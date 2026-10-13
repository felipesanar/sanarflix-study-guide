"""Fixtures sintéticas: o gabarito descreve de fato o que está nas imagens, e o gerador é reprodutível."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pymupdf
import pytest
import zxingcpp

from cartao_omr import layout as L
from cartao_omr.card import build_template

from conftest import ROOT

import tools.make_fixtures as mf

FIXTURES = ROOT / "tests" / "fixtures"
SETS = ["sfa_personalizado_limpo", "sfa_generico_realista", "sfa_dificil", "uniatenas_realista"]


def _load(name: str) -> tuple[dict, pymupdf.Document]:
    gab = json.loads((FIXTURES / f"{name}.gabarito.json").read_text(encoding="utf-8"))
    return gab, pymupdf.open(FIXTURES / gab["file"])


def _gray(doc: pymupdf.Document, page: dict) -> np.ndarray:
    pix = doc[page["page"] - 1].get_pixmap(dpi=page["scan"]["dpi"], colorspace=pymupdf.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)


def _to_px(m: list[list[float]], x: float, y: float) -> tuple[float, float]:
    p = np.array(m) @ np.array([x, y, 1.0])
    return p[0] / p[2], p[1] / p[2]


def _disc_mean(img: np.ndarray, cx: float, cy: float, r: float) -> float:
    x0, y0 = int(cx - r), int(cy - r)
    n = int(2 * r) + 1
    yy, xx = np.mgrid[0:n, 0:n]
    mask = (xx + x0 - cx) ** 2 + (yy + y0 - cy) ** 2 <= r * r
    sub = img[y0:y0 + n, x0:x0 + n]
    return float(sub[mask[:sub.shape[0], :sub.shape[1]]].mean())


@pytest.mark.parametrize("name", SETS)
def test_pdf_e_gabarito_batem(name):
    gab, doc = _load(name)
    assert len(doc) == len(gab["pages"])
    assert [p["page"] for p in gab["pages"]] == list(range(1, len(doc) + 1))
    tpl = build_template(gab["layout"], gab["n_matricula_cols"] if gab["layout"] == L.LAYOUT_SFA else None)
    assert tpl["template_version"] == gab["template"]
    for p in gab["pages"]:
        if p["kind"] != "cartao":
            continue
        assert set(p["answers"]) == set(tpl["questions"])
        for a in p["answers"].values():
            assert a["truth"] in {"marcada", "branco", "multipla", "ambigua"}
            assert len(a["cov"]) == 4
            if a["truth"] == "marcada":
                assert a["strict"] and len(a["letter"]) == 1


@pytest.mark.parametrize("name", SETS)
def test_marcadores_estao_onde_o_gabarito_diz(name):
    gab, doc = _load(name)
    tpl = build_template(gab["layout"], gab["n_matricula_cols"] if gab["layout"] == L.LAYOUT_SFA else None)
    for p in gab["pages"]:
        if p["kind"] != "cartao":
            continue
        img = _gray(doc, p)
        m = p["scan"]["mm_to_px"]
        escuros = []
        for nome, (x, y, w) in tpl["fiducials_mm"].items():
            cx, cy = _to_px(m, x + w / 2, y + w / 2)
            r = 0.3 * w * p["scan"]["dpi"] / 25.4
            if 1 <= cx < img.shape[1] - 1 and 1 <= cy < img.shape[0] - 1:
                escuros.append(_disc_mean(img, cx, cy, r) < 90)
            else:
                escuros.append(False)
        if p["legible"]:
            assert all(escuros), (p["page"], escuros)
        else:  # página com defeito proposital: pelo menos um marcador sumiu
            assert not all(escuros)


@pytest.mark.parametrize("name", SETS)
def test_tinta_do_gabarito_esta_na_imagem(name):
    """Bolhas 'marcada' são bem mais escuras que as vazias da mesma página."""
    gab, doc = _load(name)
    tpl = build_template(gab["layout"], gab["n_matricula_cols"] if gab["layout"] == L.LAYOUT_SFA else None)
    for p in gab["pages"]:
        if p["kind"] != "cartao" or not p["legible"]:
            continue
        img = _gray(doc, p)
        k = p["scan"]["dpi"] / 25.4
        m = p["scan"]["mm_to_px"]
        marcadas, vazias = [], []
        for q, a in p["answers"].items():
            for alt, cov in zip(tpl["alternatives"], a["cov"]):
                cx, cy, d = tpl["questions"][q][alt]
                px, py = _to_px(m, cx, cy)
                val = _disc_mean(img, px, py, 0.35 * d * k)
                if a["truth"] == "marcada" and alt == a["letter"]:
                    marcadas.append(val)
                elif cov == 0.0:
                    vazias.append(val)
        assert marcadas and vazias
        assert np.median(vazias) - np.median(marcadas) > 80, p["page"]
        assert np.mean(np.array(marcadas) < np.median(vazias) - 50) > 0.95


@pytest.mark.parametrize("name", SETS)
def test_qr_das_paginas_legiveis_e_lido(name):
    gab, doc = _load(name)
    for p in gab["pages"]:
        if p["kind"] != "cartao" or not p["legible"]:
            continue
        assert [r.text for r in zxingcpp.read_barcodes(_gray(doc, p))] == [p["qr"]], p["page"]


@pytest.mark.parametrize("name", SETS)
def test_paginas_em_branco_sao_brancas(name):
    gab, doc = _load(name)
    for p in gab["pages"]:
        if p["kind"] != "branco":
            continue
        assert p["expected"] == "pagina_em_branco"
        img = _gray(doc, p)
        assert (img < 100).mean() < 0.0005 and np.median(img) > 200


def test_variedade_do_conjunto_de_referencia():
    pages = []
    for name in SETS:
        gab, _ = _load(name)
        pages += [(gab, p) for p in gab["pages"]]
    cartoes = [p for _, p in pages if p["kind"] == "cartao"]
    assert len(cartoes) >= 20 and any(p["kind"] == "branco" for _, p in pages)
    scans = [p["scan"] for p in cartoes]
    assert {150, 200, 300} <= {s["dpi"] for s in scans}
    assert sum(s["flip180"] for s in scans) >= 2
    assert max(abs(s["rotation_deg"]) for s in scans) >= 3.0
    assert any(s["background"] == "escuro" for s in scans)
    assert any(s["color"] == "colorida" for s in scans) and any(s["color"] == "cinza" for s in scans)
    assert any(not p["legible"] for p in cartoes)
    kinds = {a["kind"] for p in cartoes for a in p["answers"].values()}
    assert {"marcada", "branco", "multipla", "fraca", "x", "visto", "ponto", "circulo", "rasurada", "sujeira"} <= kinds
    assert {p["model"] for p in cartoes} == {"personalizado", "generico", "uniatenas"}
    # matrículas: preenchidas, em branco (reserva do personalizado) e com defeito
    mats = [p["matricula"] for p in cartoes]
    assert any(m["status"] == "ok" for m in mats) and any(m["status"] == "invalida" for m in mats)
    assert any(m["status"] == "em_branco" for m in mats)


def test_fixtures_uniatenas_tem_matricula_com_g():
    gab, _ = _load("uniatenas_realista")
    validas = [p["matricula"]["value"] for p in gab["pages"] if p["kind"] == "cartao" and p["matricula"]["value"]]
    assert any(v[3] == "G" for v in validas), validas
    assert all(len(v) == 10 and v[2] == "-" and v[4] == "-" for v in validas)


def test_fixtures_sfa_tem_matricula_com_zero_a_esquerda_e_colunas_em_branco():
    mats = []
    for name in ["sfa_personalizado_limpo", "sfa_generico_realista", "sfa_dificil"]:
        gab, _ = _load(name)
        mats += [p["matricula"] for p in gab["pages"] if p["kind"] == "cartao"]
    valores = [m["value"] for m in mats if m["value"]]
    assert valores and all(v.isdigit() for v in valores)
    assert any(v.startswith("0") for v in valores)
    assert any(m["columns"] and m["columns"][-1] is None for m in mats)  # colunas em branco à direita


def test_gabarito_nao_traz_dados_reais():
    for name in SETS:
        gab, _ = _load(name)
        for p in gab["pages"]:
            if p["kind"] == "cartao" and p["model"] == "personalizado":
                assert p["aluno"].split()[1] in mf.SOBRENOMES  # nomes sintéticos


def test_gerador_e_reprodutivel(tmp_path):
    spec = mf.SetSpec("mini", L.LAYOUT_UNIATENAS, "uniatenas", "realista", 2, dpi=(150,), blank_after=(1,))
    a = mf.build_set(spec, tmp_path / "a", seed=11)
    b = mf.build_set(spec, tmp_path / "b", seed=11)
    c = mf.build_set(spec, tmp_path / "c", seed=12)
    assert a == b
    assert a != c
    # o trailer do PDF traz um ID aleatório; o que precisa ser igual são os pixels
    da, db = pymupdf.open(tmp_path / "a" / "mini.pdf"), pymupdf.open(tmp_path / "b" / "mini.pdf")
    assert len(da) == len(db) == 3
    for pa, pb in zip(da, db):
        assert pa.get_pixmap(dpi=72).samples == pb.get_pixmap(dpi=72).samples


def test_gerador_personalizado_usa_qr_e_nome_do_roster(tmp_path):
    spec = mf.SetSpec("mini_p", L.LAYOUT_SFA, "personalizado", "limpo", 2, dpi=(150,))
    meta = mf.build_set(spec, tmp_path, seed=5)
    for p in meta["pages"]:
        assert p["qr"] == f"SFA1|sfa|{meta['simulado_id']}|U|{p['user_id']}"
