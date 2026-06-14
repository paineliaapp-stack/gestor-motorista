-- Lixeira: guarda dados de usuários removidos para possível recuperação (30 dias)
CREATE TABLE IF NOT EXISTS usuarios_removidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    motorista_id UUID NOT NULL,
    email TEXT,
    dados JSONB NOT NULL,
    removido_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_removidos_data ON usuarios_removidos(removido_em);
