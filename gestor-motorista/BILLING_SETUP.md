# Setup do Sistema Comercial — Painel.IA

## 1. Rodar a migration no Supabase
SQL Editor → colar e executar: `migrations/001_billing.sql`
(cria tabelas planos, assinaturas, pagamentos + 50 vagas Fundador)

## 2. Variáveis no Railway (Variables)
```
MP_ACCESS_TOKEN=TEST-3926038783660644-061023-271dce0963b525aff7d2eac16fee314b-234679629
RESEND_API_KEY=re_VdjwxNCi_2ykkd85i8ohTuTF4MASTb2qz
ADMIN_TOKEN=pia-admin-x9k2m7w4q1z8v3r6
MP_WEBHOOK_SECRET=          (deixar vazio por enquanto)
```
⚠️ O MP_ACCESS_TOKEN acima é de TESTE — pagamentos não são reais.
Para vender de verdade: MercadoPago → Credenciais → token de PRODUÇÃO.

## 3. Webhook no MercadoPago
Painel MP → Webhooks → adicionar:
`https://gestor-motorista-production.up.railway.app/billing/webhook`
Eventos: subscription_preapproval + payment

## 4. Resend
Verificar o domínio painelia.app em resend.com/domains para o
remetente noreply@painelia.app funcionar. Sem verificação, usar o
domínio sandbox do Resend (onboarding@resend.dev) trocando _FROM
em services/email_service.py.

## 5. Admin
URL: https://gestor-motorista-production.up.railway.app/admin
Token: o valor de ADMIN_TOKEN.

## Como funciona
- 1º login → trial de 24h criado automaticamente + email de boas-vindas
- Contador no topo do app sincronizado com o servidor
- 6h antes de expirar → email de aviso (scheduler de hora em hora)
- Expirou → overlay de upgrade no app + chat bloqueado + email
- Checkout → MercadoPago assinatura mensal → webhook ativa o plano
- Fundador: 50 vagas, decrementa a cada ativação
