-- ============================================================
-- TECCHTI — SISTEMA DE GESTÃO
-- Script de configuração do banco de dados (Supabase/PostgreSQL)
-- Execute no Supabase SQL Editor: app.supabase.com → SQL Editor
-- ============================================================

-- ============================================================
-- 1. PERFIS DE USUÁRIO (extensão do auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL,
  telefone      TEXT,
  role          TEXT NOT NULL DEFAULT 'tecnico'
                CHECK (role IN ('admin','tecnico','financeiro','vendedor')),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-criar profile quando usuário é criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL DEFAULT 'pf' CHECK (tipo IN ('pf','pj')),
  nome          TEXT NOT NULL,
  cpf_cnpj      TEXT,
  telefone      TEXT,
  whatsapp      TEXT,
  email         TEXT,
  cep           TEXT,
  logradouro    TEXT,
  numero        TEXT,
  complemento   TEXT,
  bairro        TEXT,
  cidade        TEXT,
  estado        TEXT,
  inscricao_estadual  TEXT,
  inscricao_municipal TEXT,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes USING gin(to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);

-- ============================================================
-- 3. CATEGORIAS E SERVIÇOS
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias_servico (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome     TEXT NOT NULL,
  icone    TEXT,
  cor      TEXT,
  ativo    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS servicos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id        UUID REFERENCES categorias_servico(id) ON DELETE SET NULL,
  nome                TEXT NOT NULL,
  descricao           TEXT,
  valor_base          NUMERIC(10,2) NOT NULL DEFAULT 0,
  tempo_medio_minutos INTEGER,
  custo_estimado      NUMERIC(10,2) DEFAULT 0,
  margem_lucro_pct    NUMERIC(5,2) DEFAULT 40,
  taxa_urgencia_pct   NUMERIC(5,2) DEFAULT 50,
  taxa_deslocamento   NUMERIC(10,2) DEFAULT 0,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. PRODUTOS E ESTOQUE
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  categoria       TEXT,
  codigo          TEXT UNIQUE,
  unidade         TEXT DEFAULT 'un',
  preco_custo     NUMERIC(10,2) DEFAULT 0,
  preco_venda     NUMERIC(10,2) DEFAULT 0,
  estoque_atual   NUMERIC(10,3) DEFAULT 0,
  estoque_minimo  NUMERIC(10,3) DEFAULT 0,
  localizacao     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id   UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo         TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','uso_os')),
  quantidade   NUMERIC(10,3) NOT NULL,
  valor_unit   NUMERIC(10,2),
  os_id        UUID,
  observacao   TEXT,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: atualizar estoque_atual ao movimentar
CREATE OR REPLACE FUNCTION update_estoque_atual()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo IN ('entrada', 'ajuste') THEN
    UPDATE produtos SET estoque_atual = estoque_atual + NEW.quantidade,
      updated_at = NOW() WHERE id = NEW.produto_id;
  ELSIF NEW.tipo IN ('saida', 'uso_os') THEN
    UPDATE produtos SET estoque_atual = GREATEST(0, estoque_atual - NEW.quantidade),
      updated_at = NOW() WHERE id = NEW.produto_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_estoque_movimento ON estoque_movimentos;
CREATE TRIGGER on_estoque_movimento
  AFTER INSERT ON estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION update_estoque_atual();

-- ============================================================
-- 5. ORÇAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS orcamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  criado_por      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','enviado','aprovado','recusado','expirado')),
  data_validade   DATE,
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto_pct    NUMERIC(5,2) DEFAULT 0,
  desconto_valor  NUMERIC(10,2) DEFAULT 0,
  taxa_deslocamento NUMERIC(10,2) DEFAULT 0,
  taxa_urgencia   NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacoes     TEXT,
  pdf_url         TEXT,
  enviado_whatsapp BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  servico_id    UUID REFERENCES servicos(id) ON DELETE SET NULL,
  descricao     TEXT NOT NULL,
  quantidade    NUMERIC(8,2) NOT NULL DEFAULT 1,
  valor_unit    NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * valor_unit) STORED
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);

