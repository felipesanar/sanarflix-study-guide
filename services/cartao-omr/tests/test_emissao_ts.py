"""Paridade entre o gerador Python e o do Academy (TypeScript, `src/features/cartoes/`).

O TypeScript é executado pelo Node (`tools/emitir_ts.mts`, o mesmo código do navegador) e o PDF que ele
produz é conferido aqui: QR lido pelo `zxing-cpp`, marcadores e bolhas nas posições do template, pixels
comparados com o PDF do Python e leitura pelo pipeline da Fase 1. Pula se não houver Node 22.18+ ou
`node_modules` na raiz do repositório.
"""
from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pymupdf
import pytest
import zxingcpp

from cartao_omr.card import build_template, specs_personalizados, specs_uniatenas, write_cards_pdf
from cartao_omr.models import RosterEntry, parse_qr
from cartao_omr.pipeline import omr
from cartao_omr.pipeline.page import OK, read_page
from cartao_omr.pipeline.render import open_pdf, render_page
from cartao_omr.roster import _sort_key

from cardcheck import assert_marcadores_e_bolhas, render_gray
from conftest import ROOT

REPO = ROOT.parent.parent
SCRIPT = ROOT / "tools" / "emitir_ts.mts"
SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
LONGO = "Fulano de Tal Beltrano Ciclano Sicrano da Silva Pereira de Albuquerque Cavalcanti " * 2


def _node() -> str | None:
    exe = shutil.which("node")
    if not exe or not (REPO / "node_modules" / "jspdf" / "package.json").exists():
        return None
    out = subprocess.run([exe, "--version"], capture_output=True, text=True).stdout.strip().lstrip("v")
    major, minor = (int(p) for p in out.split(".")[:2])
    return exe if (major, minor) >= (22, 18) else None


NODE = _node()
pytestmark = pytest.mark.skipif(NODE is None, reason="precisa de Node 22.18+ e node_modules na raiz do repositório")

ALUNOS = [
    {"matricula": "2023001234", "nome": "Maria Exemplo da Silva"},
    {"matricula": "ab-12.3/x", "nome": "Çãtia Ñandú Öztürk"},
    {"matricula": "A1B2C3D4E5F6G7H8I9J0K1L2", "nome": LONGO},
    {"matricula": "99-G-12345", "nome": "Álvaro Falso"},
    {"email": "Bia.Sem.Matricula@Faculdade.edu.br", "nome": "Bia Sem Matrícula"},  # plano B
]


def run_ts(tmp_path: Path, entrada: dict) -> tuple[bytes, dict]:
    cfg, pdf = tmp_path / "entrada.json", tmp_path / "saida.pdf"
    cfg.write_text(json.dumps(entrada), encoding="utf-8")
    r = subprocess.run([NODE, str(SCRIPT), str(cfg), str(pdf)], cwd=REPO, capture_output=True, text=True,
                       encoding="utf-8", timeout=300)
    assert r.returncode == 0, r.stderr
    return pdf.read_bytes(), json.loads(r.stdout.strip().splitlines()[-1])


def _py_pdf(specs) -> bytes:
    buf = io.BytesIO()
    write_cards_pdf(buf, specs)
    return buf.getvalue()


def _sfa_entrada(alunos=ALUNOS):
    return {"layout": "sfa", "simuladoId": SIM, "nomeSimulado": "SIMULADO ENAMED 2026",
            "ies": "Faculdade Exemplo", "data": "25/10/2026", "alunos": alunos}


def _sfa_py(alunos=ALUNOS):
    ordenados = sorted(alunos, key=lambda a: (_sort_key(a["nome"]), (a.get("matricula") or a.get("email", "")).strip().upper()))
    roster = [RosterEntry(a.get("matricula", ""), a["nome"], email=a.get("email", "")) for a in ordenados]
    return specs_personalizados(roster, SIM, "SIMULADO ENAMED 2026", "Faculdade Exemplo", "25/10/2026")


@pytest.fixture(scope="module")
def sfa(tmp_path_factory):
    pdf, stats = run_ts(tmp_path_factory.mktemp("ts_sfa"), _sfa_entrada())
    return pdf, stats, _sfa_py()


