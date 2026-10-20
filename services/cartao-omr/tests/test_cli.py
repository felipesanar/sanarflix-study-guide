from __future__ import annotations

import json

import pymupdf
from typer.testing import CliRunner

from cartao_omr.cli import app

runner = CliRunner()
SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"


def test_modelo_gera_templates_e_pdfs(tmp_path):
    r = runner.invoke(app, ["modelo", "--saida", str(tmp_path)])
    assert r.exit_code == 0, r.output
    for nome in ["sfa_v3.json", "uniatenas_v1.json", "exemplo_sfa.pdf", "exemplo_uniatenas.pdf"]:
        assert (tmp_path / nome).exists()
    assert len(pymupdf.open(tmp_path / "exemplo_sfa.pdf")) == 1
    assert len(pymupdf.open(tmp_path / "exemplo_uniatenas.pdf")) == 1


def test_modelo_com_layout(tmp_path):
    r = runner.invoke(app, ["modelo", "--layout", "sfa", "--saida", str(tmp_path)])
    assert r.exit_code == 0, r.output
    assert not (tmp_path / "uniatenas_v1.json").exists()
    assert json.loads((tmp_path / "sfa_v3.json").read_text(encoding="utf-8"))["matricula"] is None


def test_modelo_layout_invalido(tmp_path):
    assert runner.invoke(app, ["modelo", "--layout", "x", "--saida", str(tmp_path)]).exit_code != 0


def test_gerar_cartoes_um_por_aluno(tmp_path, fake_roster_csv):
    out = tmp_path / "c.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--roster", str(fake_roster_csv),
                            "--saida", str(out)])
    assert r.exit_code == 0, r.output
    doc = pymupdf.open(out)
    assert len(doc) == 3
    assert "Álvaro Falso" in doc[0].get_text()  # ordenado por nome


def test_gerar_cartoes_sfa_exige_roster(tmp_path):
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--saida", str(tmp_path / "x.pdf")])
    assert r.exit_code != 0 and not (tmp_path / "x.pdf").exists()


def test_gerar_cartoes_nao_tem_mais_cartao_generico(tmp_path, fake_roster_csv):
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--roster", str(fake_roster_csv),
                            "--genericos", "5", "--saida", str(tmp_path / "x.pdf")])
    assert r.exit_code != 0


def test_gerar_cartoes_uniatenas(tmp_path):
    out = tmp_path / "u.pdf"
    r = runner.invoke(app, ["gerar-cartoes", "--simulado", SIM, "--modelo", "uniatenas",
                            "--copias", "2", "--saida", str(out)])
    assert r.exit_code == 0, r.output
    doc = pymupdf.open(out)
    assert len(doc) == 2 and "UniAtenas" in doc[0].get_text()


def test_gerar_cartoes_erros(tmp_path, fake_roster_csv):
    base = ["gerar-cartoes", "--saida", str(tmp_path / "x.pdf")]
    # simulado que não é UUID
    assert runner.invoke(app, base + ["--simulado", "sim-1", "--roster", str(fake_roster_csv)]).exit_code == 2
    # UniAtenas não é personalizado
    assert runner.invoke(app, base + ["--simulado", SIM, "--modelo", "uniatenas",
                                      "--roster", str(fake_roster_csv)]).exit_code != 0
    assert runner.invoke(app, base + ["--simulado", SIM, "--modelo", "foo"]).exit_code != 0
    # roster com matrícula fora do formato (espaço)
    ruim = tmp_path / "ruim.csv"
    ruim.write_text("matricula,nome\n12 34,Fulano\n", encoding="utf-8")
    assert runner.invoke(app, base + ["--simulado", SIM, "--roster", str(ruim)]).exit_code == 2
