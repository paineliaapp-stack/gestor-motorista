-- Tabela de investimentos de marketing do negócio (aba Marketing do admin).
-- O endpoint /admin/marketing já existia, mas a tabela nunca foi criada — por isso
-- o botão "Registrar gasto" não salvava nada.
CREATE TABLE IF NOT EXISTS marketing_investimentos (
    id BIGSERIAL PRIMARY KEY,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    categoria TEXT NOT NULL DEFAULT 'Outros',
    valor NUMERIC NOT NULL,
    descricao TEXT DEFAULT '',
    criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_data ON marketing_investimentos (data);
