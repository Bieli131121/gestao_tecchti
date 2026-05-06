# TecchTI — Sistema de Gestão Completo

Sistema completo para empresa de TI, câmeras, redes e serviços técnicos.
**Stack:** React 18 + Vite + TypeScript + Tailwind CSS + Supabase

## Configuração rápida

```bash
npm install
cp .env.example .env.local   # preencher com chaves do Supabase
npm run dev
```

Execute `supabase-migration.sql` no SQL Editor do Supabase antes de usar.

## Deploy Vercel

```bash
npm run build && vercel --prod
```

Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis da Vercel.

## Módulos

| Módulo | Status |
|--------|--------|
| Auth + Dashboard | ✅ |
| Clientes + Serviços | ✅ |
| Orçamentos (PDF + WhatsApp) | ✅ |
| OS (checklist + fotos + assinatura) | ✅ |
| Financeiro (fluxo de caixa) | ✅ |
| Estoque (movimentações + alertas) | ✅ |
| Relatórios (rankings + PDF) | ✅ |
| Configurações (empresa + usuários) | ✅ |

**TecchTI — Soluções de Informática | Garopaba, SC**
