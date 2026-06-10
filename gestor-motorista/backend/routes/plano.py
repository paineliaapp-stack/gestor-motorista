"""Rotas do plano financeiro, compromissos e plano ativo."""
from fastapi import APIRouter, Body, Depends, HTTPException
from core.supabase_client import supabase
from core.config import hoje_brasil
from core.logging import log_info, log_erro
from core.security import get_uid_from_token
from services.gemini_service import gerar_conteudo_plano, ERROS_SOBRECARGA
from prompts.plano_prompt import montar_prompt_plano

router = APIRouter()

@router.post("/plano-financeiro")
async def plano_financeiro(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    if dados.get("motorista_id") != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Plano financeiro: Python faz todos os calculos, IA só escreve com empatia."""
    try:
        return await _plano_financeiro_impl(dados)
    except Exception as e:
        import traceback
        traceback.print_exc()
        log_erro("plano_financeiro_erro", erro=e)
        return {"ok": False, "plano": "Erro ao gerar plano"}

async def _plano_financeiro_impl(dados: dict):
    import httpx, datetime as _dt

    motorista_id = dados.get("motorista_id")
    # SEMPRE busca meta_diaria do perfil — ignora max_dia do frontend (pode ser valor antigo)
    comb_configurado = None
    capacidade_max_manual = 0
    try:
        perf = supabase.table("motoristas").select("meta_diaria,comb_diario").eq("id", motorista_id).single().execute()
        capacidade_max_manual = float((perf.data or {}).get("meta_diaria") or 0)
        comb_conf = (perf.data or {}).get("comb_diario")
        if comb_conf is not None:
            comb_configurado = float(comb_conf)
    except: pass

    # Fallback final: 300
    if capacidade_max_manual <= 0:
        capacidade_max_manual = 300

    hoje = hoje_brasil()
    inicio_mes = hoje.replace(day=1).isoformat()
    inicio_historico = (hoje - _dt.timedelta(days=45)).isoformat()

    # ── BUSCA DADOS ──────────────────────────────────────────────────────────
    try:
        contas_res = supabase.table("contas").select("*").eq("motorista_id", motorista_id).order("vencimento").execute()
        contas = contas_res.data or []
    except: contas = []

    try:
        lanc_res = supabase.table("lancamentos").select("tipo,valor,descricao,plataforma,data").eq("motorista_id", motorista_id).gte("data", inicio_historico).execute()
        lancamentos_hist = lanc_res.data or []
    except: lancamentos_hist = []

    lancamentos_mes = [l for l in lancamentos_hist if l["data"] >= inicio_mes]

    # ── COMPROMISSOS DE DIAS ESPECÍFICOS (ex: "sexta faço 600") ──────────────
    # Motorista pode informar valores diferentes por dia — o plano usa esses valores reais
    compromissos_dict = {}  # {data_str: meta_bruta}
    try:
        fim_busca_comp = (hoje_brasil() + _dt.timedelta(days=14)).isoformat()
        comp_res = supabase.table("plano_compromissos").select("data,meta_bruta").eq("motorista_id", motorista_id).gte("data", hoje_brasil().isoformat()).lte("data", fim_busca_comp).execute()
        for c in (comp_res.data or []):
            if c.get("data") and c.get("meta_bruta"):
                compromissos_dict[c["data"]] = float(c["meta_bruta"])
        if compromissos_dict:
            log_info("compromissos_ok", qtd=len(compromissos_dict))
    except Exception as e:
        log_erro("compromissos_erro", erro=e)

    # ── COMBUSTIVEL — hierarquia de prioridade ───────────────────────────────
    # 1. Valor configurado pelo motorista no perfil (mais confiável)
    # 2. Média real dos lançamentos do mês
    # 3. Taxa proporcional estimada (25% do faturamento)
    # 4. Nunca usa valor de conta "Combustível - Resto do Mês" como base de cálculo

    dias_rodados = max(1, hoje.day - 1)
    ganhos_total_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho")
    COMB_KEYS = ["combustivel", "combustível", "gasolina", "etanol", "diesel", "abastec"]
    # Soma todos os lançamentos de despesa com categoria/descrição de combustível
    comb_total_mes_bruto = sum(
        float(l["valor"]) for l in lancamentos_mes
        if l["tipo"] == "despesa"
        and any(k in (l.get("descricao") or "").lower() for k in COMB_KEYS)
    )
    # Exclui lançamentos únicos muito grandes (acima de R$400 em um único dia = provavelmente conta a pagar)
    comb_total_mes = sum(
        float(l["valor"]) for l in lancamentos_mes
        if l["tipo"] == "despesa"
        and any(k in (l.get("descricao") or "").lower() for k in COMB_KEYS)
        and float(l["valor"]) <= 400
    )
    # Se filtrar tudo, usa o bruto (melhor do que zero)
    if comb_total_mes < 10 and comb_total_mes_bruto > 10:
        comb_total_mes = comb_total_mes_bruto
    taxa_comb_bruta = comb_total_mes / max(ganhos_total_mes, 1)
    comb_suspeito = taxa_comb_bruta > 0.50

    fonte_comb = ""
    if comb_configurado is not None and comb_configurado > 0:
        # PRIORIDADE 1: motorista informou manualmente
        comb_diario = comb_configurado
        taxa_comb = comb_diario / max(capacidade_max_manual, 1)
        taxa_comb = min(max(taxa_comb, 0.05), 0.60)
        fonte_comb = f"informado pelo motorista (R${comb_diario:.0f}/dia)"
        precisa_configurar_comb = False
    elif comb_total_mes > 10 and dias_rodados >= 3:
        # PRIORIDADE 2: histórico real dos lançamentos (pelo menos 3 dias de dados)
        comb_diario = round(comb_total_mes / dias_rodados, 0)
        taxa_comb = comb_total_mes / max(ganhos_total_mes, 1)
        if comb_suspeito:
            # Taxa acima de 50% → provavelmente tem lançamento errado no histórico
            # Usa cap de 35% e avisa no contexto
            taxa_comb = 0.35
            comb_diario = round(capacidade_max_manual * taxa_comb, 0)
            fonte_comb = f"estimativa corrigida (histórico mostra {taxa_comb_bruta*100:.0f}% mas pode ter lançamentos errados — usando 35%)"
            precisa_configurar_comb = True
        else:
            taxa_comb = min(max(taxa_comb, 0.10), 0.55)
            fonte_comb = f"média dos lançamentos ({dias_rodados} dias)"
            precisa_configurar_comb = False
    else:
        # PRIORIDADE 3: estimativa — pede para configurar
        taxa_comb = 0.25
        comb_diario = round(capacidade_max_manual * taxa_comb, 0)
        fonte_comb = "estimativa (25% do faturamento) — configure para maior precisão"
        precisa_configurar_comb = True

    # ── CAPACIDADE REAL POR DIA DA SEMANA ────────────────────────────────────
    ganhos_por_data = {}
    for l in lancamentos_hist:
        if l["tipo"] == "ganho":
            d = l["data"]
            ganhos_por_data[d] = ganhos_por_data.get(d, 0) + float(l["valor"])

    # Detecta outliers: dias com ganho acima de 1.5x o max_dia informado
    # Isso acontece quando o motorista lança histórico acumulado num único dia
    teto_outlier = max(capacidade_max_manual * 4, 2000)
    # Filtra outliers acima E dias com ganho mínimo (<R$30 = dia de teste/inativo)
    ganhos_filtrados = {d: v for d, v in ganhos_por_data.items() if v <= teto_outlier and v >= 30}

    # Só usa histórico por dia da semana se tem pelo menos 5 dias reais (não outliers)
    # e esses dias cobrem pelo menos 2 dias da semana diferentes
    soma_dow = {i: 0.0 for i in range(7)}
    cont_dow = {i: 0 for i in range(7)}
    for data_str, total in ganhos_filtrados.items():
        try:
            dow = _dt.date.fromisoformat(data_str).weekday()
            soma_dow[dow] += total
            cont_dow[dow] += 1
        except: pass

    dias_com_historico_real = sum(cont_dow.values())
    dias_semana_cobertos = len([v for v in cont_dow.values() if v > 0])

    media_dow = {dow: round(soma_dow[dow]/cont_dow[dow], 0) for dow in range(7) if cont_dow[dow] > 0}

    # Limita cada média ao máximo informado — segurança extra contra outliers
    if capacidade_max_manual > 0:
        media_dow = {dow: min(v, capacidade_max_manual) for dow, v in media_dow.items()}

    NOMES_DOW = ["Seg","Ter","Qua","Qui","Sex","Sab","Dom"]

    # Histórico confiável = pelo menos 5 dias reais cobrindo 2+ dias da semana distintos
    tem_historico = dias_com_historico_real >= 5 and dias_semana_cobertos >= 2

    # Capacidade padrão: usa histórico ou meta manual
    if tem_historico:
        cap_padrao = round(sum(media_dow.values()) / len(media_dow), 0)
        fonte = "historico real"
    else:
        cap_padrao = capacidade_max_manual if capacidade_max_manual > 0 else 350
        fonte = "meta informada"

    # ── DIA A DIA: PROJECAO REAL ─────────────────────────────────────────────
    if hoje.month == 12:
        fim_mes = _dt.date(hoje.year + 1, 1, 1) - _dt.timedelta(days=1)
    else:
        fim_mes = _dt.date(hoje.year, hoje.month + 1, 1) - _dt.timedelta(days=1)
    dias_restantes_mes = max(1, (fim_mes - hoje).days + 1)
    # Se faltam menos de 3 dias no mês mas há contas com vencimento em junho,
    # expande o horizonte para 7 dias para o plano não parecer impossível
    tem_contas_proximo_mes = any(
        c.get("vencimento","") > fim_mes.isoformat()
        for c in contas if not c.get("pago")
    )
    dias_restantes = dias_restantes_mes if dias_restantes_mes >= 5 else (
        max(7, dias_restantes_mes) if tem_contas_proximo_mes else dias_restantes_mes
    )

    # Para cada dia restante: qual a capacidade bruta realista
    dias_projecao = []
    for i in range(dias_restantes):
        dia = hoje + _dt.timedelta(days=i)
        dow = dia.weekday()
        # Compromisso específico tem prioridade sobre histórico/média
        data_str = dia.isoformat()
        if data_str in compromissos_dict:
            bruto = compromissos_dict[data_str]
            fonte_dia = "compromisso"
        elif tem_historico:
            bruto = media_dow.get(dow, cap_padrao)
            fonte_dia = "historico"
        else:
            bruto = cap_padrao
            fonte_dia = "padrao"
        liquido = max(0, bruto - comb_diario)
        dias_projecao.append({"data": dia, "nome": NOMES_DOW[dow], "bruto": bruto, "liquido": liquido, "fonte": fonte_dia, "compromisso": data_str in compromissos_dict})

    total_liquido_possivel = sum(d["liquido"] for d in dias_projecao)

    # ── SALDO ATUAL ──────────────────────────────────────────────────────────
    ganhos_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho")
    despesas_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa")
    caixa_atual = max(0, ganhos_mes - despesas_mes)
    poder_total = caixa_atual + total_liquido_possivel

    # ── CLASSIFICA E PRIORIZA CONTAS ─────────────────────────────────────────
    INTOCAVEIS_KEYS = ["carro", "aluguel car", "financiamento", "veiculo", "finan", "semanal do carro", "diaria carro", "locacao", "locação"]
    NEGOCIAVEIS_KEYS = ["emprestimo", "elaine", "amigo", "familiar", "devendo", "pessoal"]
    COMBUSTIVEL_KEYS = ["combustivel", "combustível", "gasolina", "etanol", "diesel", "abastec"]

    contas_pendentes = [c for c in contas if not c.get("pago")]

    # ── TRATA CONTAS DE COMBUSTÍVEL SEPARADO ─────────────────────────────────
    # Conta de combustível projetada = estimativa que o motorista cadastrou
    # O valor real já gasto no mês está nos lançamentos
    # Lógica: valor_restante_conta = max(0, valor_conta - combustivel_ja_gasto_no_mes)
    contas_comb = [c for c in contas_pendentes
                   if any(k in (c.get("descricao") or "").lower() for k in COMBUSTIVEL_KEYS)]
    contas_normais = [c for c in contas_pendentes
                      if not any(k in (c.get("descricao") or "").lower() for k in COMBUSTIVEL_KEYS)]

    # Para contas de combustível: desconta só o que foi gasto DEPOIS que a conta foi criada
    # (não o mês inteiro — a conta projetada já cobre só o restante do mês)
    comb_projetado_contas = sum(
        max(0, float(c["valor"]) - float(c.get("valor_pago") or 0)) for c in contas_comb
    )
    # Data de criação da conta de combustível mais recente
    if contas_comb:
        data_conta_comb = min(
            (c.get("criado_em") or c.get("created_at") or c.get("vencimento") or "2000-01-01")[:10]
            for c in contas_comb
        )
        # Soma só os gastos reais de combustível a partir dessa data
        comb_ja_gasto = sum(
            float(l["valor"]) for l in lancamentos_mes
            if (l.get("descricao") or "").lower() == "combustivel"
            and (l.get("data") or "")[:10] >= data_conta_comb
        )
    else:
        comb_ja_gasto = 0

    # O que ainda falta pagar = projeção - já gasto desde que a conta foi criada
    comb_restante_real = max(0, comb_projetado_contas - comb_ja_gasto)
    economia_comb = max(0, comb_projetado_contas - comb_restante_real)

    # Inclui contas de combustível como uma única entrada ajustada (se ainda houver saldo)
    contas_pendentes_ajustadas = contas_normais[:]
    if contas_comb and comb_restante_real > 0:
        # Usa a primeira conta de combustível como representante, com valor ajustado
        c_repr = contas_comb[0].copy()
        c_repr["_valor_ajustado"] = comb_restante_real
        c_repr["_economia"] = economia_comb
        contas_pendentes_ajustadas.append(c_repr)

    def valor_falta(c):
        if c.get("_valor_ajustado") is not None:
            return c["_valor_ajustado"]
        return max(0, float(c["valor"]) - float(c.get("valor_pago") or 0))

    def dias_venc(c):
        try:
            return (_dt.date.fromisoformat(c["vencimento"]) - hoje).days
        except: return 999

    def prioridade(c):
        nome = (c.get("descricao") or "").lower()
        if any(k in nome for k in INTOCAVEIS_KEYS): return 1  # intocavel
        if any(k in nome for k in NEGOCIAVEIS_KEYS): return 4  # claramente negociavel
        dv = dias_venc(c)
        if dv <= 3: return 2   # urgente por vencimento
        if dv <= 7: return 3   # esta semana
        return 4               # pode negociar

    contas_enriquecidas = []
    for c in contas_pendentes_ajustadas:
        falta = valor_falta(c)
        if falta <= 0: continue
        dv = dias_venc(c)
        p = prioridade(c)
        nome = (c.get("descricao") or "").lower()
        contas_enriquecidas.append({
            "nome": c.get("descricao", "?"),
            "falta": falta,
            "dias_ate": dv,
            "vencimento": c.get("vencimento", "?"),
            "prioridade": p,
            "intocavel": any(k in nome for k in INTOCAVEIS_KEYS),
            "negociavel": p == 4,
        })

    contas_enriquecidas.sort(key=lambda x: (x["prioridade"], x["dias_ate"]))

    # Distribui caixa atual nas mais urgentes primeiro
    caixa_disp = caixa_atual
    for c in contas_enriquecidas:
        abate = min(caixa_disp, c["falta"])
        caixa_disp -= abate
        c["coberto_caixa"] = round(abate, 0)
        c["ainda_falta"] = round(c["falta"] - abate, 0)

    # Separa grupos
    pagar_agora   = [c for c in contas_enriquecidas if c["ainda_falta"] <= 0]
    pagar_urgente = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and c["prioridade"] <= 2]
    pagar_semana  = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and c["prioridade"] == 3]
    negociar      = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and c["prioridade"] == 4]

    total_urgente = sum(c["ainda_falta"] for c in pagar_urgente)
    total_semana  = sum(c["ainda_falta"] for c in pagar_semana)
    total_negociar= sum(c["ainda_falta"] for c in negociar)
    total_falta   = total_urgente + total_semana + total_negociar

    # ── MONTA PLANO DIA A DIA ────────────────────────────────────────────────
    # Distribui as contas urgentes pelos próximos dias
    saldo_acumulado = 0.0
    plano_dias = []
    conta_idx = 0
    contas_a_distribuir = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and not c["negociavel"]]

    for d in dias_projecao[:7]:  # próximos 7 dias
        liquido_dia = d["liquido"]
        saldo_acumulado += liquido_dia
        plano_dias.append({
            "dia": d["nome"],
            "data": d["data"].strftime("%d/%m"),
            "bruto": d["bruto"],
            "liquido": liquido_dia,
            "acumulado": round(saldo_acumulado, 0)
        })

    # Verifica se cobre os urgentes
    cobre_urgentes = poder_total >= total_urgente
    cobre_tudo = poder_total >= total_falta

    # Meta de hoje específica
    hoje_dow = hoje.weekday()
    meta_hoje_bruto = media_dow.get(hoje_dow, cap_padrao) if tem_historico else cap_padrao
    meta_hoje_liquido = max(0, meta_hoje_bruto - comb_diario)

    # ── ALERTAS DE SAÚDE FINANCEIRA ──────────────────────────────────────────
    # Regra: cada alerta fala SÓ UMA coisa, sem contradição com outros alertas
    alertas = []

    # 1. Precisa configurar combustível
    if precisa_configurar_comb:
        alertas.append(f"⚙️ Usando estimativa de R${comb_diario:.0f}/dia de combustível (25% do faturamento). Configure o valor real nas configurações para o plano ficar mais preciso.")

    # 2. Taxa de combustível alta — SÓ mostra se NÃO tem conta de combustível cadastrada
    # (se tem conta, o plano já aborda isso; o alerta ficaria contraditório)
    if not contas_comb:
        if taxa_comb >= 0.45:
            alertas.append(f"🚨 Combustível consumindo {taxa_comb*100:.0f}% do que você fatura — acima do ideal (máx 30%). A cada R$100 faturados, sobram R${(1-taxa_comb)*100:.0f} no bolso. Vale revisar rotas e horários.")
        elif taxa_comb >= 0.35:
            alertas.append(f"⚠️ Combustível em {taxa_comb*100:.0f}% do faturamento — um pouco acima do ideal (20-30%). A cada R$100, sobram R${(1-taxa_comb)*100:.0f} líquido.")

    alertas_txt = "\n".join(alertas) if alertas else ""

    # ── MONTA TEXTO DO CONTEXTO COMPLETO PARA A IA ───────────────────────────
    def fmt_lista(lista, incluir_dias=True):
        linhas = []
        for c in lista:
            dv = c["dias_ate"]
            venc_label = f"vence em {dv}d" if dv >= 0 else f"VENCIDA há {abs(dv)}d"
            dias_necessarios = round(c["ainda_falta"] / max(meta_hoje_liquido, 1), 1)
            linha = f"• {c['nome']}: R${c['ainda_falta']:.0f}"
            if incluir_dias:
                linha += f" ({venc_label} — {dias_necessarios} dias de trabalho para cobrir)"
            linhas.append(linha)
        return "\n".join(linhas) if linhas else "Nenhuma"

    plano_7dias_txt = "".join(
        f"• {d['dia']} {d['data']}: fatura R${d['bruto']:.0f} → combustível R${comb_diario:.0f} → líquido R${d['liquido']:.0f} → acumulado R${d['acumulado']:.0f}"
        for d in plano_dias
    )

    if cobre_tudo:
        diagnostico = f"✅ DÁ para pagar tudo. Com R${meta_hoje_bruto:.0f}/dia você cobre os R${total_falta:.0f} restantes em {dias_restantes} dias."
    elif cobre_urgentes:
        deficit_negociar = total_falta - poder_total  # quanto falta no total
        diagnostico = f"⚠️ DÁ para cobrir o essencial (R${total_urgente:.0f}), MAS faltam R${deficit_negociar:.0f} no total — contas negociáveis precisam de prazo."
    else:
        deficit_total = total_falta - poder_total          # buraco total
        deficit_essencial = total_urgente - (poder_total - total_negociar)  # só do essencial
        diagnostico = (
            f"🔴 CRÍTICO: mesmo trabalhando todos os dias, poder total é R${poder_total:.0f} "
            f"(R${caixa_atual:.0f} caixa + R${total_liquido_possivel:.0f} projetado líquido) "
            f"mas contas somam R${total_falta:.0f}. Déficit total: R${deficit_total:.0f}. "
            f"Precisa negociar prazo em pelo menos R${deficit_total:.0f} em contas."
        )

    # ── CENÁRIO DE ESFORÇO EXTRA ────────────────────────────────────────────
    # Quanto precisaria fazer por dia para fechar o buraco?
    # Calcula o mínimo bruto necessário para cobrir o déficit nos dias restantes
    if not cobre_tudo and total_falta > 0 and dias_restantes > 0:
        deficit_normal = max(0, total_falta - (caixa_atual + total_liquido_possivel))
        # Bruto necessário = (líquido faltante / dias) / (1 - taxa_comb)
        # Só sugere se for acima do normal mas abaixo de 2x o cap_padrao (realista)
        liq_extra_por_dia_necessario = deficit_normal / dias_restantes
        bruto_necessario_dia = round(liq_extra_por_dia_necessario / max(1 - taxa_comb, 0.3), 0)
        # Arredonda para múltiplo de 50 acima
        cap_esforco = int((bruto_necessario_dia + cap_padrao + 49) / 50) * 50
        cap_esforco = max(cap_esforco, cap_padrao + 50)  # pelo menos 50 a mais que o normal
        cap_esforco_max = cap_padrao * 2.5  # teto realista
        cap_esforco = min(cap_esforco, cap_esforco_max)
    else:
        cap_esforco = round(cap_padrao * 1.3 / 50) * 50  # 30% a mais como sugestão

    comb_esforco = round(cap_esforco * taxa_comb, 0)
    liq_esforco_dia = max(0, cap_esforco - comb_esforco)
    total_liq_esforco = liq_esforco_dia * dias_restantes
    poder_esforco = caixa_atual + total_liq_esforco

    if not cobre_tudo and liq_esforco_dia > meta_hoje_liquido:
        deficit_normal = max(0, total_falta - (caixa_atual + total_liquido_possivel))
        ganho_extra_por_dia = liq_esforco_dia - meta_hoje_liquido
        dias_esforco_necessarios = min(dias_restantes, max(1, round(deficit_normal / max(ganho_extra_por_dia, 1) + 0.5)))
        fecha_com_esforco = poder_esforco >= total_falta
        # Explica de onde veio o número (referência para a IA usar no texto)
        origem_numero = f"seu histórico mostra R${cap_padrao:.0f}/dia em média" if tem_historico else f"você informou R${cap_padrao:.0f}/dia como meta"
        cenario_esforco_txt = f"""
=== CENÁRIO DE ESFORÇO EXTRA ===
Referência: {origem_numero}.
Se fizer R${cap_esforco:.0f} brutos/dia (R${cap_esforco - cap_padrao:.0f} a mais que o normal):
- Combustível: R${comb_esforco:.0f} ({taxa_comb*100:.0f}% do faturamento — mesma taxa, só o valor muda)
- Líquido por dia: R${liq_esforco_dia:.0f} (R${ganho_extra_por_dia:.0f}/dia a mais)
- Total em {dias_restantes} dias: R${total_liq_esforco:.0f}
- {'✅ FECHA TUDO com R' + f'{poder_esforco - total_falta:.0f}' + ' de sobra' if fecha_com_esforco else f'❌ ainda falta R${abs(poder_esforco - total_falta):.0f} — mas reduz o buraco bastante'}
- Alternativa mínima: fazer R${cap_esforco:.0f}/dia por apenas {dias_esforco_necessarios} dia{'s' if dias_esforco_necessarios > 1 else ''} específico{'s' if dias_esforco_necessarios > 1 else ''} → cobre o déficit
INSTRUÇÃO: Na seção SITUAÇÃO, mostre o cenário de esforço (linha começando com 💡). Depois PERGUNTE: "Você consegue fazer R${cap_esforco:.0f} em algum dia?" — SOMENTE "consegue ou não". Não pergunte os dias ainda. Quando ele confirmar que consegue, aí você pergunta os dias."""
    else:
        cenario_esforco_txt = ""

    # ── COMPROMISSOS ESPECÍFICOS (para o prompt) ─────────────────────────────
    NOMES_DOW_COMPLETO = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"]
    if compromissos_dict:
        dias_comp_linhas = []
        for d in sorted(compromissos_dict.keys()):
            try:
                dt = _dt.date.fromisoformat(d)
                nome_dia = NOMES_DOW_COMPLETO[dt.weekday()]
                meta_b = compromissos_dict[d]
                meta_l = max(0, meta_b - comb_diario)
                dias_comp_linhas.append(f"  • {nome_dia} {dt.strftime('%d/%m')}: R${meta_b:.0f} bruto → ⛽R${comb_diario:.0f} → R${meta_l:.0f} líquido")
            except: pass
        compromissos_txt = "DIAS COM META ESPECÍFICA (informados pelo motorista — use ESTES valores, não a média):\n" + "\n".join(dias_comp_linhas)
    else:
        compromissos_txt = ""

    # ── PADRÃO POR DIA DA SEMANA (para a IA comentar) ───────────────────────
    if tem_historico and len(media_dow) >= 3:
        dias_ord = sorted(media_dow.items(), key=lambda x: x[1], reverse=True)
        melhores = [NOMES_DOW_COMPLETO[d] for d,_ in dias_ord[:2]]
        piores   = [NOMES_DOW_COMPLETO[d] for d,_ in dias_ord[-2:] if _ < cap_padrao * 0.85]
        dow_txt_linhas = [f"  {NOMES_DOW_COMPLETO[d]}: R${v:.0f}/dia (média histórica)" for d,v in sorted(media_dow.items())]
        padrao_semana_txt = (
            f"PADRÃO REAL POR DIA DA SEMANA (baseado no histórico do motorista):\n"
            + "\n".join(dow_txt_linhas)
            + f"\n→ Dias mais fortes: {', '.join(melhores)}"
            + (f"\n→ Dias mais fracos: {', '.join(piores)}" if piores else "")
            + "\nUse esse padrão para sugerir em quais dias vale a pena forçar mais. Comente isso naturalmente — mostra que o sistema conhece a rotina dele."
        )
    else:
        padrao_semana_txt = ""

    # Python já calculou tudo. A IA só escreve o texto — 3 mensagens separadas por |||
    # Cada mensagem = uma bolha separada no chat (como WhatsApp)
    prompt = montar_prompt_plano(NOMES_DOW_COMPLETO=NOMES_DOW_COMPLETO, caixa_atual=caixa_atual, cap_esforco=cap_esforco, cap_padrao=cap_padrao, cobre_tudo=cobre_tudo, comb_diario=comb_diario, dias_restantes=dias_restantes, media_dow=media_dow, meta_hoje_bruto=meta_hoje_bruto, meta_hoje_liquido=meta_hoje_liquido, negociar=negociar, pagar_semana=pagar_semana, pagar_urgente=pagar_urgente, tem_historico=tem_historico, total_falta=total_falta, total_liquido_possivel=total_liquido_possivel)

    log_info("plano_fin", dias_rest=dias_restantes, poder=round(poder_total,2))
    # debug dados removido

    _ERROS_SOBRECARGA = ERROS_SOBRECARGA
    result = await gerar_conteudo_plano(prompt)

    if "error" in result:
        err_msg = result["error"].get("message", "")
        log_erro("gemini_api_erro", msg=err_msg[:150])
        if any(x in err_msg for x in _ERROS_SOBRECARGA):
            return {"ok": False, "plano": "Muita demanda agora 😅 Aguarda 1 minuto e tenta de novo!"}
        return {"ok": False, "plano": f"Não consegui gerar o plano: {err_msg[:100]}"}

    parts = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    texto = "".join(p.get("text", "") for p in parts if p.get("text"))
    if not texto:
        return {"ok": False, "plano": "Não consegui gerar o plano agora. Tente em instantes."}

    # Divide o texto em 3 mensagens pelo separador |||
    partes = [p.strip() for p in texto.split("|||") if p.strip()]
    # Se a IA não usou |||, divide por linha em branco como fallback
    if len(partes) == 1 and len(partes[0]) > 200:
        blocos = [b.strip() for b in texto.split("\n\n") if b.strip()]
        if len(blocos) >= 2:
            partes = blocos[:3]
    # Garante no máximo 3 partes
    partes = partes[:3]
    if not partes:
        partes = [texto]

    return {
        "ok": True,
        "plano": texto,
        "partes": partes,
        "alertas": alertas,  # lista de alertas de saúde financeira
        "contexto": {
            "caixa_atual": round(caixa_atual, 2),
            "total_pendente": round(total_falta, 2),
            "total_urgente": round(total_urgente, 2),
            "comb_diario": round(comb_diario, 2),
            "taxa_comb_pct": round(taxa_comb * 100, 1),
            "comb_projetado": round(comb_projetado_contas, 2),
            "comb_ja_gasto": round(comb_ja_gasto, 2),
            "comb_restante": round(comb_restante_real, 2),
            "economia_comb": round(economia_comb, 2),
            "meta_hoje": round(meta_hoje_bruto, 2),
            "dias_restantes": dias_restantes,
            "fonte_capacidade": fonte
        }
    }

# ── COMPROMISSOS DO PLANO ────────────────────────────────────────────────────
# Salva metas específicas por dia que o motorista se comprometeu a cumprir
@router.post("/plano-compromisso")
async def salvar_compromisso(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Salva meta diária comprometida pelo motorista."""
    mid = uid  # sempre do token
    compromissos = dados.get("compromissos", [])
    if not compromissos:
        return {"ok": False, "erro": "dados incompletos"}
    try:
        for c in compromissos:
            data = c.get("data")
            meta_bruta = float(c.get("meta_bruta", 0))
            nota = c.get("nota", "")
            if not data or meta_bruta <= 0:
                continue
            existente = supabase.table("plano_compromissos").select("id").eq("motorista_id", mid).eq("data", data).execute()
            if existente.data:
                supabase.table("plano_compromissos").update({"meta_bruta": meta_bruta, "nota": nota}).eq("id", existente.data[0]["id"]).execute()
            else:
                supabase.table("plano_compromissos").insert({"motorista_id": mid, "data": data, "meta_bruta": meta_bruta, "nota": nota, "status": "pendente"}).execute()
        return {"ok": True, "salvos": len(compromissos)}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@router.get("/plano-compromisso/{mid}")
async def buscar_compromissos(mid: str, uid: str = Depends(get_uid_from_token)):
    if mid != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna compromissos dos próximos 14 dias + cruzado com o que foi feito."""
    import datetime as _dt
    hoje = hoje_brasil()
    inicio = (hoje - _dt.timedelta(days=1)).isoformat()
    fim = (hoje + _dt.timedelta(days=14)).isoformat()
    try:
        comp_res = supabase.table("plano_compromissos").select("*").eq("motorista_id", mid).gte("data", inicio).lte("data", fim).order("data").execute()
        compromissos = comp_res.data or []
        datas = [c["data"] for c in compromissos]
        if datas:
            lanc_res = supabase.table("lancamentos").select("data,tipo,valor").eq("motorista_id", mid).in_("data", datas).execute()
            lancamentos = lanc_res.data or []
        else:
            lancamentos = []
        ganho_por_data = {}
        for l in lancamentos:
            if l["tipo"] == "ganho":
                d = l["data"]
                ganho_por_data[d] = ganho_por_data.get(d, 0) + float(l["valor"])
        resultado = []
        for c in compromissos:
            data = c["data"]
            faturado = ganho_por_data.get(data, None)
            meta = float(c["meta_bruta"])
            if data < hoje.isoformat():
                status = "batido" if (faturado or 0) >= meta * 0.85 else "perdido"
            elif data == hoje.isoformat():
                status = "hoje"
            else:
                status = "pendente"
            resultado.append({"id": c["id"], "data": data, "meta_bruta": meta, "faturado": faturado, "nota": c.get("nota", ""), "status": status, "pct": round((faturado or 0) / meta * 100) if meta > 0 else 0})
        return {"compromissos": resultado}
    except Exception as e:
        return {"compromissos": [], "erro": str(e)}

@router.post("/plano-ativo")
async def salvar_plano_ativo(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Salva o plano completo."""
    mid = uid  # sempre do token
    try:
        plano = {
            "motorista_id": mid,
            "total_contas": dados.get("total_contas", 0),
            "caixa_inicial": dados.get("caixa_inicial", 0),
            "comb_ajustado": dados.get("comb_ajustado"),
            # NOTA (bug pré-existente preservado): datetime e TZ_BR nunca foram
            # definidos no main.py original — NameError capturado pelo except.
            "criado_em": datetime.now(TZ_BR).isoformat(),
            "status": "ativo"
        }
        existente = supabase.table("plano_ativo").select("id").eq("motorista_id", mid).eq("status", "ativo").execute()
        if existente.data:
            supabase.table("plano_ativo").update(plano).eq("id", existente.data[0]["id"]).execute()
        else:
            supabase.table("plano_ativo").insert(plano).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@router.get("/plano-ativo/{mid}")
async def buscar_plano_ativo(mid: str, uid: str = Depends(get_uid_from_token)):
    if mid != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna o plano ativo + progresso real dos compromissos."""
    import datetime as _dt
    try:
        plano_res = supabase.table("plano_ativo").select("*").eq("motorista_id", mid).eq("status", "ativo").execute()
        if not plano_res.data:
            return {"tem_plano": False}
        plano = plano_res.data[0]

        # Busca compromissos ativos
        comp_res = supabase.table("plano_compromissos").select("*").eq("motorista_id", mid).gte("data", plano["criado_em"][:10]).order("data").execute()
        compromissos = comp_res.data or []

        # Cruzar com lançamentos reais
        hoje = hoje_brasil()
        datas = [c["data"] for c in compromissos]
        faturado_por_dia = {}
        if datas:
            lancs = supabase.table("lancamentos").select("data,tipo,valor").eq("motorista_id", mid).in_("data", datas).execute()
            for l in (lancs.data or []):
                if l["tipo"] == "ganho":
                    faturado_por_dia[l["data"]] = faturado_por_dia.get(l["data"], 0) + float(l["valor"])

        total_meta = sum(float(c["meta_bruta"]) for c in compromissos)
        total_faturado = sum(faturado_por_dia.get(c["data"], 0) for c in compromissos)
        pct_geral = round(total_faturado / max(total_meta, 1) * 100)

        # Verifica se objetivo foi cumprido (faturado >= total contas pendentes)
        total_contas = float(plano.get("total_contas", 0))
        caixa_inicial = float(plano.get("caixa_inicial", 0))
        objetivo_cumprido = (total_faturado + caixa_inicial) >= total_contas * 0.95  # 95% = cumprido

        if objetivo_cumprido and compromissos:
            supabase.table("plano_ativo").update({"status": "concluido"}).eq("id", plano["id"]).execute()

        dias_detalhes = []
        for c in compromissos:
            fat = faturado_por_dia.get(c["data"], 0)
            meta = float(c["meta_bruta"])
            dt = _dt.date.fromisoformat(c["data"])
            NOMES = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]
            dias_detalhes.append({
                "data": c["data"],
                "nome_dia": NOMES[dt.weekday()],
                "meta_bruta": meta,
                "faturado": fat,
                "pct": round(fat / max(meta, 1) * 100),
                "status": "batido" if fat >= meta*0.85 else ("hoje" if c["data"] == hoje.isoformat() else ("perdido" if c["data"] < hoje.isoformat() else "pendente"))
            })

        return {
            "tem_plano": True,
            "plano": plano,
            "compromissos": dias_detalhes,
            "resumo": {
                "total_meta_bruto": round(total_meta),
                "total_faturado": round(total_faturado),
                "pct_geral": pct_geral,
                "objetivo_cumprido": objetivo_cumprido,
                "dias_total": len(compromissos),
                "dias_batidos": sum(1 for d in dias_detalhes if d["status"] == "batido")
            }
        }
    except Exception as e:
        return {"tem_plano": False, "erro": str(e)}

