"""Cartão genérico: em branco (o aluno escreve nome e matrícula), última página do PDF pessoal e emissão avulsa."""
from __future__ import annotations

import io
import json

import pymupdf
import pytest
import zxingcpp
from openpyxl import load_workbook
from typer.testing import CliRunner

from cartao_omr import layout as L
from cartao_omr.card import (
    ROTULO_GENERICO,
    build_template,
    draw_card,
    specs_genericos,
    specs_personalizados,
    template_json,
    write_cards_pdf,
)
from cartao_omr.cli import app
from cartao_omr.config import TEMPLATES_DIR
from cartao_omr.export_xlsx import escrever_planilha, resumo
from cartao_omr.models import MODEL_GENERICO, QR_KIND_GENERICO, CardSpec, RosterEntry, parse_qr
from cartao_omr.processar import CARTAO_GENERICO, NAO_IDENTIFICADOS, RESPOSTAS, processar_pdf

from cardcheck import assert_marcadores_e_bolhas, render_gray

SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
PT = 72 / 25.4
runner = CliRunner()


def _pdf(specs) -> bytes:
    buf = io.BytesIO()
    write_cards_pdf(buf, specs)
    return buf.getvalue()


def _textos(pdf: bytes, pagina: int) -> str:
    return pymupdf.open(stream=pdf, filetype="pdf")[pagina].get_text()


# ------------------------------------------------------------------ QR
def test_payload_e_parse_do_qr_generico():
    spec = specs_genericos(1, SIM, "S", "IES X")[0]
    assert spec.qr_payload == "SFA2:G:9D6C1F0E"
    data = parse_qr(spec.qr_payload)
    assert data.kind == QR_KIND_GENERICO and data.sim8 == "9D6C1F0E"
    assert data.layout == L.LAYOUT_SFA and data.identificacao is None


@pytest.mark.parametrize("texto", ["SFA2:G:9D6C1F0E:2023001", "SFA2:G:9d6c1f0e", "SFA2:G:", "SFA2:G:9D6C1F0"])
def test_qr_generico_mal_formado_e_recusado(texto):
    assert parse_qr(texto) is None


def test_specs_genericos_validam_copias_e_simulado():
    assert len(specs_genericos(3, SIM)) == 3
    assert all(s.label == ROTULO_GENERICO and s.model == MODEL_GENERICO for s in specs_genericos(2, SIM))
    with pytest.raises(ValueError):
        specs_genericos(0, SIM)
    with pytest.raises(ValueError):
        specs_genericos(1, "nao-e-uuid")[0].qr_payload


# ------------------------------------------------------------------ template
def test_template_generico_tem_a_geometria_do_sfa():
    sfa, gen = build_template(L.LAYOUT_SFA), build_template(L.LAYOUT_SFA, generico=True)
    assert gen["template_version"] == L.TEMPLATE_GENERICO and gen["layout"] == L.LAYOUT_SFA
    for chave in ("page_mm", "fiducials_mm", "qr_box_mm", "alternatives", "questions", "matricula", "crops_mm",
                  "blocks_mm"):
        assert gen[chave] == sfa[chave], chave
    assert gen["qr"]["example"].startswith("SFA2:G:")
    # sem os slots do aluno: nome e matrícula são escritos à mão
    slots = {op.get("slot") for op in gen["draw"]}
    assert not slots & {"aluno", "matricula", "dica_matricula"}
    assert {"titulo", "subtitulo", "label"} <= slots


def test_template_generico_no_disco_esta_sincronizado():
    path = TEMPLATES_DIR / f"{L.TEMPLATE_GENERICO}.json"
    assert path.exists(), f"{path} não existe; rode `cartao-omr modelo`"
    assert path.read_text(encoding="utf-8") == template_json(build_template(L.LAYOUT_SFA, generico=True))
    json.loads(path.read_text(encoding="utf-8"))


def test_genérico_so_existe_no_layout_sfa():
    with pytest.raises(ValueError):
        build_template(L.LAYOUT_UNIATENAS, generico=True)


def test_template_errado_para_o_cartao_e_recusado():
    from reportlab.pdfgen.canvas import Canvas

    c = Canvas(io.BytesIO())
    with pytest.raises(ValueError, match="template"):
        draw_card(c, build_template(L.LAYOUT_SFA), specs_genericos(1, SIM)[0])
    pessoal = CardSpec(model="personalizado", simulado_id=SIM, aluno_nome="A", matricula="1")
    with pytest.raises(ValueError, match="template"):
        draw_card(c, build_template(L.LAYOUT_SFA, generico=True), pessoal)


# ------------------------------------------------------------------ PDF
def test_pdf_generico_tem_qr_legivel_marcadores_e_textos():
    pdf = _pdf(specs_genericos(1, SIM, "SIMULADO TESTE", "IES X", "25/10/2026"))
    img = render_gray(pdf, dpi=200)
    assert [r.text for r in zxingcpp.read_barcodes(img)] == ["SFA2:G:9D6C1F0E"]
    assert [r.text for r in zxingcpp.read_barcodes(render_gray(pdf, dpi=100))] == ["SFA2:G:9D6C1F0E"]
    assert_marcadores_e_bolhas(img, build_template(L.LAYOUT_SFA, generico=True), 200)
    texto = _textos(pdf, 0)
    for trecho in ("SIMULADO TESTE", "IES X", "GENÉRICO", "MATRÍCULA", "escreva seu nome completo"):
        assert trecho in texto, trecho


