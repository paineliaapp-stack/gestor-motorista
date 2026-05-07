import { supabase } from '../config/supabase.js';

const PLAN_LIMITS = {
  founder: 150,
  pro: 150,
  agency: 500,
  none: 0
};

export async function checkQuota(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Não autenticado' });

    const { data: user, error } = await supabase
      .from('users')
      .select('plan, scripts_used, scripts_limit, reset_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(403).json({ error: 'Usuário não encontrado. Faça login novamente.' });
    }

    if (user.plan === 'none') {
      return res.status(403).json({ error: 'Sem plano ativo. Assine para continuar.' });
    }

    // Reset mensal
    const resetAt = new Date(user.reset_at);
    const now = new Date();
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      await supabase
        .from('users')
        .update({ scripts_used: 0, reset_at: now.toISOString() })
        .eq('id', userId);
      user.scripts_used = 0;
    }

    const limit = PLAN_LIMITS[user.plan] || 0;
    if (user.scripts_used >= limit) {
      return res.status(429).json({
        error: `Limite de ${limit} roteiros/mês atingido. Faça upgrade para continuar.`,
        scripts_used: user.scripts_used,
        scripts_limit: limit,
        plan: user.plan
      });
    }

    req.userPlan = user;
    next();
  } catch (err) {
    console.error('[quota] erro:', err.message);
    res.status(500).json({ error: 'Erro ao verificar quota' });
  }
}

export async function incrementUsage(userId) {
  await supabase.rpc('increment_scripts_used', { user_id: userId });
}
