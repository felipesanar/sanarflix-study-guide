"""`processar`: PDF escaneado -> planilha de importação, identificando o aluno só pela matrícula do cartão."""
from __future__ import annotations

import json

import pymupdf
import pytest
from openpyxl import load_workbook
from typer.testing import CliRunner

from cartao_omr.cli import app
from cartao_omr.export_xlsx import COLUNA_ID, escrever_planilha, escrever_relatorio, resumo
from cartao_omr.processar import (
    ALUNO_DUPLICADO,
    FORA_DA_LISTA,
    MATRICULA_INVALIDA,
    NAO_IDENTIFICADOS,
    PAGINA_ILEGIVEL,
    QR_ILEGIVEL,
    RESPOSTA_ALEM_DO_SIMULADO,
    RESPOSTAS,
    SIMULADO_DIVERGENTE,
    ler_lista_emissao,
    processar_pdf,
)

from conftest import ROOT

FIXTURES = ROOT / "tests" / "fixtures"
runner = CliRunner()


def _gab(nome: str) -> dict:
    return json.loads((FIXTURES / f"{nome}.gabarito.json").read_text(encoding="utf-8"))


def _processar(nome: str, tmp_path, **kw):
    gab = _gab(nome)
    res = processar_pdf(FIXTURES / gab["file"], gab["simulado_id"], tmp_path, **kw)
    return gab, res


def _importador(path, total: int):
    """Espelho Python de `parseMatrizRespostas` (importar-respostas-types.ts): só a 1ª aba, por posição."""
    ws = load_workbook(path).worksheets[0]
    linhas = [list(r) for r in ws.iter_rows(values_only=True)]
    vazia = lambda v: v is None or str(v).strip() == ""  # noqa: E731
    linhas = [r for r in linhas if any(not vazia(v) for v in r)]
    assert len(linhas) >= 2
    largura = 0
    for r in linhas:
        w = len(r)
        while w > 0 and vazia(r[w - 1]):
            w -= 1
        largura = max(largura, w)
    assert largura == 1 + total, f"{largura} colunas; esperado {1 + total}"
    rows = []
    for r in linhas[1:]:
        respostas = {}
        for q in range(1, total + 1):
            v = r[q] if q < len(r) else None
            assert vazia(v) or str(v).strip() in "ABCDE", v
            respostas[q] = None if vazia(v) else str(v).strip()
        rows.append((str(r[0]).strip(), respostas))
    return rows


# ------------------------------------------------------------------ cartão pessoal: matrícula do QR
def test_sfa_limpo_identifica_todos_pela_matricula_do_qr(tmp_path):
    gab, res = _processar("sfa_personalizado_limpo", tmp_path)
    cartoes = [p for p in gab["pages"] if p["kind"] == "cartao"]
    ids = {pg.pagina: pg.matricula for pg in res.paginas}
    for c in cartoes:
        assert ids[c["page"]] == c["matricula_qr"].upper()
    assert sum(pg.destino == RESPOSTAS for pg in res.paginas) == len(cartoes)
    assert not [p for p in res.pendencias if p.tipo in (QR_ILEGIVEL, PAGINA_ILEGIVEL, SIMULADO_DIVERGENTE)]


def test_respostas_lidas_batem_com_o_gabarito(tmp_path):
    gab, res = _processar("sfa_personalizado_limpo", tmp_path)
    por_pagina = {pg.pagina: pg for pg in res.paginas}
    conferidas = 0
    for c in (p for p in gab["pages"] if p["kind"] == "cartao"):
        for q, a in c["answers"].items():
            if not a["strict"]:
                continue
            esperado = a["letter"] if a["truth"] == "marcada" else None
            assert por_pagina[c["page"]].respostas[int(q)] == esperado, (c["page"], q)
            conferidas += 1
    assert conferidas >= 400


def test_sfa_dificil_manda_para_pendencias_o_que_nao_deu_certeza(tmp_path):
    gab, res = _processar("sfa_dificil", tmp_path)
    tipos = {(p.pagina, p.tipo) for p in res.pendencias}
    assert (6, PAGINA_ILEGIVEL) in tipos          # marcador de canto coberto
    assert (7, QR_ILEGIVEL) in tipos              # QR danificado: as respostas saem, o aluno não
    pg7 = next(pg for pg in res.paginas if pg.pagina == 7)
    assert pg7.destino == NAO_IDENTIFICADOS and pg7.matricula is None
    assert len(pg7.respostas) == 100
    # os dois ganham recorte para o João conferir (o QR ilegível, nome e matrícula impressos)
    for pend in res.pendencias:
        if pend.tipo in (PAGINA_ILEGIVEL, QR_ILEGIVEL):
            assert pend.recorte and (tmp_path / pend.recorte).exists()
    # marca fraca vira dúvida: célula em branco, nunca letra errada
    assert any(p.tipo in ("ambigua", "multipla") for p in res.pendencias)


