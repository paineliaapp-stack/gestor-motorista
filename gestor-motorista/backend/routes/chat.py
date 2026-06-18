"""Rotas do chat com o Gestor: /chat, /chat-setup e /distribuir-ganho."""
import os
from fastapi import APIRouter, Body, Depends, HTTPException
from core.supabase_client import supabase
from core.config import hoje_brasil
from core.security import _check_rate, get_uid_from_token
from core.logging import log_info, log_warn, log_erro
from services.conta_service import executar_editar_conta
from services.gemini_service import chamar_gemini_chat, chamar_gemini_chat_curto, chamar_gemini_setup
from prompts.chat_prompt import montar_contexto_chat
from prompts.setup_prompt import montar_contexto_setup

router = APIRouter()

@router.post("/chat-setup")
async def chat_setup(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    # Força motorista_id = uid do token
    dados["motorista_id"] = uid
    dados["mid"] = uid
    """Chat do onboarding guiado — Gestor coleta dados do novo usuário."""
    import httpx, json as _json
    uid = dados.get("id") or dados.get("motorista_id")
    mensagem = str(dados.get("mensagem", ""))[:1000]  # limite 1000 chars
    historico = dados.get("historico", [])
    # Pré-normaliza valores monetários com vírgula: "156,28" não vire "156" e "28"
    # Substitui padrões como "R$156,28" ou "156,28" por "R$156.28" antes de mandar ao Gemini
    import re as _re_pre
    def _norm_valor(m):
        # só normaliza se parece número monetário (dígitos,dígitos onde parte após vírgula tem 1-2 dígitos)
        full = m.group(0)
        parts = full.replace("R$","").replace(" ","").split(",")
        if len(parts)==2 and parts[1].isdigit() and len(parts[1])<=2:
            return full.replace(",",".")
        return full
    mensagem = _re_pre.sub(r'R?\$?\s*\d+,\d{1,2}', _norm_valor, mensagem)
    nome = dados.get("nome", "motorista")

    contexto_setup = montar_contexto_setup(nome=nome)

    msgs = [
        {"role": "user", "parts": [{"text": contexto_setup}]},
        {"role": "model", "parts": [{"text": "Entendido. Vou conduzir o setup de forma amigável, um passo por vez, e retornar sempre em JSON."}]}
    ]
    for h in (historico or []):
        role = "model" if h["role"] == "assistant" else h["role"]
        msgs.append({"role": role, "parts": [{"text": h["content"]}]})
    msgs.append({"role": "user", "parts": [{"text": mensagem if mensagem else "oi"}]})

    result = await chamar_gemini_setup(msgs)

    texto = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    if not texto:
        return {"resposta": "Ops, tive um problema técnico. Tenta de novo!", "setup_completo": False}

    try:
        parsed = _json.loads(texto.strip())
        resposta = parsed.get("resposta", "")
        setup_completo = parsed.get("setup_completo", False)
        setup_dados = parsed.get("setup_dados", {})

        # Se setup completo, salva dados no banco
        if setup_completo and uid:
            update = {"setup_completo": True}
            if setup_dados.get("meta_diaria"): update["meta_diaria"] = float(setup_dados["meta_diaria"])
            if setup_dados.get("comb_diario"): update["comb_diario"] = float(setup_dados["comb_diario"])
            if setup_dados.get("plataformas"): update["plataformas"] = ",".join(setup_dados["plataformas"])
            if setup_dados.get("tipo_veiculo"): update["tipo_veiculo"] = setup_dados["tipo_veiculo"]
            try:
                supabase.table("motoristas").update(update).eq("id", uid).execute()
            except Exception as e:
                log_erro("setup_salvar_erro", erro=e)

            # Registra contas coletadas
            contas_setup = setup_dados.get("contas", [])
            for conta in contas_setup:
                if conta.get("descricao") and conta.get("valor") and conta.get("vencimento"):
                    try:
                        supabase.table("contas").insert({
                            "motorista_id": uid,
                            "descricao": conta["descricao"],
                            "valor": float(conta["valor"]),
                            "vencimento": conta["vencimento"],
                            "pago": False
                        }).execute()
                    except: pass

        return {"resposta": resposta, "setup_completo": setup_completo, "setup_dados": setup_dados}
    except Exception as e:
        log_erro("setup_parse_erro", erro=e)
        return {"resposta": "Não entendi bem. Me conta de novo?", "setup_completo": False}

def _veiculo_ativo(mid: str):
    """Veículo atual do motorista para marcar o lançamento. 'ambos' → None (não força)."""
    try:
        from core.supabase_client import supabase as _sb
        r = _sb.table("motoristas").select("tipo_veiculo").eq("id", mid).execute()
        v = (r.data or [{}])[0].get("tipo_veiculo")
        return v if v in ("carro", "moto") else None
    except Exception:
        return None


@router.post("/chat")
async def chat(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    # uid vem do token JWT verificado — ignora qualquer motorista_id do body
    motorista_id = uid
    if not _check_rate(motorista_id):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"resposta": "Muitas mensagens. Aguarde um momento.", "acoes": []})
    # Limite de tamanho do histórico — evita payload gigante
    if dados.get("historico") and len(str(dados.get("historico", ""))) > 50000:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"resposta": "Payload muito grande.", "acoes": []})
    import httpx, json
    mensagem = str(dados.get("mensagem", ""))[:1000]  # limite 1000 chars

    # Proteção básica contra prompt injection
    _injection_patterns = [
        "ignore previous", "ignore as instruções", "esqueça tudo", "novo sistema",
        "system prompt", "você agora é", "aja como", "finja ser", "ignore all",
        "disregard", "forget everything", "jailbreak", "DAN mode"
    ]
    if any(p.lower() in mensagem.lower() for p in _injection_patterns):
        return {"resposta": "Não consigo processar essa mensagem.", "acoes": []}

    historico = dados.get("historico", [])
    semana_relatorio = dados.get("semana_relatorio")  # {ini, fim} ou None

    # Busca contexto completo do motorista
    import datetime
    contas = []
    lancamentos_mes = []
    hoje = hoje_brasil()
    inicio_mes = hoje.replace(day=1).isoformat()
    hoje_str = hoje.isoformat()
    import datetime as _dt2
    ontem_str = (hoje - _dt2.timedelta(days=1)).isoformat()
    amanha_str = (hoje + _dt2.timedelta(days=1)).isoformat()
    # Sábado passado
    dias_ate_sabado = (hoje.weekday() - 5) % 7  # 5 = sábado
    sabado_str = (hoje - _dt2.timedelta(days=dias_ate_sabado if dias_ate_sabado > 0 else 7)).isoformat()
    # Próximo sábado e sábado que vem (para edição de contas)
    dias_para_prox_sabado = (5 - hoje.weekday()) % 7 or 7  # 5 = sábado
    proximo_sabado_str = (hoje + _dt2.timedelta(days=dias_para_prox_sabado)).isoformat()
    sabado_que_vem_str = (hoje + _dt2.timedelta(days=dias_para_prox_sabado + 7)).isoformat()
    # Datas "daqui X dias" pré-calculadas
    daqui2_str = (hoje + _dt2.timedelta(days=2)).isoformat()
    daqui3_str = (hoje + _dt2.timedelta(days=3)).isoformat()
    daqui7_str = (hoje + _dt2.timedelta(days=7)).isoformat()
    try:
        c = supabase.table("contas").select("*").eq("motorista_id", motorista_id).execute()
        contas = c.data or []
    except: pass
    try:
        lr = supabase.table("lancamentos").select("id,tipo,valor,descricao,plataforma,data,horas_rodadas,km_rodados,created_at").eq("motorista_id", motorista_id).gte("data", inicio_mes).order("data", desc=True).execute()
        lancamentos_mes = lr.data or []
        log_info("chat_ctx", lancamentos=len(lancamentos_mes))
    except Exception as e:
        log_erro("chat_lanc_erro", erro=e)

    # Calcula totais para a IA responder perguntas diretamente
    ganhos_hoje = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho" and l["data"] == hoje_str)
    despesas_hoje = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa" and l["data"] == hoje_str)
    ganhos_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho")
    despesas_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa")
    lucro_mes = ganhos_mes - despesas_mes
    # Horas do mês via tabela turnos
    try:
        tr_mes = supabase.table("turnos").select("horas,data").eq("motorista_id", motorista_id).gte("data", inicio_mes).execute()
        horas_mes = sum(float(t.get("horas") or 0) for t in (tr_mes.data or []))
        turnos_mes = tr_mes.data or []
    except:
        horas_mes = 0
        turnos_mes = []
    km_mes = sum(float(l.get("km_rodados") or 0) for l in lancamentos_mes)
    contas_pendentes = [c for c in contas if not c.get("pago")]
    total_pendente = sum(float(c["valor"]) for c in contas_pendentes)

    # Calcula déficit real para o gestor poder ser proativo
    import datetime as _dt
    try:
        perf_chat = supabase.table("motoristas").select("meta_diaria,comb_diario,tipo_veiculo").eq("id", motorista_id).execute()
        meta_dia_config = float((perf_chat.data or [{}])[0].get("meta_diaria") or 300)
        comb_dia_chat = float((perf_chat.data or [{}])[0].get("comb_diario") or 0)
        tipo_veiculo = (perf_chat.data or [{}])[0].get("tipo_veiculo") or "carro"
    except:
        meta_dia_config = 300
        comb_dia_chat = 0
        tipo_veiculo = "carro"
    # Usa média real do histórico quando disponível (mais preciso que a meta configurada)
    ganhos_dias_trabalhados = [l for l in lancamentos_mes if l["tipo"] == "ganho"]
    dias_com_ganho = len(set(l["data"] for l in ganhos_dias_trabalhados))
    if dias_com_ganho >= 3:
        media_bruta_real = ganhos_mes / dias_com_ganho
        # Limita a variação: no máximo 2x a meta configurada para evitar distorções por dias atípicos
        meta_dia_chat = min(media_bruta_real, meta_dia_config * 2)
    else:
        meta_dia_chat = meta_dia_config
    # Combustível: configurado > histórico > cap de 40%
    if comb_dia_chat <= 0:
        comb_total = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa" and "combustivel" in (l.get("descricao") or "").lower())
        dias_mes_ate_hoje = max(1, hoje.day)
        comb_diario_hist = round(comb_total / dias_mes_ate_hoje, 0) if comb_total > 10 else 0
        comb_pct_hist = comb_diario_hist / meta_dia_chat if meta_dia_chat > 0 else 0
        comb_dia_chat = round(comb_diario_hist if comb_pct_hist <= 0.40 else meta_dia_chat * 0.30, 0)
    liq_dia_chat = max(0, meta_dia_chat - comb_dia_chat)
    taxa_comb_pct = round((comb_dia_chat / meta_dia_chat * 100), 1) if meta_dia_chat > 0 else 25.0

    # Calcula janela de dias relevante:
    # Usa o vencimento mais próximo das contas pendentes como horizonte (máx 10 dias)
    # Isso evita que no último dia do mês o sistema projete só 1 dia
    import calendar as _cal
    fim_mes_chat = hoje.replace(day=_cal.monthrange(hoje.year, hoje.month)[1])
    
    # Busca vencimento mais próximo entre as contas pendentes
    contas_pend_chat = [c for c in contas if not c.get("pago") and not any(k in (c.get("descricao","") or "").lower() for k in ["combustivel","gasolina","etanol"])]
    vencimentos_pend = []
    for c in contas_pend_chat:
        try:
            import datetime as _dt3
            v = _dt3.date.fromisoformat(c["vencimento"])
            if v >= hoje:
                vencimentos_pend.append((v - hoje).days)
        except:
            pass
    
    # Horizonte: próximo vencimento ou 7 dias (o que for maior), máx 10 dias
    proximo_venc_dias = min(vencimentos_pend) if vencimentos_pend else 7
    horizonte_dias = max(7, min(proximo_venc_dias + 2, 10))
    
    # Para o cálculo do déficit, usa os dias restantes do mês OU horizonte (o maior)
    dias_rest_chat = max(horizonte_dias, (fim_mes_chat - hoje).days + 1)
    projecao_liq_chat = liq_dia_chat * dias_rest_chat
    poder_chat = lucro_mes + projecao_liq_chat  # caixa atual + projeção
    deficit_chat = max(0, total_pendente - poder_chat)
    # Cenário de esforço: quanto precisaria por dia para fechar
    if deficit_chat > 0 and dias_rest_chat > 0:
        liq_extra_necessario = deficit_chat / dias_rest_chat
        cap_esforco_chat = round((liq_dia_chat + liq_extra_necessario + comb_dia_chat + 49) / 50) * 50
        cap_esforco_chat = min(cap_esforco_chat, meta_dia_chat * 2)  # máx 2x a meta normal
    else:
        cap_esforco_chat = 0

    log_info("chat_totais", g_hoje=round(ganhos_hoje,2), g_mes=round(ganhos_mes,2))
    # Monta resumo dos lançamentos de hoje para detecção de duplicatas
    import json as _json
    lancamentos_hoje_lista = [l for l in lancamentos_mes if l.get("data") == hoje_str]
    ganhos_hoje_detalhe = [(l.get("plataforma","?"), float(l.get("valor",0)), l.get("created_at","")) for l in lancamentos_hoje_lista if l["tipo"] == "ganho"]
    despesas_hoje_detalhe = [(l.get("descricao","?"), float(l.get("valor",0)), l.get("created_at","")) for l in lancamentos_hoje_lista if l["tipo"] == "despesa"]

    # Lista dos últimos lançamentos com ID/valor/categoria/hora — pra IA identificar qual cancelar/editar
    # com precisão (por valor, hora ou categoria) em vez de adivinhar por posição.
    def _hora_br(ts):
        try:
            from datetime import datetime as _d
            dt = _d.fromisoformat(str(ts).replace("Z","+00:00"))
            from datetime import timedelta as _td
            dt = dt - _td(hours=3)
            return dt.strftime("%Hh%M")
        except Exception:
            return "?"
    _ultimos = sorted(lancamentos_mes, key=lambda x: x.get("created_at",""), reverse=True)[:10]
    ultimos_lancamentos_txt = "\n".join(
        f'  #{i+1} [id:{l.get("id")}] {l.get("tipo")} R${float(l.get("valor",0)):.2f} '
        f'{l.get("plataforma") or l.get("descricao") or "?"} '
        f'em {l.get("data","?")} {_hora_br(l.get("created_at",""))}'
        for i, l in enumerate(_ultimos)
    ) or "  (nenhum lançamento ainda)"

    # Lançamentos de ontem (para detecção de duplicata e referências)
    ontem_str_ctx = ontem_str
    lanc_ontem = [l for l in lancamentos_mes if l.get("data","") == ontem_str_ctx]
    ganhos_ontem_detalhe = [(l.get("plataforma","?"), float(l.get("valor",0))) for l in lanc_ontem if l["tipo"] == "ganho"]

    # Pré-computa JSON de contas para evitar bug de f-string com dict
    contas_json = _json.dumps(
        [{"descricao": c.get("descricao"), "valor": c.get("valor"), "vencimento": c.get("vencimento"), "pago": c.get("pago"), "valor_pago": c.get("valor_pago")} for c in contas],
        ensure_ascii=False, default=str
    )

    # Renda extra da semana — precisa ser calculado ANTES do f-string que usa {renda_extra_ctx}
    import datetime as _dt_re
    semana_inicio_re = (hoje - _dt_re.timedelta(days=7)).isoformat()
    RENDA_EXTRA_PLATS = ['renda_extra','gorjeta','freelance','bico','bonus','seguro_desemprego','venda','aluguel_recebido']
    renda_extra_semana = [
        {"data": l["data"], "plataforma": l.get("plataforma",""), "valor": float(l["valor"])}
        for l in lancamentos_mes
        if l["tipo"] == "ganho"
        and l.get("data","") >= semana_inicio_re
        and (l.get("plataforma","") or "").lower().replace(" ","_") in RENDA_EXTRA_PLATS
    ]
    renda_extra_semana_total = sum(r["valor"] for r in renda_extra_semana)
    if renda_extra_semana:
        itens_re = ", ".join(f"R${r['valor']:.0f} ({r['plataforma']}) em {r['data']}" for r in renda_extra_semana)
        renda_extra_ctx = f"\nRENDA EXTRA ESSA SEMANA: {itens_re} — total R${renda_extra_semana_total:.2f}"
    else:
        renda_extra_ctx = "\nRENDA EXTRA ESSA SEMANA: nenhuma registrada."

    # Monta aviso de contexto semanal se necessário
    _semana_ctx_str = ""
    if semana_relatorio and semana_relatorio.get("ini") and semana_relatorio.get("fim"):
        _sem_ini = semana_relatorio["ini"]
        _sem_fim = semana_relatorio["fim"]
        _semana_ctx_str = f"\n\n⚠️ CONTEXTO ESPECIAL: Esta conversa é sobre o RELATÓRIO DA SEMANA {_sem_ini} a {_sem_fim}. Ao responder perguntas sobre ganhos, despesas, dias trabalhados ou qualquer dado dessa semana, use SOMENTE os lançamentos desse intervalo de datas — não da semana atual (que começa em {hoje_str})."

    contexto = montar_contexto_chat(_semana_ctx_str=_semana_ctx_str, amanha_str=amanha_str, cap_esforco_chat=cap_esforco_chat, comb_dia_chat=comb_dia_chat, contas_json=contas_json, contas_pendentes=contas_pendentes, daqui2_str=daqui2_str, daqui3_str=daqui3_str, daqui7_str=daqui7_str, deficit_chat=deficit_chat, despesas_hoje=despesas_hoje, despesas_hoje_detalhe=despesas_hoje_detalhe, despesas_mes=despesas_mes, dias_rest_chat=dias_rest_chat, ganhos_hoje=ganhos_hoje, ganhos_hoje_detalhe=ganhos_hoje_detalhe, ganhos_mes=ganhos_mes, ganhos_ontem_detalhe=ganhos_ontem_detalhe, hoje_str=hoje_str, horas_mes=horas_mes, inicio_mes=inicio_mes, lancamentos_mes=lancamentos_mes, lucro_mes=lucro_mes, meta_dia_chat=meta_dia_chat, ontem_str=ontem_str, ontem_str_ctx=ontem_str_ctx, poder_chat=poder_chat, projecao_liq_chat=projecao_liq_chat, proximo_sabado_str=proximo_sabado_str, renda_extra_ctx=renda_extra_ctx, sabado_que_vem_str=sabado_que_vem_str, sabado_str=sabado_str, taxa_comb_pct=taxa_comb_pct, tipo_veiculo=tipo_veiculo, total_pendente=total_pendente, ultimos_lancamentos_txt=ultimos_lancamentos_txt)

    # Separa prompt em system_instruction (estático, cacheável) + contexto dinâmico
    # A seção AÇÕES nunca muda → vai para system_instruction → Gemini 2.5 Flash
    # aplica implicit caching automático em prefixos >1024 tokens, reduzindo custo ~75%
    _ACOES_MARKER = "=== AÇÕES (responda SEMPRE em JSON puro) ==="
    _PLANO_MARKER = "=== PLANO FINANCEIRO ==="
    _acoes_start = contexto.find(_ACOES_MARKER)
    _plano_start = contexto.find(_PLANO_MARKER)
    if _acoes_start != -1 and _plano_start != -1:
        _system_static = contexto[_acoes_start:_plano_start].strip()
        _contexto_dinamico = contexto[:_acoes_start] + contexto[_plano_start:]
    else:
        _system_static = None
        _contexto_dinamico = contexto

    if _system_static:
        msgs = [{"role": "user", "parts": [{"text": _contexto_dinamico}]},
                {"role": "model", "parts": [{"text": "Entendido. Pronto para registrar."}]}]
        _gemini_payload_extra = {"system_instruction": {"parts": [{"text": _system_static}]}}
    else:
        msgs = [{"role": "user", "parts": [{"text": contexto}]},
                {"role": "model", "parts": [{"text": "Entendido. Estou pronto para registrar e responder de forma curta."}]}]
        _gemini_payload_extra = {}
    # Limita histórico a 8 mensagens para evitar MAX_TOKENS no Gemini
    hist_curto = (historico or [])[-8:]
    for h in hist_curto:
        role = "model" if h["role"] == "assistant" else h["role"]
        txt = str(h.get("content",""))[:600]  # trunca msgs muito longas
        msgs.append({"role": role, "parts": [{"text": txt}]})
    msgs.append({"role": "user", "parts": [{"text": mensagem}]})

    result = await chamar_gemini_chat(msgs, _gemini_payload_extra)
    # Conta uso de API (custo Gemini) por usuário/dia — para o admin ver quem usa mais
    try:
        import datetime as __dt
        from core.supabase_client import supabase as __sb
        __hoje = __dt.date.today().isoformat()
        __ex = __sb.table("uso_api").select("chamadas").eq("motorista_id", uid).eq("data", __hoje).execute()
        if __ex.data:
            __sb.table("uso_api").update({"chamadas": (__ex.data[0].get("chamadas") or 0) + 1}).eq("motorista_id", uid).eq("data", __hoje).execute()
        else:
            __sb.table("uso_api").insert({"motorista_id": uid, "data": __hoje, "chamadas": 1}).execute()
    except Exception:
        pass

    if "error" in result:
        err_detail = result['error'].get('message','sem detalhes')
        log_erro("gemini_api_err", msg=str(err_detail)[:150])
        log_erro("gemini_falhou", erro=err_detail)
        return {"resposta": "Estou com dificuldade para processar agora. Tenta de novo em alguns segundos! 🙏", "acao": None}

    candidates = result.get("candidates", [])
    # candidates debug removido
    if candidates:
        finish = candidates[0].get("finishReason","")
        # finishReason debug removido
        if finish in ("MAX_TOKENS", "RECITATION", "SAFETY"):
            log_warn("gemini_retry", finish=finish)
            # Tenta de novo com histórico reduzido (só última mensagem)
            msgs_curto = [msgs[0], msgs[-1]]  # só system + mensagem atual
            try:
                result2 = await chamar_gemini_chat_curto(msgs_curto, _gemini_payload_extra)
                if "candidates" in result2:
                    result = result2
                    candidates = result2.get("candidates",[])
            except Exception as e2:
                log_erro("gemini_retry_erro", erro=e2)

    texto = ""
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        texto = parts[0].get("text","") if parts else ""
    
    log_info("gemini_resp", texto_len=len(texto))
    if not texto:
        log_warn("gemini_sem_candidatos")
        return {"resposta": "Não entendi. Pode repetir de outro jeito?", "acao": None}

    # Executa todas as ações retornadas pelo Gemini (JSON mode)
    acoes_executadas = []
    try:
        texto_parse = texto.strip()
        if texto_parse.startswith("```"):
            texto_parse = texto_parse.split("```")[1]
            if texto_parse.startswith("json"):
                texto_parse = texto_parse[4:]
            texto_parse = texto_parse.strip()
        # Tenta localizar JSON pelo índice (funciona mesmo com texto antes do {)
        start = texto_parse.find("{")
        end = texto_parse.rfind("}") + 1
        if start >= 0 and end > start:
            texto_parse = texto_parse[start:end]
        parsed = json.loads(texto_parse)
        lista_acoes = parsed.get("acoes", [])
        texto = parsed.get("resposta", "")

        # PROTEÇÃO anti-inflação de valor (ex: usuário manda "350" e a IA entende 350350).
        # Acontece dentro do modelo; aqui detectamos e corrigimos antes de usar/exibir.
        try:
            _m = mensagem.strip().replace("R$","").replace("r$","").replace(" ","")
            if _m.isdigit() and 1 <= len(_m) <= 6:   # usuário mandou só um número inteiro
                _su = _m
                _vu = float(_su)
                _dup = _su + _su  # ex "350350"
                def _fix_valor(v):
                    try:
                        vi = float(v)
                        si = str(int(vi)) if vi == int(vi) else None
                        if si and si == _dup:
                            return _vu
                    except Exception: pass
                    return v
                for _a in lista_acoes:
                    if isinstance(_a, dict) and _a.get("valor") is not None:
                        _a["valor"] = _fix_valor(_a["valor"])
                # No texto: troca o número duplicado pelo certo (com e sem formatação de milhar)
                import re as _rfix
                _dup_fmt = f"{int(_dup):,}".replace(",", ".")   # ex "350.350"
                texto = texto.replace(_dup_fmt + ",00", _su).replace(_dup_fmt, _su).replace(_dup, _su)
        except Exception:
            pass

        # PROTEÇÃO anti-FALSA-DUPLICATA: às vezes a IA REGISTRA um lançamento novo
        # e mesmo assim devolve a pergunta de duplicata ("é o mesmo?"), confundindo o
        # motorista — mesmo sem existir nenhum lançamento igual hoje. Como o contexto
        # (ganhos/despesas_hoje_detalhe) é o snapshot ANTES desta mensagem, dá pra saber
        # deterministicamente se o lançamento é inédito. Se for, troca por confirmação limpa.
        try:
            _tl = (texto or "").lower()
            _pergunta_dup = ("é o mesmo" in _tl or "e o mesmo" in _tl
                             or "ou o mesmo" in _tl or "mesmo lançamento" in _tl
                             or "mesmo lancamento" in _tl)
            if _pergunta_dup:
                _novos = [a for a in lista_acoes
                          if isinstance(a, dict)
                          and a.get("acao") == "registrar_lancamento"
                          and not a.get("substituir")]
                def _ja_existe_hoje(a):
                    try:
                        v = float(a.get("valor", 0) or 0)
                    except Exception:
                        return False
                    if a.get("tipo") == "ganho":
                        plat = (a.get("plataforma") or "").lower()
                        return any(abs(vv - v) < 0.01 and (p or "").lower() == plat
                                   for (p, vv, _ts) in ganhos_hoje_detalhe)
                    if a.get("tipo") == "despesa":
                        desc = (a.get("descricao") or a.get("categoria") or "").lower()
                        return any(abs(vv - v) < 0.01 and (d or "").lower() == desc
                                   for (d, vv, _ts) in despesas_hoje_detalhe)
                    return False
                # há lançamento(s) novo(s) e NENHUM já existia hoje → pergunta indevida
                if _novos and not any(_ja_existe_hoje(a) for a in _novos):
                    _partes = []
                    for a in _novos:
                        try:
                            v = float(a.get("valor", 0) or 0)
                        except Exception:
                            continue
                        _vfmt = f"R${int(v)}" if v == int(v) else f"R${v:.2f}".replace(".", ",")
                        if a.get("tipo") == "ganho":
                            _partes.append(f"{_vfmt} na {a.get('plataforma') or 'plataforma'}")
                        else:
                            _partes.append(f"{_vfmt} de {a.get('descricao') or a.get('categoria') or 'despesa'}")
                    if _partes:
                        texto = "Anotei! ✅ " + " e ".join(_partes) + " hoje."
                        log_info("chat_falsa_duplicata_corrigida", qtd=len(_partes))
        except Exception:
            pass

        if not texto or texto.strip() in ("OK", "ok", "", "Entendido.", "Entendido"):
            # Se há ações, gera confirmação automática descrevendo o que foi feito
            if lista_acoes:
                partes = []
                for _a in lista_acoes:
                    if isinstance(_a, dict):
                        _ac = _a.get("acao","")
                        if _ac == "editar_conta":
                            _desc = _a.get("descricao","conta")
                            _campo = _a.get("campo","")
                            _val = _a.get("novo_valor","")
                            if _campo == "vencimento":
                                partes.append(f"{_desc} → {_val}")
                            else:
                                partes.append(f"{_desc} {_campo} → {_val}")
                        elif _ac == "registrar_lancamento":
                            partes.append(f"R${_a.get('valor',0)} registrado")
                if partes:
                    texto = "✅ " + " | ".join(partes)
                else:
                    texto = "✅ Feito!"
            else:
                texto = "Pode repetir? Não entendi bem o que você quis dizer."
        log_info("chat_parse_ok", qtd=len(lista_acoes))
    except Exception as e:
        log_erro("chat_parse_erro", erro=e, texto=texto[:200])
        lista_acoes = []
        # Tenta extrair só o campo "resposta" com regex como fallback
        import re as _re
        m = _re.search(r'"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"', texto)
        if m:
            texto = m.group(1).replace("\\n", "\n").replace('\\"', '"')
        elif not texto.startswith("{") and not texto.startswith("["):
            pass  # texto já é texto puro, mantém
        else:
            texto = "Pode repetir? Não entendi bem."
    log_info("chat_exec_acoes", qtd=len(lista_acoes))
    linhas_json = lista_acoes  # já são dicts, não precisa serializar

    # ANTI-DUPLICACAO: a IA às vezes cria 2+ lançamentos IDÊNTICOS de um valor citado
    # UMA vez (ex: "gastei 2 reais em marketing" -> "Anotei DUAS despesas de R$2").
    # Só mantém cópias idênticas se o motorista REPETIU o valor (ex "20 e 20") ou usou
    # palavra de quantidade (duas/dois/várias...). Senão, colapsa pra uma.
    try:
        import re as _re
        _regs_n = sum(1 for a in linhas_json if isinstance(a, dict) and a.get("acao") == "registrar_lancamento")
        if _regs_n >= 2:
            _msg_low = (mensagem or "").lower()
            def _pn(s):
                s = s.strip()
                if "," in s: s = s.replace(".", "").replace(",", ".")
                elif s.count(".") == 1 and len(s.split(".")[1]) == 3: s = s.replace(".", "")
                try: return float(s)
                except Exception: return None
            _nums_msg = [x for x in (_pn(n) for n in _re.findall(r"\d+(?:[.,]\d+)?", _msg_low)) if x is not None]
            _tem_plural = bool(_re.search(r"(\bduas\b|\bdois\b|\btr[eê]s\b|\bquatro\b|\bcinco\b|\bv[aá]rias?\b|\bv[aá]rios?\b|\bcada\b|\bambas\b|\bambos\b|\d\s*x\b|\bx\s*\d)", _msg_low))
            def _key(a):
                return (a.get("tipo"), round(float(a.get("valor", 0) or 0), 2),
                        (a.get("plataforma") or "").lower(),
                        (a.get("descricao") or a.get("categoria") or "").lower(),
                        a.get("data") or "")
            _vistos, _novas, _colapsou = {}, [], False
            for a in linhas_json:
                if isinstance(a, dict) and a.get("acao") == "registrar_lancamento":
                    try: _v = float(a.get("valor", 0) or 0)
                    except Exception: _v = None
                    _ocorr = sum(1 for n in _nums_msg if _v is not None and abs(n - _v) < 0.01)
                    _permitido = max(_ocorr, 2 if _tem_plural else 1, 1)
                    k = _key(a)
                    if _vistos.get(k, 0) >= _permitido:
                        _colapsou = True
                        continue  # descarta cópia idêntica excedente
                    _vistos[k] = _vistos.get(k, 0) + 1
                _novas.append(a)
            if _colapsou:
                lista_acoes = linhas_json = _novas
                _regs2 = [a for a in _novas if isinstance(a, dict) and a.get("acao") == "registrar_lancamento"]
                _partes = []
                for a in _regs2:
                    try: v = float(a.get("valor", 0) or 0)
                    except Exception: continue
                    _vf = f"R${int(v)}" if v == int(v) else f"R${v:.2f}".replace(".", ",")
                    if a.get("tipo") == "ganho":
                        _partes.append(f"{_vf} na {a.get('plataforma') or 'plataforma'}")
                    else:
                        _partes.append(f"{_vf} de {a.get('descricao') or a.get('categoria') or 'despesa'}")
                if _partes:
                    texto = "Anotei! ✅ " + " e ".join(_partes) + " hoje."
                log_warn("lancamentos_identicos_colapsados")
    except Exception:
        pass
    acoes_executadas_count = 0

    # === DETECÇÃO DE VALOR ALTO: ganho muito acima da média = pode ser acumulado de vários dias ===
    # Calcula média diária real do motorista (últimos 30 dias, excluindo outliers)
    _media_diaria_real = meta_dia_chat  # já calculada acima
    _LIMIAR_PERIODO = max(700, _media_diaria_real * 2.5)  # mínimo R$700 ou 2.5x a média

    # Verifica se há algum ganho alto suspeito na lista de ações
    _ganho_alto_pendente = None
    for _linha_check in linhas_json:
        _a = _linha_check if isinstance(_linha_check, dict) else json.loads(_linha_check)
        if (_a.get("acao") == "registrar_lancamento"
                and _a.get("tipo", "ganho") == "ganho"
                and float(_a.get("valor", 0)) >= _LIMIAR_PERIODO
                and not _a.get("periodo_ja_confirmado")):  # flag para não perguntar de novo
            _ganho_alto_pendente = _a
            break

    if _ganho_alto_pendente:
        _valor_alto = float(_ganho_alto_pendente.get("valor", 0))
        _plat_alta = _ganho_alto_pendente.get("plataforma", "app")
        log_info("valor_alto", valor=_valor_alto, plataforma=_plat_alta)
        # Separa ações: executa tudo EXCETO o ganho alto suspeito
        _acoes_nao_ganho_alto = [_a for _a in linhas_json if not (
            isinstance(_a, dict)
            and _a.get("acao") == "registrar_lancamento"
            and _a.get("tipo", "ganho") == "ganho"
            and float(_a.get("valor", 0)) >= _LIMIAR_PERIODO
            and not _a.get("periodo_ja_confirmado")
        )]
        # Executa ações não-ganho (editar_conta, despesas normais, etc.)
        for _linha_ng in _acoes_nao_ganho_alto:
            try:
                _a_ng = _linha_ng if isinstance(_linha_ng, dict) else json.loads(_linha_ng)
                if _a_ng.get("acao") == "editar_conta":
                    # Unificado em services/conta_service.executar_editar_conta
                    if executar_editar_conta(
                        motorista_id,
                        _a_ng.get("descricao", ""),
                        _a_ng.get("campo"),
                        _a_ng.get("novo_valor"),
                        valor_filtro=_a_ng.get("valor_filtro"),
                        vencimento_alvo=_a_ng.get("vencimento_alvo"),
                    ):
                        acoes_executadas.append("conta_editada")
            except Exception as _eng_e:
                log_erro("acao_nganho_erro", erro=_eng_e)
        return {
            "resposta": texto,
            "acao": "conta_editada" if "conta_editada" in acoes_executadas else None,
            "acoes_count": len(acoes_executadas),
            "acoes_esperadas": len(linhas_json),
            "aguarda_periodo": True,
            "ganho_pendente": {
                "valor": _valor_alto,
                "plataforma": _plat_alta,
                "descricao": _ganho_alto_pendente.get("descricao", ""),
                "lista_acoes_original": linhas_json
            }
        }

    _lanc_deletados_real = 0  # conta linhas de lancamento REALMENTE apagadas (pra nao afirmar "apaguei" sem efeito)
    for linha in linhas_json:
        try:
            acao = linha if isinstance(linha, dict) else json.loads(linha)
            log_info("chat_acao", acao=acao.get("acao","?"))
            if acao.get("acao") == "registrar_lancamento":
                import datetime as _dt
                hoje = hoje_brasil()
                ontem = (hoje - _dt.timedelta(days=1)).isoformat()
                data_ia = acao.get("data", "")
                # Resolve "ontem" literal ou usa a data fornecida pela IA, senão hoje
                if data_ia == "ontem":
                    data_final = ontem
                elif data_ia and data_ia != "hoje" and len(data_ia) == 10:
                    data_final = data_ia
                else:
                    data_final = hoje.isoformat()
                dados = {
                    "motorista_id": motorista_id,
                    "tipo": acao.get("tipo", "ganho"),
                    "valor": float(acao.get("valor", 0)),
                    "data": data_final
                }
                # PROTEÇÃO anti-concatenação: se o usuário mandou só um número (ex "350")
                # e a IA retornou esse número duplicado/concatenado (ex 350350), corrige.
                try:
                    _msg_limpa = mensagem.strip().replace("R$", "").replace("r$", "").replace(".", "").replace(",", ".").strip()
                    if _msg_limpa.replace(".", "").isdigit():
                        _val_user = float(_msg_limpa)
                        _val_ia = float(dados["valor"])
                        # Se a IA inflou o valor e a string do valor IA == número do user repetido
                        _su = str(int(_val_user)) if _val_user == int(_val_user) else None
                        _si = str(int(_val_ia)) if _val_ia == int(_val_ia) else None
                        if _su and _si and _si == _su + _su:  # "350350" == "350"+"350"
                            dados["valor"] = _val_user
                            log_info("valor_concatenacao_corrigida", de=_si, para=_su)
                        elif _su and _si and _si != _su and _su in _si and len(_si) >= 2*len(_su):
                            # outros casos de inflação suspeita: usa o que o usuário digitou
                            dados["valor"] = _val_user
                            log_info("valor_inflado_corrigido", de=_si, para=_su)
                except Exception:
                    pass
                if acao.get("plataforma"): dados["plataforma"] = acao["plataforma"]
                if acao.get("descricao"): dados["descricao"] = acao["descricao"]
                # Se substituir=true ou tipo=ganho com plataforma+data=hoje, deleta antes de inserir (evita duplicata)
                if acao.get("substituir") and dados.get("plataforma") and dados["tipo"] == "ganho":
                    try:
                        supabase.table("lancamentos").delete().eq("motorista_id", motorista_id).eq("tipo", "ganho").eq("plataforma", dados["plataforma"]).eq("data", data_final).execute()
                    except: pass
                try:
                    _veic = _veiculo_ativo(motorista_id)
                    if _veic: dados["veiculo"] = _veic
                except Exception: pass
                dados["origem"] = "chat"
                supabase.table("lancamentos").insert(dados).execute()
                acoes_executadas.append("lancamento_registrado")
                # AUTO-ABATE: se for despesa, verifica se existe conta pendente com nome similar e abate
                if dados["tipo"] == "despesa" and dados.get("descricao"):
                    try:
                        desc_desp = dados["descricao"].lower().strip()
                        # Grupos de sinônimos: pagamentos do mesmo tipo de conta
                        SINONIMOS = [
                            {"carro","aluguel","aluguel carro","semanal","semanal do carro","locacao","locação","veiculo","veículo"},
                            {"gas","gás","botijao","botijão"},
                            {"luz","energia","eletrica","elétrica"},
                            {"agua","água"},
                            {"mercado","feira","supermercado"},
                            {"moto","aluguel moto","semanal moto"},
                        ]
                        def _mesmo_grupo(a, b):
                            for grp in SINONIMOS:
                                if any(s in a for s in grp) and any(s in b for s in grp):
                                    return True
                            return False
                        contas_pend = supabase.table("contas").select("id,descricao,valor,valor_pago,vencimento").eq("motorista_id", motorista_id).eq("pago", False).order("vencimento").execute()
                        for cp in (contas_pend.data or []):
                            nome_conta = cp["descricao"].lower()
                            # Match: contido OU primeira palavra OU mesmo grupo de sinônimos
                            casou = (desc_desp in nome_conta or nome_conta in desc_desp
                                     or nome_conta.split()[0] in desc_desp
                                     or _mesmo_grupo(desc_desp, nome_conta))
                            if casou:
                                valor_despesa = float(dados["valor"])
                                ja_pago = float(cp.get("valor_pago") or 0)
                                valor_total_conta = float(cp["valor"])
                                saldo_conta = valor_total_conta - ja_pago
                                # Se pagou MAIS que o saldo (juros/multa): quita a conta e registra a diferença
                                if valor_despesa >= saldo_conta - 0.01:
                                    supabase.table("contas").update({"pago": True, "valor_pago": valor_total_conta}).eq("id", cp["id"]).execute()
                                    diferenca = round(valor_despesa - saldo_conta, 2)
                                    if diferenca > 0.5:
                                        acoes_executadas.append(f"conta_quitada_com_juros:{diferenca:.2f}")
                                    else:
                                        acoes_executadas.append("conta_abatida_auto")
                                else:
                                    supabase.table("contas").update({"valor_pago": ja_pago + valor_despesa}).eq("id", cp["id"]).execute()
                                    acoes_executadas.append("conta_abatida_auto")
                                break
                    except Exception: pass

            elif acao.get("acao") == "deletar_conta":
                # Remove uma conta a pagar pelo nome
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and (descricao.lower() in c["descricao"].lower() or c["descricao"].lower() in descricao.lower() or len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao.lower(), c["descricao"].lower()])) >= 5):
                        supabase.table("contas").delete().eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_deletada")
                        break
            elif acao.get("acao") == "editar_conta":
                # Unificado em services/conta_service.executar_editar_conta
                # Prioridade: valor_filtro > vencimento_alvo > vencimento mais próximo
                if executar_editar_conta(
                    motorista_id,
                    acao.get("descricao", ""),
                    acao.get("campo"),
                    acao.get("novo_valor"),
                    valor_filtro=acao.get("valor_filtro"),
                    vencimento_alvo=acao.get("vencimento_alvo"),
                ):
                    acoes_executadas.append("conta_editada")
            elif acao.get("acao") == "deletar_ultimo_lancamento":
                tipo = acao.get("tipo", "ganho")
                plataforma_filtro = acao.get("plataforma")  # None = qualquer plataforma
                # Pega os últimos 15 lançamentos para detectar distribuição em lote
                q_del = supabase.table("lancamentos").select("id,created_at,plataforma").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(15).execute()
                cands_del = q_del.data or []
                # Filtra por plataforma se informada pelo usuário
                if plataforma_filtro:
                    cands_del = [x for x in cands_del if (x.get("plataforma") or "").lower() == plataforma_filtro.lower()]
                if cands_del:
                    from datetime import datetime as _dtt2
                    ultimo_ts = None
                    try:
                        ultimo_ts = _dtt2.fromisoformat(cands_del[0]["created_at"].replace("Z","+00:00"))
                    except: pass
                    # Verifica se múltiplos lançamentos foram criados quase ao mesmo tempo (±5s = distribuição em lote)
                    ids_lote = [cands_del[0]["id"]]
                    if ultimo_ts:
                        plat_ref = cands_del[0].get("plataforma")
                        for item in cands_del[1:]:
                            try:
                                ts2 = _dtt2.fromisoformat(item["created_at"].replace("Z","+00:00"))
                                diff = abs((ultimo_ts - ts2).total_seconds())
                                if diff <= 5 and item.get("plataforma") == plat_ref:
                                    ids_lote.append(item["id"])
                                else:
                                    break
                            except: break
                    _del_n = 0
                    for lid in ids_lote:
                        _r = supabase.table("lancamentos").delete().eq("id", lid).eq("motorista_id", motorista_id).execute()
                        _del_n += len(_r.data or [])
                    _lanc_deletados_real += _del_n
                    if _del_n:
                        acoes_executadas.append("lancamento_deletado" if _del_n==1 else "lancamentos_deletados")

            elif acao.get("acao") == "deletar_lancamento_por_id":
                lid = acao.get("id")
                if lid:
                    _r = supabase.table("lancamentos").delete().eq("id", lid).eq("motorista_id", motorista_id).execute()
                    _n = len(_r.data or [])
                    _lanc_deletados_real += _n
                    if _n:
                        acoes_executadas.append("lancamento_deletado")

            elif acao.get("acao") == "deletar_lancamentos_por_ids":
                ids = acao.get("ids", [])
                _n = 0
                for lid in ids:
                    _r = supabase.table("lancamentos").delete().eq("id", lid).eq("motorista_id", motorista_id).execute()
                    _n += len(_r.data or [])
                _lanc_deletados_real += _n
                if _n:
                    acoes_executadas.append("lancamentos_deletados")

            elif acao.get("acao") == "editar_lancamento_por_id":
                lid = acao.get("id")
                _upd_l = {}
                if acao.get("valor") is not None:
                    try: _upd_l["valor"] = float(acao.get("valor"))
                    except Exception: pass
                if acao.get("descricao") is not None:
                    _upd_l["descricao"] = str(acao.get("descricao")).strip()
                if acao.get("plataforma") is not None:
                    _upd_l["plataforma"] = str(acao.get("plataforma")).strip()
                if lid and _upd_l:
                    supabase.table("lancamentos").update(_upd_l).eq("id", lid).eq("motorista_id", motorista_id).execute()
                    acoes_executadas.append("lancamento_editado")
            elif acao.get("acao") == "registrar_turno":
                turno_data = {
                    "motorista_id": motorista_id,
                    "data": str(hoje_brasil()),
                    "inicio": acao.get("inicio"),
                    "fim": acao.get("fim"),
                    "horas": acao.get("horas")
                }
                if turno_data["inicio"] and turno_data["fim"]:
                    from datetime import datetime as _dtt
                    try:
                        h = (_dtt.strptime(turno_data["fim"], "%H:%M") - _dtt.strptime(turno_data["inicio"], "%H:%M")).seconds / 3600
                        turno_data["horas"] = round(h, 2)
                    except: pass
                try:
                    existing = supabase.table("turnos").select("id").eq("motorista_id", motorista_id).eq("data", str(hoje_brasil())).execute()
                    if existing.data:
                        supabase.table("turnos").update({"inicio": turno_data["inicio"], "fim": turno_data["fim"], "horas": turno_data["horas"]}).eq("id", existing.data[0]["id"]).execute()
                    else:
                        supabase.table("turnos").insert(turno_data).execute()
                    acoes_executadas.append("turno_registrado")
                    horas_turno = turno_data.get("horas") or 0
                    ganhos_dia = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho" and l["data"] == str(hoje_brasil()))
                    if horas_turno > 0 and ganhos_dia > 0:
                        texto = f"✅ Turno registrado! {horas_turno:.1f}h de trabalho. Você fez R$ {ganhos_dia:.2f} hoje = R$ {ganhos_dia/horas_turno:.2f}/hora 💰"
                except Exception as e:
                    log_erro("turno_erro", erro=e)

            elif acao.get("acao") == "editar_ultimo_lancamento":
                tipo = acao.get("tipo", "despesa")
                campo = acao.get("campo", "valor")
                novo_valor = acao.get("novo_valor")
                descricao = acao.get("descricao", "")
                # Para horas_rodadas e km_rodados, pega simplesmente o último ganho sem filtrar por descrição
                if campo in ("horas_rodadas", "km_rodados"):
                    q = supabase.table("lancamentos").select("id,valor,plataforma").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(1).execute()
                    if q.data and novo_valor is not None:
                        supabase.table("lancamentos").update({campo: float(novo_valor)}).eq("id", q.data[0]["id"]).execute()
                        acoes_executadas.append("lancamento_editado")
                        # Calcula e exibe ganho por hora na resposta
                        if campo == "horas_rodadas" and float(novo_valor) > 0:
                            valor_ganho = float(q.data[0].get("valor") or 0)
                            plat = q.data[0].get("plataforma") or "app"
                            ganho_hora = valor_ganho / float(novo_valor)
                            texto = f"✅ Registrado! Você fez R$ {valor_ganho:.2f} em {float(novo_valor):.1f}h na {plat}. Isso dá R$ {ganho_hora:.2f}/hora 💰"
                else:
                    # Edita lancamento por descrição
                    q = supabase.table("lancamentos").select("id,descricao").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(5).execute()
                    for item in (q.data or []):
                        if not descricao or descricao.lower()[:6] in (item.get("descricao") or "").lower():
                            if novo_valor is not None:
                                supabase.table("lancamentos").update({campo: float(novo_valor)}).eq("id", item["id"]).execute()
                            acoes_executadas.append("lancamento_editado")
                            break
                # Edita conta correspondente
                if descricao and novo_valor is not None:
                    contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).eq("pago", False).execute()
                    for c in (contas_res.data or []):
                        if descricao.lower()[:6] in c["descricao"].lower():
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", c["id"]).execute()
                            acoes_executadas.append("conta_editada")
                            break
            elif acao.get("acao") == "registrar_conta":
                pago_direto = bool(acao.get("pago", False))
                supabase.table("contas").insert({
                    "motorista_id": motorista_id,
                    "descricao": acao.get("descricao", ""),
                    "valor": float(acao.get("valor", 0)),
                    "vencimento": acao.get("vencimento", hoje_brasil().isoformat()),
                    "pago": pago_direto
                }).execute()
                acoes_executadas.append("conta_registrada")
            elif acao.get("acao") == "marcar_pago":
                # Marca a conta como paga — NÃO cria lançamento automático
                # O motorista já registrou o gasto separadamente no chat
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao,valor,valor_pago").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for c in (contas_res.data or []):
                    nome_c = c["descricao"].lower()
                    if descricao and (descricao in nome_c or nome_c in descricao or
                        len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao, nome_c])) >= 4):
                        valor_total = float(c["valor"])
                        supabase.table("contas").update({"pago": True, "valor_pago": valor_total}).eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_paga")
                        break
            elif acao.get("acao") == "abater_conta":
                # Abate valor parcial de uma conta E registra como despesa real
                descricao = acao.get("descricao", "").lower()
                valor_pago = float(acao.get("valor_pago", 0))
                contas_res = supabase.table("contas").select("id,descricao,valor,valor_pago").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for c in (contas_res.data or []):
                    if descricao and (descricao.lower() in c["descricao"].lower() or c["descricao"].lower() in descricao.lower() or len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao.lower(), c["descricao"].lower()])) >= 5):
                        valor_original = float(c["valor"])
                        ja_pago = float(c.get("valor_pago") or 0)
                        total_pago = ja_pago + valor_pago
                        saldo_restante = valor_original - total_pago
                        if saldo_restante <= 0.01:
                            # Quitou tudo — marca como pago
                            supabase.table("contas").update({
                                "pago": True,
                                "valor_pago": valor_original
                            }).eq("id", c["id"]).execute()
                        else:
                            # Abatimento parcial — acumula valor_pago, mantém valor original
                            supabase.table("contas").update({
                                "valor_pago": total_pago
                            }).eq("id", c["id"]).execute()
                        # REGISTRA DESPESA REAL no historico de lancamentos
                        supabase.table("lancamentos").insert({
                            "motorista_id": motorista_id,
                            "tipo": "despesa",
                            "valor": valor_pago,
                            "descricao": c["descricao"],
                            "plataforma": "conta",
                            "data": str(hoje_brasil())
                        }).execute()
                        acoes_executadas.append("conta_abatida")
                        break

            # NOTA: o main.py original tinha aqui blocos elif duplicados de
            # deletar_conta, editar_conta e deletar_ultimo_lancamento. Eram código
            # morto (a 1ª ocorrência de cada um na cadeia if/elif sempre vencia) e
            # foram removidos na refatoração. O editar_conta duplicado era o 3º
            # handler citado no plano — agora unificado em conta_service.
            elif acao.get("acao") == "zerar_despesas_hoje":
                # Deleta TODAS as despesas de hoje do motorista
                hoje_str = hoje_brasil().isoformat()
                supabase.table("lancamentos").delete().eq("motorista_id", motorista_id).eq("data", hoje_str).eq("tipo", "despesa").execute()
                acoes_executadas.append("despesas_zeradas")
            elif acao.get("acao") == "salvar_compromissos":
                # Salva metas diárias que o motorista se comprometeu a cumprir
                compromissos = acao.get("compromissos", [])
                for c in compromissos:
                    data = c.get("data")
                    meta_bruta = float(c.get("meta_bruta", 0))
                    nota = c.get("nota", "")
                    if not data or meta_bruta <= 0:
                        continue
                    try:
                        existente = supabase.table("plano_compromissos").select("id").eq("motorista_id", motorista_id).eq("data", data).execute()
                        if existente.data:
                            supabase.table("plano_compromissos").update({"meta_bruta": meta_bruta, "nota": nota, "status": "pendente"}).eq("id", existente.data[0]["id"]).execute()
                        else:
                            supabase.table("plano_compromissos").insert({"motorista_id": motorista_id, "data": data, "meta_bruta": meta_bruta, "nota": nota, "status": "pendente"}).execute()
                    except Exception as ce:
                        log_erro("compromisso_err", erro=ce)
                acoes_executadas.append("compromissos_salvos")
        except Exception as e:
            import traceback
            log_erro("acao_err", erro=e)
            traceback.print_exc()
    # ANTI-MENTIRA DE DELEÇÃO: a IA às vezes diz que "apagou/corrigiu" lançamentos
    # sem a deleção ter acontecido de verdade (ex: tentou apagar "137" e "29" que não
    # existiam como linhas separadas — o que existia era um lançamento de 166 — então
    # nada foi removido e ficou duplicado). Se o texto afirma deleção mas NENHUMA linha
    # foi apagada (e não houve edição), troca por uma resposta honesta.
    try:
        _tl = (texto or "").lower()
        _diz_apagou = any(k in _tl for k in ("apaguei", "apagei", "apagad", "deletei",
                          "deletad", "exclui", "excluí", "removi", "removid"))
        if _diz_apagou and _lanc_deletados_real == 0 and "lancamento_editado" not in acoes_executadas:
            _regs = []
            for a in lista_acoes:
                if isinstance(a, dict) and a.get("acao") == "registrar_lancamento":
                    try:
                        v = float(a.get("valor", 0) or 0)
                    except Exception:
                        continue
                    _vf = f"R${int(v)}" if v == int(v) else f"R${v:.2f}".replace(".", ",")
                    if a.get("tipo") == "ganho":
                        _regs.append(f"{_vf} na {a.get('plataforma') or 'plataforma'}")
                    else:
                        _regs.append(f"{_vf} de {a.get('descricao') or a.get('categoria') or 'despesa'}")
            if _regs:
                texto = ("Registrei " + " e ".join(_regs) + ". ✅ Mas não localizei o lançamento antigo "
                         "pra apagar automaticamente — confere no Histórico e toca na 🗑️ se ficou algum duplicado.")
            else:
                texto = ("Não localizei o lançamento pra apagar — pode já ter sido removido ou estar com outro valor. "
                         "Dá uma olhada no Histórico e toca na 🗑️ no que quiser remover.")
            log_warn("delecao_reivindicada_sem_efeito")
    except Exception:
        pass

    acao_executada = acoes_executadas[0] if acoes_executadas else None
    # texto já atualizado pelo JSON mode
    # Se a IA disse que registrou mas nenhuma ação foi executada, avisa
    if lista_acoes and not acoes_executadas:
        log_warn("acoes_nao_exec", qtd=len(lista_acoes))

    return {"resposta": texto, "acao": acao_executada, "acoes_count": len(acoes_executadas), "acoes_esperadas": len(lista_acoes)}


