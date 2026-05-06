-- =============================================================
-- TECCHTI — SISTEMA DE GESTÃO
-- Supabase / PostgreSQL Migration — v1.0
-- Execute no SQL Editor: app.supabase.com → SQL Editor
-- =============================================================

-- ===== EXTENSÕES =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================
-- 1. PROFILES (extensão do auth.users)
-- =============================================================
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

-- Trigger: criar perfil automaticamente ao criar usuário no auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================
-- 2. CLIENTES
-- =============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                TEXT NOT NULL DEFAULT 'pf' CHECK (tipo IN ('pf','pj')),
  nome                TEXT NOT NULL,
  cpf_cnpj            TEXT,
  telefone            TEXT,
  whatsapp            TEXT,
  email               TEXT,
  cep                 TEXT,
  logradouro          TEXT,
  numero              TEXT,
  complemento         TEXT,
  bairro              TEXT,
  cidade              TEXT,
  estado              TEXT,
  inscricao_estadual  TEXT,
  inscricao_municipal TEXT,
  observacoes         TEXT,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_clientes_nome     ON clientes USING gin(to_tsvector('portuguese', nome));
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo    ON clientes (ativo);

-- =============================================================
-- 3. CATEGORIAS E SERVIÇOS
-- =============================================================
CREATE TABLE IF NOT EXISTS categorias_servico (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome   TEXT NOT NULL,
  icone  TEXT,
  cor    TEXT DEFAULT '#3b82f6',
  ativo  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS servicos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id        UUID REFERENCES categorias_servico(id) ON DELETE SET NULL,
  nome                TEXT NOT NULL,
  descricao           TEXT,
  valor_base          NUMERIC(10,2) NOT NULL DEFAULT 0,
  tempo_medio_minutos INTEGER DEFAULT 60,
  custo_estimado      NUMERIC(10,2) NOT NULL DEFAULT 0,
  margem_lucro_pct    NUMERIC(5,2) NOT NULL DEFAULT 40,
  taxa_urgencia_pct   NUMERIC(5,2) NOT NULL DEFAULT 50,
  taxa_deslocamento   NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicos_categoria ON servicos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo     ON servicos (ativo);

-- =============================================================
-- 4. PRODUTOS / ESTOQUE
-- =============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  categoria       TEXT CHECK (categoria IN ('camera','dvr','cabo','conector','fonte','computador','rede','outro')),
  codigo          TEXT UNIQUE,
  unidade         TEXT NOT NULL DEFAULT 'un',
  preco_custo     NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_venda     NUMERIC(10,2) NOT NULL DEFAULT 0,
  estoque_atual   NUMERIC(10,3) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(10,3) NOT NULL DEFAULT 0,
  localizacao     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER produtos_updated_at BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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

-- Trigger: atualizar estoque_atual ao registrar movimento
CREATE OR REPLACE FUNCTION atualizar_estoque()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo IN ('entrada', 'ajuste') THEN
    UPDATE produtos SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.produto_id;
  ELSIF NEW.tipo IN ('saida', 'uso_os') THEN
    UPDATE produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_estoque ON estoque_movimentos;
CREATE TRIGGER trigger_atualizar_estoque
  AFTER INSERT ON estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION atualizar_estoque();

-- =============================================================
-- 5. ORÇAMENTOS
-- =============================================================
CREATE TABLE IF NOT EXISTS orcamentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT NOT NULL UNIQUE,
  cliente_id        UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  criado_por        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','enviado','aprovado','recusado','expirado')),
  data_validade     DATE,
  subtotal          NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  desconto_valor    NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_deslocamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  taxa_urgencia     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacoes       TEXT,
  pdf_url           TEXT,
  enviado_whatsapp  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER orcamentos_updated_at BEFORE UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  UUID NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  servico_id    UUID REFERENCES servicos(id) ON DELETE SET NULL,
  descricao     TEXT NOT NULL,
  quantidade    NUMERIC(8,2) NOT NULL DEFAULT 1,
  valor_unit    NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * valor_unit) STORED
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status  ON orcamentos (status);

