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


@router.get("/admin/mapa-usuarios")
async def mapa_usuarios(x_admin_token: str = Header(default="")):
    """Agrega usuários por cidade/coordenada para o mapa do admin."""
    _check(x_admin_token)
    try:
        mot = supabase.table("motoristas").select("id,cidade,estado,lat,lon").execute()
        # Agrupa por cidade
        cidades = {}
        com_loc = 0
        for m in (mot.data or []):
            if m.get("lat") is None or m.get("lon") is None:
                continue
            com_loc += 1
            cidade = (m.get("cidade") or "Desconhecida").strip()
            key = cidade
            if key not in cidades:
                cidades[key] = {
                    "cidade": cidade,
                    "estado": m.get("estado") or "",
                    "lat": float(m["lat"]),
                    "lon": float(m["lon"]),
                    "total": 0
                }
            cidades[key]["total"] += 1
        pontos = sorted(cidades.values(), key=lambda x: x["total"], reverse=True)
        return {
            "ok": True,
            "total_com_localizacao": com_loc,
            "total_sem_localizacao": len(mot.data or []) - com_loc,
            "pontos": pontos
        }
    except Exception as e:
        log_erro("mapa_usuarios_erro", erro=e)
        return {"ok": False, "pontos": []}


# ═══════════════ MARKETING & MÉTRICAS DE NEGÓCIO ═══════════════

@router.get("/admin/landing-metricas")
async def landing_metricas(x_admin_token: str = Header(default="")):
    """Totais de visitas e cliques na landing (essencial pra medir anúncios)."""
    _check(x_admin_token)
    try:
        def _conta(tipo):
            r = supabase.table("eventos_landing").select("id", count="exact").eq("tipo", tipo).execute()
            return getattr(r, "count", 0) or 0
        visitas = _conta("visita")
        cliques_gratis = _conta("clique_gratis")
        cliques_assinar = _conta("clique_assinar")
        # Leads e pagamentos (do que já temos)
        try:
            rl = supabase.table("leads_captura").select("id", count="exact").execute()
            leads = getattr(rl, "count", 0) or 0
        except Exception:
            leads = 0
        total_cliques = cliques_gratis + cliques_assinar
        taxa_clique = round((total_cliques / visitas * 100), 1) if visitas else 0
        return {
            "visitas": visitas,
            "cliques_gratis": cliques_gratis,
            "cliques_assinar": cliques_assinar,
            "total_cliques": total_cliques,
            "leads": leads,
            "taxa_clique": taxa_clique,
        }
    except Exception as e:
        log_erro("landing_metricas_erro", erro=e)
        return {"visitas": 0, "cliques_gratis": 0, "cliques_assinar": 0, "total_cliques": 0, "leads": 0, "taxa_clique": 0}


