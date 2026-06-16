-- Coluna meta_mensal na tabela motoristas (cada motorista tem a sua).
-- O backend (routes/metas.py) ja salva por usuario com .eq("id"), mas a coluna precisa existir.
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS meta_mensal NUMERIC;
