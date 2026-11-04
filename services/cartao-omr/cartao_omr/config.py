"""Caminhos e parâmetros de leitura.

Limiares do OMR (Fase 1). Resultado da calibração sobre 310 páginas sintéticas (conjuntos "completo" e
"estresse" de `tools/make_fixtures.py`, ~27 mil questões estritas): qualquer T_ALTO de 0,20 a 0,60 com
T_BAIXO de 0,10 a 0,48 acerta 100%, então os valores abaixo são os escolhidos a priori e ficam no meio
da região. Folgas medidas: a pior marca "marcada" pontua 0,609 (T_ALTO = 0,50) e o pior branco, 0,082
(T_BAIXO = 0,20). As fixtures NÃO discriminam limiares; só o piloto com cartões reais (Fase 3) pode
confirmá-los. Detalhes em docs/prd/cartoes-resposta-handoff/fase-1.md.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = PACKAGE_ROOT / "templates"
RUNS_DIR = PACKAGE_ROOT / "runs"


@dataclass(frozen=True)
class ReadConfig:
    # --- render / alinhamento
    render_dpi: int = 200
    align_max_mm: float = 1.5        # erro de reprojeção (RMS) acima disso => página ilegível
    blank_dark_fraction: float = 0.0005
    # --- OMR
    radius_frac: float = 0.70        # círculo de medição = 70% do diâmetro da bolha
    t_ink: float = 0.55              # pixel é tinta se (cinza / fundo local) < t_ink
    t_alto: float = 0.50             # score mínimo de uma bolha "marcada"
    t_baixo: float = 0.20            # abaixo disso a bolha conta como vazia
    gap_min: float = 0.30            # diferença mínima entre a 1ª e a 2ª bolha


DEFAULT_CONFIG = ReadConfig()