@router.get("/admin/marketing")
async def marketing_listar(x_admin_token: str = Header(default="")):
    """Lista investimentos de marketing + métricas de SaaS (CAC, LTV, churn, MRR, ROI, etc)."""
    _check(x_admin_token)
    hoje = (_dt.datetime.utcnow() - _dt.timedelta(hours=3)).date()
    ini_mes = hoje.replace(day=1).isoformat()
    out = {"investimentos": [], "total_invest": 0.0, "invest_mes": 0.0, "por_categoria": {}, "metricas": {}}

    # 1. Investimentos
    try:
        inv = supabase.table("marketing_investimentos").select("*").order("data", desc=True).execute()
        for r in (inv.data or []):
            v = float(r.get("valor") or 0)
            out["investimentos"].append({
                "id": r.get("id"), "data": r.get("data"), "categoria": r.get("categoria"),
                "valor": v, "descricao": r.get("descricao") or ""
            })
            out["total_invest"] += v
            if str(r.get("data", ""))[:10] >= ini_mes:
                out["invest_mes"] += v
            cat = r.get("categoria") or "Outros"
            out["por_categoria"][cat] = out["por_categoria"].get(cat, 0) + v
    except Exception as e:
        log_erro("marketing_listar_erro", erro=e)

    # 2. Dados para métricas de SaaS
    try:
        ass = supabase.table("assinaturas").select("status,plano_id,mp_subscription_id,criado_em").execute()
        precos = {"fundador": 19.0, "pro": 29.0}
        clientes_pagantes = [r for r in (ass.data or []) if r.get("status") == "ativo" and r.get("mp_subscription_id")]
        n_pagantes = len(clientes_pagantes)
        mrr = sum(precos.get(r.get("plano_id", ""), 0) for r in clientes_pagantes)
        # Churn: cancelados/expirados sobre o total que já foi ativo
        n_expirados = sum(1 for r in (ass.data or []) if r.get("status") in ("expirado", "cancelado", "bloqueado"))
        base_ativa = n_pagantes + n_expirados
        churn = round((n_expirados / base_ativa * 100), 1) if base_ativa > 0 else 0.0

        total_invest = out["total_invest"]
        # CAC = total investido / nº de clientes adquiridos (pagantes)
        cac = round(total_invest / n_pagantes, 2) if n_pagantes > 0 else 0.0
        # Ticket médio mensal
        ticket = round(mrr / n_pagantes, 2) if n_pagantes > 0 else 0.0
        # Tempo de vida médio (meses) = 1/churn mensal. Se churn 0, assume 24 meses (estimativa conservadora)
        churn_frac = churn / 100 if churn > 0 else (1/24)
        vida_meses = round(1 / churn_frac, 1) if churn_frac > 0 else 24.0
        # LTV = ticket médio × tempo de vida
        ltv = round(ticket * vida_meses, 2)
        # ROI = (receita gerada - investimento) / investimento
        receita_total_estimada = mrr * vida_meses  # receita projetada da base atual
        roi = round(((receita_total_estimada - total_invest) / total_invest * 100), 1) if total_invest > 0 else 0.0
        # Payback (meses para recuperar o CAC)
        payback = round(cac / ticket, 1) if ticket > 0 else 0.0
        # LTV/CAC ratio (saudável > 3)
        ltv_cac = round(ltv / cac, 1) if cac > 0 else 0.0
        # ARPU (receita média por usuário, incluindo não-pagantes)
        total_users = len(ass.data or [])
        arpu = round(mrr / total_users, 2) if total_users > 0 else 0.0
        # Taxa de conversão trial→pago
        n_trial = sum(1 for r in (ass.data or []) if r.get("status") == "trial")
        conv = round((n_pagantes / (n_pagantes + n_trial + n_expirados) * 100), 1) if (n_pagantes + n_trial + n_expirados) > 0 else 0.0

        out["metricas"] = {
            "mrr": round(mrr, 2),
            "arr": round(mrr * 12, 2),
            "clientes_pagantes": n_pagantes,
            "cac": cac,
            "ltv": ltv,
            "ltv_cac": ltv_cac,
            "churn": churn,
            "ticket_medio": ticket,
            "arpu": arpu,
            "roi": roi,
            "payback": payback,
            "vida_meses": vida_meses,
            "conversao": conv,
        }
    except Exception as e:
        log_erro("marketing_metricas_erro", erro=e)

    out["total_invest"] = round(out["total_invest"], 2)
    out["invest_mes"] = round(out["invest_mes"], 2)
    return out


@router.post("/admin/marketing")
async def marketing_adicionar(dados: dict = Body(...), x_admin_token: str = Header(default="")):
    """Registra um novo investimento de marketing."""
    _check(x_admin_token)
    data = dados.get("data") or (_dt.datetime.utcnow() - _dt.timedelta(hours=3)).date().isoformat()
    categoria = (dados.get("categoria") or "Outros").strip()
    valor = dados.get("valor")
    descricao = (dados.get("descricao") or "").strip()
    if valor is None:
        raise HTTPException(status_code=400, detail="valor obrigatório")
    try:
        supabase.table("marketing_investimentos").insert({
            "data": data, "categoria": categoria, "valor": float(valor), "descricao": descricao
        }).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("marketing_add_erro", erro=e)
        return {"ok": False}


@router.delete("/admin/marketing/{inv_id}")
async def marketing_remover(inv_id: str, x_admin_token: str = Header(default="")):
    """Remove um investimento de marketing."""
    _check(x_admin_token)
    try:
        supabase.table("marketing_investimentos").delete().eq("id", inv_id).execute()
        return {"ok": True}
    except Exception:
        return {"ok": False}