def test_simulado_de_outro_cartao_nao_e_lido(tmp_path):
    gab = _gab("sfa_personalizado_limpo")
    outro = "11111111-2222-4333-8444-555555555555"
    res = processar_pdf(FIXTURES / gab["file"], outro, tmp_path)
    cartoes = [pg for pg in res.paginas if pg.status != "pagina_em_branco"]
    assert cartoes and all(pg.status == SIMULADO_DIVERGENTE and pg.destino == "ignorada" for pg in cartoes)
    assert not any(pg.destino == RESPOSTAS for pg in res.paginas)


def test_a_mesma_matricula_em_duas_paginas_sai_de_respostas(tmp_path):
    gab = _gab("sfa_personalizado_limpo")
    doc = pymupdf.open(FIXTURES / gab["file"])
    doc.insert_pdf(pymupdf.open(FIXTURES / gab["file"]), from_page=0, to_page=0)  # cartão 1 de novo, no fim
    pdf = tmp_path / "dup.pdf"
    doc.save(pdf)
    res = processar_pdf(pdf, gab["simulado_id"], tmp_path / "out")
    ultima = len(doc)
    dups = [pg for pg in res.paginas if pg.motivo == ALUNO_DUPLICADO]
    assert sorted(pg.pagina for pg in dups) == [1, ultima]
    assert all(pg.destino == NAO_IDENTIFICADOS and pg.matricula for pg in dups)
    assert not any(pg.matricula == dups[0].matricula for pg in res.paginas if pg.destino == RESPOSTAS)


# ------------------------------------------------------------------ UniAtenas: matrícula das bolhas
def test_uniatenas_identifica_pelas_bolhas_e_pendencia_a_invalida(tmp_path):
    gab, res = _processar("uniatenas_realista", tmp_path)
    por_pagina = {pg.pagina: pg for pg in res.paginas}
    for c in (p for p in gab["pages"] if p["kind"] == "cartao"):
        pg = por_pagina[c["page"]]
        if c["matricula"]["status"] == "ok":
            assert pg.destino == RESPOSTAS and pg.matricula == c["matricula"]["value"]
        else:
            assert pg.destino == NAO_IDENTIFICADOS and pg.motivo == MATRICULA_INVALIDA
    invalidas = [p for p in res.pendencias if p.tipo == MATRICULA_INVALIDA]
    assert invalidas and all(p.recorte and (tmp_path / p.recorte).exists() for p in invalidas)


def test_layout_dado_a_mao_quando_o_qr_nao_e_lido(tmp_path):
    gab = _gab("sfa_dificil")
    sem = processar_pdf(FIXTURES / gab["file"], gab["simulado_id"], tmp_path / "a")
    assert next(pg for pg in sem.paginas if pg.pagina == 7).motivo == QR_ILEGIVEL
    # com o layout sfa assumido não há matrícula para ler: continua não identificado, mas sem erro
    com = processar_pdf(FIXTURES / gab["file"], gab["simulado_id"], tmp_path / "b", layout_hint="sfa")
    assert next(pg for pg in com.paginas if pg.pagina == 7).destino == RESPOSTAS
    assert next(pg for pg in com.paginas if pg.pagina == 7).matricula is None


# ------------------------------------------------------------------ planilha
@pytest.mark.parametrize("total", [100, 90])
def test_planilha_no_formato_da_importacao(tmp_path, total):
    gab, res = _processar("sfa_personalizado_limpo", tmp_path, total_questoes=total)
    xlsx = escrever_planilha(res, tmp_path / "r.xlsx")
    wb = load_workbook(xlsx)
    assert wb.sheetnames == ["Respostas", "Pendências", "Não identificados", "Resumo"]
    assert wb["Respostas"].cell(1, 1).value == COLUNA_ID
    assert wb["Respostas"].cell(1, 2).value == "Questão 1"
    assert wb["Respostas"].max_column == 1 + total
    rows = _importador(xlsx, total)
    esperadas = sorted(c["matricula_qr"].upper() for c in gab["pages"] if c["kind"] == "cartao")
    assert [m for m, _ in rows] == esperadas
    assert len({m for m, _ in rows}) == len(rows)  # a importação recusa matrícula repetida


def test_matricula_com_zeros_a_esquerda_e_letras_fica_como_texto(tmp_path):
    _, res = _processar("sfa_personalizado_limpo", tmp_path)
    res.paginas[0].matricula = "00012345"
    xlsx = escrever_planilha(res, tmp_path / "r.xlsx")
    ws = load_workbook(xlsx)["Respostas"]
    assert "00012345" in [str(ws.cell(r, 1).value) for r in range(2, ws.max_row + 1)]
    assert ws.cell(2, 1).number_format == "@"