def test_pdf_misto_pessoal_e_generico():
    specs = specs_personalizados([RosterEntry("2023001", "Ana")], SIM, "S", "IES") + specs_genericos(1, SIM, "S", "IES")
    pdf = _pdf(specs)
    assert len(pymupdf.open(stream=pdf, filetype="pdf")) == 2
    assert "Ana" in _textos(pdf, 0) and "GENÉRICO" in _textos(pdf, 1)
    assert "escreva seu nome completo" not in _textos(pdf, 0)


# ------------------------------------------------------------------ CLI
def _roster(tmp_path):
    csv = tmp_path / "roster.csv"
    csv.write_text("matricula,nome\n2023001,Ana\n2023002,Bruno\n", encoding="utf-8")
    return csv


def test_cli_sfa_acrescenta_o_generico_na_ultima_pagina(tmp_path):
    out = tmp_path / "c.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--roster", str(_roster(tmp_path)), "--saida", str(out)])
    assert r.exit_code == 0, r.output
    doc = pymupdf.open(out)
    assert len(doc) == 3 and "GENÉRICO" in doc[2].get_text() and "GENÉRICO" not in doc[1].get_text()


def test_cli_sem_generico(tmp_path):
    out = tmp_path / "c.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--roster", str(_roster(tmp_path)), "--saida", str(out),
                            "--sem-generico"])
    assert r.exit_code == 0, r.output
    assert len(pymupdf.open(out)) == 2


def test_cli_modelo_generico_avulso(tmp_path):
    out = tmp_path / "g.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--modelo", "generico", "--copias", "2", "--saida", str(out)])
    assert r.exit_code == 0, r.output
    assert len(pymupdf.open(out)) == 2
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--modelo", "generico", "--roster",
                            str(_roster(tmp_path)), "--saida", str(out)])
    assert r.exit_code != 0


# ------------------------------------------------------------------ leitura
def _marcar(pdf_path, pagina: int, respostas: dict[int, str], escrito: str | None = None):
    """Preenche bolhas (e escreve a matrícula, como o aluno faria) na página do PDF."""
    tpl = build_template(L.LAYOUT_SFA)
    doc = pymupdf.open(pdf_path)
    page = doc[pagina]
    for q, alt in respostas.items():
        cx, cy, d = tpl["questions"][str(q)][alt]
        page.draw_circle((cx * PT, cy * PT), d / 2 * PT * 0.9, color=(0, 0, 0), fill=(0, 0, 0))
    if escrito:
        page.insert_text((25 * PT, (L.GENERICO_MATRICULA_LINE_Y - 1) * PT), escrito, fontsize=14)
        page.insert_text((40 * PT, 38 * PT), "Fulano Atrasado", fontsize=12)
    saida = pdf_path.with_name(pdf_path.stem + "_marcado.pdf")
    doc.save(saida)
    return saida


def test_leitor_manda_o_generico_para_nao_identificados_com_recorte_e_respostas(tmp_path):
    specs = specs_personalizados([RosterEntry("2023001", "Ana")], SIM, "S", "IES") + specs_genericos(1, SIM, "S", "IES")
    pdf = tmp_path / "cartoes.pdf"
    pdf.write_bytes(_pdf(specs))
    marcado = _marcar(pdf, 1, {1: "A", 2: "C", 3: "D"}, escrito="2024009")
    res = processar_pdf(marcado, SIM, tmp_path / "out", 10)
    ana, gen = res.paginas
    assert ana.destino == RESPOSTAS and ana.identificacao == "2023001"
    assert gen.destino == NAO_IDENTIFICADOS and gen.motivo == CARTAO_GENERICO and gen.identificacao is None
    assert gen.respostas == {1: "A", 2: "C", 3: "D", **{q: None for q in range(4, 11)}}
    [pend] = [p for p in res.pendencias if p.tipo == CARTAO_GENERICO]
    assert pend.pagina == 2 and pend.recorte and (tmp_path / "out" / pend.recorte).exists()
    assert resumo(res)["genericos"] == 1 and resumo(res)["identificadas"] == 1

    xlsx = escrever_planilha(res, tmp_path / "r.xlsx")
    wb = load_workbook(xlsx)
    assert [r[0] for r in wb["Respostas"].iter_rows(min_row=2, values_only=True)] == ["2023001"]
    [linha] = list(wb["Não identificados"].iter_rows(min_row=2, values_only=True))
    assert linha[:5] == (2, CARTAO_GENERICO, None, "A", "C")


def test_generico_de_outro_simulado_e_ignorado(tmp_path):
    pdf = tmp_path / "g.pdf"
    pdf.write_bytes(_pdf(specs_genericos(1, SIM)))
    res = processar_pdf(pdf, "11111111-2222-4333-8444-555555555555", tmp_path / "out")
    assert res.paginas[0].status == "simulado_divergente" and res.paginas[0].destino == "ignorada"


def test_dois_genericos_nao_viram_aluno_duplicado(tmp_path):
    pdf = tmp_path / "g.pdf"
    pdf.write_bytes(_pdf(specs_genericos(2, SIM)))
    res = processar_pdf(pdf, SIM, tmp_path / "out")
    assert [pg.motivo for pg in res.paginas] == [CARTAO_GENERICO, CARTAO_GENERICO]
