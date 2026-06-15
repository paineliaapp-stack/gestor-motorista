-- Suporte a PIX: ciclo (mensal/anual) e id do pagamento avulso
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS ciclo TEXT DEFAULT 'mensal';
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS periodo_fim TIMESTAMPTZ;
