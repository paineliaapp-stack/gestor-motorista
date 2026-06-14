-- Investimentos de marketing registrados manualmente pelo admin
CREATE TABLE IF NOT EXISTS marketing_investimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    categoria TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mkt_data ON marketing_investimentos(data);
