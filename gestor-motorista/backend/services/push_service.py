"""Push notifications (webpush) + scheduler de notificações."""
from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import json as _push_json
from core.config import VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
from core.supabase_client import supabase
from core.logging import log_info, log_warn, log_erro

def _enviar_push(subscription_info: dict, titulo: str, corpo: str, url: str = "/", tag: str = "painel"):
    try:
        payload = _push_json.dumps({"title": titulo, "body": corpo, "url": url, "tag": tag, "icon": "/static/icon-192.png"})
        webpush(subscription_info=subscription_info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_EMAIL})
        return True
    except WebPushException as ex:
        status = ex.response.status_code if ex.response else 0
        if status in (404, 410): return "expired"
        log_warn("push_falhou", status=status, err=str(ex)[:100])
        return False
    except Exception as ex:
        log_warn("push_erro", err=str(ex)[:100])
        return False

async def _disparar_push_todos(titulo: str, corpo: str, url: str = "/", tag: str = "painel", apenas_motorista_id: str = None):
    try:
        q = supabase.table("push_subscriptions").select("*")
        if apenas_motorista_id:
            q = q.eq("motorista_id", apenas_motorista_id)
        res = q.execute()
        subs = res.data or []
        expiradas = []
        for sub in subs:
            resultado = _enviar_push(sub["subscription"], titulo, corpo, url, tag)
            if resultado == "expired": expiradas.append(sub["id"])
        for sid in expiradas:
            supabase.table("push_subscriptions").delete().eq("id", sid).execute()
        log_info("push_disparado", total=len(subs), expiradas=len(expiradas))
    except Exception as e:
        log_erro("push_dispatch_erro", err=str(e)[:200])

_scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")

async def _notif_teste_0010():
    await _disparar_push_todos("Painel.IA — Teste 🧪", "As notificacoes estao funcionando! Pode usar agora ✅", "/", "teste")

async def _notif_lembrete_noite():
    await _disparar_push_todos("Nao esquece! 📊", "Registre seus ganhos de hoje antes de dormir 💰", "/", "lembrete-noite")

async def _notif_meta_manha():
    await _disparar_push_todos("Bom dia, motorista! 🚀", "Hoje e um novo dia. Bora bater a meta! 💪", "/", "meta-manha")

async def _notif_contas_urgentes():
    try:
        from datetime import date as _dc2, timedelta as _td2
        hoje2 = _dc2.today().isoformat()
        amanha2 = (_dc2.today() + _td2(days=1)).isoformat()
        res2 = supabase.table("contas").select("motorista_id,descricao,valor,vencimento").eq("pago", False).in_("vencimento", [hoje2, amanha2]).execute()
        por_mid = {}
        for c in (res2.data or []):
            por_mid.setdefault(c["motorista_id"], []).append(c)
        for mid, cs in por_mid.items():
            nomes = ", ".join(c["descricao"] for c in cs[:2])
            extra = f" +{len(cs)-2} mais" if len(cs) > 2 else ""
            total = sum(float(c.get("valor", 0)) for c in cs)
            await _disparar_push_todos(f"Conta(s) vencendo! ⚠️", f"{nomes}{extra} — R$ {total:.0f}", "/", "contas-urgentes", apenas_motorista_id=mid)
    except Exception as e:
        log_erro("notif_contas_urg", err=str(e)[:200])

async def _notif_relatorio_domingo():
    await _disparar_push_todos("Relatorio da semana 📈", "Veja como foi sua semana no Painel.IA 📊", "/", "relatorio-semana")

async def startup_scheduler():
    # Garante que a tabela push_subscriptions existe
    try:
        supabase.table("push_subscriptions").select("id").limit(1).execute()
    except Exception:
        try:
            supabase.rpc("exec_sql", {"query": """
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                    motorista_id text NOT NULL,
                    endpoint text NOT NULL,
                    subscription jsonb NOT NULL,
                    created_at timestamptz DEFAULT now()
                );
                CREATE UNIQUE INDEX IF NOT EXISTS push_subs_unique ON push_subscriptions (motorista_id, endpoint);
            """}).execute()
            log_info("push_table_criada")
        except Exception as e:
            log_warn("push_table_criar_erro", err=str(e)[:200])
    _scheduler.add_job(_notif_teste_0010,        CronTrigger(hour=0,  minute=15), id="teste_0015",     replace_existing=True)
    _scheduler.add_job(_notif_meta_manha,         CronTrigger(hour=8,  minute=0),  id="meta_manha",     replace_existing=True)
    _scheduler.add_job(_notif_contas_urgentes,    CronTrigger(hour=9,  minute=0),  id="contas_urg",     replace_existing=True)
    _scheduler.add_job(_notif_lembrete_noite,     CronTrigger(hour=22, minute=0),  id="lembrete_noite", replace_existing=True)
    _scheduler.add_job(_notif_relatorio_domingo,  CronTrigger(day_of_week="sun", hour=20, minute=0), id="relatorio_dom", replace_existing=True)
    # _scheduler.start()  # push desativado temporariamente
    log_info("scheduler_iniciado", jobs=5)