-- ============================================================
-- 6. ORDENS DE SERVIÇO
-- ============================================================
CREATE TABLE IF NOT EXISTS ordens_servico (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL UNIQUE,
  cliente_id       UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  tecnico_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  orcamento_id     UUID REFERENCES orcamentos(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'aberto'
                   CHECK (status IN ('aberto','em_andamento','concluido','cancelado','pausado')),
  prioridade       TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  data_abertura    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_previsao    TIMESTAMPTZ,
  data_conclusao   TIMESTAMPTZ,
  valor_servico    NUMERIC(10,2) DEFAULT 0,
  valor_materiais  NUMERIC(10,2) DEFAULT 0,
  desconto         NUMERIC(10,2) DEFAULT 0,
  valor_total      NUMERIC(10,2) DEFAULT 0,
  forma_pagamento  TEXT,
  pago             BOOLEAN DEFAULT FALSE,
  assinatura_url   TEXT,
  assinado_em      TIMESTAMPTZ,
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS os_itens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id        UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('servico','material')),
  servico_id   UUID REFERENCES servicos(id) ON DELETE SET NULL,
  produto_id   UUID REFERENCES produtos(id) ON DELETE SET NULL,
  descricao    TEXT NOT NULL,
  quantidade   NUMERIC(8,2) NOT NULL DEFAULT 1,
  valor_unit   NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal     NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * valor_unit) STORED
);

