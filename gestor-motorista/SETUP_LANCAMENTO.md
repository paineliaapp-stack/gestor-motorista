# PAINEL.IA — Guia de Lançamento
*Execute nessa ordem para o app começar a vender*

---

## PASSO 1 — Upgrade Railway Hobby (URGENTE — 3 dias)
1. Acesse: railway.com → seu projeto `gestor-motorista`
2. Clique no aviso "Limited Trial Plan" no topo
3. Clique **"Upgrade to Hobby"** → US$5/mês
4. ✅ App não cai mais

---

## PASSO 2 — Variáveis de Ambiente no Railway
Vá em: Railway → gestor-motorista → **Variables** → Add Variable

Adicionar cada uma:
```
Nome: MP_ACCESS_TOKEN
Valor: [Token de PRODUÇÃO do MercadoPago]
→ MercadoPago → Credenciais → Access Token (produção, não teste)

Nome: RESEND_API_KEY
Valor: re_VdjwxNCi_2ykkd85i8ohTuTF4MASTb2qz

Nome: ADMIN_TOKEN
Valor: pia-admin-2026-x9k2m7w4q1z8v3r6

Nome: MP_WEBHOOK_SECRET
Valor: (deixar vazio por enquanto)
```
Após salvar: Railway faz redeploy automático (~2 min).

---

## PASSO 3 — Migrations no Supabase
Vá em: supabase.com → seu projeto → **SQL Editor** → New Query

Execute um por um (copie e cole → Run):

### 001_billing.sql
```sql
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
```

### 002_competicao.sql
```sql
CREATE TABLE IF NOT EXISTS metas_dia (
  motorista_id UUID NOT NULL REFERENCES motoristas(id),
  data DATE NOT NULL,
  meta DECIMAL(10,2) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (motorista_id, data)
);
```

### 003_uso_api.sql
```sql
CREATE TABLE IF NOT EXISTS uso_api (
  motorista_id UUID NOT NULL REFERENCES motoristas(id),
  data DATE NOT NULL,
  chamadas INTEGER DEFAULT 0,
  PRIMARY KEY (motorista_id, data)
);
```

### 004_veiculo_lancamento.sql
```sql
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS veiculo TEXT;
```

---

## PASSO 4 — Webhook MercadoPago
1. MercadoPago → Configurações → Webhooks
2. Adicionar URL: `https://gestor-motorista-production.up.railway.app/billing/webhook`
3. Eventos: marcar `subscription_preapproval` e `payment`
4. ✅ Pagamentos ativam o plano automaticamente

---

## PASSO 5 — Domínio Resend (emails)
1. resend.com → Domains → Add Domain
2. Adicionar: `painelia.app`
3. Seguir as instruções de DNS (adicionar registros no seu provedor de domínio)
4. Aguardar verificação (~10 min)
5. ✅ Emails de trial passam a sair com remetente @painelia.app

---

## PASSO 6 — Ativar Supabase Pro (evitar pausa)
1. supabase.com → seu projeto → Settings → Billing
2. Upgrade para Pro: US$25/mês
3. ✅ Banco não pausa, 8GB de armazenamento, backup automático

---

## Verificação final
Após executar todos os passos, teste:
- [ ] Acesse o app e veja se o chip "24h grátis" aparece
- [ ] No admin (/admin), verifique se as métricas carregam
- [ ] Tente fazer um pagamento de teste (com cartão de teste do MercadoPago)
- [ ] Verifique se recebe o email de boas-vindas

---

## URLs do app
- App: https://gestor-motorista-production.up.railway.app
- Landing: https://gestor-motorista-production.up.railway.app/landing
- Admin: https://gestor-motorista-production.up.railway.app/admin
- Termos: https://gestor-motorista-production.up.railway.app/termos
- Privacidade: https://gestor-motorista-production.up.railway.app/privacidade
