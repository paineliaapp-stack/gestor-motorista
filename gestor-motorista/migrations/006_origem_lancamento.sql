-- Rastreamento de origem do lançamento: 'chat' (via IA) ou 'manual' (botão Registrar)
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS origem TEXT;
