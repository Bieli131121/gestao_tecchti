import type { Orcamento } from '@/types'
import type { OrcamentoCalcResult } from './orcamentos'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  } catch { return '—' }
}

export function buildOrcamentoPDFHtml(orc: Orcamento, calc: OrcamentoCalcResult): string {
  const itensRows = (orc.itens || []).map(i => `
    <tr>
      <td>${i.descricao}</td>
      <td class="center">${i.quantidade}</td>
      <td class="right">${fmt(i.valor_unit)}</td>
      <td class="right bold">${fmt(i.subtotal ?? i.quantidade * i.valor_unit)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: white; padding: 40px; }
  
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 2px solid #0c8fe6; margin-bottom: 28px; }
  .logo-area h1 { font-size: 26px; font-weight: 800; color: #0159a0; letter-spacing: -0.5px; }
  .logo-area p { font-size: 11px; color: #64748b; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-num { font-size: 22px; font-weight: 700; color: #0c8fe6; }
  .doc-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #dbeafe; color: #1d4ed8; margin-top: 4px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; font-weight: 600; }
  .info-box p { font-size: 13px; color: #1e293b; line-height: 1.6; }
  .info-box .name { font-weight: 700; font-size: 14px; }
  
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead th { background: #0159a0; color: white; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child { border-radius: 0 8px 0 0; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 600; }

  .totals { margin-top: 0; display: flex; justify-content: flex-end; }
  .totals-box { width: 280px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  .totals-row:last-child { background: #0159a0; color: white; padding: 12px 14px; border: none; font-weight: 700; font-size: 15px; }
  .totals-row .label { color: #64748b; }
  .totals-row:last-child .label { color: rgba(255,255,255,0.8); }

  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 10px; font-weight: 600; }
  .obs-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-size: 12px; color: #78350f; line-height: 1.6; }

  .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94a3b8; }
  .footer strong { color: #64748b; }

  .validity-row { display: flex; gap: 8px; margin-top: 4px; }
  .validity-badge { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
</style>
</head>
<body>

<div class="header">
  <div class="logo-area">
    <h1>TecchTI</h1>
    <p>Soluções de Informática — Garopaba, SC</p>
  </div>
  <div class="doc-info">
    <div class="doc-label">Orçamento</div>
    <div class="doc-num">${orc.numero}</div>
    <div class="badge">${
      orc.status === 'aprovado' ? '✓ Aprovado' :
      orc.status === 'enviado'  ? '→ Enviado'  :
      orc.status === 'recusado' ? '✗ Recusado' : 'Rascunho'
    }</div>
  </div>
</div>

<div class="grid2">
  <div class="info-box">
    <h3>Cliente</h3>
    <p class="name">${orc.cliente?.nome || '—'}</p>
    ${orc.cliente?.telefone ? `<p>Tel: ${orc.cliente.telefone}</p>` : ''}
    ${orc.cliente?.email    ? `<p>${orc.cliente.email}</p>` : ''}
    ${orc.cliente?.cidade   ? `<p>${orc.cliente.cidade}</p>` : ''}
  </div>
  <div class="info-box">
    <h3>Datas</h3>
    <p>Emissão: <strong>${fmtDate(orc.created_at?.substring(0,10))}</strong></p>
    ${orc.data_validade
      ? `<p>Válido até: <span class="validity-badge">${fmtDate(orc.data_validade)}</span></p>`
      : ''
    }
  </div>
</div>

<div class="section-title">Itens do Orçamento</div>
<table>
  <thead>
    <tr>
      <th style="width:55%">Descrição</th>
      <th class="center" style="width:10%">Qtd</th>
      <th class="right" style="width:17%">Valor Unit.</th>
      <th class="right" style="width:18%">Subtotal</th>
    </tr>
  </thead>
  <tbody>
    ${itensRows}
    ${calc.taxaUrgencia > 0 ? `
    <tr>
      <td><em>Adicional de urgência</em></td>
      <td class="center">1</td>
      <td class="right">${fmt(calc.taxaUrgencia)}</td>
      <td class="right bold">${fmt(calc.taxaUrgencia)}</td>
    </tr>` : ''}
    ${calc.deslocamento > 0 ? `
    <tr>
      <td><em>Deslocamento</em></td>
      <td class="center">1</td>
      <td class="right">${fmt(calc.deslocamento)}</td>
      <td class="right bold">${fmt(calc.deslocamento)}</td>
    </tr>` : ''}
  </tbody>
</table>

<div class="totals">
  <div class="totals-box">
    <div class="totals-row"><span class="label">Subtotal</span><span>${fmt(calc.subtotalBruto)}</span></div>
    ${calc.descontoAplicado > 0 ? `<div class="totals-row"><span class="label">Desconto</span><span>- ${fmt(calc.descontoAplicado)}</span></div>` : ''}
    <div class="totals-row"><span class="label">TOTAL</span><span>${fmt(calc.total)}</span></div>
  </div>
</div>

${orc.observacoes ? `<div class="obs-box"><strong>Observações:</strong> ${orc.observacoes}</div>` : ''}

<div class="footer">
  <div>
    <strong>TecchTI — Soluções de Informática</strong><br/>
    Garopaba, Santa Catarina
  </div>
  <div style="text-align:right">
    Orçamento ${orc.numero}<br/>
    Gerado em ${new Date().toLocaleDateString('pt-BR')}
  </div>
</div>

</body>
</html>`
}

export function printOrcamento(html: string): void {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Permita pop-ups para imprimir o orçamento.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 600)
}