@router.post("/distribuir-ganho")
async def distribuir_ganho(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    if dados.get("motorista_id") != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """
    Distribui um ganho acumulado de vários dias igualmente pelos dias do período.
    Body: { motorista_id, valor, plataforma, data_inicio, data_fim }
    data_inicio e data_fim: "YYYY-MM-DD"
    Se data_inicio == data_fim → registra tudo no único dia.
    """
    import datetime as _dt
    mid = dados.get("motorista_id")
    valor_total = float(dados.get("valor", 0))
    plataforma = dados.get("plataforma", "uber")
    descricao = dados.get("descricao", "")
    data_inicio_str = dados.get("data_inicio", "")
    data_fim_str = dados.get("data_fim", "")
    hoje = hoje_brasil()

    if not mid or valor_total <= 0 or not data_inicio_str or not data_fim_str:
        return {"ok": False, "erro": "Parâmetros incompletos"}

    try:
        data_inicio = _dt.date.fromisoformat(data_inicio_str)
        data_fim = _dt.date.fromisoformat(data_fim_str)
    except:
        return {"ok": False, "erro": "Data inválida"}

    # Gera lista de dias entre inicio e fim (inclusive)
    dias = []
    d = data_inicio
    while d <= data_fim:
        dias.append(d.isoformat())
        d += _dt.timedelta(days=1)

    if not dias:
        return {"ok": False, "erro": "Nenhum dia no período"}

    # Distribui igualmente
    n_dias = len(dias)
    valor_por_dia = round(valor_total / n_dias, 2)
    # Ajusta último dia para cobrir centavos
    valores = [valor_por_dia] * n_dias
    valores[-1] = round(valor_total - valor_por_dia * (n_dias - 1), 2)

    registrados = []
    erros = []
    for i, data_str in enumerate(dias):
        try:
            row = {
                "motorista_id": mid,
                "tipo": "ganho",
                "valor": valores[i],
                "data": data_str,
                "plataforma": plataforma,
            }
            if descricao:
                row["descricao"] = descricao
            res_insert = supabase.table("lancamentos").insert(row).execute()
            inserted_id = res_insert.data[0]["id"] if res_insert.data else None
            registrados.append({"data": data_str, "valor": valores[i], "id": inserted_id})
        except Exception as e:
            erros.append({"data": data_str, "erro": str(e)})

    if n_dias == 1:
        msg = f"✅ Anotei! R${valor_total:.0f} na {plataforma} em {data_inicio_str}."
    else:
        msg = f"✅ Distribuí R${valor_total:.0f} em {n_dias} dias ({data_inicio_str} a {data_fim_str}). R${valor_por_dia:.0f}/dia na {plataforma}."

    ids_criados = [r["id"] for r in registrados if r.get("id")]
    return {
        "ok": True,
        "registrados": registrados,
        "ids_criados": ids_criados,
        "erros": erros,
        "mensagem": msg,
        "n_dias": n_dias,
        "valor_por_dia": valor_por_dia
    }

