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
        "user_id,nome\n"
        "11111111-1111-4111-8111-111111111111,Zélia Teste\n"
        "22222222-2222-4222-8222-222222222222,Ana Fictícia\n"
        "33333333-3333-4333-8333-333333333333,Álvaro Falso\n",
        encoding="utf-8",
    )
    return path
