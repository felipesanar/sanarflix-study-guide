"""Pipeline de leitura (Fase 1): render, alinhamento, QR e OMR sobre as fixtures e sobre casos construídos."""
from __future__ import annotations

import json
from dataclasses import replace

import cv2
import numpy as np
import pytest

from cartao_omr.config import DEFAULT_CONFIG
from cartao_omr.pipeline import omr
from cartao_omr.pipeline.align import AlignError, align_page, find_markers, rectify
from cartao_omr.pipeline.page import EM_BRANCO, ILEGIVEL, OK, load_template, read_page
from cartao_omr.pipeline.qr import read_qr
from cartao_omr.pipeline.render import is_blank, open_pdf, render_page

from conftest import ROOT

FIXTURES = ROOT / "tests" / "fixtures"
CFG = DEFAULT_CONFIG


def _gab(name):
    return json.loads((FIXTURES / f"{name}.gabarito.json").read_text(encoding="utf-8"))


def _page_img(name, page):
    doc = open_pdf(FIXTURES / f"{name}.pdf")
    return render_page(doc, page - 1)


@pytest.fixture(scope="module")
def lidas():
    """Lê uma vez todas as páginas das fixtures: {(conjunto, página): (gabarito da página, PageResult)}."""
    out = {}
    for name in ["sfa_personalizado_limpo", "sfa_personalizado_realista", "sfa_dificil", "uniatenas_realista"]:
        gab = _gab(name)
        doc = open_pdf(FIXTURES / gab["file"])
        for p in gab["pages"]:
            out[(name, p["page"])] = (p, read_page(render_page(doc, p["page"] - 1)))
    return out


# ------------------------------------------------------------------ classificação
SC = lambda a, b, c, d: {"A": a, "B": b, "C": c, "D": d}  # noqa: E731


def test_classify_marcada():
    c = omr.classify(SC(0.05, 0.9, 0.0, 0.02))
    assert (c.kind, c.value) == (omr.MARCADA, "B")


def test_classify_branco():
    assert omr.classify(SC(0.0, 0.05, 0.1, 0.02)).kind == omr.BRANCO


def test_classify_multipla_lista_as_letras():
    c = omr.classify(SC(0.9, 0.0, 0.8, 0.0))
    assert c.kind == omr.MULTIPLA and c.symbols == ["A", "C"] and c.value is None


def test_classify_ambigua_marca_fraca_ou_segunda_bolha_media():
    assert omr.classify(SC(0.35, 0.0, 0.0, 0.0)).kind == omr.AMBIGUA      # nem alta nem baixa
    assert omr.classify(SC(0.9, 0.4, 0.0, 0.0)).kind == omr.AMBIGUA       # rasura: 2ª bolha entre os limiares
    assert omr.classify(SC(0.0, 0.0, 0.0, 0.0)).kind == omr.BRANCO


def test_classify_respeita_os_limiares_da_config():
    cfg = replace(CFG, t_alto=0.95)
    assert omr.classify(SC(0.9, 0.0, 0.0, 0.0), cfg).kind == omr.AMBIGUA


def test_classify_batch_igual_ao_escalar():
    rng = np.random.default_rng(3)
    scores = np.clip(rng.normal(0.25, 0.4, (3000, 4)), 0, 1).astype(np.float32)
    kind, arg = omr.classify_batch(scores)
    for i in range(0, 3000, 7):
        cell = omr.classify({a: float(v) for a, v in zip("ABCD", scores[i])})
        assert omr.KIND_CODES[kind[i]] == cell.kind
        assert "ABCD"[arg[i]] == max(cell.scores, key=cell.scores.get)


def test_normalize_tira_a_linha_de_base():
    fr = np.array([0.1] * 30 + [0.9, 0.1, 0.1], np.float32)
    n = omr.normalize(fr)
    assert n[:30].max() < 1e-6 and n[30] > 0.85


def test_flatten_corrige_iluminacao_irregular():
    img = np.full((600, 400), 235, np.uint8)
    grad = np.linspace(0.7, 1.0, 400)[None, :]
    img = (img * grad).astype(np.uint8)
    flat = omr.flatten(img, 200)
    assert flat.min() > 0.9 and flat.max() < 1.1  # papel liso vira ~1,0 em toda a largura