CREATE TABLE IF NOT EXISTS os_checklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id       UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  item        TEXT NOT NULL,
  concluido   BOOLEAN DEFAULT FALSE,
  ordem       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS os_fotos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id       UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('antes','depois','geral')),
  url         TEXT NOT NULL,
  legenda     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_cliente ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_tecnico ON ordens_servico(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_data ON ordens_servico(data_abertura DESC);

-- ============================================================
-- 7. FINANCEIRO
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria      TEXT,
  descricao      TEXT NOT NULL,
  valor          NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  pago            BOOLEAN DEFAULT FALSE,
  forma_pagamento TEXT,
  os_id           UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,
  fornecedor      TEXT,
  recorrente      BOOLEAN DEFAULT FALSE,
  parcela_atual   INTEGER DEFAULT 1,
  total_parcelas  INTEGER DEFAULT 1,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento ON financeiro_lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON financeiro_lancamentos(tipo, pago);

-- ============================================================
-- 8. CONFIGURAÇÕES DA EMPRESA
-- ============================================================
CREATE TABLE IF NOT EXISTS empresa_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social          TEXT,
  nome_fantasia         TEXT DEFAULT 'TecchTI',
  cnpj                  TEXT,
  inscricao_municipal   TEXT,
  regime_tributario     TEXT DEFAULT 'simples_nacional',
  endereco              JSONB DEFAULT '{}',
  contato               JSONB DEFAULT '{}',
  logo_url              TEXT,
  proximo_num_os        INTEGER DEFAULT 1,
  proximo_num_orcamento INTEGER DEFAULT 1,
  certificado_digital_info JSONB,
  ambiente_nfse         TEXT DEFAULT 'homologacao',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir configuração inicial
INSERT INTO empresa_config (razao_social, nome_fantasia)
VALUES ('TecchTI Soluções de Informática', 'TecchTI')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_servico    ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_itens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico        ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_itens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_checklist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_fotos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_config        ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter role do usuário logado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Função auxiliar para verificar se usuário está ativo
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS BOOLEAN AS $$
  SELECT ativo FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES: cada usuário vê o próprio; admin vê todos
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (get_user_role() = 'admin' OR id = auth.uid());

-- CLIENTES: todos os usuários ativos leem; admin e tecnico e vendedor inserem/atualizam
DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes FOR SELECT
  USING (is_active_user() = TRUE);

DROP POLICY IF EXISTS "clientes_insert" ON clientes;
CREATE POLICY "clientes_insert" ON clientes FOR INSERT
  WITH CHECK (get_user_role() IN ('admin','tecnico','vendedor'));

DROP POLICY IF EXISTS "clientes_update" ON clientes;
CREATE POLICY "clientes_update" ON clientes FOR UPDATE
  USING (get_user_role() IN ('admin','tecnico','vendedor'));

DROP POLICY IF EXISTS "clientes_delete" ON clientes;
CREATE POLICY "clientes_delete" ON clientes FOR DELETE
  USING (get_user_role() = 'admin');

-- SERVIÇOS e CATEGORIAS: leitura para todos, escrita para admin
DROP POLICY IF EXISTS "servicos_select" ON servicos;
CREATE POLICY "servicos_select" ON servicos FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "servicos_write" ON servicos;
CREATE POLICY "servicos_write" ON servicos FOR ALL USING (get_user_role() IN ('admin','vendedor'));

DROP POLICY IF EXISTS "categorias_select" ON categorias_servico;
CREATE POLICY "categorias_select" ON categorias_servico FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "categorias_write" ON categorias_servico;
CREATE POLICY "categorias_write" ON categorias_servico FOR ALL USING (get_user_role() = 'admin');

-- PRODUTOS e ESTOQUE: leitura para todos; admin e financeiro escrevem
DROP POLICY IF EXISTS "produtos_select" ON produtos;
CREATE POLICY "produtos_select" ON produtos FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "produtos_write" ON produtos;
CREATE POLICY "produtos_write" ON produtos FOR ALL USING (get_user_role() IN ('admin','financeiro'));

DROP POLICY IF EXISTS "estoque_select" ON estoque_movimentos;
CREATE POLICY "estoque_select" ON estoque_movimentos FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "estoque_write" ON estoque_movimentos;
CREATE POLICY "estoque_write" ON estoque_movimentos FOR INSERT WITH CHECK (get_user_role() IN ('admin','financeiro','tecnico'));

-- ORÇAMENTOS: todos leem; vendedor/admin/tecnico criam; admin atualiza status
DROP POLICY IF EXISTS "orcamentos_select" ON orcamentos;
CREATE POLICY "orcamentos_select" ON orcamentos FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "orcamentos_write" ON orcamentos;
CREATE POLICY "orcamentos_write" ON orcamentos FOR ALL
  USING (get_user_role() IN ('admin','vendedor','tecnico'));

DROP POLICY IF EXISTS "orcamento_itens_select" ON orcamento_itens;
CREATE POLICY "orcamento_itens_select" ON orcamento_itens FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "orcamento_itens_write" ON orcamento_itens;
CREATE POLICY "orcamento_itens_write" ON orcamento_itens FOR ALL
  USING (get_user_role() IN ('admin','vendedor','tecnico'));

-- ORDENS DE SERVIÇO: admin vê todas; tecnico vê as suas
DROP POLICY IF EXISTS "os_admin_all" ON ordens_servico;
CREATE POLICY "os_admin_all" ON ordens_servico FOR ALL
  USING (get_user_role() IN ('admin','financeiro'));

DROP POLICY IF EXISTS "os_tecnico_own" ON ordens_servico;
CREATE POLICY "os_tecnico_own" ON ordens_servico FOR SELECT
  USING (get_user_role() = 'tecnico' AND tecnico_id = auth.uid());

DROP POLICY IF EXISTS "os_tecnico_update_own" ON ordens_servico;
CREATE POLICY "os_tecnico_update_own" ON ordens_servico FOR UPDATE
  USING (get_user_role() = 'tecnico' AND tecnico_id = auth.uid());

DROP POLICY IF EXISTS "os_tecnico_insert" ON ordens_servico;
CREATE POLICY "os_tecnico_insert" ON ordens_servico FOR INSERT
  WITH CHECK (get_user_role() IN ('admin','tecnico','vendedor'));

-- OS_ITENS, CHECKLIST, FOTOS
DROP POLICY IF EXISTS "os_itens_select" ON os_itens;
CREATE POLICY "os_itens_select" ON os_itens FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "os_itens_write" ON os_itens;
CREATE POLICY "os_itens_write" ON os_itens FOR ALL USING (is_active_user() = TRUE);

DROP POLICY IF EXISTS "os_checklist_all" ON os_checklist;
CREATE POLICY "os_checklist_all" ON os_checklist FOR ALL USING (is_active_user() = TRUE);

DROP POLICY IF EXISTS "os_fotos_all" ON os_fotos;
CREATE POLICY "os_fotos_all" ON os_fotos FOR ALL USING (is_active_user() = TRUE);

-- FINANCEIRO: apenas admin e financeiro
DROP POLICY IF EXISTS "financeiro_select" ON financeiro_lancamentos;
CREATE POLICY "financeiro_select" ON financeiro_lancamentos FOR SELECT
  USING (get_user_role() IN ('admin','financeiro'));
DROP POLICY IF EXISTS "financeiro_write" ON financeiro_lancamentos;
CREATE POLICY "financeiro_write" ON financeiro_lancamentos FOR ALL
  USING (get_user_role() IN ('admin','financeiro'));

-- EMPRESA CONFIG: apenas admin
DROP POLICY IF EXISTS "empresa_config_select" ON empresa_config;
CREATE POLICY "empresa_config_select" ON empresa_config FOR SELECT USING (is_active_user() = TRUE);
DROP POLICY IF EXISTS "empresa_config_write" ON empresa_config;
CREATE POLICY "empresa_config_write" ON empresa_config FOR ALL USING (get_user_role() = 'admin');

-- ============================================================
-- 10. STORAGE BUCKETS
-- ============================================================
-- Execute manualmente no painel do Supabase: Storage → New bucket
-- Ou use a API do Supabase Studio:

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('os-fotos', 'os-fotos', false),
  ('assinaturas', 'assinaturas', false),
  ('orcamentos-pdf', 'orcamentos-pdf', false),
  ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage
DROP POLICY IF EXISTS "os_fotos_upload" ON storage.objects;
CREATE POLICY "os_fotos_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'os-fotos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "os_fotos_read" ON storage.objects;
CREATE POLICY "os_fotos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'os-fotos' AND auth.role() = 'authenticated');

-- ============================================================
-- 11. DADOS INICIAIS — CATEGORIAS DE SERVIÇO
-- ============================================================
INSERT INTO categorias_servico (nome, icone, cor) VALUES
  ('Câmeras de Segurança', 'camera', '#3b82f6'),
  ('DVR / NVR', 'monitor', '#8b5cf6'),
  ('Redes', 'wifi', '#10b981'),
  ('Computadores', 'monitor', '#f59e0b'),
  ('Manutenção Geral', 'wrench', '#6b7280'),
  ('Instalações', 'tool', '#ef4444'),
  ('Suporte Remoto', 'headphones', '#0ea5e9'),
  ('Software', 'code', '#84cc16')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. SERVIÇOS EXEMPLO
-- ============================================================
INSERT INTO servicos (categoria_id, nome, valor_base, custo_estimado, margem_lucro_pct, tempo_medio_minutos) 
SELECT c.id, s.nome, s.valor_base, s.custo, s.margem, s.tempo
FROM (VALUES
  ('Câmeras de Segurança', 'Instalação de câmera IP', 120.00, 30.00, 75, 60),
  ('Câmeras de Segurança', 'Instalação de câmera analógica', 80.00, 20.00, 75, 45),
  ('Câmeras de Segurança', 'Configuração de DVR', 150.00, 0.00, 100, 90),
  ('Câmeras de Segurança', 'Acesso remoto câmeras', 80.00, 0.00, 100, 60),
  ('Redes', 'Configuração de roteador/switch', 100.00, 0.00, 100, 60),
  ('Redes', 'Passagem de cabo de rede (por ponto)', 80.00, 15.00, 80, 60),
  ('Redes', 'Configuração de rede Wi-Fi', 120.00, 0.00, 100, 60),
  ('Computadores', 'Formatação e instalação Windows', 150.00, 0.00, 100, 120),
  ('Computadores', 'Limpeza e manutenção preventiva', 80.00, 5.00, 90, 60),
  ('Computadores', 'Instalação de SSD', 80.00, 0.00, 100, 30),
  ('Manutenção Geral', 'Diagnóstico técnico', 60.00, 0.00, 100, 30),
  ('Suporte Remoto', 'Suporte remoto (até 1h)', 80.00, 0.00, 100, 60)
) AS s(cat, nome, valor_base, custo, margem, tempo)
JOIN categorias_servico c ON c.nome = s.cat
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIM DO SCRIPT
-- Execute e confirme que todas as tabelas foram criadas
-- em Database → Tables no painel do Supabase
-- ============================================================
