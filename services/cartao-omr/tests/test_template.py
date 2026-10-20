"""Template (fonte da verdade das coordenadas): contagens, geometria e sincronia com o disco."""
from __future__ import annotations

import itertools
import json
import math

import pytest

from cartao_omr import layout as L
from cartao_omr.card import build_template, template_json
from cartao_omr.config import TEMPLATES_DIR

LAYOUTS = [L.LAYOUT_SFA, L.LAYOUT_UNIATENAS]


def _answer_bubbles(tpl):
    return [tuple(b) for q in tpl["questions"].values() for b in q.values()]


def _matricula_bubbles(tpl):
    if not tpl["matricula"]:
        return []
    return [tuple(b["c"]) for col in tpl["matricula"]["columns"] for b in col]


def _left_block(tpl):
    return tpl["blocks_mm"]["matricula" if tpl["matricula"] else "pessoal"]


@pytest.mark.parametrize("layout", LAYOUTS)
def test_contagem_de_bolhas(layout):
    tpl = build_template(layout)
    esperado_resp, esperado_mat = L.expected_bubble_counts(layout)
    assert len(tpl["questions"]) == 100
    assert len(_answer_bubbles(tpl)) == esperado_resp == 400
    assert len(_matricula_bubbles(tpl)) == esperado_mat


def test_numero_de_bolhas_do_prd():
    sfa = build_template(L.LAYOUT_SFA)
    assert sfa["matricula"] is None and "matricula" not in sfa["crops_mm"]  # só o QR identifica
    uni = build_template(L.LAYOUT_UNIATENAS)
    assert len(_matricula_bubbles(uni)) == 8 * 10


@pytest.mark.parametrize("layout", LAYOUTS)
def test_sem_sobreposicao_entre_bolhas(layout):
    tpl = build_template(layout)
    bubbles = _answer_bubbles(tpl) + _matricula_bubbles(tpl)
    for (x1, y1, d1), (x2, y2, d2) in itertools.combinations(bubbles, 2):
        dist = math.hypot(x1 - x2, y1 - y2)
        assert dist >= (d1 + d2) / 2 + 0.4, f"bolhas coladas: {(x1, y1)} e {(x2, y2)}"


@pytest.mark.parametrize("layout", LAYOUTS)
def test_tudo_dentro_da_area_util(layout):
    tpl = build_template(layout)
    x0, y0, x1, y1 = tpl["useful_area_mm"]
    for cx, cy, d in _answer_bubbles(tpl) + _matricula_bubbles(tpl):
        assert x0 <= cx - d / 2 and cx + d / 2 <= x1
        assert y0 <= cy - d / 2 and cy + d / 2 <= y1
    qx0, qy0, qx1, qy1 = tpl["qr_box_mm"]
    assert x0 <= qx0 and qx1 <= x1 and y0 <= qy0 and qy1 <= y1
    for nome, (bx0, by0, bx1, by1) in tpl["blocks_mm"].items():
        assert x0 <= bx0 and bx1 <= x1 and y0 <= by0 and by1 <= y1, nome


@pytest.mark.parametrize("layout", LAYOUTS)
def test_bloco_superior_termina_em_108mm(layout):
    tpl = build_template(layout)
    fx0, fy0, fx1, fy1 = _left_block(tpl)
    assert fy1 <= 108.0
    for cx, cy, d in _matricula_bubbles(tpl):
        assert fx0 + 0.5 <= cx - d / 2 and cx + d / 2 <= fx1 - 0.5
        assert cy + d / 2 <= fy1 - 0.5
    # a grade começa depois do bloco superior
    assert min(cy - d / 2 for _, cy, d in _answer_bubbles(tpl)) >= 115.0


@pytest.mark.parametrize("layout", LAYOUTS)
def test_blocos_nao_invadem_instrucoes_nem_qr(layout):
    tpl = build_template(layout)
    assert _left_block(tpl)[2] < tpl["blocks_mm"]["instrucoes"][0]
    assert tpl["blocks_mm"]["instrucoes"][2] < tpl["qr_box_mm"][0]


