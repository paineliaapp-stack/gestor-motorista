"""Lógica unificada de contas: matching por nome e edição de conta.

executar_editar_conta substitui os 3 handlers de editar_conta que existiam
no /chat com lógicas ligeiramente diferentes (fonte de bugs históricos)."""
import unicodedata as _ud
from datetime import date as _date
from core.supabase_client import supabase
from core.logging import log_info, log_erro


def _match_conta(descricao_busca: str, contas: list) -> dict | None:
    """Encontra a melhor conta pelo nome — prefere match exato, depois prefixo mais longo."""
    import os.path
    descricao_busca = descricao_busca.lower().strip()
    melhor = None
    melhor_score = 0
    for c in contas:
        nome = c.get("descricao", "").lower().strip()
        if nome == descricao_busca:
            return c  # match exato
        score = len(os.path.commonprefix([descricao_busca, nome]))
        if score > melhor_score and score >= 4:
            melhor_score = score
            melhor = c
    return melhor


def _norm_desc(s):
    s = (s or '').lower().strip()
    s = _ud.normalize('NFD', s)
    return ''.join(c for c in s if _ud.category(c) != 'Mn')


def executar_editar_conta(motorista_id, descricao, campo, novo_valor, valor_filtro=None, vencimento_alvo=None):
    """Edita valor ou vencimento de uma conta pelo nome.

    Prioridade de identificação da parcela:
      1. valor_filtro     (ex: "o tênis de 500")
      2. vencimento_alvo  (ex: "o que vence dia X")
      3. mais próximo do vencimento (fallback: pendente com vencimento mais cedo)

    SEMPRE inclui o campo "valor" no SELECT do Supabase.
    Retorna True se alguma conta foi editada.
    """
    descricao = (descricao or "").lower()
    desc_norm = _norm_desc(descricao)
    contas_res = supabase.table("contas").select("id,descricao,pago,vencimento,valor").eq("motorista_id", motorista_id).execute()

    # ── Matching por nome: contém / contido / prefixo ──
    matches = []
    for c in (contas_res.data or []):
        c_norm = _norm_desc(c["descricao"])
        if desc_norm and (desc_norm in c_norm or c_norm in desc_norm or len(_ud.normalize('NFC', desc_norm[:5])) >= 4 and c_norm.startswith(desc_norm[:5])):
            matches.append(c)
    # Se não achou, tenta prefixo comum de 4+ chars
    if not matches:
        for c in (contas_res.data or []):
            c_norm = _norm_desc(c["descricao"])
            prefix = ''
            for a, b in zip(desc_norm, c_norm):
                if a == b: prefix += a
                else: break
            if len(prefix) >= 4:
                matches.append(c)
    if not matches:
        return False

    pendentes = [c for c in matches if not c.get("pago")]

    def _alvo_por_filtros(lista):
        """Aplica a prioridade: valor_filtro > vencimento_alvo > vencimento mais próximo."""
        if not lista:
            return None
        if valor_filtro is not None:
            try:
                vf = float(valor_filtro)
                por_valor = [c for c in lista if abs(float(c.get("valor", 0) or 0) - vf) < 1]
                if por_valor:
                    return por_valor[0]
            except Exception as _ef:
                log_erro("vfiltro_err", erro=_ef)
        if vencimento_alvo:
            try:
                alvo_dt = _date.fromisoformat(str(vencimento_alvo))
                return sorted(lista, key=lambda c: abs((_date.fromisoformat(c["vencimento"]) - alvo_dt).days))[0]
            except Exception:
                pass
        return sorted(lista, key=lambda c: c.get("vencimento", ""))[0]

    if campo == "vencimento":
        alvo = _alvo_por_filtros(pendentes)
        if alvo:
            log_info("editar_venc_ok", desc=alvo["descricao"], novo_venc=novo_valor)
            supabase.table("contas").update({"vencimento": str(novo_valor)}).eq("id", alvo["id"]).execute()
            return True
        return False

    if campo == "valor":
        if valor_filtro is not None or vencimento_alvo:
            # Parcela específica identificada por valor ou vencimento
            alvo = _alvo_por_filtros(pendentes)
            if alvo:
                supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", alvo["id"]).execute()
                return True
            return False
        # Sem filtro específico: atualiza TODAS as parcelas pendentes
        for c in pendentes:
            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", c["id"]).execute()
        return bool(pendentes)

    return False
