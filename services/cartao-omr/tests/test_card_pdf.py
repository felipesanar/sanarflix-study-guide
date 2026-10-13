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
    specs_genericos,
    specs_personalizados,
    specs_uniatenas,
    write_cards_pdf,
)
from cartao_omr.models import CardSpec, RosterEntry
from cartao_omr.roster import load_roster_csv

from conftest import render_gray

SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
UID = "7f3a9c21-5b1e-4f0a-9c3d-0123456789ab"
DPI = 200
PX = DPI / 25.4


def _pdf(specs, n=None) -> bytes:
    buf = io.BytesIO()
    write_cards_pdf(buf, specs, n)
    return buf.getvalue()


def _specs():
    return {
        "personalizado": (
            specs_personalizados([RosterEntry(UID, "Maria Exemplo da Silva")], SIM, "SIMULADO TESTE", "IES X", "25/10/2026")[0],
            f"SFA1|sfa|{SIM}|U|{UID}",
        ),
        "generico": (specs_genericos(1, SIM, "SIMULADO TESTE")[0], f"SFA1|sfa|{SIM}|G"),
        "uniatenas": (specs_uniatenas(1, SIM, "SIMULADO TESTE")[0], f"SFA1|uniatenas|{SIM}|G"),
    }


@pytest.mark.parametrize("modelo", ["personalizado", "generico", "uniatenas"])
def test_qr_e_lido_de_volta_pelo_zxing(modelo):
    spec, esperado = _specs()[modelo]
    img = render_gray(_pdf([spec]), dpi=DPI)
    results = zxingcpp.read_barcodes(img)
    assert [r.text for r in results] == [esperado]
    r = results[0]
    # o QR lido fica dentro da caixa do template
    xs = [p.x for p in (r.position.top_left, r.position.bottom_right)]
    ys = [p.y for p in (r.position.top_left, r.position.bottom_right)]
    x0, y0, x1, y1 = build_template(spec.layout)["qr_box_mm"]
    assert all(x0 * PX <= x <= x1 * PX for x in xs) and all(y0 * PX <= y <= y1 * PX for y in ys)


@pytest.mark.parametrize("modelo", ["personalizado", "generico", "uniatenas"])
def test_qr_continua_legivel_a_150_dpi(modelo):
    spec, esperado = _specs()[modelo]
    img = render_gray(_pdf([spec]), dpi=150)
    assert [r.text for r in zxingcpp.read_barcodes(img)] == [esperado]


def test_cada_cartao_personalizado_tem_o_proprio_qr():
    roster = [RosterEntry(f"{i:08d}-0000-4000-8000-000000000000", f"Aluno {i}") for i in range(3)]
    pdf = _pdf(specs_personalizados(roster, SIM))
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    assert len(doc) == 3
    textos = []
    for i in range(3):
        textos += [r.text for r in zxingcpp.read_barcodes(render_gray(pdf, i, DPI))]
    assert textos == [f"SFA1|sfa|{SIM}|U|{r.user_id}" for r in roster]


def test_id_com_barra_vertical_e_recusado():
    with pytest.raises(ValueError):
        CardSpec(model="generico", simulado_id="a|b").qr_payload
    with pytest.raises(ValueError):
        CardSpec(model="personalizado", simulado_id=SIM, user_id="").qr_payload


@pytest.mark.parametrize("layout", L.LAYOUTS)
def test_marcadores_pretos_e_bolhas_no_lugar_do_template(layout):
    spec = _specs()["personalizado" if layout == L.LAYOUT_SFA else "uniatenas"][0]
    img = render_gray(_pdf([spec]), dpi=300)
    px = 300 / 25.4
    tpl = build_template(layout)
    for nome, (x, y, w) in tpl["fiducials_mm"].items():
        assert img[round((y + w / 2) * px), round((x + w / 2) * px)] < 30, nome
        # área branca livre de 4 mm em volta (3 mm para o marcador de orientação, vide PRD)
        folga = 3.0 if nome == "orient" else 4.0
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            gx = x + w / 2 + dx * (w / 2 + folga - 1.0)
            gy = y + w / 2 + dy * (w / 2 + folga - 1.0)
            if nome == "tl" and dx == 1:
                continue  # ao lado do marcador tl está o de orientação
            if 0 <= gx <= 210 and 0 <= gy <= 297:
                assert img[round(gy * px), round(gx * px)] > 240, (nome, dx, dy)
    bubbles = [tuple(b) for q in tpl["questions"].values() for b in q.values()]
    bubbles += [tuple(b["c"]) for col in tpl["matricula"]["columns"] for b in col]
    for cx, cy, d in bubbles:
        r = d / 2
        ring = [img[round((cy + r * math.sin(a)) * px), round((cx + r * math.cos(a)) * px)]
                for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
        assert min(ring) < 200, (cx, cy)  # contorno cinza presente
        a = math.radians(45)
        inner = img[round((cy + 0.7 * r * math.sin(a)) * px), round((cx + 0.7 * r * math.cos(a)) * px)]
        assert inner > 235, (cx, cy)  # interior branco


@pytest.mark.parametrize("modelo", ["personalizado", "generico", "uniatenas"])
def test_so_preto_e_cinza(modelo):
    spec, _ = _specs()[modelo]
    doc = pymupdf.open(stream=_pdf([spec]), filetype="pdf")
    pix = doc[0].get_pixmap(dpi=100, colorspace=pymupdf.csRGB, alpha=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    assert np.array_equal(rgb[..., 0], rgb[..., 1]) and np.array_equal(rgb[..., 1], rgb[..., 2])
    assert len(doc[0].get_images()) == 0  # nada de logos ou imagens


def test_pdf_e_a4_e_deterministico():
    spec, _ = _specs()["personalizado"]
    a, b = _pdf([spec]), _pdf([spec])
    assert a == b
    page = pymupdf.open(stream=a, filetype="pdf")[0]
    assert round(page.rect.width / 72 * 25.4) == 210 and round(page.rect.height / 72 * 25.4) == 297


def test_nomes_e_titulos_longos_nao_estouram():
    longo = "Fulano de Tal Beltrano Ciclano Sicrano da Silva Pereira de Albuquerque Cavalcanti " * 2
    spec = specs_personalizados([RosterEntry(UID, longo)], SIM, "SIMULADO " * 30, "IES " * 40, "01/01/2026")[0]
    pdf = _pdf([spec])
    img = render_gray(pdf, dpi=DPI)
    # nada escrito entre o fim da linha do aluno (150 mm) e o QR (158 mm)
    faixa = img[round(20 * PX):round(40 * PX), round(151 * PX):round(157 * PX)]
    assert faixa.min() > 240
    assert [r.text for r in zxingcpp.read_barcodes(img)] == [spec.qr_payload]


def test_nome_com_acentos_aparece_no_pdf():
    spec = specs_personalizados([RosterEntry(UID, "Çãtia Ñandú Öztürk")], SIM, "SIMULADO")[0]
    texto = pymupdf.open(stream=_pdf([spec]), filetype="pdf")[0].get_text()
    assert "Çãtia" in texto and "CARTÃO-RESPOSTA" in texto and "MATRÍCULA" in texto


def test_pdf_so_aceita_um_layout():
    with pytest.raises(ValueError):
        _pdf([_specs()["generico"][0], _specs()["uniatenas"][0]])
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
