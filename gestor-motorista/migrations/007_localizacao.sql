-- Localização do motorista para o mapa do admin
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS lon NUMERIC;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS estado TEXT;