# ------------------------------------------------------------------ render / branco
def test_pagina_em_branco_e_detectada_e_cartao_nao():
    assert is_blank(np.full((2339, 1654), 245, np.uint8))
    assert not is_blank(_page_img("sfa_personalizado_limpo", 1))


# ------------------------------------------------------------------ alinhamento
def test_alinhamento_acha_os_marcadores_e_o_erro_e_pequeno(lidas):
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] != "cartao" or not gab["legible"]:
            continue
        assert res.status == OK, (name, page, res.reason)
        assert res.alignment.rms_mm < 0.5, (name, page, res.alignment.rms_mm)


def test_alinhamento_reconhece_pagina_de_cabeca_para_baixo(lidas):
    viradas = [(k, r) for k, (g, r) in lidas.items() if g["kind"] == "cartao" and g["scan"]["flip180"] and g["legible"]]
    assert viradas
    for _, r in viradas:
        assert abs(abs(r.alignment.rotation_deg) - 180) < 8


@pytest.mark.parametrize("giros", [1, 2, 3])
def test_pagina_girada_em_multiplos_de_90_graus_le_igual(lidas, giros):
    gab, base = lidas[("sfa_personalizado_limpo", 1)]
    img = np.rot90(_page_img("sfa_personalizado_limpo", 1), giros).copy()
    res = read_page(img)
    assert res.status == OK
    assert res.user_id == base.user_id
    assert {q: c.value for q, c in res.answers.items()} == {q: c.value for q, c in base.answers.items()}


def test_pagina_sem_marcadores_e_ilegivel(lidas):
    img = _page_img("sfa_personalizado_limpo", 1)
    cortada = img[300:, :]  # tira o canto superior (marcadores tl/tr e orientação)
    res = read_page(cortada)
    assert res.status == ILEGIVEL and res.reason
    with pytest.raises(AlignError):
        align_page(cortada, load_template("sfa"))


def test_pagina_com_marcador_coberto_e_ilegivel(lidas):
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] == "cartao" and not gab["legible"]:
            assert res.status == ILEGIVEL, (name, page)


def test_paginas_em_branco_viram_pagina_em_branco(lidas):
    brancas = [(k, r) for k, (g, r) in lidas.items() if g["kind"] == "branco"]
    assert brancas
    for k, r in brancas:
        assert r.status == EM_BRANCO, k


def test_retificacao_poe_os_marcadores_no_lugar_do_template():
    img = _page_img("sfa_dificil", 1)
    tpl = load_template("sfa")
    al = align_page(img, tpl)
    rect = rectify(img, al, tpl)
    k = CFG.render_dpi / 25.4
    for nome, (x, y, w) in tpl["fiducials_mm"].items():
        c = rect[round((y + w / 2) * k), round((x + w / 2) * k)]
        assert c < 90, nome
    marks = find_markers(rect, tpl)
    assert set(marks) == {"tl", "tr", "br", "bl", "orient"}


# ------------------------------------------------------------------ QR
def test_qr_lido_e_igual_ao_gabarito(lidas):
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] != "cartao" or not gab["legible"]:
            continue
        if gab["qr_legivel"]:
            assert res.qr.text == gab["qr"], (name, page)
            assert not res.qr_ilegivel
        else:
            assert res.qr.text is None and res.qr_ilegivel, (name, page)


def test_qr_danificado_continua_sendo_lido_o_resto(lidas):
    """QR ilegível não derruba a página: as respostas saem e o aluno fica sem identificação."""
    danificadas = [(k, r) for k, (g, r) in lidas.items() if g["kind"] == "cartao" and not g["qr_legivel"] and g["legible"]]
    assert danificadas
    for _, r in danificadas:
        assert r.status == OK and r.user_id is None and len(r.answers) == 100


def test_qr_de_outro_formato_e_ignorado():
    import segno

    qr = segno.make("SFA1|sfa|x|G", error="q")
    buf = np.array(qr.matrix, np.uint8)
    img = np.pad(np.where(buf == 1, 0, 255).astype(np.uint8), 4, constant_values=255)
    img = cv2.resize(img, None, fx=8, fy=8, interpolation=cv2.INTER_NEAREST)
    r = read_qr(None, img, load_template("sfa"))
    assert r.text is None and r.data is None and r.other_texts == ["SFA1|sfa|x|G"]


