"""Painel admin: métricas, usuários, suporte."""
import os
import datetime as _dt
import httpx as _httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from core.supabase_client import supabase
from core.logging import log_info, log_erro
from core.security import get_uid_from_token

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")


def _check(token: str):
    esperado = os.getenv("ADMIN_TOKEN", "")
    if not esperado or token != esperado:
        raise HTTPException(status_code=401, detail="Não autorizado")


async def _auth_users(page=1, per_page=1000):
    async with _httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"page": page, "per_page": per_page},
            headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
        )
    if r.status_code != 200:
        log_erro("auth_users_erro", status=r.status_code, body=r.text[:300])
        raise HTTPException(status_code=502, detail=f"Supabase Auth erro: {r.status_code}")
    data = r.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("users") or data.get("data") or []
    return []


async def _auth_user_by_email(email: str):
    async with _httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"filter": email, "page": 1, "per_page": 50},
            headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
        )
    if r.status_code != 200:
        return []
    users = r.json().get("users", []) if isinstance(r.json(), dict) else r.json()
    return [u for u in users if u.get("email", "").lower() == email.lower()]


# ── Métricas ──────────────────────────────────────────────────────────────────

@router.get("/admin/diag-token")
async def diag_token(x_admin_token: str = Header(default="")):
    """Diagnóstico: confirma se o token enviado bate com o configurado (sem expor valores)."""
    esperado = os.getenv("ADMIN_TOKEN", "")
    return {
        "admin_token_configurado": bool(esperado),
        "tamanho_esperado": len(esperado),
        "tamanho_recebido": len(x_admin_token),
        "primeiros_3_esperado": esperado[:3] if esperado else "",
        "primeiros_3_recebido": x_admin_token[:3] if x_admin_token else "",
        "batem": esperado == x_admin_token and bool(esperado),
        "tem_espaco_no_recebido": x_admin_token != x_admin_token.strip(),
    }


@router.get("/admin/metricas")
async def metricas(x_admin_token: str = Header(default="")):
    _check(x_admin_token)
    out = {
        "total_usuarios": 0, "em_trial": 0, "ativos": 0,
        "expirados": 0, "sem_assinatura": 0,
        "receita_total": 0.0, "novos_7_dias": 0,
        "vagas_fundador_restantes": None, "vagas_fundador_total": None,
        "fundadores": 0, "pro": 0,
        # extras
        "total_lancamentos": 0,
        "usuarios_com_lancamentos": 0,
        "top_usuarios": [],
        "usuarios_sem_uso": 0,
        "tickets_abertos": 0,
    }
    try:
        auth_users = await _auth_users()
        out["total_usuarios"] = len(auth_users)
        hoje = _dt.datetime.now(_dt.timezone.utc)
        sete_dias = hoje - _dt.timedelta(days=7)
        for u in auth_users:
            criado = u.get("created_at", "")
            if criado:
                try:
                    d = _dt.datetime.fromisoformat(criado.replace("Z", "+00:00"))
                    if d >= sete_dias:
                        out["novos_7_dias"] += 1
                except Exception:
                    pass
    except Exception as e:
        log_erro("admin_auth_erro", erro=e)

    try:
        ass = supabase.table("assinaturas").select("status,plano_id").execute()
        precos = {"fundador": 19.0, "pro": 29.0}
        for r in (ass.data or []):
            s = r.get("status", "")
            if s == "trial":
                out["em_trial"] += 1
            elif s == "ativo":
                out["ativos"] += 1
                out["receita_total"] += precos.get(r.get("plano_id", ""), 0)
                if r.get("plano_id") == "fundador":
                    out["fundadores"] += 1
                elif r.get("plano_id") == "pro":
                    out["pro"] += 1
            elif s == "expirado":
                out["expirados"] += 1
        out["sem_assinatura"] = max(0, out["total_usuarios"] - len(ass.data or []))
        out["receita_total"] = round(out["receita_total"], 2)
    except Exception as e:
        log_erro("admin_assinaturas_erro", erro=e)

    try:
        p = supabase.table("planos").select("vagas_restantes,vagas_total").eq("id", "fundador").execute()
        if p.data:
            out["vagas_fundador_restantes"] = p.data[0].get("vagas_restantes")
            out["vagas_fundador_total"]     = p.data[0].get("vagas_total")
    except Exception:
        pass

    # Uso por usuário (lançamentos)
    try:
        lanc = supabase.table("lancamentos").select("motorista_id,valor,tipo").execute()
        uso = {}
        for l in (lanc.data or []):
            mid = l.get("motorista_id")
            if mid:
                if mid not in uso:
                    uso[mid] = {"lancamentos": 0, "receita": 0.0}
                uso[mid]["lancamentos"] += 1
                if l.get("tipo") == "ganho":
                    uso[mid]["receita"] += float(l.get("valor") or 0)

        out["total_lancamentos"] = sum(v["lancamentos"] for v in uso.values())
        out["usuarios_com_lancamentos"] = len(uso)
        out["usuarios_sem_uso"] = max(0, out["total_usuarios"] - len(uso))

        # top 5 por lançamentos
        auth_map = {}
        try:
            users = await _auth_users()
            auth_map = {u["id"]: u.get("email", "—") for u in users}
        except Exception:
            pass

        # Uso de API REAL (chamadas Gemini) — o que importa pro custo
        api_uso = {}
        try:
            ua = supabase.table("uso_api").select("motorista_id,chamadas").execute()
            for r in (ua.data or []):
                k = r["motorista_id"]
                api_uso[k] = api_uso.get(k, 0) + int(r.get("chamadas") or 0)
        except Exception:
            pass
        out["total_chamadas_api"] = sum(api_uso.values())
        # Custo estimado: ~R$0,03 por chamada (referência Gemini flash — ajustar com valor real depois)
        CUSTO_POR_CHAMADA = 0.03
        out["custo_api_estimado"] = round(sum(api_uso.values()) * CUSTO_POR_CHAMADA, 2)

        # Ranking por USO (chamadas de API se houver, senão lançamentos) — SEM receita
        # Agrupa por lançamentos sempre; API fica como segunda coluna se tiver dados
        top = sorted(uso.items(), key=lambda x: (api_uso.get(x[0],0), x[1]["lancamentos"]), reverse=True)[:8]
        out["top_usuarios"] = [
            {"id": mid,
             "email": auth_map.get(mid, "—") if auth_map.get(mid, "").strip() and "@" in auth_map.get(mid,"") else (mid[:8] + "…"),
             "chamadas_api": api_uso.get(mid, 0),
             "custo_estimado": round(api_uso.get(mid, 0) * 0.03, 2),
             "lancamentos": v["lancamentos"]}
            for mid, v in top
        ]
    except Exception as e:
        log_erro("admin_uso_erro", erro=e)

    # Tickets abertos
    try:
        tickets = supabase.table("tickets_suporte").select("id").eq("status", "aberto").execute()
        out["tickets_abertos"] = len(tickets.data or [])
    except Exception:
        pass

    return out


