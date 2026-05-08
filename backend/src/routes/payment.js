import express from 'express';
import { supabase } from '../config/supabase.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { config } from '../config/index.js';

const router = express.Router();

async function sendEmail(to, subject, html) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: 'Autor.ai <acesso@autorai.com.br>', to, subject, html }),
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

const EMAIL_HTML = `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#07080d;color:#fff;padding:40px;border-radius:16px">
    <div style="font-size:28px;font-weight:800;margin-bottom:8px">Autor<span style="color:#00e5b0">.AI</span></div>
    <h2 style="margin:24px 0 8px">Acesso liberado!</h2>
    <p style="color:rgba(255,255,255,0.6);margin-bottom:24px">Seu pagamento foi confirmado. Clique no botao abaixo para acessar a plataforma:</p>
    <a href="https://autorai.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#00e5b0,#00b8ff);color:#07080d;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px">Acessar o Autor.ai</a>
    <p style="color:rgba(255,255,255,0.4);font-size:13px">Faca login com o Google usando este email. Duvidas? autor.ai.app@gmail.com</p>
  </div>
`;

const client = new MercadoPagoConfig({ accessToken: config.mpAccessToken });

router.get('/check-plan', async (req, res) => {
  try {
    const email = req.query.email?.trim().toLowerCase();
    if (!email) return res.json({ ready: false });

    const { data: pending } = await supabase
      .from('pending_plans')
      .select('plan')
      .eq('email', email)
      .single();

    const { data: user } = await supabase
      .from('users')
      .select('plan')
      .eq('email', email)
      .single();

    const ready = (pending && pending.plan && pending.plan !== 'pending') ||
                  (user && user.plan && user.plan !== 'none');

    res.json({ ready: !!ready });
  } catch {
    res.json({ ready: false });
  }
});

router.post('/lead', async (req, res) => {
  try {
    const { email, name, whats, uso } = req.body;
    if (email) {
      await supabase.from('leads').upsert({ email, name, whats, uso });
    }
  } catch(e) {
    console.error('Lead error:', e.message);
  }
  res.json({ ok: true });
});

router.get('/config', (_req, res) => {
  res.json({ publicKey: config.mpPublicKey });
});

router.post('/create-preference', async (req, res) => {
  try {
    const { title, price, quantity = 1, email: customerEmail, planTitle } = req.body;
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{ title, unit_price: Number(price), quantity }],
        external_reference: customerEmail || 'unknown',
        back_urls: {
          success: 'https://autorai.com.br/payment-success.html',
          failure: 'https://autorai.com.br/payment-success.html',
          pending: 'https://autorai.com.br/payment-success.html',
        },
        auto_return: 'approved',
      },
    });
    res.json({ id: result.id, init_point: result.init_point });
  } catch (err) {
    console.error('MP error:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar preferencia' });
  }
});

const PLAN_MAP = {
  'Plano B\u00e1sico': { plan: 'basic', limit: 30 },
  'Plano Fundador': { plan: 'founder', limit: 100 },
  'Plano Pro': { plan: 'pro', limit: 200 },
};

router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment' && data?.id) {
      const payment = new Payment(client);
      const info = await payment.get({ id: data.id });
      console.log('Webhook pagamento:', info.status, info.id);
      console.log('Titulo recebido:', JSON.stringify(info.additional_info?.items?.[0]?.title));
      console.log('Payer email:', info.payer?.email);

      if (info.status === 'approved') {
        const title = info.additional_info?.items?.[0]?.title || '';
        const planData = PLAN_MAP[title];
        const rawPayerEmail = info.payer?.email?.trim().toLowerCase();
        // Valida se é realmente um email (MP às vezes envia CPF/telefone)
        const isValidEmail = (e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
        let payerEmail = isValidEmail(rawPayerEmail) ? rawPayerEmail : null;
        if (rawPayerEmail && !payerEmail) {
          console.log('MP enviou valor invalido no email:', rawPayerEmail);
        }

        console.log('preference_id:', info.preference_id);
        console.log('external_ref:', info.external_reference);
        console.log('order:', JSON.stringify(info.order));
        console.log('preference_id:', info.preference_id);
        console.log('external_ref:', info.external_reference);
        console.log('order:', JSON.stringify(info.order));
        console.log('preference_id:', info.preference_id);
        console.log('external_ref:', info.external_reference);
        console.log('order:', JSON.stringify(info.order));
        // Fallback: busca email pelo preference_id se MP nao enviou
        // Fallback: usa external_reference que foi setado com o email no checkout
        if (!payerEmail && info.external_reference && info.external_reference !== 'unknown') {
          const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.external_reference);
          if (isValid) {
            payerEmail = info.external_reference;
            console.log('Email recuperado do external_reference:', payerEmail);
          }
        }

        console.log('planData:', JSON.stringify(planData), '| payerEmail:', payerEmail);
        if (planData && payerEmail) {
          const now = new Date().toISOString();
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', payerEmail)
            .single();

          // Sempre salva em pending_plans primeiro
          await supabase.from('pending_plans').upsert({
            email: payerEmail,
            plan: planData.plan,
            scripts_limit: planData.limit,
          });
          console.log('Plano salvo em pending_plans para:', payerEmail);

          // Se usuario ja existe, ativa imediatamente e limpa pending
          if (existing) {
            await supabase
              .from('users')
              .update({ plan: planData.plan, scripts_limit: planData.limit, scripts_used: 0, reset_at: now })
              .eq('email', payerEmail);
            await supabase.from('pending_plans').delete().eq('email', payerEmail);
            console.log('Plano ativado para usuario existente:', payerEmail);
          }
          // Envia email sem bloquear
          sendEmail(payerEmail, 'Seu acesso ao Autor.ai esta liberado!', EMAIL_HTML).catch(e => console.error('Email falhou:', e.message));
        }
      }
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
  res.sendStatus(200);
});

export default router;
