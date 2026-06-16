-- Sistema de parcerias com influencers.
-- Cada influencer tem um código (o @ dele). Clientes que vierem por ele são contados.
CREATE TABLE IF NOT EXISTS parcerias (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL,                 -- nome/@ do influencer
    codigo TEXT NOT NULL,               -- código de indicação (ex: JOAODAUBER)
    comissao_por_cliente NUMERIC DEFAULT 5.00,  -- R$ por cliente ativo
    contato TEXT,                       -- whatsapp/email do influencer (pra pagar)
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parcerias_codigo ON parcerias (UPPER(codigo));

-- De onde veio cada motorista (qual influencer indicou)
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS indicado_por TEXT;
