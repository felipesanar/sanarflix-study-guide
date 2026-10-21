"""PDF do cartão: QR legível, marcadores e bolhas nas posições do template, só tons de cinza."""
from __future__ import annotations

import io
import math

import numpy as np
import pymupdf
import pytest
import zxingcpp

from cartao_omr import layout as L
from cartao_omr.card import (
    build_template,
    specs_personalizados,
    specs_uniatenas,
    write_cards_pdf,
)
from cartao_omr.models import RosterEntry, parse_qr
from cartao_omr.roster import load_roster_csv

from cardcheck import assert_marcadores_e_bolhas, render_gray



SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
MAT = "2023001234"
EMAIL = "maria.exemplo@faculdade.edu.br"
DPI = 200
PX = DPI / 25.4
MODELOS = ["personalizado", "uniatenas"]


def _pdf(specs) -> bytes:
    buf = io.BytesIO()
    write_cards_pdf(buf, specs)
    return buf.getvalue()


def _spec(modelo: str):
    if modelo == "personalizado":
        return specs_personalizados([RosterEntry(MAT, "Maria Exemplo da Silva")], SIM,
                                    "SIMULADO TESTE", "IES X", "25/10/2026")[0]
    return specs_uniatenas(1, SIM, "SIMULADO TESTE")[0]


@pytest.mark.parametrize("modelo", MODELOS)
def test_qr_e_lido_de_volta_pelo_zxing(modelo):
    spec = _spec(modelo)
    img = render_gray(_pdf([spec]), dpi=DPI)
    results = zxingcpp.read_barcodes(img)
    assert [r.text for r in results] == [spec.qr_payload]
    r = results[0]
    # o QR lido fica dentro da caixa do template
    xs = [p.x for p in (r.position.top_left, r.position.bottom_right)]
    ys = [p.y for p in (r.position.top_left, r.position.bottom_right)]
    x0, y0, x1, y1 = build_template(spec.layout)["qr_box_mm"]
    assert all(x0 * PX <= x <= x1 * PX for x in xs) and all(y0 * PX <= y <= y1 * PX for y in ys)


@pytest.mark.parametrize("modelo", MODELOS)
@pytest.mark.parametrize("dpi", [100, 150])
def test_qr_continua_legivel_em_resolucao_baixa(modelo, dpi):
    spec = _spec(modelo)
    img = render_gray(_pdf([spec]), dpi=dpi)
    assert [r.text for r in zxingcpp.read_barcodes(img)] == [spec.qr_payload]


def test_qr_lido_devolve_a_matricula_do_aluno():
    spec = _spec("personalizado")
    texto = zxingcpp.read_barcodes(render_gray(_pdf([spec]), dpi=DPI))[0].text
    assert parse_qr(texto).matricula == MAT


def test_cada_cartao_personalizado_tem_o_proprio_qr():
    roster = [RosterEntry(f"20230{i:05d}", f"Aluno {i}") for i in range(3)]
    specs = specs_personalizados(roster, SIM)
    pdf = _pdf(specs)
    assert len(pymupdf.open(stream=pdf, filetype="pdf")) == 3
    lidos = [zxingcpp.read_barcodes(render_gray(pdf, i, DPI))[0].text for i in range(3)]
    assert lidos == [s.qr_payload for s in specs]
    assert [parse_qr(t).matricula for t in lidos] == [r.matricula for r in roster]


def test_qr_do_sfa_no_pior_caso_mantem_modulo_de_0_7_mm():
    """Plano B (e-mail de 58 caracteres): versão 6 e módulo >= 0,73 mm, que é o que a caixa de 36 mm garante."""
    info = build_template(L.LAYOUT_SFA)["qr"]["worst_case"]
    assert info["version"] <= 6 and info["module_mm"] >= 0.73


@pytest.mark.parametrize("layout", L.LAYOUTS)
def test_marcadores_pretos_e_bolhas_no_lugar_do_template(layout):
    spec = _spec("personalizado" if layout == L.LAYOUT_SFA else "uniatenas")
    assert_marcadores_e_bolhas(render_gray(_pdf([spec]), dpi=300), build_template(layout), 300)


def test_sfa_traz_a_matricula_impressa_e_uniatenas_as_bolhas():
    sfa = pymupdf.open(stream=_pdf([_spec("personalizado")]), filetype="pdf")[0].get_text()
    uni = pymupdf.open(stream=_pdf([_spec("uniatenas")]), filetype="pdf")[0].get_text()
    assert "MATRÍCULA" in sfa and MAT in sfa and "CARTÃO PESSOAL" not in sfa
    assert "MATRÍCULA" in uni and MAT not in uni
    assert build_template(L.LAYOUT_SFA)["matricula"] is None  # sem bolhas no sfa
    assert build_template(L.LAYOUT_UNIATENAS)["matricula"]['n_columns'] == 8