def test_duvida_vira_celula_amarela_vazia_com_comentario(tmp_path):
    _, res = _processar("sfa_dificil", tmp_path)
    duvida = next(p for p in res.pendencias if p.tipo in ("ambigua", "multipla") and
                  next(pg for pg in res.paginas if pg.pagina == p.pagina).destino == RESPOSTAS)
    xlsx = escrever_planilha(res, tmp_path / "r.xlsx")
    ws = load_workbook(xlsx)["Respostas"]
    linhas = {str(ws.cell(r, 1).value): r for r in range(2, ws.max_row + 1)}
    pg = next(pg for pg in res.paginas if pg.pagina == duvida.pagina)
    cel = ws.cell(linhas[pg.matricula], 1 + duvida.questao)
    assert cel.value is None and cel.fill.fgColor.rgb.endswith("FFF2CC")
    assert f"página {pg.pagina}" in cel.comment.text


def test_resposta_alem_do_total_do_simulado_vira_pendencia(tmp_path):
    _, res = _processar("sfa_personalizado_limpo", tmp_path, total_questoes=50)
    assert any(p.tipo == RESPOSTA_ALEM_DO_SIMULADO for p in res.pendencias)
    assert all(len(pg.respostas) == 50 for pg in res.paginas if pg.destino == RESPOSTAS)


def test_resumo_e_relatorio(tmp_path):
    gab, res = _processar("sfa_dificil", tmp_path)
    r = resumo(res)
    assert r["paginas"] == len(gab["pages"])
    assert r["ilegiveis"] == 1 and r["nao_identificadas"] == 1
    assert r["identificadas"] + r["nao_identificadas"] + r["ilegiveis"] + r["em_branco"] == r["paginas"]
    rel = json.loads(escrever_relatorio(res, tmp_path / "relatorio.json").read_text(encoding="utf-8"))
    assert rel["resumo"]["sim8"] == gab["simulado_id"].replace("-", "")[:8].upper()
    assert {p["tipo"] for p in rel["pendencias"]} >= {PAGINA_ILEGIVEL, QR_ILEGIVEL}


# ------------------------------------------------------------------ lista da emissão
def test_lista_da_emissao_aponta_quem_esta_fora_e_quem_faltou(tmp_path):
    gab = _gab("sfa_personalizado_limpo")
    mats = sorted(c["matricula_qr"].upper() for c in gab["pages"] if c["kind"] == "cartao")
    csv_ = tmp_path / "emissao.csv"
    csv_.write_text("matricula;nome\n" + "\n".join(f"{m};Fulano" for m in mats[1:]) + "\n9999;Faltou\n",
                    encoding="utf-8-sig")
    assert ler_lista_emissao(csv_) == set(mats[1:]) | {"9999"}
    res = processar_pdf(FIXTURES / gab["file"], gab["simulado_id"], tmp_path / "o", lista=ler_lista_emissao(csv_))
    fora = [p for p in res.pendencias if p.tipo == FORA_DA_LISTA]
    assert len(fora) == 1 and mats[0] in fora[0].detalhe
    assert res.ausentes == ["9999"]


def test_lista_sem_coluna_matricula_e_recusada(tmp_path):
    ruim = tmp_path / "x.csv"
    ruim.write_text("nome,ra\nA,1\n", encoding="utf-8")
    with pytest.raises(ValueError):
        ler_lista_emissao(ruim)


# ------------------------------------------------------------------ linha de comando
def test_cli_processar_ponta_a_ponta(tmp_path):
    gab = _gab("sfa_personalizado_limpo")
    out = tmp_path / "saida"
    r = runner.invoke(app, ["processar", str(FIXTURES / gab["file"]), "--simulado", gab["simulado_id"],
                            "--saida", str(out)])
    assert r.exit_code == 0, r.output
    assert (out / f"respostas_{gab['simulado_id']}.xlsx").exists() and (out / "relatorio.json").exists()
    assert "identificada" in r.output


@pytest.mark.parametrize("args", [
    ["--simulado", "sim-1"],
    ["--simulado", "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc", "--questoes", "0"],
    ["--simulado", "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc", "--layout", "x"],
])
def test_cli_processar_recusa_entradas_ruins(tmp_path, args):
    pdf = FIXTURES / _gab("sfa_personalizado_limpo")["file"]
    r = runner.invoke(app, ["processar", str(pdf), "--saida", str(tmp_path), *args])
    assert r.exit_code != 0
