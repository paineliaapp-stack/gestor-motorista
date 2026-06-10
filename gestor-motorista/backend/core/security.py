"""Validação de UUID, rate limiting e verificação de token JWT (Supabase)."""
from core.logging import log_erro
from core.supabase_client import _supabase_url, _supabase_service_key

import re as _re, time as _time, asyncio as _asyncio
_UUID_RE = _re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', _re.I)
def _valid_uuid(v: str) -> bool:
    return bool(v and _UUID_RE.match(str(v).strip()))

# Rate limiting por motorista_id (em memória por worker)
_chat_rate: dict = {}
def _check_rate(mid: str, max_per_min: int = 20) -> bool:
    """Limita a 20 mensagens/min por usuário (era 60 — muito permissivo)"""
    agora = _time.time()
    hist = [t for t in _chat_rate.get(mid, []) if agora - t < 60]
    if len(hist) >= max_per_min:
        return False
    hist.append(agora)
    _chat_rate[mid] = hist
    if len(_chat_rate) > 1000:
        _chat_rate.clear()
    return True

# Semáforo global: limita chamadas SIMULTÂNEAS ao Gemini

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx as _httpx_auth
import base64 as _b64, json as _json2, time as _time2

# ── Cache de tokens: evita chamar Supabase a cada request ───────────────────
from collections import OrderedDict
class _TokenCache:
    def __init__(self, maxsize=2000):
        self._d: OrderedDict = OrderedDict()
        self._n = maxsize
    def get(self, tok):
        e = self._d.get(tok)
        if not e: return None
        uid, exp = e
        if exp < _time2.time(): self._d.pop(tok, None); return None
        self._d.move_to_end(tok); return uid
    def set(self, tok, uid, exp):
        if len(self._d) >= self._n: self._d.popitem(last=False)
        self._d[tok] = (uid, exp)

_tok_cache = _TokenCache()

def _jwt_exp(token):
    try:
        p = token.split(".")[1] + "=="
        return float(_json2.loads(_b64.urlsafe_b64decode(p)).get("exp", 0))
    except: return 0.0

_bearer_scheme = HTTPBearer(auto_error=False)

async def get_uid_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)
) -> str:
    """Verifica JWT do Supabase. Cache local — chama HTTP só na 1ª vez por token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = credentials.credentials
    # Cache hit: sem chamada HTTP
    cached = _tok_cache.get(token)
    if cached: return cached
    # Cache miss: verifica com Supabase
    try:
        async with _httpx_auth.AsyncClient(timeout=5) as c:
            r = await c.get(
                f"{_supabase_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": _supabase_service_key}
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
        uid = r.json().get("id")
        if not uid:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        exp = _jwt_exp(token)
        _tok_cache.set(token, uid, exp if exp > 0 else _time2.time() + 3600)
        return uid
    except HTTPException: raise
    except Exception as e:
        log_erro("token_verificacao_erro", erro=e)
        raise HTTPException(status_code=401, detail="Erro ao verificar token")
