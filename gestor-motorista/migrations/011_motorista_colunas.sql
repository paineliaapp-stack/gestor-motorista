-- Colunas que o app usa mas nunca foram criadas — causavam 400 no select de motoristas,
-- impedindo a criacao do registro do motorista no login (e quebrando ativacao de assinatura).
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS plataformas TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS tipo_veiculo TEXT DEFAULT 'carro';
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS setup_completo BOOLEAN DEFAULT FALSE;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS comb_diario NUMERIC;
