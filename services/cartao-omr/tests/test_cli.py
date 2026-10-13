from __future__ import annotations

import json

import pymupdf
from typer.testing import CliRunner

from cartao_omr.cli import app

runner = CliRunner()


def test_modelo_gera_templates_e_pdfs(tmp_path):
    r = runner.invoke(app, ["modelo", "--saida", str(tmp_path)])
    assert r.exit_code == 0, r.output
    for nome in ["sfa_v1.json", "uniatenas_v1.json", "exemplo_sfa.pdf", "exemplo_uniatenas.pdf"]:
        assert (tmp_path / nome).exists()
    assert len(pymupdf.open(tmp_path / "exemplo_sfa.pdf")) == 2
    assert len(pymupdf.open(tmp_path / "exemplo_uniatenas.pdf")) == 1


def test_modelo_com_layout_e_colunas(tmp_path):
    r = runner.invoke(app, ["modelo", "--layout", "sfa", "--matricula-colunas", "9", "--saida", str(tmp_path)])
    assert r.exit_code == 0, r.output
    assert not (tmp_path / "uniatenas_v1.json").exists()
    assert json.loads((tmp_path / "sfa_v1.json").read_text(encoding="utf-8"))["matricula"]["n_columns"] == 9


def test_modelo_layout_invalido(tmp_path):
    assert runner.invoke(app, ["modelo", "--layout", "x", "--saida", str(tmp_path)]).exit_code != 0


def test_gerar_cartoes_personalizados_e_genericos(tmp_path, fake_roster_csv):
    out = tmp_path / "c.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", "sim-1", "--roster", str(fake_roster_csv),
                            "--genericos", "5", "--saida", str(out)])
    assert r.exit_code == 0, r.output
    assert len(pymupdf.open(out)) == 3 + 5


def test_gerar_cartoes_sem_roster_so_genericos(tmp_path):
    out = tmp_path / "c.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", "sim-1", "--genericos", "2", "--saida", str(out)])
    assert r.exit_code == 0, r.output
    assert len(pymupdf.open(out)) == 2


def test_gerar_cartoes_uniatenas(tmp_path):
    out = tmp_path / "u.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", "sim-1", "--modelo", "uniatenas",
                            "--copias", "2", "--saida", str(out)])
    assert r.exit_code == 0, r.output
    doc = pymupdf.open(out)
    assert len(doc) == 2 and "UniAtenas" in doc[0].get_text()


def test_gerar_cartoes_erros(tmp_path, fake_roster_csv):
    base = ["gerar-cartoes", "--saida", str(tmp_path / "x.pdf")]
    assert runner.invoke(app, base + ["--simulado", "a|b", "--genericos", "1"]).exit_code == 2
    assert runner.invoke(app, base + ["--simulado", "s", "--genericos", "0"]).exit_code != 0
    assert runner.invoke(app, base + ["--simulado", "s", "--modelo", "uniatenas",
                                      "--roster", str(fake_roster_csv)]).exit_code != 0
    assert runner.invoke(app, base + ["--simulado", "s", "--modelo", "foo"]).exit_code != 0
