"""Toda a lógica de chamada ao Gemini + retry.
Cada função preserva exatamente a estratégia de retry do endpoint original."""
import os
import asyncio as _asyncio
import httpx
from core.logging import log_info, log_warn, log_erro

# Semáforo global: limita chamadas SIMULTÂNEAS ao Gemini
# 25 slots = até 25 chamadas Gemini ao mesmo tempo; o resto fica em fila assíncrona
_gemini_sem = _asyncio.Semaphore(25)

ERROS_SOBRECARGA = ["high demand","overloaded","quota","RESOURCE_EXHAUSTED","503","502","529","UNAVAILABLE"]


async def gerar_conteudo_plano(prompt: str) -> dict:
    """Chamada do /plano-financeiro: 4 tentativas com backoff exponencial."""
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    _ERROS_SOBRECARGA = ERROS_SOBRECARGA
    _seq_modelos = ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash"]
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 3000, "temperature": 0.1}
    }
    result = {}
    async with httpx.AsyncClient(timeout=60) as client:
        for tentativa in range(4):
            modelo_atual = _seq_modelos[min(tentativa // 2, 2)]
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_atual}:generateContent?key={GEMINI_KEY}",
                    json=payload
                )
                result = resp.json()
                if "error" not in result:
                    break
                err_msg = result["error"].get("message", "")
                if any(x in err_msg for x in _ERROS_SOBRECARGA):
                    wait = min(5 * (2 ** tentativa), 45)
                    await _asyncio.sleep(wait)
                else:
                    break
            except Exception as e:
                await _asyncio.sleep(min(5 * (2 ** tentativa), 30))
    return result


async def chamar_gemini_setup(msgs: list) -> dict:
    """Chamada do /chat-setup: 3 tentativas, JSON mode."""
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    result = {}
    async with httpx.AsyncClient(timeout=25) as client:
        for tentativa in range(3):
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
                    json={"contents": msgs, "generationConfig": {"responseMimeType": "application/json"}}
                )
                result = resp.json()
                if "error" not in result:
                    break
                await __import__("asyncio").sleep((tentativa+1)*4)
            except:
                await __import__("asyncio").sleep(4)
    return result


async def chamar_gemini_chat(msgs: list, _gemini_payload_extra: dict) -> dict:
    """Chamada do /chat: rodízio de modelos (cotas independentes na API Gemini).
    2.5-flash: 1000 RPM | 2.0-flash: 2000 RPM | 2.0-flash-lite: 4000 RPM"""
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    result = {}
    modelos = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
    async with httpx.AsyncClient(timeout=35) as client:
        for tentativa, modelo_atual in enumerate(modelos):
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_atual}:generateContent?key={GEMINI_KEY}",
                    json={**_gemini_payload_extra, "contents": msgs, "generationConfig": {
                        "responseMimeType": "application/json",
                        "maxOutputTokens": 4096,
                        "temperature": 0.1
                    }}
                )
                result = resp.json()
                err_code = result.get("error",{}).get("code", 0)
                err_msg = result.get("error",{}).get("message","")
                if "error" not in result:
                    log_info("gemini_ok", modelo=modelo_atual)
                    break
                eh_cota = err_code in [429, 503, 502] or any(x in err_msg for x in ["quota","RESOURCE_EXHAUSTED","overloaded","high demand"])
                eh_nao_encontrado = err_code == 404 or "not found" in err_msg.lower()
                log_warn("gemini_err", modelo=modelo_atual, code=err_code)
                if eh_cota or eh_nao_encontrado:
                    # Troca imediatamente para o próximo modelo — sem esperar
                    continue
                # Erro desconhecido — espera 1s e tenta próximo
                await __import__("asyncio").sleep(1)
            except Exception as e:
                log_erro("gemini_timeout", modelo=modelo_atual, erro=e)
                # Timeout — tenta próximo modelo imediatamente
    return result


async def chamar_gemini_chat_curto(msgs_curto: list, _gemini_payload_extra: dict) -> dict:
    """Retry do /chat com histórico reduzido (finishReason MAX_TOKENS/RECITATION/SAFETY)."""
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    async with httpx.AsyncClient(timeout=30) as c2:
        r2 = await c2.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
            json={**_gemini_payload_extra, "contents": msgs_curto, "generationConfig": {"responseMimeType":"application/json","maxOutputTokens":1024,"temperature":0.1}}
        )
        return r2.json()
