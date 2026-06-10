"""Rota do relatório em PDF."""
from fastapi import APIRouter, Body, Depends, HTTPException
from core.security import get_uid_from_token
from services.pdf_service import gerar_relatorio_pdf_impl

router = APIRouter()


@router.post("/relatorio-pdf")
async def gerar_relatorio_pdf(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    if dados.get("motorista_id") != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    return await gerar_relatorio_pdf_impl(dados)


