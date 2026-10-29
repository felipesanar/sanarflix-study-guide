from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))  # permite importar tools/ nos testes
sys.path.insert(0, str(ROOT / "tests"))

from cardcheck import render_gray  # noqa: E402,F401  (reexportado: vários testes importam daqui)


@pytest.fixture(scope="session")
def fake_roster_csv(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("roster") / "roster.csv"
    path.write_text(
        "matricula,nome\n"
        "20230001,Zélia Teste\n"
        "20230002,Ana Fictícia\n"
        "20230003,Álvaro Falso\n",
        encoding="utf-8",
    )
    return path