# ── Usuários ──────────────────────────────────────────────────────────────────

@router.get("/admin/usuarios")
async def usuarios(
    x_admin_token: str = Header(default=""),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    status: str = Query("all")
):
    _check(x_admin_token)
    try:
        auth_users = await _auth_users()
        auth_map = {u["id"]: u for u in auth_users}

        # Motoristas — só colunas que existem
        mot = supabase.table("motoristas").select("id,nome,setup_completo,meta_diaria").execute()
        mot_map = {r["id"]: r for r in (mot.data or [])}

        # Contagem de lançamentos + data do último por motorista
        lanc = supabase.table("lancamentos").select("motorista_id,data,created_at").order("created_at", desc=True).execute()
        uso_map = {}
        ultimo_map = {}  # motorista_id -> created_at do último lançamento
        for l in (lanc.data or []):
            mid = l.get("motorista_id")
            if mid:
                uso_map[mid] = uso_map.get(mid, 0) + 1
                # Como está ordenado desc, o primeiro que aparece é o mais recente
                if mid not in ultimo_map:
                    ultimo_map[mid] = l.get("created_at") or l.get("data")

        ass = supabase.table("assinaturas").select(
            "motorista_id,status,plano_id,trial_inicio,trial_fim,periodo_fim,email_pagamento,criado_em"
        ).execute()
        ass_map = {r["motorista_id"]: r for r in (ass.data or [])}

        out = []
        for uid, u in auth_map.items():
            m = mot_map.get(uid, {})
            a = ass_map.get(uid, {})
            s = a.get("status", "sem_assinatura")

            if status != "all" and s != status:
                continue

            out.append({
                "id":            uid,
                "email":         u.get("email", "—"),
                "nome":          m.get("nome") or u.get("user_metadata", {}).get("name") or "—",
                "status":        s,
                "plano":         a.get("plano_id"),
                "trial_fim":     a.get("trial_fim"),
                "periodo_fim":   a.get("periodo_fim"),
                "criado_em":     u.get("created_at"),
                "ultimo_login":  u.get("last_sign_in_at"),
                "setup_completo": m.get("setup_completo", False),
                "meta_diaria":   m.get("meta_diaria"),
                "lancamentos":   uso_map.get(uid, 0),
                "ultimo_lancamento": ultimo_map.get(uid),
            })

        out.sort(key=lambda x: x.get("lancamentos", 0), reverse=True)
        total = len(out)
        ini = (page - 1) * limit
        return {"total": total, "page": page, "usuarios": out[ini:ini + limit]}

    except HTTPException:
        raise
    except Exception as e:
        log_erro("admin_usuarios_erro", erro=e)
        return {"total": 0, "page": page, "usuarios": [], "erro": str(e)}


