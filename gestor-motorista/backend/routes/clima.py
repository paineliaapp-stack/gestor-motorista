"""Previsão do tempo (OpenWeatherMap) — card do dashboard.

GET /api/weather?lat=..&lon=..  ou  ?cidade=Curitiba
Retorna janelas de chuva nas próximas 36h para o frontend montar o aviso.
Cache de 30 min por localização — free tier do OWM aguenta folgado.
Requer env OPENWEATHER_API_KEY.
"""
import os
import datetime as _dt
import httpx
from fastapi import APIRouter, Depends
from core.security import get_uid_from_token
from core.cache import _cache_get, _cache_set
from core.logging import log_erro

router = APIRouter()

_NOMES_DIA = {0: "hoje", 1: "amanhã", 2: "depois de amanhã"}


def _hora_brasil(ts_utc: int) -> _dt.datetime:
    return _dt.datetime.utcfromtimestamp(ts_utc) - _dt.timedelta(hours=3)


@router.get("/api/weather")
async def previsao_tempo(lat: float = None, lon: float = None, cidade: str = None,
                         uid: str = Depends(get_uid_from_token)):
    key = os.getenv("OPENWEATHER_API_KEY", "")
    if not key:
        return {"ok": False, "erro": "OPENWEATHER_API_KEY não configurada"}
    if lat is None and not cidade:
        return {"ok": False, "erro": "informe lat/lon ou cidade"}

    cache_key = f"weather:{round(lat,2)}:{round(lon,2)}" if lat is not None else f"weather:{cidade.lower().strip()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {"appid": key, "units": "metric", "lang": "pt_br", "cnt": 14}  # 14 blocos de 3h ≈ 42h
    if lat is not None:
        params["lat"] = lat
        params["lon"] = lon
    else:
        params["q"] = f"{cidade},BR"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.openweathermap.org/data/2.5/forecast", params=params)
            data = r.json()
        if str(data.get("cod")) != "200":
            return {"ok": False, "erro": str(data.get("message", "erro OWM"))[:100]}
    except Exception as e:
        log_erro("weather_erro", erro=e)
        return {"ok": False, "erro": "falha ao consultar previsão"}

    agora_br = _dt.datetime.utcnow() - _dt.timedelta(hours=3)
    hoje = agora_br.date()

    # Agrupa blocos consecutivos de 3h com chuva relevante em "janelas"
    janelas = []
    atual = None
    for bloco in data.get("list", []):
        dt_br = _hora_brasil(bloco["dt"])
        if (dt_br - agora_br).total_seconds() > 36 * 3600:
            break
        pop = float(bloco.get("pop", 0))  # probabilidade 0-1
        cond = (bloco.get("weather") or [{}])[0]
        chove = pop >= 0.5 or cond.get("main") in ("Rain", "Thunderstorm", "Drizzle")
        if chove:
            if atual is None:
                atual = {"ini": dt_br, "fim": dt_br + _dt.timedelta(hours=3), "pop_max": pop,
                         "descricao": cond.get("description", "chuva")}
            else:
                # Estende a janela — fim sempre avança
                novo_fim = dt_br + _dt.timedelta(hours=3)
                if novo_fim > atual["fim"]:
                    atual["fim"] = novo_fim
                atual["pop_max"] = max(atual["pop_max"], pop)
        elif atual is not None:
            janelas.append(atual)
            atual = None
    if atual is not None:
        janelas.append(atual)

    def _fmt_janela(j):
        dia_idx = (j["ini"].date() - hoje).days
        ini_str = j["ini"].strftime("%Hh")
        # fim sempre pelo menos 1h depois do ini para evitar "09h às 09h"
        fim_real = j["fim"] if j["fim"] > j["ini"] else j["ini"] + _dt.timedelta(hours=3)
        # Se o fim escapou para o dia seguinte (ex: 12h às 09h), trava em meia-noite
        if fim_real.date() != j["ini"].date():
            fim_str = "meia-noite"
        else:
            fim_str = fim_real.strftime("%Hh")
        return {
            "dia": _NOMES_DIA.get(dia_idx, j["ini"].strftime("%d/%m")),
            "ini": ini_str,
            "fim": fim_str,
            "probabilidade": round(j["pop_max"] * 100),
            "descricao": j["descricao"],
        }

    primeiro = (data.get("list") or [{}])[0]
    resp = {
        "ok": True,
        "cidade": (data.get("city") or {}).get("name", cidade or ""),
        "temp": round(float(primeiro.get("main", {}).get("temp", 0))),
        "chuva_36h": bool(janelas),
        "janelas": [_fmt_janela(j) for j in janelas[:3]],
    }
    _cache_set(cache_key, resp, ttl=60)  # 1 min — temporário para limpar cache
    return resp
