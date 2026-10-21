"""`processar`: PDF escaneado -> planilha de importação, identificando o aluno só pela matrícula do cartão."""
from __future__ import annotations

import json

import pymupdf
import pytest
from openpyxl import load_workbook
from typer.testing import CliRunner

from cartao_omr.card import specs_personalizados, write_cards_pdf
from cartao_omr.cli import app
from cartao_omr.models import RosterEntry
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


def _chave(card: dict) -> str:
    """Identificação esperada de um cartão do gabarito: a matrícula (maiúsculas) ou, no plano B, o e-mail."""
    return (card["matricula_qr"] or "").upper() or card["email_qr"]


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
    ids = {pg.pagina: pg.identificacao for pg in res.paginas}
    for c in cartoes:
        assert ids[c["page"]] == _chave(c)
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
    assert pg7.destino == NAO_IDENTIFICADOS and pg7.identificacao is None
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
    assert all(pg.destino == NAO_IDENTIFICADOS and pg.identificacao for pg in dups)
    assert not any(pg.identificacao == dups[0].identificacao for pg in res.paginas if pg.destino == RESPOSTAS)


# ------------------------------------------------------------------ UniAtenas: matrícula das bolhas
def test_uniatenas_identifica_pelas_bolhas_e_pendencia_a_invalida(tmp_path):
    gab, res = _processar("uniatenas_realista", tmp_path)
    por_pagina = {pg.pagina: pg for pg in res.paginas}
    for c in (p for p in gab["pages"] if p["kind"] == "cartao"):
        pg = por_pagina[c["page"]]
        if c["matricula"]["status"] == "ok":
            assert pg.destino == RESPOSTAS and pg.identificacao == c["matricula"]["value"]
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
    assert next(pg for pg in com.paginas if pg.pagina == 7).identificacao is None


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
    esperadas = sorted(_chave(c) for c in gab["pages"] if c["kind"] == "cartao")
    assert [m for m, _ in rows] == esperadas
    assert len({m for m, _ in rows}) == len(rows)  # a importação recusa matrícula repetida


def test_matricula_com_zeros_a_esquerda_e_letras_fica_como_texto(tmp_path):
    _, res = _processar("sfa_personalizado_limpo", tmp_path)
    res.paginas[0].identificacao = "00012345"
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
    cel = ws.cell(linhas[pg.identificacao], 1 + duvida.questao)
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
    mats = sorted(_chave(c) for c in gab["pages"] if c["kind"] == "cartao")
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


# ------------------------------------------------------------------ plano B: cartão identificado por e-mail
SIM_EMAIL = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"


def _pdf_misto(tmp_path, roster):
    pdf = tmp_path / "misto.pdf"
    with open(pdf, "wb") as fh:
        write_cards_pdf(fh, specs_personalizados(roster, SIM_EMAIL, "SIM", "IES"))
    return pdf


def test_cartao_com_email_vai_para_a_coluna_1_junto_com_os_de_matricula(tmp_path):
    roster = [RosterEntry("2023001", "Ana Com Matrícula"), RosterEntry("", "Bia Sem Matrícula", email="Bia@x.com"),
              RosterEntry("2023003", "Caio Com Matrícula")]
    res = processar_pdf(_pdf_misto(tmp_path, roster), SIM_EMAIL, tmp_path / "out", 100)
    assert [(pg.identificacao, pg.via) for pg in res.paginas] == [
        ("2023001", "matricula"), ("bia@x.com", "email"), ("2023003", "matricula")]
    assert all(pg.destino == RESPOSTAS for pg in res.paginas)
    xlsx = escrever_planilha(res, tmp_path / "r.xlsx")
    assert [m for m, _ in _importador(xlsx, 100)] == ["2023001", "2023003", "bia@x.com"]
    assert load_workbook(xlsx)["Respostas"].cell(1, 1).value == "matricula_ra_ou_email"
    assert resumo(res)["identificadas_por_email"] == 1