# ── Buscar por email ──────────────────────────────────────────────────────────

@router.get("/admin/buscar-usuario")
async def buscar_usuario(request: Request, email: str = ""):
    tok = request.headers.get("X-Admin-Token", "")
    _check(tok)
    if not email:
        raise HTTPException(status_code=400, detail="email obrigatório")
    try:
        users = await _auth_user_by_email(email)
        if not users:
            return {}
        u   = users[0]
        uid = u["id"]
        mot = supabase.table("motoristas").select("nome,setup_completo").eq("id", uid).execute()
        nome = mot.data[0]["nome"] if mot.data else "—"
        ass  = supabase.table("assinaturas").select("status,plano_id,trial_fim,periodo_fim").eq("motorista_id", uid).order("criado_em", desc=True).limit(1).execute()
        a    = ass.data[0] if ass.data else {}
        return {
            "id":           uid,
            "email":        u.get("email"),
            "nome":         nome,
            "status":       a.get("status"),
            "plano":        a.get("plano_id"),
            "trial_fim":    a.get("trial_fim"),
            "periodo_fim":  a.get("periodo_fim"),
            "ultimo_login": u.get("last_sign_in_at"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Liberar acesso ────────────────────────────────────────────────────────────

@router.post("/admin/liberar")
async def liberar_acesso(request: Request, dados: dict = Body(...)):
    tok = request.headers.get("X-Admin-Token", "")
    _check(tok)
    mid   = dados.get("motorista_id", "").strip()
    tipo  = dados.get("tipo", "ativo")
    plano = dados.get("plano_id", "fundador")
    dias  = int(dados.get("dias", 30))
    if not mid:
        raise HTTPException(status_code=400, detail="motorista_id obrigatório")

    agora = _dt.datetime.now(_dt.timezone.utc)
    fim   = agora + _dt.timedelta(days=dias)

    try:
        ass = supabase.table("assinaturas").select("id").eq("motorista_id", mid).order("criado_em", desc=True).limit(1).execute()
        if tipo == "trial":
            upd = {"status": "trial", "plano_id": plano, "trial_inicio": agora.isoformat(), "trial_fim": fim.isoformat(), "atualizado_em": agora.isoformat()}
        elif tipo == "bloqueado":
            # NUNCA apaga dados — só muda o status. Mantém o plano_id existente.
            upd = {"status": "bloqueado", "atualizado_em": agora.isoformat()}
        else:
            upd = {"status": "ativo", "plano_id": plano, "periodo_inicio": agora.isoformat(), "periodo_fim": fim.isoformat(), "atualizado_em": agora.isoformat()}

        if ass.data:
            # Já existe assinatura: só atualiza (preserva plano_id e todo o histórico)
            supabase.table("assinaturas").update(upd).eq("id", ass.data[0]["id"]).execute()
        else:
            # Garante que o motorista existe na tabela motoristas (FK da assinaturas).
            # Usuários que só têm conta de auth mas nunca abriram o app não estão lá.
            try:
                existe = supabase.table("motoristas").select("id").eq("id", mid).limit(1).execute()
                if not existe.data:
                    # Cria registro mínimo para satisfazer a foreign key
                    supabase.table("motoristas").insert({"id": mid, "nome": "—", "setup_completo": False}).execute()
            except Exception as _e:
                log_erro("admin_criar_motorista_minimo_erro", erro=_e)
            # INSERT precisa de plano_id (coluna NOT NULL).
            ins = {"motorista_id": mid, "plano_id": plano, **upd}
            ins.setdefault("plano_id", "fundador")
            supabase.table("assinaturas").insert(ins).execute()

        log_info("acesso_liberado_manual", motorista_id=mid, tipo=tipo, dias=dias)
        return {"ok": True, "mensagem": f"Acesso {tipo} por {dias} dias"}
    except Exception as e:
        log_erro("admin_liberar_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Suporte ───────────────────────────────────────────────────────────────────

@router.post("/suporte/enviar")
async def enviar_ticket(dados: dict = Body(...)):
    """Recebe mensagem de suporte do usuário — sem autenticação obrigatória."""
    nome    = (dados.get("nome") or "").strip()
    email   = (dados.get("email") or "").strip()
    assunto = (dados.get("assunto") or "outro").strip()
    msg     = (dados.get("mensagem") or "").strip()

    if not email or not msg:
        raise HTTPException(status_code=400, detail="email e mensagem são obrigatórios")

    try:
        supabase.table("tickets_suporte").insert({
            "nome":     nome or "—",
            "email":    email,
            "assunto":  assunto,
            "mensagem": msg,
            "status":   "aberto",
        }).execute()
        return {"ok": True, "mensagem": "Mensagem enviada! Retornamos em até 24h."}
    except Exception as e:
        log_erro("suporte_enviar_erro", erro=e)
        raise HTTPException(status_code=500, detail="Erro ao salvar mensagem")


@router.get("/admin/tickets")
async def listar_tickets(
    x_admin_token: str = Header(default=""),
    status: str = Query("todos")
):
    _check(x_admin_token)
    try:
        q = supabase.table("tickets_suporte").select("*").order("criado_em", desc=True)
        if status != "todos":
            q = q.eq("status", status)
        r = q.execute()
        return {"tickets": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suporte/respostas/{motorista_id}")
async def respostas_suporte(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    """Busca respostas do admin para os tickets do usuário."""
    if motorista_id != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    try:
        r = supabase.table("tickets_suporte").select("id,assunto,mensagem,resposta_admin,status,criado_em").eq("motorista_id", motorista_id).order("criado_em", desc=True).limit(10).execute()
        return {"tickets": r.data or []}
    except Exception as e:
        log_erro("respostas_suporte_erro", erro=e)
        return {"tickets": []}


@router.post("/admin/tickets/{ticket_id}/responder")
async def responder_ticket(ticket_id: str, dados: dict = Body(...), x_admin_token: str = Header(default="")):
    """Admin responde um ticket — resposta aparece no app do usuário."""
    if not os.getenv("ADMIN_TOKEN") or x_admin_token != os.getenv("ADMIN_TOKEN"):
        raise HTTPException(status_code=401, detail="Não autorizado")
    resposta = (dados.get("resposta") or "").strip()
    if not resposta:
        raise HTTPException(status_code=400, detail="Resposta vazia")
    try:
        supabase.table("tickets_suporte").update({
            "resposta_admin": resposta,
            "status": "respondido",
            "atualizado_em": _agora().isoformat()
        }).eq("id", ticket_id).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("responder_ticket_erro", erro=e)
        return {"ok": False, "erro": str(e)}


@router.patch("/admin/tickets/{ticket_id}")
async def atualizar_ticket(
    ticket_id: str,
    request: Request,
    dados: dict = Body(...)
):
    tok = request.headers.get("X-Admin-Token", "")
    _check(tok)
    try:
        upd = {}
        if "status" in dados:
            upd["status"] = dados["status"]
        if "resposta" in dados:
            upd["resposta"] = dados["resposta"]
        if upd:
            supabase.table("tickets_suporte").update(upd).eq("id", ticket_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Emails remarketing ────────────────────────────────────────────────────────

@router.get("/admin/emails-remarketing")
async def emails_remarketing(request: Request):
    tok = request.headers.get("X-Admin-Token", "")
    _check(tok)
    try:
        auth_users = await _auth_users()
        auth_map = {u["id"]: u.get("email", "") for u in auth_users}

        ass = supabase.table("assinaturas").select(
            "motorista_id,status,trial_fim,criado_em,email_pagamento"
        ).neq("status", "ativo").execute()

        ids_com_ass = {r["motorista_id"] for r in (ass.data or [])}
        emails = []

        for r in (ass.data or []):
            email = r.get("email_pagamento") or auth_map.get(r["motorista_id"], "")
            if email:
                emails.append({
                    "email":    email,
                    "status":   r.get("status"),
                    "trial_fim": r.get("trial_fim"),
                    "criado_em": r.get("criado_em"),
                })

        for uid, email in auth_map.items():
            if uid not in ids_com_ass and email:
                emails.append({"email": email, "status": "sem_assinatura", "trial_fim": None, "criado_em": None})

        seen = set()
        unique = []
        for e in emails:
            if e["email"] not in seen:
                seen.add(e["email"])
                unique.append(e)

        return {"emails": unique, "total": len(unique)}
    except Exception as e:
        log_erro("admin_emails_remarketing_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/debug-auth")
async def debug_auth(x_admin_token: str = Header(default="")):
    _check(x_admin_token)
    async with _httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"page": 1, "per_page": 5},
            headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
        )
    data = r.json()
    return {
        "status": r.status_code,
        "tipo": type(data).__name__,
        "chaves": list(data.keys()) if isinstance(data, dict) else "lista",
        "total": len(data) if isinstance(data, list) else data.get("total", "?"),
        "amostra": data[:2] if isinstance(data, list) else data.get("users", [])[:2],
    }
