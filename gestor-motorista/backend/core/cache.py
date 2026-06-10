"""Cache simples em memória com TTL (evita queries repetidas ao Supabase)."""
import time as _time

_cache: dict = {}
def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and _time.time() - entry["ts"] < entry["ttl"]:
        return entry["val"]
    return None

def _cache_set(key: str, val, ttl: int = 30):
    _cache[key] = {"val": val, "ts": _time.time(), "ttl": ttl}
    # Limpa cache quando cresce demais
    if len(_cache) > 5000:
        cutoff = _time.time()
        for k in list(_cache.keys()):
            if cutoff - _cache[k]["ts"] > _cache[k]["ttl"] * 2:
                del _cache[k]

def _cache_del(prefix: str):
    """Invalida entradas de cache com esse prefixo."""
    for k in list(_cache.keys()):
        if k.startswith(prefix):
            del _cache[k]

