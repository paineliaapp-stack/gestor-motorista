"""Painel admin: métricas, usuários com email, busca e liberação manual."""
import os
import datetime as _dt
import httpx as _httpx
from fastapi import APIRouter, Body, Header, HTTPException, Query, Request
from core.supabase_client import supabase
from core.logging import log_info, log_erro

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")


def _check(token: str):
    esperado = os.getenv("ADMIN_TOKEN", "")
    if not esperado or token != esperado:
        raise HTTPException(status_code=401, detail="Não autorizado")


async def _auth_users(page=1, per_page=1000):
    """Busca todos os usuários do Supabase Auth."""
    async with _httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"page": page, "per_page": per_page},
            headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
        )
    if r.status_code != 200:
        log_erro("auth_users_erro", status=r.status_code, body=r.text[:300])
        raise HTTPException(status_code=502, detail=f"Supabase Auth erro: {r.status_code} — {r.text[:200]}")
    try:
        data = r.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Supabase Auth retornou JSON inválido")
    # Supabase pode retornar {"users": [...]} ou diretamente [...]
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # Algumas versões retornam {"users": [...], "total": N} ou {"data": [...]}
        return data.get("users") or data.get("data") or []
    return []


async def _auth_user_by_email(email: str):
    """Busca um usuário específico por email no Supabase Auth."""
    async with _httpx.AsyncClient(timeout=10) as c:
        r = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"filter": email, "page": 1, "per_page": 50},
            headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
        )
    if r.status_code != 200:
        return []
    users = r.json().get("users", [])
    # filtra exato pelo email
    return [u for u in users if u.get("email", "").lower() == email.lower()]


# ── Métricas ─────────────────────────────────────────────────────────────────

@router.get("/admin/metricas")
async def metricas(x_admin_token: str = Header(default="")):
    _check(x_admin_token)
    out = {
        "total_usuarios": 0, "em_trial": 0, "ativos": 0,
        "expirados": 0, "sem_assinatura": 0,
        "receita_total": 0.0, "novos_7_dias": 0,
        "vagas_fundador_restantes": None, "vagas_fundador_total": None,
        "fundadores": 0, "pro": 0,
    }
    try:
        # Busca todos do Auth para contar total real
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
        # 1. Todos os usuários do Auth (com email)
        auth_users = await _auth_users()
        auth_map = {u["id"]: u for u in auth_users}

        # 2. Nomes da tabela motoristas
        mot = supabase.table("motoristas").select("id,nome,criado_em").execute()
        mot_map = {r["id"]: r for r in (mot.data or [])}

        # 3. Assinaturas
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
                "id":          uid,
                "email":       u.get("email", "—"),
                "nome":        m.get("nome") or u.get("user_metadata", {}).get("name") or "—",
                "status":      s,
                "plano":       a.get("plano_id"),
                "trial_fim":   a.get("trial_fim"),
                "periodo_fim": a.get("periodo_fim"),
                "criado_em":   u.get("created_at"),
                "ultimo_login": u.get("last_sign_in_at"),
            })

        # Ordena por criado_em desc
        out.sort(key=lambda x: x.get("criado_em") or "", reverse=True)
        total = len(out)
        ini   = (page - 1) * limit
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
        mot = supabase.table("motoristas").select("nome").eq("id", uid).execute()
        nome = mot.data[0]["nome"] if mot.data else "—"
        ass  = supabase.table("assinaturas").select("status,plano_id,trial_fim,periodo_fim").eq("motorista_id", uid).order("criado_em", desc=True).limit(1).execute()
        a    = ass.data[0] if ass.data else {}
        return {
            "id":          uid,
            "email":       u.get("email"),
            "nome":        nome,
            "status":      a.get("status"),
            "plano":       a.get("plano_id"),
            "trial_fim":   a.get("trial_fim"),
            "periodo_fim": a.get("periodo_fim"),
            "ultimo_login": u.get("last_sign_in_at"),
        }
    except HTTPException:
        raise
    except Exception as e:
        log_erro("admin_buscar_usuario_erro", erro=e)
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
        else:
            upd = {"status": "ativo", "plano_id": plano, "periodo_inicio": agora.isoformat(), "periodo_fim": fim.isoformat(), "atualizado_em": agora.isoformat()}

        if ass.data:
            supabase.table("assinaturas").update(upd).eq("id", ass.data[0]["id"]).execute()
        else:
            supabase.table("assinaturas").insert({"motorista_id": mid, **upd}).execute()

        log_info("acesso_liberado_manual", motorista_id=mid, tipo=tipo, dias=dias)
        return {"ok": True, "mensagem": f"Acesso liberado: {tipo} por {dias} dias"}
    except Exception as e:
        log_erro("admin_liberar_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Emails remarketing ────────────────────────────────────────────────────────

@router.get("/admin/emails-remarketing")
async def emails_remarketing(request: Request):
    """Todos os emails que usaram e não estão ativos — para remarketing."""
    tok = request.headers.get("X-Admin-Token", "")
    _check(tok)
    try:
        # Busca todos do Auth
        auth_users = await _auth_users()
        auth_map = {u["id"]: u.get("email", "") for u in auth_users}

        # Assinaturas não ativas
        ass = supabase.table("assinaturas").select(
            "motorista_id,status,trial_fim,criado_em,email_pagamento"
        ).neq("status", "ativo").execute()

        # IDs sem nenhuma assinatura
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

        # Usuários sem nenhuma assinatura
        for uid, email in auth_map.items():
            if uid not in ids_com_ass and email:
                emails.append({"email": email, "status": "sem_assinatura", "trial_fim": None, "criado_em": None})

        # Deduplica por email
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
    """Debug: mostra o que o Supabase Auth retorna."""
    _check(x_admin_token)
    async with _httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"page": 1, "per_page": 5},
            headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY}
        )
    return {
        "status": r.status_code,
        "tipo_resposta": type(r.json()).__name__,
        "chaves": list(r.json().keys()) if isinstance(r.json(), dict) else "é lista",
        "total": len(r.json()) if isinstance(r.json(), list) else r.json().get("total", "?"),
        "amostra": r.json()[:2] if isinstance(r.json(), list) else r.json().get("users", [])[:2],
    }