@pytest.fixture(scope="module")
def uni(tmp_path_factory):
    entrada = {"layout": "uniatenas", "simuladoId": SIM, "nomeSimulado": "SIMULADO ENAMED 2026", "data": "25/10/2026",
               "copias": 2}
    pdf, stats = run_ts(tmp_path_factory.mktemp("ts_uni"), entrada)
    return pdf, stats, specs_uniatenas(2, SIM, "SIMULADO ENAMED 2026", "UniAtenas", "25/10/2026")


# ------------------------------------------------------------------ estrutura
def test_uma_pagina_a4_por_cartao_na_mesma_ordem_do_python(sfa):
    pdf, stats, specs = sfa
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    assert len(doc) == stats["paginas"] == len(specs) == 5
    for page in doc:
        assert round(page.rect.width / 72 * 25.4) == 210 and round(page.rect.height / 72 * 25.4) == 297


def test_qr_de_cada_pagina_e_o_payload_do_python(sfa):
    pdf, _, specs = sfa
    for i, spec in enumerate(specs):
        lidos = zxingcpp.read_barcodes(render_gray(pdf, i, 200))
        assert [r.text for r in lidos] == [spec.qr_payload], i
        assert parse_qr(lidos[0].text).identificacao == (spec.matricula_normalizada or spec.email_normalizado)


def test_qr_do_typescript_e_igual_ao_do_python_pixel_a_pixel(sfa):
    pdf, _, specs = sfa
    py = _py_pdf(specs)
    x0, y0, x1, y1 = build_template("sfa")["qr_box_mm"]
    k = 300 / 25.4
    box = (slice(round(y0 * k), round(y1 * k)), slice(round(x0 * k), round(x1 * k)))
    for i in range(len(specs)):
        a, b = render_gray(pdf, i, 300)[box].astype(int), render_gray(py, i, 300)[box].astype(int)
        assert (np.abs(a - b) > 64).mean() < 0.001, i


@pytest.mark.parametrize("fixture,layout", [("sfa", "sfa"), ("uni", "uniatenas")])
def test_marcadores_e_bolhas_no_lugar_do_template(request, fixture, layout):
    pdf = request.getfixturevalue(fixture)[0]
    tpl = build_template(layout)
    for i in range(len(pymupdf.open(stream=pdf, filetype="pdf"))):
        assert_marcadores_e_bolhas(render_gray(pdf, i, 300), tpl, 300)


