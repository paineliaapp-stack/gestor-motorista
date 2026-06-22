"""Planejador inteligente de contas: detecta inviabilidade e sugere renegociação.

Algoritmo:
1. Calcula a média de faturamento diário real dos últimos 30 dias
2. Soma quanto precisa faturar por dia para pagar todas as contas nos prazos atuais
3. Se inviável (necessário > média * 1.3), calcula quais contas pedir prazo
4. Retorna um plano: contas no prazo original + contas para renegociar com nova data sugerida
"""
import datetime as _dt
from fastapi import APIRouter, Depends, HTTPException
from core.supabase_client import supabase
from core.security import get_uid_from_token, _valid_uuid
from core.config import hoje_brasil
from core.logging import log_erro

router = APIRouter()


def _hoje():
    return hoje_brasil()


def _media_diaria(mid: str, dias: int = 30) -> float:
    """Média de faturamento diário real no MÊS ATUAL (alinhada com a Evolução diária do app)."""
    try:
        ini = _hoje().replace(day=1).isoformat()  # dia 1 do mês atual
        r = supabase.table("lancamentos").select("valor,tipo,data") \
            .eq("motorista_id", mid).eq("tipo", "ganho").gte("data", ini).execute()
        if not r.data:
            return 0.0
        # Agrupa por dia para não contar dias sem trabalho como "R$0"
        por_dia: dict[str, float] = {}
        for l in r.data:
            d = str(l.get("data", ""))[:10]
            try:
                por_dia[d] = por_dia.get(d, 0.0) + float(l.get("valor") or 0)
            except Exception:
                pass
        dias_trabalhados = len(por_dia)
        if dias_trabalhados == 0:
            return 0.0
        return sum(por_dia.values()) / dias_trabalhados
    except Exception as e:
        log_erro("media_diaria_erro", erro=e)
        return 0.0


def _contas_pendentes(mid: str) -> list[dict]:
    """Contas pendentes do MÊS ATUAL (inclui vencidas/atrasadas; exclui as que vencem em meses seguintes)."""
    try:
        hoje = _hoje()
        # Fim do mês atual
        if hoje.month == 12:
            fim_mes = _dt.date(hoje.year, 12, 31)
        else:
            fim_mes = _dt.date(hoje.year, hoje.month + 1, 1) - _dt.timedelta(days=1)
        r = supabase.table("contas").select("*") \
            .eq("motorista_id", mid) \
            .lte("vencimento", fim_mes.isoformat()) \
            .order("vencimento").execute()
        # Considera pendente: campo 'pago' é False/None (não foi quitado)
        out = []
        for c in (r.data or []):
            if not c.get("pago"):
                out.append(c)
        return out
    except Exception:
        return []


def _calcular_necessidade_diaria(contas: list[dict], hoje: _dt.date) -> float:
    """Quanto precisa faturar por dia HOJE para pagar tudo nos prazos."""
    total = sum(float(c.get("valor") or 0) for c in contas)
    # Usa o vencimento mais próximo como horizonte de urgência
    if not contas:
        return 0.0
    venc_mais_proximo = _dt.date.fromisoformat(str(contas[0]["vencimento"])[:10])
    dias = max(1, (venc_mais_proximo - hoje).days + 1)
    return total / dias


def _sugerir_plano(contas: list[dict], media: float, hoje: _dt.date) -> dict:
    """
    Algoritmo de renegociação:
    - Mantém contas críticas (vence hoje/amanhã, já atrasadas) no prazo
    - Para as demais, calcula se redistribuindo os vencimentos a necessidade
      diária fica dentro da capacidade do motorista
    - Sugere prazo mínimo extra para cada conta renegociável
    """
    criticas = []
    renegociaveis = []
    
    # Palavras que indicam conta ESSENCIAL para motorista (nunca renegociar)
    ESSENCIAIS = ("carro", "veículo", "veiculo", "semanal", "aluguel do carro",
                  "combustível", "combustivel", "gasolina", "gás", "gas",
                  "luz", "energia", "água", "agua", "moto", "financiamento")
    
    for c in contas:
        venc = _dt.date.fromisoformat(str(c["vencimento"])[:10])
        dias_ate_venc = (venc - hoje).days
        desc = (c.get("descricao") or c.get("nome") or "").lower()
        eh_essencial = any(p in desc for p in ESSENCIAIS)
        # Essenciais OU que vencem em <=1 dia = críticas (pagar, não mover)
        if eh_essencial or dias_ate_venc <= 1:
            criticas.append(c)
        else:
            renegociaveis.append(c)
    
    # Calcula o total que precisa pagar nas contas críticas agora
    total_critico = sum(float(c.get("valor") or 0) for c in criticas)
    total_renegociavel = sum(float(c.get("valor") or 0) for c in renegociaveis)
    
    # Capacidade disponível após pagar as críticas (nos próximos 2 dias)
    cap_disponivel_2d = max(0.0, (media * 2) - total_critico)
    cap_restante = max(0.0, media * 30)  # capacidade do mês
    
    # Para cada conta renegociável, sugere quando pagar
    plano_renegociado = []
    saldo_acumulado = cap_restante - total_critico
    data_cursor = hoje + _dt.timedelta(days=2)
    
    # Limite: fim do mês atual (não joga conta pro mês seguinte sem necessidade)
    if hoje.month == 12:
        fim_mes = _dt.date(hoje.year, 12, 31)
    else:
        fim_mes = _dt.date(hoje.year, hoje.month + 1, 1) - _dt.timedelta(days=1)
    
    for c in renegociaveis:
        valor = float(c.get("valor") or 0)
        # Distribui ao longo do mês conforme a capacidade
        dias_necessarios = max(2, int(valor / (media * 0.5)) + 1)
        nova_data = data_cursor + _dt.timedelta(days=dias_necessarios)
        # NUNCA passa do fim do mês atual
        if nova_data > fim_mes:
            nova_data = fim_mes
        data_cursor = nova_data + _dt.timedelta(days=1)
        
        venc_original = _dt.date.fromisoformat(str(c["vencimento"])[:10])
        prazo_extra = (nova_data - venc_original).days
        
        # Se não precisa de prazo extra (já cabe), não sugere renegociar
        if prazo_extra <= 0:
            criticas.append(c)
            continue
        
        plano_renegociado.append({
            **c,
            "nova_data_sugerida": nova_data.isoformat(),
            "prazo_extra_dias": prazo_extra,
            "motivo": f"Mover para {nova_data.strftime('%d/%m')} libera caixa para as urgentes"
        })
    
    return {
        "criticas": criticas,
        "renegociaveis": plano_renegociado,
        "total_critico": round(total_critico, 2),
        "total_renegociavel": round(total_renegociavel, 2),
    }


