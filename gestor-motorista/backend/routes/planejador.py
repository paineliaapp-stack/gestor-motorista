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
    """Média de faturamento diário real nos últimos N dias."""
    try:
        ini = (_hoje() - _dt.timedelta(days=dias)).isoformat()
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
    """Contas pendentes ordenadas por vencimento."""
    try:
        hoje_s = _hoje().isoformat()
        r = supabase.table("contas").select("*") \
            .eq("motorista_id", mid).eq("status", "pendente") \
            .gte("vencimento", hoje_s) \
            .order("vencimento").execute()
        return r.data or []
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
    
    for c in contas:
        venc = _dt.date.fromisoformat(str(c["vencimento"])[:10])
        dias_ate_venc = (venc - hoje).days
        if dias_ate_venc <= 1:  # hoje ou amanhã: não dá pra renegociar
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
    
    for c in renegociaveis:
        valor = float(c.get("valor") or 0)
        # Quantos dias trabalhando para acumular esse valor (com 70% do faturamento livre)
        dias_necessarios = max(1, int(valor / (media * 0.65)) + 1)
        nova_data = data_cursor + _dt.timedelta(days=dias_necessarios)
        data_cursor = nova_data + _dt.timedelta(days=2)  # folga entre contas
        
        venc_original = _dt.date.fromisoformat(str(c["vencimento"])[:10])
        prazo_extra = (nova_data - venc_original).days
        
        plano_renegociado.append({
            **c,
            "nova_data_sugerida": nova_data.isoformat(),
            "prazo_extra_dias": max(0, prazo_extra),
            "motivo": f"Mover para {nova_data.strftime('%d/%m')} libera R${media:.0f}/dia para as demais"
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
    
    # Decide a situação
    if media <= 0:
        situacao = "sem_dados"
        mensagem = "Registre seus ganhos por alguns dias para eu calcular seu faturamento médio e criar um plano."
    elif necessidade_7d <= media * 1.1:
        situacao = "ok"
        mensagem = f"Tá tranquilo! Com sua média de R${media:.0f}/dia você consegue pagar tudo nos prazos atuais."
    elif necessidade_7d <= media * 1.5:
        situacao = "atencao"
        mensagem = f"Atenção: você precisa faturar R${necessidade_7d:.0f}/dia nos próximos 7 dias. Sua média é R${media:.0f}/dia. Dá pra fazer, mas vai precisar de um bom ritmo."
    else:
        situacao = "critico"
        mensagem = f"Os prazos atuais pedem R${necessidade_7d:.0f}/dia, mas sua média é R${media:.0f}/dia — inviável sem renegociar alguns prazos."
    
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