-- =============================================================
-- 6. ORDENS DE SERVIÇO
-- =============================================================
CREATE TABLE IF NOT EXISTS ordens_servico (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL UNIQUE,
  cliente_id       UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  tecnico_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  orcamento_id     UUID REFERENCES orcamentos(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'aberto'
                   CHECK (status IN ('aberto','em_andamento','concluido','cancelado','pausado')),
  prioridade       TEXT NOT NULL DEFAULT 'normal'
                   CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  titulo           TEXT NOT NULL,
  descricao        TEXT,
  data_abertura    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_previsao    TIMESTAMPTZ,
  data_conclusao   TIMESTAMPTZ,
  valor_servico    NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_materiais  NUMERIC(10,2) NOT NULL DEFAULT 0,
  desconto         NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento  TEXT,
  pago             BOOLEAN NOT NULL DEFAULT FALSE,
  assinatura_url   TEXT,
  assinado_em      TIMESTAMPTZ,
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER os_updated_at BEFORE UPDATE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id      UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  item       TEXT NOT NULL,
  concluido  BOOLEAN NOT NULL DEFAULT FALSE,
  ordem      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS os_fotos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id      UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('antes','depois','geral')),
  url        TEXT NOT NULL,
  legenda    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_cliente   ON ordens_servico (cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_tecnico   ON ordens_servico (tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_status    ON ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_os_abertura  ON ordens_servico (data_abertura DESC);

-- Trigger: ao concluir OS, registrar data_conclusao
CREATE OR REPLACE FUNCTION handle_os_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    NEW.data_conclusao = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_os_status_change ON ordens_servico;
CREATE TRIGGER trigger_os_status_change
  BEFORE UPDATE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION handle_os_status_change();

-- =============================================================
-- 7. FINANCEIRO
-- =============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria       TEXT,
  descricao       TEXT NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  pago            BOOLEAN NOT NULL DEFAULT FALSE,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro','pix','cartao_debito','cartao_credito','transferencia','boleto','cheque')),
  os_id           UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,
  fornecedor      TEXT,
  recorrente      BOOLEAN NOT NULL DEFAULT FALSE,
  parcela_atual   INTEGER NOT NULL DEFAULT 1,
  total_parcelas  INTEGER NOT NULL DEFAULT 1,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_tipo        ON financeiro_lancamentos (tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento  ON financeiro_lancamentos (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_pago        ON financeiro_lancamentos (pago);
CREATE INDEX IF NOT EXISTS idx_financeiro_os          ON financeiro_lancamentos (os_id);

-- =============================================================
-- 8. CONFIGURAÇÕES DA EMPRESA
-- =============================================================
CREATE TABLE IF NOT EXISTS empresa_config (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social             TEXT,
  nome_fantasia            TEXT DEFAULT 'TecchTI',
  cnpj                     TEXT,
  inscricao_municipal      TEXT,
  regime_tributario        TEXT DEFAULT 'simples_nacional',
  endereco                 JSONB DEFAULT '{}',
  contato                  JSONB DEFAULT '{}',
  logo_url                 TEXT,
  proximo_num_os           INTEGER NOT NULL DEFAULT 1,
  proximo_num_orcamento    INTEGER NOT NULL DEFAULT 1,
  certificado_digital_info JSONB,
  ambiente_nfse            TEXT DEFAULT 'homologacao',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER empresa_config_updated_at BEFORE UPDATE ON empresa_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- 9. FUNÇÕES UTILITÁRIAS
-- =============================================================

-- Gera próximo número de OS
CREATE OR REPLACE FUNCTION gerar_numero_os()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  config  empresa_config%ROWTYPE;
  num     INTEGER;
BEGIN
  SELECT * INTO config FROM empresa_config LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO empresa_config DEFAULT VALUES RETURNING * INTO config;
  END IF;
  num := config.proximo_num_os;
  UPDATE empresa_config SET proximo_num_os = num + 1;
  RETURN LPAD(num::TEXT, 5, '0');
END;
$$;

-- Gera próximo número de orçamento
CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  config  empresa_config%ROWTYPE;
  num     INTEGER;
BEGIN
  SELECT * INTO config FROM empresa_config LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO empresa_config DEFAULT VALUES RETURNING * INTO config;
  END IF;
  num := config.proximo_num_orcamento;
  UPDATE empresa_config SET proximo_num_orcamento = num + 1;
  RETURN 'ORC-' || LPAD(num::TEXT, 4, '0');
END;
$$;

-- =============================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- =============================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_servico    ENABLE ROW LEVEL SECURITY;
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

-- Função: role do usuário logado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- PROFILES
CREATE POLICY "profiles_self_read"   ON profiles FOR SELECT USING (id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all"   ON profiles FOR ALL   USING (get_user_role() = 'admin');

-- CLIENTES (todos leem, admin/vendedor escrevem)
CREATE POLICY "clientes_read_all"    ON clientes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "clientes_write"       ON clientes FOR INSERT USING (get_user_role() IN ('admin','vendedor','tecnico'));
CREATE POLICY "clientes_update"      ON clientes FOR UPDATE USING (get_user_role() IN ('admin','vendedor','tecnico'));
CREATE POLICY "clientes_admin_delete" ON clientes FOR DELETE USING (get_user_role() = 'admin');

-- SERVIÇOS E CATEGORIAS (todos leem, admin escreve)
CREATE POLICY "servicos_read"  ON servicos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "servicos_write" ON servicos FOR ALL    USING (get_user_role() IN ('admin','vendedor'));
CREATE POLICY "cats_read"      ON categorias_servico FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "cats_write"     ON categorias_servico FOR ALL    USING (get_user_role() IN ('admin','vendedor'));

-- PRODUTOS
CREATE POLICY "produtos_read"  ON produtos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "produtos_write" ON produtos FOR ALL    USING (get_user_role() IN ('admin','financeiro'));
CREATE POLICY "estoque_mov_read"  ON estoque_movimentos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "estoque_mov_write" ON estoque_movimentos FOR INSERT USING (get_user_role() IN ('admin','financeiro','tecnico'));

-- ORÇAMENTOS
CREATE POLICY "orcamentos_read"  ON orcamentos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "orcamentos_write" ON orcamentos FOR ALL    USING (get_user_role() IN ('admin','vendedor'));
CREATE POLICY "orc_itens_read"   ON orcamento_itens FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "orc_itens_write"  ON orcamento_itens FOR ALL    USING (get_user_role() IN ('admin','vendedor'));

-- OS (técnico gerencia as próprias, admin gerencia todas)
CREATE POLICY "os_read_all"    ON ordens_servico FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "os_write_admin" ON ordens_servico FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "os_write_tech"  ON ordens_servico FOR UPDATE
  USING (get_user_role() = 'tecnico' AND tecnico_id = auth.uid());
CREATE POLICY "os_insert_tech" ON ordens_servico FOR INSERT
  USING (get_user_role() IN ('admin','tecnico','vendedor'));

CREATE POLICY "os_itens_all"     ON os_itens     FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "os_checklist_all" ON os_checklist FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "os_fotos_all"     ON os_fotos     FOR ALL USING (auth.uid() IS NOT NULL);

-- FINANCEIRO (admin e financeiro)
CREATE POLICY "financeiro_all" ON financeiro_lancamentos FOR ALL
  USING (get_user_role() IN ('admin','financeiro'));

-- EMPRESA CONFIG (admin apenas)
CREATE POLICY "empresa_config_all" ON empresa_config FOR ALL USING (get_user_role() = 'admin');

-- =============================================================
-- 11. STORAGE BUCKETS
-- =============================================================
-- Execute no painel do Supabase: Storage → New bucket

-- Bucket: os-fotos (público para leitura)
-- Bucket: assinaturas (privado)
-- Bucket: pdfs (privado)
-- Bucket: logos (público)

-- =============================================================
-- 12. DADOS INICIAIS (SEED)
-- =============================================================

-- Configuração inicial da empresa
INSERT INTO empresa_config (nome_fantasia, razao_social)
VALUES ('TecchTI', 'TecchTI Soluções de Informática')
ON CONFLICT DO NOTHING;

-- Categorias de serviço padrão TecchTI
INSERT INTO categorias_servico (nome, cor) VALUES
  ('Câmeras e CFTV',       '#3b82f6'),
  ('Redes e Infraestrutura','#10b981'),
  ('Computadores e TI',    '#8b5cf6'),
  ('DVR e NVR',            '#f59e0b'),
  ('Elétrica e Instalação','#ef4444'),
  ('Suporte Remoto',       '#06b6d4')
ON CONFLICT DO NOTHING;

-- Serviços iniciais TecchTI (após inserir categorias, ajuste os IDs)
-- Execute separadamente após verificar os IDs das categorias:
/*
INSERT INTO servicos (nome, valor_base, custo_estimado, margem_lucro_pct, tempo_medio_minutos, taxa_deslocamento)
SELECT 'Instalação de câmera IP', 150, 30, 80, 120, 0 WHERE EXISTS (SELECT 1 FROM categorias_servico LIMIT 1);
*/

-- =============================================================
-- FIM DA MIGRATION
-- =============================================================
-- Próximos passos:
-- 1. Crie o primeiro usuário em Authentication → Users
-- 2. Na tabela profiles, atualize o role para 'admin'
-- 3. Crie os buckets de storage listados acima
-- 4. Configure as variáveis de ambiente no .env.local
-- =============================================================
