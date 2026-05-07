import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'viralnews-secret-2026';

export function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Não autenticado' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expirado' });
  }
}
