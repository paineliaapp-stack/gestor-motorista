-- Suporte: campo para resposta do admin + status respondido
ALTER TABLE tickets_suporte ADD COLUMN IF NOT EXISTS resposta_admin TEXT;
ALTER TABLE tickets_suporte ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();
