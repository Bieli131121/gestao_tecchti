import { supabase } from '@/lib/supabase'
import type { OrdemServico, OSItem, OSChecklist, OSFoto, OSStatus } from '@/types'

export const osService = {
  async list(filters?: { status?: OSStatus; tecnicoId?: string; clienteId?: string }) {
    let q = supabase
      .from('ordens_servico')
      .select(`
        *,
        cliente:clientes(id, nome, whatsapp, telefone, cidade),
        tecnico:profiles(id, nome, role)
      `)
      .order('data_abertura', { ascending: false })

    if (filters?.status)    q = q.eq('status', filters.status)
    if (filters?.tecnicoId) q = q.eq('tecnico_id', filters.tecnicoId)
    if (filters?.clienteId) q = q.eq('cliente_id', filters.clienteId)

    const { data, error } = await q
    if (error) throw error
    return data as OrdemServico[]
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select(`
        *,
        cliente:clientes(*),
        tecnico:profiles(id, nome, role),
        itens:os_itens(*, servico:servicos(id,nome), produto:produtos(id,nome,unidade)),
        checklist:os_checklist(*),
        fotos:os_fotos(*)
      `)
      .eq('id', id)
      .single()
    if (error) throw error

    // Sort checklist by ordem
    if (data.checklist) data.checklist.sort((a: OSChecklist, b: OSChecklist) => a.ordem - b.ordem)
    return data as OrdemServico
  },

  async create(payload: Partial<OrdemServico>, itens?: Partial<OSItem>[], checklist?: string[]) {
    const { data: numData } = await supabase.rpc('gerar_numero_os')
    const numero = numData as string

    const { data: os, error } = await supabase
      .from('ordens_servico')
      .insert({ ...payload, numero })
      .select()
      .single()
    if (error) throw error

    if (itens && itens.length > 0) {
      await supabase.from('os_itens').insert(itens.map(i => ({ ...i, os_id: os.id })))
    }
    if (checklist && checklist.length > 0) {
      await supabase.from('os_checklist').insert(
        checklist.map((item, i) => ({ os_id: os.id, item, ordem: i }))
      )
    }

    return os as OrdemServico
  },

  async update(id: string, payload: Partial<OrdemServico>) {
    const { data, error } = await supabase
      .from('ordens_servico')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as OrdemServico
  },

  async updateStatus(id: string, status: OSStatus) {
    return osService.update(id, { status })
  },

  async toggleChecklist(itemId: string, concluido: boolean) {
    const { error } = await supabase
      .from('os_checklist')
      .update({ concluido })
      .eq('id', itemId)
    if (error) throw error
  },

  async addChecklistItem(osId: string, item: string, ordem: number) {
    const { data, error } = await supabase
      .from('os_checklist')
      .insert({ os_id: osId, item, ordem })
      .select()
      .single()
    if (error) throw error
    return data as OSChecklist
  },

  async deleteChecklistItem(itemId: string) {
    const { error } = await supabase.from('os_checklist').delete().eq('id', itemId)
    if (error) throw error
  },

  async uploadFoto(osId: string, file: File, tipo: OSFoto['tipo'], legenda?: string) {
    const ext  = file.name.split('.').pop()
    const path = `${osId}/${tipo}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('os-fotos')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('os-fotos').getPublicUrl(path)

    const { data, error } = await supabase
      .from('os_fotos')
      .insert({ os_id: osId, tipo, url: publicUrl, legenda })
      .select()
      .single()
    if (error) throw error
    return data as OSFoto
  },

  async deleteFoto(foto: OSFoto) {
    // Extract path from URL
    const url  = new URL(foto.url)
    const path = url.pathname.split('/os-fotos/')[1]
    if (path) await supabase.storage.from('os-fotos').remove([path])
    await supabase.from('os_fotos').delete().eq('id', foto.id)
  },

  async saveAssinatura(osId: string, dataUrl: string) {
    // Convert data URL to blob
    const res  = await fetch(dataUrl)
    const blob = await res.blob()
    const path = `${osId}/assinatura.png`

    await supabase.storage.from('assinaturas').upload(path, blob, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('assinaturas').getPublicUrl(path)

    return osService.update(osId, {
      assinatura_url: publicUrl,
      assinado_em: new Date().toISOString(),
    })
  },

  async listTecnicos() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, role')
      .in('role', ['admin', 'tecnico'])
      .eq('ativo', true)
      .order('nome')
    if (error) throw error
    return data
  },

  // Build PDF OS
  buildOSPDFHtml(os: OrdemServico): string {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
    const fmtDateTime = (d?: string | null) => d
      ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

    const STATUS_LABEL: Record<string, string> = {
      aberto: 'Aberto', em_andamento: 'Em andamento',
      concluido: 'Concluído', cancelado: 'Cancelado', pausado: 'Pausado',
    }

    const itensRows = (os.itens || []).map(i => `
      <tr>
        <td>${i.tipo === 'servico' ? '🔧' : '📦'} ${i.descricao}</td>
        <td class="center">${i.quantidade}</td>
        <td class="right">${fmt(i.valor_unit)}</td>
        <td class="right bold">${fmt(i.subtotal ?? i.quantidade * i.valor_unit)}</td>
      </tr>
    `).join('')

    const checklistRows = (os.checklist || []).map(c => `
      <div class="checklist-item ${c.concluido ? 'done' : ''}">
        <span class="check">${c.concluido ? '✓' : '○'}</span>
        <span>${c.item}</span>
      </div>
    `).join('')

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;padding:36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0c8fe6;padding-bottom:20px;margin-bottom:24px}
  .logo h1{font-size:22px;font-weight:800;color:#0159a0}
  .logo p{font-size:11px;color:#64748b;margin-top:2px}
  .doc-info{text-align:right}
  .os-num{font-size:20px;font-weight:700;color:#0c8fe6}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-top:4px;background:#dbeafe;color:#1d4ed8}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
  .box h3{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px;font-weight:600}
  .box p{font-size:13px;line-height:1.6;color:#1e293b}
  .section{margin-bottom:20px}
  .section-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px;font-weight:600}
  table{width:100%;border-collapse:collapse}
  thead th{background:#0159a0;color:white;padding:8px 12px;font-size:11px;text-transform:uppercase;font-weight:600}
  tbody tr:nth-child(even) td{background:#f8fafc}
  tbody td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
  .center{text-align:center}.right{text-align:right}.bold{font-weight:600}
  .totals-box{margin-top:0;display:flex;justify-content:flex-end}
  .totals{width:240px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px}
  .t-row{display:flex;justify-content:space-between;padding:7px 12px;font-size:13px;border-bottom:1px solid #f1f5f9}
  .t-row.total{background:#0159a0;color:white;font-weight:700;font-size:15px;border:none}
  .t-row .lbl{color:#64748b}.t-row.total .lbl{color:rgba(255,255,255,.7)}
  .checklist-item{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .checklist-item .check{font-size:14px;width:18px;text-align:center}
  .checklist-item.done{color:#64748b;text-decoration:line-through}
  .sign-box{border:1px dashed #e2e8f0;border-radius:8px;padding:12px;min-height:90px;display:flex;align-items:center;justify-content:center}
  .footer{margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
</style></head><body>

<div class="header">
  <div class="logo">
    <h1>TecchTI</h1>
    <p>Soluções de Informática — Garopaba, SC</p>
  </div>
  <div class="doc-info">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Ordem de Serviço</div>
    <div class="os-num">OS #${os.numero}</div>
    <div class="badge">${STATUS_LABEL[os.status] || os.status}</div>
  </div>
</div>

<div class="grid2">
  <div class="box">
    <h3>Cliente</h3>
    <p><strong>${os.cliente?.nome || '—'}</strong></p>
    ${os.cliente?.telefone ? `<p>${os.cliente.telefone}</p>` : ''}
    ${os.cliente?.cidade   ? `<p>${os.cliente.cidade}</p>` : ''}
  </div>
  <div class="box">
    <h3>Informações</h3>
    <p>Abertura: <strong>${fmtDateTime(os.data_abertura)}</strong></p>
    ${os.tecnico ? `<p>Técnico: <strong>${os.tecnico.nome}</strong></p>` : ''}
    ${os.data_conclusao ? `<p>Conclusão: <strong>${fmtDateTime(os.data_conclusao)}</strong></p>` : ''}
    <p>Prioridade: <strong>${os.prioridade}</strong></p>
  </div>
</div>

<div class="section">
  <div class="section-title">Descrição do Serviço</div>
  <div class="box"><p>${os.descricao || os.titulo}</p></div>
</div>

${os.checklist && os.checklist.length > 0 ? `
<div class="section">
  <div class="section-title">Checklist</div>
  <div class="box" style="padding:8px 14px">${checklistRows}</div>
</div>` : ''}

${os.itens && os.itens.length > 0 ? `
<div class="section">
  <div class="section-title">Itens e Materiais</div>
  <table>
    <thead><tr><th>Descrição</th><th class="center">Qtd</th><th class="right">Valor Unit.</th><th class="right">Subtotal</th></tr></thead>
    <tbody>${itensRows}</tbody>
  </table>
  <div class="totals-box">
    <div class="totals">
      ${os.desconto > 0 ? `<div class="t-row"><span class="lbl">Desconto</span><span>-${fmt(os.desconto)}</span></div>` : ''}
      <div class="t-row total"><span class="lbl">TOTAL</span><span>${fmt(os.valor_total)}</span></div>
    </div>
  </div>
</div>` : ''}

${os.observacoes ? `
<div class="section">
  <div class="section-title">Observações</div>
  <div class="box"><p>${os.observacoes}</p></div>
</div>` : ''}

<div class="grid2" style="margin-top:20px">
  <div class="box">
    <div class="section-title">Assinatura do Cliente</div>
    <div class="sign-box">
      ${os.assinatura_url
        ? `<img src="${os.assinatura_url}" style="max-height:80px;max-width:200px"/>`
        : '<span style="color:#94a3b8;font-size:12px">Sem assinatura</span>'
      }
    </div>
    <p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:6px">${os.cliente?.nome || ''}</p>
  </div>
  <div class="box">
    <div class="section-title">Responsável Técnico</div>
    <div class="sign-box"><span style="color:#94a3b8;font-size:12px">_________________________</span></div>
    <p style="font-size:10px;color:#94a3b8;text-align:center;margin-top:6px">${os.tecnico?.nome || 'TecchTI'}</p>
  </div>
</div>

<div class="footer">
  <div>TecchTI — Soluções de Informática | Garopaba, SC</div>
  <div>OS #${os.numero} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
</div>
</body></html>`
  }
}
