-- Leads capturados na landing page (antes de virar usuário).
-- Não exige verificação — só anota o contato para remarketing.
CREATE TABLE IF NOT EXISTS leads_captura (
    id BIGSERIAL PRIMARY KEY,
    contato TEXT NOT NULL,              -- email ou whatsapp
    tipo TEXT DEFAULT 'email',          -- 'email' ou 'whatsapp'
    plano_interesse TEXT,               -- fundador/pro (qual plano clicou)
    origem TEXT DEFAULT 'landing',      -- de onde veio
    virou_usuario BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT now()
);
-- Evita duplicar o mesmo contato
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_contato ON leads_captura (contato);