@pytest.mark.parametrize("fixture", ["sfa", "uni"])
def test_so_preto_e_cinza_e_sem_imagens(request, fixture):
    pdf = request.getfixturevalue(fixture)[0]
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    pix = doc[0].get_pixmap(dpi=100, colorspace=pymupdf.csRGB, alpha=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    rgb = rgb.astype(int)  # o jsPDF arredonda as cores: tolera 2 níveis de diferença entre canais
    assert np.abs(rgb[..., 0] - rgb[..., 1]).max() <= 2 and np.abs(rgb[..., 1] - rgb[..., 2]).max() <= 2
    assert len(doc[0].get_images()) == 0


# ------------------------------------------------------------------ comparação com o PDF do Python
@pytest.mark.parametrize("fixture", ["sfa", "uni"])
def test_pagina_inteira_quase_identica_a_do_python(request, fixture):
    pdf, _, specs = request.getfixturevalue(fixture)
    py = _py_pdf(specs)
    for i in range(len(specs)):
        a, b = render_gray(pdf, i, 150).astype(int), render_gray(py, i, 150).astype(int)
        diferentes = (np.abs(a - b) > 64).mean()
        assert diferentes < 0.01, (i, diferentes)  # só diferenças de serrilhado de texto


def test_nomes_longos_nao_invadem_o_qr(sfa):
    pdf, _, specs = sfa
    i = next(i for i, s in enumerate(specs) if s.aluno_nome == LONGO)
    img = render_gray(pdf, i, 200)
    k = 200 / 25.4
    assert img[round(20 * k):round(40 * k), round(151 * k):round(157 * k)].min() > 240
    assert [r.text for r in zxingcpp.read_barcodes(img)] == [specs[i].qr_payload]


def test_nome_e_matricula_impressos_no_pdf_do_typescript(sfa):
    pdf, _, specs = sfa
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    for i, spec in enumerate(specs):
        texto = doc[i].get_text()
        assert "MATRÍCULA" in texto and "CARTÃO PESSOAL" not in texto, i
        if spec.por_email:  # plano B: campo em branco, dica para escrever e o e-mail como rótulo sob o QR
            assert "escreva sua matrícula abaixo" in texto and spec.email_normalizado in texto, i
        else:
            assert spec.matricula_normalizada in texto and "escreva sua matrícula" not in texto, i


def test_ordem_dos_alunos_ignora_acentos(sfa):
    _, _, specs = sfa
    assert [s.aluno_nome for s in specs][:3] == ["Álvaro Falso", "Bia Sem Matrícula", "Çãtia Ñandú Öztürk"]


# ------------------------------------------------------------------ o leitor da Fase 1 lê o cartão do TypeScript
def test_leitor_da_fase_1_le_o_cartao_gerado_no_typescript(sfa, tmp_path):
    pdf, _, specs = sfa
    path = tmp_path / "ts.pdf"
    path.write_bytes(pdf)
    doc = open_pdf(path)
    for i, spec in enumerate(specs):
        res = read_page(render_page(doc, i))
        assert res.status == OK, res.reason
        chave = spec.matricula_normalizada or spec.email_normalizado
        assert res.identificacao == chave and not res.qr_ilegivel
        assert (res.email_qr is not None) == spec.por_email
        assert res.alignment.rms_mm < 0.3
        assert all(c.kind == omr.BRANCO for c in res.answers.values())  # cartão em branco: nada marcado


def test_leitor_le_o_cartao_uniatenas_do_typescript(uni, tmp_path):
    pdf, _, _ = uni
    path = tmp_path / "ts_uni.pdf"
    path.write_bytes(pdf)
    res = read_page(render_page(open_pdf(path), 0))
    assert res.status == OK and res.layout == "uniatenas" and res.matricula_qr is None
    assert res.matricula is not None and not res.matricula.valid  # matrícula em branco => inválida


# ------------------------------------------------------------------ erros
@pytest.mark.parametrize("mudanca", [
    {"simuladoId": "sim-1"},
    {"alunos": [{"matricula": "12 34", "nome": "Fulano"}]},
    {"alunos": [{"nome": "Sem nada"}]},
    {"alunos": [{"matricula": "1", "email": "a@x.com", "nome": "Os dois"}]},
    {"alunos": [{"email": "sem-arroba", "nome": "Email ruim"}]},
    {"alunos": [{"matricula": "", "nome": "Fulano"}]},
    {"alunos": [{"matricula": "1", "nome": "A"}, {"matricula": " 1 ", "nome": "B"}]},
    {"alunos": []},
])
def test_entradas_invalidas_param_com_erro(tmp_path, mudanca):
    entrada = {**_sfa_entrada(), **mudanca}
    cfg = tmp_path / "e.json"
    cfg.write_text(json.dumps(entrada), encoding="utf-8")
    r = subprocess.run([NODE, str(SCRIPT), str(cfg), str(tmp_path / "x.pdf")], cwd=REPO, capture_output=True,
                       text=True, encoding="utf-8", timeout=120)
    assert r.returncode != 0 and not (tmp_path / "x.pdf").exists()


def test_gerar_700_cartoes_em_tempo_razoavel(tmp_path):
    """Uma turma grande (UNIFIP tem ~700 matrículas) precisa gerar sem travar."""
    alunos = [{"matricula": f"20230{i:05d}", "nome": f"Aluno Sintético {i:04d}"} for i in range(700)]
    pdf, stats = run_ts(tmp_path, _sfa_entrada(alunos))
    assert stats["paginas"] == 700
    assert stats["ms"] < 120_000, stats  # medida em 16/10/2026 no Windows: ver o handoff da Fase E
    assert len(pymupdf.open(stream=pdf, filetype="pdf")) == 700
    assert re.match(rb"%PDF-", pdf[:8])
