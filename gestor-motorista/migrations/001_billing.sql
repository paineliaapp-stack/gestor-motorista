-- PAINEL.IA — Billing (rodar no SQL Editor do Supabase)
CREATE TABLE IF NOT EXISTS planos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_mensal DECIMAL(10,2) NOT NULL,
  vagas_total INTEGER,
  vagas_restantes INTEGER,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO planos (id, nome, preco_mensal, vagas_total, vagas_restantes) VALUES
  ('fundador', 'Plano Fundador', 19.00, 50, 50),
  ('pro', 'Plano Pro', 29.00, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id UUID NOT NULL REFERENCES motoristas(id),
  plano_id TEXT NOT NULL REFERENCES planos(id),
  status TEXT NOT NULL DEFAULT 'trial',
  trial_inicio TIMESTAMPTZ DEFAULT NOW(),
  trial_fim TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  periodo_inicio TIMESTAMPTZ,
  periodo_fim TIMESTAMPTZ,
  mp_subscription_id TEXT,
  email_pagamento TEXT,
  email_expirando_enviado BOOLEAN DEFAULT false,
  email_expirado_enviado BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assinaturas_motorista ON assinaturas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);

CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id UUID REFERENCES assinaturas(id),
  motorista_id UUID NOT NULL REFERENCES motoristas(id),
  mp_payment_id TEXT,
  valor DECIMAL(10,2),
  status TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