def test_marcadores_conforme_prd():
    fid = build_template(L.LAYOUT_SFA)["fiducials_mm"]
    for nome, (x, y, w) in fid.items():
        assert w == (4.0 if nome == "orient" else 7.0)
    assert fid["tl"][:2] == [8.0, 8.0]
    assert fid["tr"][0] + 7 == 210 - 8 and fid["bl"][1] + 7 == 297 - 8
    assert fid["br"][0] + 7 == 202 and fid["br"][1] + 7 == 289
    assert fid["orient"][0] - (fid["tl"][0] + 7) == 3.0


def test_grade_conforme_prd():
    tpl = build_template(L.LAYOUT_SFA)
    q = tpl["questions"]
    assert q["1"]["A"][2] == 4.5
    assert round(q["2"]["A"][1] - q["1"]["A"][1], 3) == 6.4
    assert round(q["1"]["B"][0] - q["1"]["A"][0], 3) == 7.5
    assert round(q["26"]["A"][0] - q["1"]["A"][0], 3) == 42.5
    assert q["26"]["A"][1] == q["1"]["A"][1] and q["100"]["D"][1] == q["25"]["D"][1]
    # >= 4 mm livres entre colunas
    assert (20 + 42.5) - (q["1"]["D"][0] + 4.5 / 2) >= 4.0
    assert set(q["1"]) == {"A", "B", "C", "D"}  # sem alternativa E


def test_grade_e_igual_nos_dois_layouts():
    assert build_template(L.LAYOUT_SFA)["questions"] == build_template(L.LAYOUT_UNIATENAS)["questions"]


def test_uniatenas_matricula():
    tpl = build_template(L.LAYOUT_UNIATENAS)
    m = tpl["matricula"]
    assert m["format"] == "uniatenas" and m["separators_after"] == [2, 3] and m["n_columns"] == 8
    assert len(m["columns"]) == 8
    for i, col in enumerate(m["columns"], start=1):
        assert [b["symbol"] for b in col] == list("0123456789"), i  # só dígitos, sem a letra G
    # colunas 1-2 | 3 | 4-8: o vão entre grupos é maior que o vão dentro do grupo
    xs = [col[0]["c"][0] for col in m["columns"]]
    gaps = [round(b - a, 3) for a, b in zip(xs, xs[1:])]
    assert gaps[0] == gaps[3] == 7.0 and gaps[1] == gaps[2] == 12.0


def test_chaves_do_contrato_7_1():
    for layout, versao in [(L.LAYOUT_SFA, "sfa_v3"), (L.LAYOUT_UNIATENAS, "uniatenas_v1")]:
        tpl = build_template(layout)
        for chave in ["template_version", "page_mm", "fiducials_mm", "qr_box_mm", "alternatives",
                      "questions", "matricula", "crops_mm"]:
            assert chave in tpl
        assert tpl["template_version"] == versao and tpl["page_mm"] == [210, 297]
        assert "nome" in tpl["crops_mm"]


def test_qr_do_pior_caso_tem_modulo_legivel():
    sfa = build_template(L.LAYOUT_SFA)["qr"]["worst_case"]
    assert sfa["version"] == 3 and sfa["module_mm"] >= 0.75, sfa
    uni = build_template(L.LAYOUT_UNIATENAS)["qr"]["worst_case"]
    assert uni["module_mm"] >= 1.0, uni


@pytest.mark.parametrize("layout", LAYOUTS)
def test_template_no_disco_esta_sincronizado(layout):
    """Se layout.py mudar, rode `cartao-omr modelo` e commite os templates."""
    path = TEMPLATES_DIR / f"{L.TEMPLATE_VERSION[layout]}.json"
    assert path.exists(), f"{path} não existe; rode `cartao-omr modelo`"
    assert path.read_text(encoding="utf-8") == template_json(build_template(layout))
    json.loads(path.read_text(encoding="utf-8"))


def test_nao_ha_template_antigo_com_matricula_no_sfa():
    assert not (TEMPLATES_DIR / "sfa_v1.json").exists()