@router.get("/planejador-contas/{motorista_id}")
async def planejador_contas(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if not _valid_uuid(motorista_id):
        return {"erro": "ID inválido"}
    
    hoje = _hoje()
    media = _media_diaria(motorista_id)
    contas = _contas_pendentes(motorista_id)
    
    if not contas:
        return {
            "situacao": "ok",
            "media_diaria": round(media, 2),
            "necessidade_diaria": 0,
            "mensagem": "Você não tem contas pendentes. 👍",
            "criticas": [], "renegociaveis": [], "total": 0
        }
    
    total = sum(float(c.get("valor") or 0) for c in contas)
    
    # Fim do mês atual (para calcular capacidade real até lá)
    if hoje.month == 12:
        fim_mes_data = _dt.date(hoje.year, 12, 31)
    else:
        fim_mes_data = _dt.date(hoje.year, hoje.month + 1, 1) - _dt.timedelta(days=1)
    
    # Calcula necessidade por janela de 30 dias (mais realista)
    hoje_s = hoje.isoformat()
    fim_30d = (hoje + _dt.timedelta(days=30)).isoformat()
    contas_30d = [c for c in contas if str(c.get("vencimento",""))[:10] <= fim_30d]
    total_30d = sum(float(c.get("valor") or 0) for c in contas_30d)
    necessidade_30d = total_30d / 30 if total_30d > 0 else 0
    
    # Necessidade imediata (pelos próximos 7 dias)
    fim_7d = (hoje + _dt.timedelta(days=7)).isoformat()
    contas_7d = [c for c in contas if str(c.get("vencimento",""))[:10] <= fim_7d]
    total_7d = sum(float(c.get("valor") or 0) for c in contas_7d)
    necessidade_7d = total_7d / 7 if total_7d > 0 else 0
    
    # Capacidade até o fim do mês: quantos dias úteis restam × média
    dias_restantes_mes = (fim_mes_data - hoje).days + 1 if 'fim_mes_data' in dir() else 30
    capacidade_mes = media * dias_restantes_mes
    
    # Decide a situação considerando o MÊS INTEIRO, não só 7 dias
    if media <= 0:
        situacao = "sem_dados"
        mensagem = "Registre seus ganhos por alguns dias para eu calcular seu faturamento médio e criar um plano."
    elif capacidade_mes >= total_30d and necessidade_7d <= media * 1.2:
        situacao = "ok"
        mensagem = f"Tá tranquilo! Com sua média de R${media:.0f}/dia você cobre tudo até o fim do mês."
    elif capacidade_mes >= total_30d:
        # Dá pra pagar no mês, mas os prazos próximos apertam — só reorganizar
        situacao = "atencao"
        mensagem = f"Você fatura o suficiente no mês (R${capacidade_mes:.0f}), mas algumas contas vencem muito juntas. Reorganizando os prazos, dá pra pagar tudo sem aperto."
    elif necessidade_7d <= media * 1.5:
        situacao = "atencao"
        mensagem = f"Atenção: os próximos 7 dias pedem R${necessidade_7d:.0f}/dia e sua média é R${media:.0f}/dia. Dá pra fazer com um bom ritmo, ou pedindo prazo em algumas."
    else:
        situacao = "critico"
        mensagem = f"Os prazos atuais pedem R${necessidade_7d:.0f}/dia, mas sua média é R${media:.0f}/dia. Vale pedir prazo nas contas não-essenciais para reorganizar."
    
    plano = _sugerir_plano(contas, media, hoje) if situacao in ("critico", "atencao") else {"criticas": contas_7d, "renegociaveis": [], "total_critico": total_7d, "total_renegociavel": 0}
    
    return {
        "situacao": situacao,
        "media_diaria": round(media, 2),
        "necessidade_7d": round(necessidade_7d, 2),
        "necessidade_30d": round(necessidade_30d, 2),
        "total_pendente": round(total, 2),
        "total_30d": round(total_30d, 2),
        "mensagem": mensagem,
        **plano
    }
