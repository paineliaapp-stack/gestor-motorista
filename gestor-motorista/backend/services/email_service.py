"""Emails transacionais via Resend. Nunca quebra o app — sem RESEND_API_KEY, só loga."""
import os
import httpx
from core.logging import log_info, log_warn, log_erro

_FROM = "Painel.IA <noreply@painelia.app>"
_APP = "https://gestor-motorista-production.up.railway.app"


def _tpl(titulo: str, corpo: str, cta_label: str, cta_url: str) -> str:
    return f"""<div style="background:#07090d;padding:40px 20px;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#0d1117;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:36px 30px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
      <div style="width:36px;height:36px;border-radius:50%;background:#F0B429;display:inline-block;text-align:center;line-height:36px;color:#000;font-weight:900;font-size:20px">P</div>
      <span style="color:#EEE9E0;font-weight:800;font-size:18px">Painel<span style="color:#F0B429">.IA</span></span>
    </div>
    <h2 style="color:#EEE9E0;font-size:21px;margin:0 0 14px">{titulo}</h2>
    <p style="color:rgba(238,233,224,.65);font-size:15px;line-height:1.65;margin:0 0 26px">{corpo}</p>
    <a href="{cta_url}" style="display:inline-block;background:#F0B429;color:#0a0a0a;font-weight:800;font-size:15px;padding:14px 28px;border-radius:12px;text-decoration:none">{cta_label}</a>
    <p style="color:rgba(238,233,224,.3);font-size:11px;margin:28px 0 0">Painel.IA — o gestor financeiro de quem vive do volante.</p>
  </div>
</div>"""


async def _enviar(para: str, assunto: str, html: str):
    key = os.getenv("RESEND_API_KEY", "")
    if not key:
        log_warn("email_sem_key", para=para, assunto=assunto)
        return
    if not para:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post("https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {key}"},
                json={"from": _FROM, "to": [para], "subject": assunto, "html": html})
            if r.status_code >= 400:
                log_warn("email_falhou", status=r.status_code, body=r.text[:200])
            else:
                log_info("email_ok", para=para, assunto=assunto)
    except Exception as e:
        log_erro("email_erro", erro=e)


async def email_boas_vindas(email, nome):
    await _enviar(email, f"Bem-vindo ao Painel.IA, {nome}! Suas 24h começaram 🚗",
        _tpl(f"Bem-vindo, {nome}! 👋",
             "Você tem <b style='color:#00D897'>24 horas</b> para experimentar tudo: o Gestor com IA, o plano financeiro, "
             "a previsão do tempo e o histórico completo. Fala quanto fez no chat e veja a mágica acontecer.",
             "Abrir o app", _APP))

async def email_trial_expirando(email, nome, horas_restantes):
    await _enviar(email, f"⏱ Faltam {horas_restantes}h do seu trial, {nome}",
        _tpl(f"Ei {nome}, faltam {horas_restantes}h",
             "Seu período de teste está acabando — mas tudo que você registrou fica salvo. "
             "Garanta o <b style='color:#F0B429'>Plano Fundador por R$19/mês</b> (preço travado por 1 ano) enquanto há vagas.",
             "Garantir meu acesso", _APP))

async def email_trial_expirado(email, nome):
    await _enviar(email, f"Seu trial acabou, {nome} — mas seus dados estão salvos",
        _tpl("Seu trial terminou",
             f"{nome}, tudo o que você registrou continua guardado. Para voltar a usar o Gestor "
             "e ver seu histórico completo, assine o Plano Fundador por R$19/mês.",
             "Assinar agora — R$19/mês", _APP))

async def email_pagamento_confirmado(email, nome, plano, valor):
    await _enviar(email, f"✅ Pagamento confirmado — bem-vindo ao {plano}!",
        _tpl(f"Tudo certo, {nome}! 🎉",
             f"Seu <b style='color:#00D897'>{plano}</b> está ativo (R${valor:.2f}/mês). "
             "Acesso completo liberado. Valeu por acreditar no Painel.IA desde o começo.",
             "Abrir o app", _APP))

async def email_pagamento_falhou(email, nome):
    await _enviar(email, f"⚠️ Problema com seu pagamento, {nome}",
        _tpl("Tivemos um problema no pagamento",
             f"{nome}, não conseguimos processar sua assinatura. Seus dados estão salvos — "
             "atualize o método de pagamento para continuar com acesso completo.",
             "Atualizar pagamento", _APP))
