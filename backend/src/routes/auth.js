import { Router } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { supabase } from '../config/supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'viralnews-secret-2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

async function verifyGoogleToken(token) {
  const res = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
  const payload = res.data;
  if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error('Client ID mismatch');
  return payload;
}

async function activatePendingPlan(userId, email) {
  const { data: pending } = await supabase
    .from('pending_plans')
    .select('plan, scripts_limit')
    .eq('email', email)
    .single();

  if (pending && pending.plan && pending.plan !== 'pending') {
    await supabase
      .from('users')
      .update({ plan: pending.plan, scripts_limit: pending.scripts_limit, scripts_used: 0, reset_at: new Date().toISOString() })
      .eq('id', userId);
    await supabase.from('pending_plans').delete().eq('email', email);
    console.log('Plano ativado:', pending.plan, 'para', email);
    return pending;
  }
  return null;
}

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Token obrigatorio' });

    const payload = await verifyGoogleToken(credential);
    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    const { data: existing } = await supabase
      .from('users')
      .select('id, plan, scripts_used, scripts_limit')
      .eq('id', user.id)
      .single();

    if (!existing) {
      // Novo usuario - verifica pending_plans
      const { data: pending } = await supabase
        .from('pending_plans')
        .select('plan, scripts_limit')
        .eq('email', user.email)
        .single();

      console.log('pending encontrado:', JSON.stringify(pending));
      const hasPlan = pending && pending.plan && pending.plan !== 'pending';
      console.log('hasPlan:', hasPlan);

      await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        plan: hasPlan ? pending.plan : 'none',
        scripts_used: 0,
        scripts_limit: hasPlan ? pending.scripts_limit : 0,
        reset_at: new Date().toISOString(),
      });

      if (hasPlan) {
        await supabase.from('pending_plans').delete().eq('email', user.email);
        console.log('Plano ativado no primeiro login:', pending.plan, 'para', user.email);
      }
    } else if (existing.plan === 'none') {
      // Usuario existe sem plano - verifica pending_plans
      await activatePendingPlan(user.id, user.email);
    }

    // Busca dados finais do banco
    const { data: dbUser } = await supabase
      .from('users')
      .select('plan, scripts_used, scripts_limit')
      .eq('id', user.id)
      .single();

    const finalUser = dbUser || { plan: 'none', scripts_used: 0, scripts_limit: 0 };

    const token = jwt.sign({ ...user, ...finalUser }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { ...user, ...finalUser } });
  } catch (err) {
    console.error('[AUTH ERROR]', err.message);
    res.status(401).json({ error: 'Token invalido' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'Nao autenticado' });
    const user = jwt.verify(auth, JWT_SECRET);

    const { data: dbUser } = await supabase
      .from('users')
      .select('plan, scripts_used, scripts_limit, reset_at')
      .eq('id', user.id)
      .single();

    // Se sem plano, verifica pending_plans (usado pelo botao "Ja paguei")
    if (dbUser && dbUser.plan === 'none') {
      const activated = await activatePendingPlan(user.id, user.email);
      if (activated) {
        dbUser.plan = activated.plan;
        dbUser.scripts_limit = activated.scripts_limit;
      }
    }

    res.json({ user: { ...user, ...dbUser } });
  } catch {
    res.status(401).json({ error: 'Token expirado' });
  }
});

export default router;
