import { Router } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { supabase } from '../config/supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'viralnews-secret-2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

async function verifyGoogleToken(token) {
  const res = await axios.get(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
  );
  const payload = res.data;
  if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error('Client ID mismatch');
  return payload;
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

    // Salva ou atualiza usuário no Supabase
    const { data: existing } = await supabase
      .from('users')
      .select('id, plan, scripts_used, scripts_limit')
      .eq('id', user.id)
      .single();

    if (!existing) {
      // Verifica se tem plano pendente do pagamento
      const { data: pending } = await supabase
        .from('pending_plans')
        .select('plan, scripts_limit')
        .eq('email', user.email)
        .single();

      await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        plan: pending?.plan || 'none',
        scripts_used: 0,
        scripts_limit: pending?.scripts_limit || 0,
        reset_at: new Date().toISOString(),
      });

      if (pending) {
        await supabase.from('pending_plans').delete().eq('email', user.email);
        console.log(`Plano pendente ${pending.plan} ativado para ${user.email}`);
      }
    }

    const dbUser = existing || { plan: 'none', scripts_used: 0, scripts_limit: 0 };

    const tokenPayload = {
      ...user,
      plan: dbUser.plan,
      scripts_used: dbUser.scripts_used,
      scripts_limit: dbUser.scripts_limit,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: tokenPayload });
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

    // Busca dados atualizados do banco
    const { data: dbUser } = await supabase
      .from('users')
      .select('plan, scripts_used, scripts_limit, reset_at')
      .eq('id', user.id)
      .single();

    res.json({ user: { ...user, ...dbUser } });
  } catch {
    res.status(401).json({ error: 'Token expirado' });
  }
});

export default router;
