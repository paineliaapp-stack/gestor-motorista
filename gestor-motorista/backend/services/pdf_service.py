"""Geração do PDF de relatório (reportlab)."""
from core.supabase_client import supabase
from core.logging import log_erro


async def gerar_relatorio_pdf_impl(dados: dict):
    try:
        import io, datetime as _dt
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.units import mm
        from fastapi.responses import StreamingResponse

        import calendar as _cal
        mid = dados.get("motorista_id")
        tipo = dados.get("tipo", "mes")  # mes | semana | ano

        if not mid:
            return {"erro": "motorista_id obrigatório"}

        # Define período conforme tipo
        if tipo == "semana":
            inicio = dados.get("inicio")
            fim = dados.get("fim")
            if not inicio or not fim:
                return {"erro": "inicio e fim obrigatórios para semana"}
            ano = inicio[:4]
            label_periodo = f"Semana {inicio} a {fim}"
            # Para comparação: semana anterior
            dt_ini = _dt.date.fromisoformat(inicio)
            ini_ant = (dt_ini - _dt.timedelta(days=7)).isoformat()
            fim_ant = (dt_ini - _dt.timedelta(days=1)).isoformat()
        elif tipo == "ano":
            ano = str(dados.get("ano", _dt.date.today().year))
            inicio = f"{ano}-01-01"
            fim = f"{ano}-12-31"
            label_periodo = f"Ano {ano}"
            ini_ant = f"{int(ano)-1}-01-01"
            fim_ant = f"{int(ano)-1}-12-31"
        else:  # mes (padrão)
            mes = dados.get("mes")
            if not mes:
                return {"erro": "mes obrigatório"}
            ano, mes_num = mes.split("-")
            inicio = f"{mes}-01"
            ultimo_dia = _cal.monthrange(int(ano), int(mes_num))[1]
            fim = f"{mes}-{ultimo_dia:02d}"
            NOMES_MESES_B = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
            label_periodo = f"{NOMES_MESES_B[int(mes_num)]} {ano}"
            dt_mes = _dt.date(int(ano), int(mes_num), 1)
            dt_ant = (dt_mes - _dt.timedelta(days=1)).replace(day=1)
            mes_ant = dt_ant.strftime("%Y-%m")
            ultimo_ant = _cal.monthrange(dt_ant.year, dt_ant.month)[1]
            ini_ant = f"{mes_ant}-01"
            fim_ant = f"{mes_ant}-{ultimo_ant:02d}"

        # Busca lançamentos do período
        lanc_res = supabase.table("lancamentos").select("*").eq("motorista_id", mid).gte("data", inicio).lte("data", fim).order("data").execute()
        lancs = lanc_res.data or []

        # Busca período anterior para comparação
        lanc_ant = supabase.table("lancamentos").select("*").eq("motorista_id", mid).gte("data", ini_ant).lte("data", fim_ant).execute()
        lancs_ant = lanc_ant.data or []

        # Busca contas
        contas_res = supabase.table("contas").select("*").eq("motorista_id", mid).execute()
        contas = contas_res.data or []

        # Cálculos mês atual
        RENDA_EXTRA = ['seguro_desemprego','freelance','aluguel_recebido','venda','emprestimo_recebido','bonus','renda_extra']
        ganhos = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho")
        ganhos_app = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho" and (l.get("plataforma","") or "") not in RENDA_EXTRA)
        ganhos_extra = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho" and (l.get("plataforma","") or "") in RENDA_EXTRA)
        despesas = sum(float(l["valor"]) for l in lancs if l["tipo"] == "despesa")
        lucro = ganhos - despesas
        dias_trab = len(set(l["data"] for l in lancs if l["tipo"] == "ganho"))
        media_dia = ganhos_app / max(dias_trab, 1)

        # Cálculos mês anterior
        ganhos_ant = sum(float(l["valor"]) for l in lancs_ant if l["tipo"] == "ganho")
        despesas_ant = sum(float(l["valor"]) for l in lancs_ant if l["tipo"] == "despesa")
        lucro_ant = ganhos_ant - despesas_ant

        # Por categoria
        cats = {}
        for l in lancs:
            if l["tipo"] == "despesa":
                k = l.get("descricao") or "outros"
                cats[k] = cats.get(k, 0) + float(l["valor"])

        # Contas
        contas_pagas = [c for c in contas if c.get("pago")]
        contas_pend = [c for c in contas if not c.get("pago")]

        def fmt(v): return f"R$ {float(v):,.2f}".replace(",","X").replace(".",",").replace("X",".")
        def delta(atual, ant):
            if ant == 0: return ""
            pct = (atual - ant) / ant * 100
            sinal = "▲" if pct >= 0 else "▼"
            return f"{sinal} {abs(pct):.0f}% vs mês anterior"

        nome_mes = label_periodo

        # ── Monta PDF ──
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
            leftMargin=18*mm, rightMargin=18*mm, topMargin=20*mm, bottomMargin=18*mm)

        AMARELO  = colors.HexColor("#F5A623")
        AMARELO2 = colors.HexColor("#FFF3D0")
        VERDE    = colors.HexColor("#16A34A")
        VERDE2   = colors.HexColor("#DCFCE7")
        VERMELHO = colors.HexColor("#DC2626")
        VERMELHO2= colors.HexColor("#FEE2E2")
        CINZA    = colors.HexColor("#6B7280")
        CINZA2   = colors.HexColor("#F3F4F6")
        CINZA3   = colors.HexColor("#E5E7EB")
        AZUL     = colors.HexColor("#6366F1")
        PRETO    = colors.HexColor("#111111")
        BRANCO   = colors.white

        def estilo(nome, **kw):
            base = {"fontName":"Helvetica","fontSize":10,"textColor":PRETO,"leading":14}
            base.update(kw)
            return ParagraphStyle(nome, **base)

        titulo_style = estilo("titulo", fontSize=22, fontName="Helvetica-Bold", textColor=AMARELO, spaceAfter=1, leading=26)
        app_name_style= estilo("appname", fontSize=22, fontName="Helvetica-Bold", textColor=PRETO, spaceAfter=1, leading=26)
        sub_style    = estilo("sub", fontSize=10, textColor=CINZA, spaceAfter=14, leading=14)
        secao_style  = estilo("secao", fontSize=12, fontName="Helvetica-Bold", textColor=PRETO, spaceBefore=16, spaceAfter=8, leading=16)
        normal_style = estilo("normal", fontSize=9, textColor=colors.HexColor("#333333"), leading=14)
        delta_style  = estilo("delta", fontSize=8, textColor=CINZA, leading=12)
        aviso_style  = estilo("aviso", fontSize=9, textColor=colors.HexColor("#D97706"), leading=13)
        rodape_style = estilo("rodape", fontSize=8, textColor=CINZA, alignment=1)

        story = []

        # ── Cabeçalho elegante ──
        from reportlab.platypus import Table as _T
        header_data = [[
            Paragraph("<font color='#F5A623'><b>Painel</b></font><b>.IA</b>", estilo("hdr_logo", fontSize=24, fontName="Helvetica-Bold", textColor=PRETO, leading=28)),
            Paragraph(
                f"<b>Relatório Financeiro</b><br/><font color='#6B7280'>{nome_mes}</font><br/><font color='#6B7280' size='8'>Gerado em {_dt.date.today().strftime('%d/%m/%Y')}</font>",
                estilo("hdr_info", fontSize=11, fontName="Helvetica-Bold", textColor=PRETO, alignment=2, leading=16)
            )
        ]]
        hdr_table = _T(header_data, colWidths=[90*mm, 90*mm])
        hdr_table.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("PADDING", (0,0), (-1,-1), 0),
            ("LINEBELOW", (0,0), (-1,0), 2.5, AMARELO),
        ]))
        story.append(hdr_table)
        story.append(Spacer(1, 14))

        # ── Resumo mensal (cards em linha) ──
        story.append(Paragraph("Resumo do Mês", secao_style))

        def card_cor(v, positivo=True):
            if positivo: return VERDE2 if v >= 0 else VERMELHO2
            return VERMELHO2

        resumo_data = [
            ["", Paragraph("<b>Este mês</b>", normal_style),
                 Paragraph("<b>Mês anterior</b>", normal_style),
                 Paragraph("<b>Variação</b>", normal_style)],
            [Paragraph("■ Ganhos totais", normal_style),
             Paragraph(f"<font color='#16A34A'><b>{fmt(ganhos)}</b></font>", normal_style),
             Paragraph(f"{fmt(ganhos_ant)}", normal_style),
             Paragraph(delta(ganhos, ganhos_ant), delta_style)],
            [Paragraph("■ Despesas", normal_style),
             Paragraph(f"<font color='#DC2626'><b>{fmt(despesas)}</b></font>", normal_style),
             Paragraph(f"{fmt(despesas_ant)}", normal_style),
             Paragraph(delta(despesas, despesas_ant), delta_style)],
            [Paragraph("■ Lucro líquido", normal_style),
             Paragraph(f"<font color='{'#16A34A' if lucro>=0 else '#DC2626'}'><b>{fmt(lucro)}</b></font>", normal_style),
             Paragraph(f"{fmt(lucro_ant)}", normal_style),
             Paragraph(delta(lucro, lucro_ant), delta_style)],
            [Paragraph("■ Dias trabalhados", normal_style),
             Paragraph(f"<b>{dias_trab}</b>", normal_style), "", ""],
            [Paragraph("■ Média/dia (apps)", normal_style),
             Paragraph(f"<font color='#D97706'><b>{fmt(media_dia)}</b></font>", normal_style), "", ""],
        ]
        if ganhos_app > 0 and ganhos_extra > 0:
            resumo_data += [
                [Paragraph("  ↳ Apps (Uber/99/inDrive)", normal_style),
                 Paragraph(f"<font color='#16A34A'>{fmt(ganhos_app)}</font>", normal_style), "", ""],
                [Paragraph("  ↳ Renda extra", normal_style),
                 Paragraph(f"<font color='#6366F1'>{fmt(ganhos_extra)}</font>", normal_style), "", ""],
            ]
        t = Table(resumo_data, colWidths=[52*mm, 42*mm, 42*mm, 44*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), CINZA2),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [BRANCO, CINZA2]),
            ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
            ("PADDING", (0,0), (-1,-1), 7),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        story.append(t)
        story.append(Spacer(1, 4))

        # Despesas por categoria
        if cats:
            story.append(Paragraph("Despesas por Categoria", secao_style))
            total_desp = sum(cats.values())
            cats_sorted = sorted(cats.items(), key=lambda x: x[1], reverse=True)
            NOMES_CAT = {
                'combustivel':'Combustível','pedagio':'Pedágio/Estac.','manutencao':'Manutenção','taxa_app':'Taxa App','cooperativa':'Cooperativa','estoque_loja':'Estoque/Loja',
                'lavagem':'Lavagem','acessorio_carro':'Acessório Carro','aluguel_carro':'Aluguel Carro',
                'financiamento':'Financiamento','seguro':'Seguro','ipva':'IPVA/Licenc.',
                'multa':'Multa Trânsito','multa_app':'Multa do App','mercado':'Mercado',
                'restaurante':'Restaurante','lanche':'Lanche/Café','farmacia':'Farmácia',
                'saude':'Saúde/Plano','higiene':'Higiene','aluguel_casa':'Aluguel Casa',
                'condominio':'Condomínio','luz_agua':'Luz/Água/Gás','presente_familia':'Presente/Família',
                'roupa':'Roupas','celular':'Celular','internet':'Internet','streaming':'Streaming',
                'emprestimo':'Empréstimo','investimento':'Investimento','lazer':'Lazer',
                'educacao':'Educação','outros':'Outros','desconhecido':'Não identificado',
            }
            cat_data = [["Categoria", "Valor", "% do total"]]
            for k, v in cats_sorted:
                nome_cat = NOMES_CAT.get(k, k.replace("_"," ").title())
                pct = v / total_desp * 100 if total_desp > 0 else 0
                cat_data.append([nome_cat, fmt(v), f"{pct:.1f}%"])
            cat_data.append(["TOTAL", fmt(total_desp), "100%"])
            tc = Table(cat_data, colWidths=[90*mm, 45*mm, 35*mm])
            tc.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), CINZA2),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
                ("BACKGROUND", (0,-1), (-1,-1), AMARELO2),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("ROWBACKGROUNDS", (0,1), (-1,-2), [BRANCO, CINZA2]),
                ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
                ("PADDING", (0,0), (-1,-1), 7),
                ("TEXTCOLOR", (1,1), (1,-2), VERMELHO),
                ("ALIGN", (1,0), (-1,-1), "RIGHT"),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ]))
            story.append(tc)
            story.append(Spacer(1, 8))

        # Lista de lançamentos
        story.append(Paragraph("Todos os Lançamentos", secao_style))
        lancs_ord = sorted(lancs, key=lambda x: x["data"])
        lanc_data = [["Data", "Tipo", "Descrição/Plataforma", "Valor"]]
        for l in lancs_ord:
            data_fmt = "/".join(reversed(l["data"].split("-")))
            tipo_str = "Ganho" if l["tipo"] == "ganho" else "Despesa"
            desc = (l.get("plataforma") or l.get("descricao") or "-").title()
            val = float(l["valor"])
            sinal = "+" if l["tipo"] == "ganho" else "-"
            lanc_data.append([data_fmt, tipo_str, desc, f"{sinal}{fmt(val)}"])
        tl = Table(lanc_data, colWidths=[22*mm, 22*mm, 90*mm, 36*mm])
        tl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), CINZA2),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 8),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [BRANCO, CINZA2]),
            ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
            ("PADDING", (0,0), (-1,-1), 6),
            ("ALIGN", (3,0), (3,-1), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        for i, l in enumerate(lancs_ord, 1):
            cor = VERDE if l["tipo"] == "ganho" else VERMELHO
            tl.setStyle(TableStyle([
                ("TEXTCOLOR", (3,i), (3,i), cor),
                ("FONTNAME", (3,i), (3,i), "Helvetica-Bold"),
            ]))
        story.append(tl)
        story.append(Spacer(1, 8))

        # Contas
        if contas:
            story.append(Paragraph("Contas do Mês", secao_style))
            contas_ord = sorted(contas, key=lambda x: x.get("vencimento","") or "")
            contas_data = [["Conta", "Vencimento", "Valor", "Status"]]
            for c in contas_ord:
                nome_c = c.get("descricao","") or c.get("nome","")
                venc = c.get("vencimento","") or ""
                if venc: venc = "/".join(reversed(venc.split("-")))
                val_c = fmt(float(c.get("valor",0)))
                status = "Pago" if c.get("pago") else "Pendente"
                contas_data.append([nome_c, venc, val_c, status])
            tc2 = Table(contas_data, colWidths=[72*mm, 28*mm, 40*mm, 30*mm])
            tc2.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), CINZA2),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [BRANCO, CINZA2]),
                ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
                ("PADDING", (0,0), (-1,-1), 7),
                ("ALIGN", (2,0), (2,-1), "RIGHT"),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ]))
            for i, c in enumerate(contas_ord, 1):
                cor = VERDE if c.get("pago") else VERMELHO
                tc2.setStyle(TableStyle([("TEXTCOLOR",(3,i),(3,i),cor),("FONTNAME",(3,i),(3,i),"Helvetica-Bold")]))
            story.append(tc2)
            story.append(Spacer(1, 8))

        # Rodapé
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=0.5, color=CINZA3))
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"Painel.IA  ·  Relatório gerado em {_dt.date.today().strftime('%d/%m/%Y')}  ·  Valores em BRL", rodape_style))

        doc.build(story)
        buffer.seek(0)
        label_arquivo = label_periodo.replace(" ","_").replace("/","-")
        nome_arquivo = f"relatorio_{label_arquivo}.pdf"
        return StreamingResponse(buffer, media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
                "Content-Type": "application/pdf",
                "X-Content-Type-Options": "nosniff"
            })
    except Exception as e:
        import traceback
        log_erro("pdf_erro", erro=e)
        return {"erro": "Erro interno ao gerar relatório"}