# ------------------------------------------------------------------ OMR de ponta a ponta
def test_respostas_estritas_batem_com_o_gabarito(lidas):
    erradas = []
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] != "cartao" or res.status != OK:
            continue
        for q, a in gab["answers"].items():
            if not a["strict"]:
                continue
            cell = res.answers[int(q)]
            if a["truth"] == "marcada":
                ok = cell.kind == omr.MARCADA and cell.value == a["letter"]
            elif a["truth"] == "multipla":
                ok = cell.kind == omr.MULTIPLA and cell.symbols == a["letters"]
            else:
                ok = cell.kind == omr.BRANCO
            if not ok:
                erradas.append((name, page, q, a["truth"], cell.kind, a["cov"], cell.scores))
    assert not erradas, erradas[:5]


def test_nunca_uma_letra_errada_nas_questoes_nao_estritas(lidas):
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] != "cartao" or res.status != OK:
            continue
        for q, a in gab["answers"].items():
            if a["strict"]:
                continue
            cell = res.answers[int(q)]
            if cell.kind == omr.MARCADA:
                assert cell.value == a["letter"], (name, page, q, a["kind"], cell.scores)


def test_multipla_nunca_vira_letra(lidas):
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] != "cartao" or res.status != OK:
            continue
        for q, a in gab["answers"].items():
            if a["truth"] == "multipla":
                assert res.answers[int(q)].kind != omr.MARCADA, (name, page, q)


# ------------------------------------------------------------------ matrícula UniAtenas
def test_matricula_uniatenas_lida_ou_recusada(lidas):
    vistos = {"ok": 0, "invalida": 0}
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] != "cartao" or gab["model"] != "uniatenas" or res.status != OK:
            continue
        assert res.layout == "uniatenas" and res.matricula is not None
        m = gab["matricula"]
        if m["status"] == "ok":
            assert res.matricula.valid and res.matricula.value == m["value"], (page, res.matricula.reason)
            vistos["ok"] += 1
        else:
            assert not res.matricula.valid and res.matricula.value is None and res.matricula.reason
            vistos["invalida"] += 1
    assert vistos["ok"] >= 2 and vistos["invalida"] >= 2


def test_sfa_nao_le_matricula(lidas):
    for (name, page), (gab, res) in lidas.items():
        if gab["kind"] == "cartao" and gab["model"] == "personalizado" and res.status == OK:
            assert res.matricula is None and res.layout in ("sfa", None)


def test_read_matricula_recusa_o_template_sfa():
    with pytest.raises(ValueError):
        omr.read_matricula(np.full((2339, 1654), 255, np.uint8), load_template("sfa"), 200)


def test_layout_hint_vale_quando_o_qr_nao_le(lidas):
    img = _page_img("uniatenas_realista", 1)
    # apaga o QR para forçar o uso da dica de layout
    k = CFG.render_dpi / 25.4
    x0, y0, x1, y1 = [int(v * k) for v in load_template("uniatenas")["qr_box_mm"]]
    img = img.copy()
    img[y0 - 20:y1 + 20, x0 - 20:x1 + 20] = 255
    sem = read_page(img)
    assert sem.qr_ilegivel and sem.layout is None and sem.matricula is None
    com = read_page(img, layout_hint="uniatenas")
    assert com.layout == "uniatenas" and com.matricula is not None


# ------------------------------------------------------------------ o avaliador
def test_avaliador_aprova_as_fixtures_de_referencia():
    import tools.eval_accuracy as ev

    pages = ev.run([FIXTURES], CFG, workers=2)
    m = ev.evaluate(pages, CFG)
    q = m["questoes"]
    assert q["acerto_bolha"] >= ev.ACEITE["acerto_bolha"]
    assert q["multipla_lida_como_letra"] == 0 and q["nao_estritas"].get("LETRA_ERRADA", 0) == 0
    assert m["taxa_matricula"] >= ev.ACEITE["matricula"] and m["matricula_errada_aceita"] == 0
    assert m["taxa_qr"] >= ev.ACEITE["qr"] and m["qr_danificados_lidos"] == 0
    assert m["taxa_ilegiveis"] <= ev.ACEITE["ilegiveis"]
    assert m["ilegiveis_propositais_detectadas"] == m["ilegiveis_propositais"] >= 1
    assert m["brancas_detectadas"] == m["brancas"] >= 1
    assert m["alinhamento_erro_max_mm"] < 0.5