def test_mesmo_email_em_duas_paginas_sai_de_respostas(tmp_path):
    roster = [RosterEntry("", "Bia", email="bia@x.com"), RosterEntry("", "Bia de novo", email="bia@x.com")]
    pdf = tmp_path / "dup.pdf"
    with open(pdf, "wb") as fh:
        write_cards_pdf(fh, specs_personalizados(roster, SIM_EMAIL))
    res = processar_pdf(pdf, SIM_EMAIL, tmp_path / "out")
    assert [pg.motivo for pg in res.paginas] == [ALUNO_DUPLICADO, ALUNO_DUPLICADO]
    assert not any(pg.destino == RESPOSTAS for pg in res.paginas)


def test_lista_da_emissao_mistura_matricula_e_email(tmp_path):
    roster = [RosterEntry("2023001", "Ana"), RosterEntry("", "Bia", email="bia@x.com")]
    csv_ = tmp_path / "lista.csv"
    csv_.write_text("identificacao;tipo;nome\n2023001;matricula;Ana\nBIA@X.COM;email;Bia\nzed@x.com;email;Zed\n",
                    encoding="utf-8-sig")
    lista = ler_lista_emissao(csv_)
    assert lista == {"2023001", "bia@x.com", "zed@x.com"}
    res = processar_pdf(_pdf_misto(tmp_path, roster), SIM_EMAIL, tmp_path / "out", lista=lista)
    assert not [p for p in res.pendencias if p.tipo == FORA_DA_LISTA]
    assert res.ausentes == ["zed@x.com"]
    # a lista antiga (coluna matricula) continua valendo
    velho = tmp_path / "velha.csv"
    velho.write_text("matricula;nome\n2023001;Ana\n", encoding="utf-8")
    assert ler_lista_emissao(velho) == {"2023001"}


def test_cli_processar_conta_os_identificados_por_email_no_relatorio(tmp_path):
    roster = [RosterEntry("", "Bia", email="bia@x.com")]
    r = runner.invoke(app, ["processar", str(_pdf_misto(tmp_path, roster)), "--simulado", SIM_EMAIL,
                            "--saida", str(tmp_path / "o")])
    assert r.exit_code == 0, r.output
    rel = json.loads((tmp_path / "o" / "relatorio.json").read_text(encoding="utf-8"))
    assert rel["resumo"]["identificadas_por_email"] == 1
    assert rel["paginas"][0]["identificacao"] == "bia@x.com" and rel["paginas"][0]["via"] == "email"


# ------------------------------------------------------------------ pasta de saída e erros de gravação
def test_cli_processar_usa_uma_pasta_nova_por_execucao(tmp_path, monkeypatch):
    import cartao_omr.cli as cli
    monkeypatch.setattr(cli, "RUNS_DIR", tmp_path / "runs")
    roster = [RosterEntry("2023001", "Ana")]
    pdf = _pdf_misto(tmp_path, roster)
    saidas = []
    for _ in range(2):
        r = runner.invoke(app, ["processar", str(pdf), "--simulado", SIM_EMAIL])
        assert r.exit_code == 0, r.output
        saidas.append(sorted(p.name for p in (tmp_path / "runs").iterdir()))
    # 1 pasta depois da 1ª execução; 1 ou 2 depois da 2ª (a hora tem resolução de segundos), nunca uma pasta compartilhada com
    # o nome só do simulado
    assert all(n.endswith(SIM_EMAIL) and not n.startswith("processar_") for n in saidas[-1])


def test_cli_processar_avisa_quando_o_xlsx_esta_aberto_no_excel(tmp_path, monkeypatch):
    import cartao_omr.cli as cli

    def trava(*_a, **_k):
        raise PermissionError(13, "Permission denied", str(tmp_path / "respostas_x.xlsx"))

    monkeypatch.setattr(cli, "escrever_planilha", trava)
    pdf = _pdf_misto(tmp_path, [RosterEntry("2023001", "Ana")])
    r = runner.invoke(app, ["processar", str(pdf), "--simulado", SIM_EMAIL, "--saida", str(tmp_path / "o")])
    assert r.exit_code == 2
    assert "aberto no Excel" in r.output and "respostas_x.xlsx" in r.output and "Traceback" not in r.output