@router.get("/admin/metricas")
async def metricas(x_admin_token: str = Header(default=""), periodo: str = Query(default="total")):
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
        ass = supabase.table("assinaturas").select("status,plano_id,mp_subscription_id").execute()
        precos = {"fundador": 19.0, "pro": 29.0}
        for r in (ass.data or []):
            s = r.get("status", "")
            if s == "trial":
                out["em_trial"] += 1
            elif s == "ativo":
                out["ativos"] += 1
                # Receita real = SÓ pagamentos via MercadoPago (tem mp_subscription_id).
                # Liberações manuais de teste no admin NÃO contam como receita.
                if r.get("mp_subscription_id"):
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
        # Filtro de período para o ranking: dia, semana, mes ou total
        _hoje_p = (_dt.datetime.utcnow() - _dt.timedelta(hours=3)).date()
        if periodo == "dia":
            _ini_p = _hoje_p.isoformat()
        elif periodo == "semana":
            _ini_p = (_hoje_p - _dt.timedelta(days=_hoje_p.weekday())).isoformat()
        elif periodo == "mes":
            _ini_p = _hoje_p.replace(day=1).isoformat()
        else:
            _ini_p = None  # total
        api_uso = {}
        try:
            ua = supabase.table("uso_api").select("motorista_id,chamadas,data").execute()
            for r in (ua.data or []):
                if _ini_p and str(r.get("data",""))[:10] < _ini_p:
                    continue
                k = r["motorista_id"]
                api_uso[k] = api_uso.get(k, 0) + int(r.get("chamadas") or 0)
        except Exception:
            pass
        out["periodo"] = periodo
        out["total_chamadas_api"] = sum(api_uso.values())
        # Contagem de lançamentos por origem (chat vs manual)
        try:
            _lanc_org = supabase.table("lancamentos").select("origem").execute()
            _por_chat = sum(1 for l in (_lanc_org.data or []) if l.get("origem") == "chat")
            _por_manual = sum(1 for l in (_lanc_org.data or []) if l.get("origem") == "manual")
            _sem_origem = sum(1 for l in (_lanc_org.data or []) if not l.get("origem"))
            out["lanc_por_chat"] = _por_chat
            out["lanc_por_manual"] = _por_manual
            out["lanc_sem_origem"] = _sem_origem
        except Exception:
            out["lanc_por_chat"] = 0
            out["lanc_por_manual"] = 0
            out["lanc_sem_origem"] = 0
        # Custo estimado: ~R$0,01 por chamada (Gemini 2.5 Flash real, conservador)
        CUSTO_POR_CHAMADA = 0.01  # Gemini 2.5 Flash: ~$0,0019/chamada (~R$0,01). Conservador.
        out["custo_api_estimado"] = round(sum(api_uso.values()) * CUSTO_POR_CHAMADA, 2)

        # Ranking por USO (chamadas de API se houver, senão lançamentos) — SEM receita
        # Agrupa por lançamentos sempre; API fica como segunda coluna se tiver dados
        top = sorted(uso.items(), key=lambda x: (api_uso.get(x[0],0), x[1]["lancamentos"]), reverse=True)[:8]
        out["top_usuarios"] = [
            {"id": mid,
             "email": auth_map.get(mid, "—") if auth_map.get(mid, "").strip() and "@" in auth_map.get(mid,"") else (mid[:8] + "…"),
             "chamadas_api": api_uso.get(mid, 0),
             "custo_estimado": round(api_uso.get(mid, 0) * 0.01, 2),
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

        # Uso de API por motorista — total e da semana atual
        import datetime as _dtapi
        _hoje_api = (_dtapi.datetime.utcnow() - _dtapi.timedelta(hours=3)).date()
        _ini_sem_api = (_hoje_api - _dtapi.timedelta(days=_hoje_api.weekday())).isoformat()
        api_uso_map = {}
        api_uso_semana_map = {}
        try:
            _api = supabase.table("uso_api").select("motorista_id,chamadas,data").execute()
            for r in (_api.data or []):
                mid = r.get("motorista_id")
                if mid:
                    ch = int(r.get("chamadas") or 0)
                    api_uso_map[mid] = api_uso_map.get(mid, 0) + ch
                    if str(r.get("data", ""))[:10] >= _ini_sem_api:
                        api_uso_semana_map[mid] = api_uso_semana_map.get(mid, 0) + ch
        except Exception:
            pass

        # Só contagem e último lançamento — NÃO lemos valores financeiros (privacidade do usuário)
        lanc = supabase.table("lancamentos").select("motorista_id,data,created_at").order("created_at", desc=True).execute()
        uso_map = {}
        ultimo_map = {}
        for l in (lanc.data or []):
            mid = l.get("motorista_id")
            if not mid:
                continue
            uso_map[mid] = uso_map.get(mid, 0) + 1
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
                "chamadas_api": api_uso_map.get(uid, 0),
                "custo_api": round(api_uso_map.get(uid, 0) * 0.01, 2),
                "chamadas_api_semana": api_uso_semana_map.get(uid, 0),
                "custo_api_semana": round(api_uso_semana_map.get(uid, 0) * 0.01, 2),
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

@router.post("/admin/remover-usuario")
async def remover_usuario(request: Request, dados: dict = Body(...)):
    """Remove um usuário, mas ARQUIVA todos os dados na lixeira (usuarios_removidos)
    para possível recuperação. Não apaga a conta de auth (Google)."""
    tok = request.headers.get("X-Admin-Token", "")
    _check(tok)
    mid = dados.get("motorista_id") or dados.get("id")
    if not mid:
        raise HTTPException(status_code=400, detail="motorista_id obrigatório")

    tabelas = ["lancamentos", "contas", "assinaturas", "turnos", "metas_dia", "uso_api",
               "tickets_suporte", "plano_compromissos", "pagamentos", "metas", "motoristas"]

    # 1. ARQUIVA: lê todos os dados do usuário antes de apagar
    arquivo = {}
    email = ""
    for tabela in tabelas:
        try:
            campo = "id" if tabela == "motoristas" else "motorista_id"
            r = supabase.table(tabela).select("*").eq(campo, mid).execute()
            arquivo[tabela] = r.data or []
            if tabela == "motoristas" and r.data:
                email = r.data[0].get("email") or r.data[0].get("nome") or ""
        except Exception:
            arquivo[tabela] = []
    # Salva o snapshot na lixeira
    try:
        supabase.table("usuarios_removidos").insert({
            "motorista_id": mid, "email": email, "dados": arquivo
        }).execute()
    except Exception as e:
        log_erro("arquivar_usuario_erro", erro=e)

    # 2. APAGA das tabelas operacionais
    apagados = {}
    for tabela in tabelas:
        try:
            campo = "id" if tabela == "motoristas" else "motorista_id"
            r = supabase.table(tabela).delete().eq(campo, mid).execute()
            apagados[tabela] = len(r.data or [])
        except Exception:
            pass
    log_info("admin_remover_usuario", mid=mid[:8], apagados=str(apagados))
    return {"ok": True, "apagados": apagados, "arquivado": True}


@router.get("/admin/lixeira")
async def lixeira_listar(x_admin_token: str = Header(default="")):
    """Lista usuários removidos (recuperáveis)."""
    _check(x_admin_token)
    try:
        r = supabase.table("usuarios_removidos").select("id,motorista_id,email,removido_em").order("removido_em", desc=True).execute()
        return {"ok": True, "removidos": r.data or []}
    except Exception:
        return {"ok": False, "removidos": []}


@router.post("/admin/restaurar-usuario")
async def restaurar_usuario(dados: dict = Body(...), x_admin_token: str = Header(default="")):
    """Restaura um usuário da lixeira de volta para as tabelas operacionais."""
    _check(x_admin_token)
    arq_id = dados.get("arquivo_id")
    if not arq_id:
        raise HTTPException(status_code=400, detail="arquivo_id obrigatório")
    try:
        r = supabase.table("usuarios_removidos").select("*").eq("id", arq_id).execute()
        if not r.data:
            return {"ok": False, "erro": "Arquivo não encontrado"}
        arquivo = r.data[0].get("dados") or {}
        restaurados = {}
        # Reinsere motoristas primeiro (FK), depois o resto
        ordem = ["motoristas", "assinaturas", "lancamentos", "contas", "turnos", "metas_dia",
                 "uso_api", "tickets_suporte", "plano_compromissos", "pagamentos", "metas"]
        for tabela in ordem:
            linhas = arquivo.get(tabela) or []
            if linhas:
                try:
                    supabase.table(tabela).insert(linhas).execute()
                    restaurados[tabela] = len(linhas)
                except Exception:
                    pass
        # Remove da lixeira
        supabase.table("usuarios_removidos").delete().eq("id", arq_id).execute()
        log_info("admin_restaurar_usuario", arq=arq_id[:8])
        return {"ok": True, "restaurados": restaurados}
    except Exception as e:
        log_erro("restaurar_usuario_erro", erro=e)
        return {"ok": False}


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