def test_matricula_impressa_em_destaque_e_nao_estoura_o_quadro():
    mat = "A1B2C3D4E5F6G7H8I9J0K1L2"  # 24 caracteres, o máximo
    spec = specs_personalizados([RosterEntry(mat, "Fulano")], SIM)[0]
    page = pymupdf.open(stream=_pdf([spec]), filetype="pdf")[0]
    spans = [s for b in page.get_text("dict")["blocks"] for ln in b.get("lines", []) for s in ln["spans"]
             if s["text"] == mat and s["size"] > 7]  # o rótulo de 6 pt sob o QR repete a matrícula
    assert len(spans) == 1
    x0, _, x1, _ = spans[0]["bbox"]
    f = L.PESSOAL_FRAME
    to_mm = 25.4 / 72
    assert x0 * to_mm >= f[0] and x1 * to_mm <= f[2] - 2
    assert spans[0]["size"] >= 9


@pytest.mark.parametrize("modelo", MODELOS)
def test_so_preto_e_cinza(modelo):
    doc = pymupdf.open(stream=_pdf([_spec(modelo)]), filetype="pdf")
    pix = doc[0].get_pixmap(dpi=100, colorspace=pymupdf.csRGB, alpha=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    assert np.array_equal(rgb[..., 0], rgb[..., 1]) and np.array_equal(rgb[..., 1], rgb[..., 2])
    assert len(doc[0].get_images()) == 0  # nada de logos ou imagens


def test_pdf_e_a4_e_deterministico():
    spec = _spec("personalizado")
    a, b = _pdf([spec]), _pdf([spec])
    assert a == b
    page = pymupdf.open(stream=a, filetype="pdf")[0]
    assert round(page.rect.width / 72 * 25.4) == 210 and round(page.rect.height / 72 * 25.4) == 297


def test_nomes_e_titulos_longos_nao_estouram():
    longo = "Fulano de Tal Beltrano Ciclano Sicrano da Silva Pereira de Albuquerque Cavalcanti " * 2
    spec = specs_personalizados([RosterEntry(MAT, longo)], SIM, "SIMULADO " * 30, "IES " * 40, "01/01/2026")[0]
    img = render_gray(_pdf([spec]), dpi=DPI)
    # nada escrito entre o fim da linha do aluno (150 mm) e o QR (158 mm)
    faixa = img[round(20 * PX):round(40 * PX), round(151 * PX):round(153.5 * PX)]
    assert faixa.min() > 240
    assert [r.text for r in zxingcpp.read_barcodes(img)] == [spec.qr_payload]


def test_nome_com_acentos_aparece_no_pdf():
    spec = specs_personalizados([RosterEntry(MAT, "Çãtia Ñandú Öztürk")], SIM, "SIMULADO")[0]
    texto = pymupdf.open(stream=_pdf([spec]), filetype="pdf")[0].get_text()
    assert "Çãtia" in texto and "CARTÃO-RESPOSTA" in texto and "MATRÍCULA" in texto


def test_pdf_so_aceita_um_layout():
    with pytest.raises(ValueError):
        _pdf([_spec("personalizado"), _spec("uniatenas")])
    with pytest.raises(ValueError):
        _pdf([])


def test_roster_csv_ordenado_sem_considerar_acentos(fake_roster_csv):
    nomes = [e.nome for e in load_roster_csv(fake_roster_csv)]
    assert nomes == ["Álvaro Falso", "Ana Fictícia", "Zélia Teste"]


def test_roster_csv_invalido(tmp_path):
    ruim = tmp_path / "r.csv"
    ruim.write_text("id,nome\n1,A\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_roster_csv(ruim)
    dup = tmp_path / "d.csv"
    dup.write_text("user_id,nome\n1,A\n1,B\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_roster_csv(dup)


def test_roster_csv_recusa_matricula_fora_do_formato(tmp_path):
    for mat in ("", "12 34", "12#34"):
        ruim = tmp_path / "f.csv"
        ruim.write_text(f"matricula,nome\n{mat},A\n", encoding="utf-8")
        with pytest.raises(ValueError):
            load_roster_csv(ruim)


def test_roster_csv_normaliza_a_matricula(tmp_path):
    ok = tmp_path / "n.csv"
    ok.write_text("matricula,nome\n  ab-1 ,Fulano\n", encoding="utf-8")
    assert load_roster_csv(ok)[0].matricula == "AB-1"


# ------------------------------------------------------------------ plano B: identificado por e-mail
def _spec_email(nome="Maria Exemplo da Silva", email=EMAIL, **kw):
    return specs_personalizados([RosterEntry("", nome, email=email)], SIM, "SIMULADO TESTE", "IES X", "25/10/2026", **kw)[0]


def test_aluno_sem_matricula_vira_cartao_com_email_no_qr_e_campo_em_branco():
    spec = _spec_email()
    assert spec.por_email and spec.matricula == "" and spec.qr_payload == f"SFA2:E:9D6C1F0E:{EMAIL}"
    page = pymupdf.open(stream=_pdf([spec]), filetype="pdf")[0]
    texto = page.get_text()
    assert "MATRÍCULA" in texto and "escreva sua matrícula abaixo" in texto and "Maria Exemplo da Silva" in texto
    assert EMAIL in texto  # o e-mail aparece como rótulo sob o QR, para o João conferir
    img = render_gray(_pdf([spec]), dpi=DPI)
    assert [r.text for r in zxingcpp.read_barcodes(img)] == [spec.qr_payload]
    assert parse_qr(spec.qr_payload).email == EMAIL


def test_campo_da_matricula_fica_em_branco_no_plano_b():
    """Entre o título MATRÍCULA e o filete, o campo é só papel: o aluno escreve ali."""
    spec = _spec_email()
    img = render_gray(_pdf([spec]), dpi=300)
    k = 300 / 25.4
    campo = img[round(50 * k):round(60 * k), round(23 * k):round(89 * k)]
    assert campo.min() > 200
    com = render_gray(_pdf([_spec("personalizado")]), dpi=300)[round(50 * k):round(60 * k), round(23 * k):round(89 * k)]
    assert com.min() < 100  # com matrícula, o número impresso está ali


@pytest.mark.parametrize("email", [EMAIL, "a" * 53 + "@b.co", "x@y.com"])
def test_qr_do_plano_b_e_lido_em_resolucao_baixa(email):
    spec = _spec_email(email=email)
    for dpi in (100, 150, 200):
        assert [r.text for r in zxingcpp.read_barcodes(render_gray(_pdf([spec]), dpi=dpi))] == [spec.qr_payload], dpi


def _spans_do_rotulo(spec, trecho):
    page = pymupdf.open(stream=_pdf([spec]), filetype="pdf")[0]
    return [s for b in page.get_text("dict")["blocks"] for ln in b.get("lines", []) for s in ln["spans"]
            if s["size"] < 6.1 and s["text"].startswith(trecho) and s["bbox"][1] * 25.4 / 72 > 56]


def test_email_longo_encolhe_o_rotulo_e_nao_invade_as_instrucoes():
    longo = "maria.eduarda.fernandes.oliveira@faculdade.edu.br"  # 49 caracteres, de letras comuns
    spans = _spans_do_rotulo(_spec_email(email=longo), "maria.eduarda")
    assert len(spans) == 1 and spans[0]["text"] == longo
    x0, _, x1, _ = spans[0]["bbox"]
    assert x0 * 25.4 / 72 >= 150.9 and x1 * 25.4 / 72 <= 193.1  # as INSTRUÇÕES terminam em 150 mm
    assert spans[0]["size"] < 6.0  # encolheu para caber


def test_email_de_58_letras_largas_tem_o_rotulo_cortado_mas_o_qr_leva_tudo():
    pior = "a" * 53 + "@b.co"
    spec = _spec_email(email=pior)
    spans = _spans_do_rotulo(spec, "aaa")
    assert len(spans) == 1 and spans[0]["text"].endswith("…")  # o rótulo é só ajuda visual
    assert spans[0]["bbox"][0] * 25.4 / 72 >= 150.9 and spans[0]["bbox"][2] * 25.4 / 72 <= 193.1
    assert [r.text for r in zxingcpp.read_barcodes(render_gray(_pdf([spec]), dpi=DPI))] == [spec.qr_payload]


def test_pdf_pode_misturar_matricula_e_email_e_a_ordem_e_por_nome():
    roster = [RosterEntry(MAT, "Zélia Com Matrícula"), RosterEntry("", "Ana Sem Matrícula", email="ana@x.com"),
              RosterEntry("99-G-99999", "Bia Repetida", email="bia@x.com")]
    specs = specs_personalizados(roster, SIM)
    # a Bia tem matrícula "utilizável" no formato; a repetição só a tela detecta, então ela segue pela matrícula aqui
    assert [s.por_email for s in specs] == [False, True, False]
    pdf = _pdf(specs)
    lidos = [parse_qr(zxingcpp.read_barcodes(render_gray(pdf, i, DPI))[0].text) for i in range(3)]
    assert [(q.kind, q.identificacao) for q in lidos] == [("M", MAT), ("E", "ana@x.com"), ("M", "99-G-99999")]


def test_roster_csv_aceita_email_quando_nao_ha_matricula(tmp_path):
    p = tmp_path / "r.csv"
    p.write_text("matricula,nome,email\n20230001,Com Matrícula,com@x.com\n,Sem Matrícula,SEM@x.com\n", encoding="utf-8")
    r = load_roster_csv(p)
    assert [(e.nome, e.matricula, e.email) for e in r] == [
        ("Com Matrícula", "20230001", ""),  # tem matrícula: o e-mail é ignorado
        ("Sem Matrícula", "", "sem@x.com"),
    ]


@pytest.mark.parametrize("linha", [",Fulano,", ",Fulano,sem-arroba", ",Fulano," + "a" * 60 + "@b.co", "12 34,Fulano,x@y.com"])
def test_roster_csv_recusa_quem_nao_tem_identificacao_valida(tmp_path, linha):
    p = tmp_path / "r.csv"
    p.write_text("matricula,nome,email\n" + linha + "\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_roster_csv(p)


def test_roster_csv_recusa_email_repetido(tmp_path):
    p = tmp_path / "r.csv"
    p.write_text("matricula,nome,email\n,A,a@x.com\n,B,A@X.com\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_roster_csv(p)
