"""Caminhos e constantes de execução. Os limiares do OMR entram na Fase 1."""
from __future__ import annotations

from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = PACKAGE_ROOT / "templates"
RUNS_DIR = PACKAGE_ROOT / "runs"
