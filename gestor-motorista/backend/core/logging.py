"""Logging estruturado JSON — versão única (módulo logging).
A duplicata baseada em print() foi removida (bug corrigido)."""
import logging, json

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":%(message)s}',
    datefmt='%Y-%m-%dT%H:%M:%S'
)
log = logging.getLogger("painelia")

def log_info(evento: str, **kw):
    log.info(json.dumps({"ev": evento, **{k: str(v)[:200] for k,v in kw.items()}}, ensure_ascii=False))

def log_erro(evento: str, erro=None, **kw):
    d = {"ev": evento, **{k: str(v)[:200] for k,v in kw.items()}}
    if erro: d["erro"] = str(erro)[:300]
    log.error(json.dumps(d, ensure_ascii=False))

def log_warn(evento: str, **kw):
    log.warning(json.dumps({"ev": evento, **{k: str(v)[:200] for k,v in kw.items()}}, ensure_ascii=False))
