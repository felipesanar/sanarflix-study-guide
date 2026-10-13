"""Geometria do cartão SFA (PRD seções 5.2 e 5.2.1).

Tudo em milímetros, origem no canto superior esquerdo da página, y para baixo.
Este módulo só calcula posições; quem desenha é `card.py` e quem lê o resultado
(o template JSON) é o pipeline de leitura. Ninguém mede nada à mão.
"""
from __future__ import annotations

from dataclasses import dataclass, field

LAYOUT_SFA = "sfa"
LAYOUT_UNIATENAS = "uniatenas"
LAYOUTS = (LAYOUT_SFA, LAYOUT_UNIATENAS)

TEMPLATE_VERSION = {LAYOUT_SFA: "sfa_v1", LAYOUT_UNIATENAS: "uniatenas_v1"}

# Número de colunas da matrícula do layout `sfa`. Placeholder do PRD (N = 12);
# o valor definitivo sai da consulta da Fase 0 (ver handoff).
SFA_MATRICULA_COLUNAS = 12
SFA_MATRICULA_COLUNAS_MAX = 14

# ---------------------------------------------------------------- página
PAGE_W = 210.0
PAGE_H = 297.0
USEFUL = (20.0, 20.0, 190.0, 277.0)  # x0, y0, x1, y1

# ---------------------------------------------------------------- marcadores
FID_SIZE = 7.0
FID_MARGIN = 8.0
ORIENT_SIZE = 4.0
ORIENT_GAP = 3.0  # distância à direita do marcador superior esquerdo

# ---------------------------------------------------------------- cabeçalho
TITLE_BOX = (20.0, 20.0, 150.0, 28.0)
ALUNO_BOX = (20.0, 30.0, 150.0, 40.0)
ALUNO_LABEL_X = 20.0
ALUNO_LINE_X0 = 38.0
ALUNO_LINE_Y = 38.8
QR_BOX = (158.0, 20.0, 188.0, 50.0)
QR_ERROR = "q"
QR_QUIET_MODULES = 4
QR_LABEL_Y = 52.6  # linha de base do código legível sob o QR (6 pt)

# ---------------------------------------------------------------- blocos
MATRICULA_FRAME = (20.0, 44.0, 92.0, 108.0)
INSTRUCOES_FRAME = (98.0, 44.0, 150.0, 108.0)

# ---------------------------------------------------------------- matrícula
MAT_BOX_W = 5.0
MAT_BOX_H = 6.0
MAT_BOX_Y0 = 50.5
MAT_FIRST_CY = 59.5          # centro da primeira bolha (caixa termina em 56,5)
MAT_BUBBLE_D = 4.0
MAT_TITLE_BASELINE = 48.6
# O PRD pede passo de 5,5 mm, mas 10 bolhas de 4 mm + caixa de 6 mm + título não
# cabem em y <= 108 com 5,5 mm (e o UniAtenas tem 11 bolhas). Desvio registrado
# no handoff: 5,0 mm no `sfa` e 4,5 mm no `uniatenas`.
MAT_PITCH = {LAYOUT_SFA: 5.0, LAYOUT_UNIATENAS: 4.5}
MAT_COL_W = {LAYOUT_SFA: 6.0, LAYOUT_UNIATENAS: 7.0}
UNI_SEPARATOR_W = 5.0
UNI_GROUPS = (2, 1, 5)       # NN-X-NNNNN
UNI_SEPARATORS_AFTER = (2, 3)
UNI_MIDDLE_COLUMN = 3        # coluna (1-based) que aceita `G`
UNI_MIDDLE_SYMBOLS = tuple("0123456789") + ("G",)
DIGITS = tuple("0123456789")

# ---------------------------------------------------------------- grade de respostas
ALTERNATIVES = ("A", "B", "C", "D")
N_QUESTIONS = 100
GRID_COLUMNS = 4
GRID_ROWS = 25
GRID_X0 = 20.0
GRID_COL_W = 42.5
GRID_FIRST_CY = 119.2
GRID_ROW_PITCH = 6.4
NUM_STRIP_W = 9.0
NUM_RIGHT_PAD = 1.0          # o número termina 1 mm antes do fim da faixa
BUBBLE_D = 4.5
BUBBLE_PITCH = 7.5
BUBBLE_FIRST_DX = NUM_STRIP_W + 2.0 + BUBBLE_D / 2  # do início da coluna ao 1º centro

# ---------------------------------------------------------------- rodapé
FOOTER_Y = 283.0
FOOTER_TEXT = "Não dobre nem amasse este cartão • Imprima só na frente • SanarFlix Academy"

# ---------------------------------------------------------------- estilo
BUBBLE_STROKE_PT = 0.5
BUBBLE_STROKE_GRAY = 0x7F
BUBBLE_LETTER_GRAY = 0xA6
BUBBLE_LETTER_PT = 6.0
NUMBER_PT = 9.0


Box = tuple[float, float, float, float]


def _r(v: float) -> float:
    return round(v, 3)


@dataclass(frozen=True)
class Bubble:
    cx: float
    cy: float
    d: float
    symbol: str

    def as_list(self) -> list[float]:
        return [_r(self.cx), _r(self.cy), _r(self.d)]


@dataclass(frozen=True)
class MatriculaColumn:
    cx: float
    box: Box
    bubbles: tuple[Bubble, ...]


@dataclass(frozen=True)
class Geometry:
    layout: str
    n_matricula_cols: int
    fiducials: dict[str, tuple[float, float, float]]  # nome -> (x, y, w), x/y = canto sup. esq.
    matricula_columns: tuple[MatriculaColumn, ...]
    matricula_separators: tuple[tuple[float, float], ...]  # (cx, cy) de cada hífen impresso
    matricula_separators_after: tuple[int, ...]
    questions: dict[int, dict[str, Bubble]]
    number_anchors: dict[int, tuple[float, float]]  # (x da borda direita, cy)
    extras: dict = field(default_factory=dict)

    @property
    def matricula_symbols(self) -> list[tuple[str, Bubble]]:
        return [(b.symbol, b) for col in self.matricula_columns for b in col.bubbles]


def fiducials() -> dict[str, tuple[float, float, float]]:
    far_x = PAGE_W - FID_MARGIN - FID_SIZE
    far_y = PAGE_H - FID_MARGIN - FID_SIZE
    return {
        "tl": (FID_MARGIN, FID_MARGIN, FID_SIZE),
        "tr": (far_x, FID_MARGIN, FID_SIZE),
        "bl": (FID_MARGIN, far_y, FID_SIZE),
        "br": (far_x, far_y, FID_SIZE),
        # centrado verticalmente no marcador tl, 3 mm à direita dele
        "orient": (
            FID_MARGIN + FID_SIZE + ORIENT_GAP,
            FID_MARGIN + (FID_SIZE - ORIENT_SIZE) / 2,
            ORIENT_SIZE,
        ),
    }


def _matricula_columns_sfa(n: int) -> tuple[list[MatriculaColumn], list[tuple[float, float]]]:
    if not 1 <= n <= SFA_MATRICULA_COLUNAS_MAX:
        raise ValueError(f"colunas de matrícula deve estar entre 1 e {SFA_MATRICULA_COLUNAS_MAX}, veio {n}")
    frame_w = MATRICULA_FRAME[2] - MATRICULA_FRAME[0]
    col_w = min(MAT_COL_W[LAYOUT_SFA], frame_w / n)
    box_w = min(MAT_BOX_W, col_w - 1.0)
    left = MATRICULA_FRAME[0] + (frame_w - n * col_w) / 2
    cols = []
    for i in range(n):
        cx = left + (i + 0.5) * col_w
        cols.append(_column(cx, box_w, DIGITS, MAT_PITCH[LAYOUT_SFA]))
    return cols, []


def _matricula_columns_uniatenas() -> tuple[list[MatriculaColumn], list[tuple[float, float]]]:
    frame_w = MATRICULA_FRAME[2] - MATRICULA_FRAME[0]
    n_cols = sum(UNI_GROUPS)
    col_w = MAT_COL_W[LAYOUT_UNIATENAS]
    total = n_cols * col_w + (len(UNI_GROUPS) - 1) * UNI_SEPARATOR_W
    x = MATRICULA_FRAME[0] + (frame_w - total) / 2
    cols: list[MatriculaColumn] = []
    seps: list[tuple[float, float]] = []
    sep_cy = MAT_BOX_Y0 + MAT_BOX_H / 2
    idx = 0
    for g, size in enumerate(UNI_GROUPS):
        for _ in range(size):
            idx += 1
            symbols = UNI_MIDDLE_SYMBOLS if idx == UNI_MIDDLE_COLUMN else DIGITS
            cols.append(_column(x + col_w / 2, MAT_BOX_W, symbols, MAT_PITCH[LAYOUT_UNIATENAS]))
            x += col_w
        if g < len(UNI_GROUPS) - 1:
            seps.append((x + UNI_SEPARATOR_W / 2, sep_cy))
            x += UNI_SEPARATOR_W
    return cols, seps


def _column(cx: float, box_w: float, symbols: tuple[str, ...], pitch: float) -> MatriculaColumn:
    box = (cx - box_w / 2, MAT_BOX_Y0, cx + box_w / 2, MAT_BOX_Y0 + MAT_BOX_H)
    bubbles = tuple(
        Bubble(cx, MAT_FIRST_CY + k * pitch, MAT_BUBBLE_D, s) for k, s in enumerate(symbols)
    )
    return MatriculaColumn(cx=cx, box=box, bubbles=bubbles)


def question_geometry() -> tuple[dict[int, dict[str, Bubble]], dict[int, tuple[float, float]]]:
    questions: dict[int, dict[str, Bubble]] = {}
    anchors: dict[int, tuple[float, float]] = {}
    for col in range(GRID_COLUMNS):
        x0 = GRID_X0 + col * GRID_COL_W
        for row in range(GRID_ROWS):
            q = col * GRID_ROWS + row + 1
            cy = GRID_FIRST_CY + row * GRID_ROW_PITCH
            questions[q] = {
                alt: Bubble(x0 + BUBBLE_FIRST_DX + k * BUBBLE_PITCH, cy, BUBBLE_D, alt)
                for k, alt in enumerate(ALTERNATIVES)
            }
            anchors[q] = (x0 + NUM_STRIP_W - NUM_RIGHT_PAD, cy)
    return questions, anchors


def build_geometry(layout: str, n_matricula_cols: int | None = None) -> Geometry:
    if layout not in LAYOUTS:
        raise ValueError(f"layout desconhecido: {layout!r}")
    if layout == LAYOUT_SFA:
        n = SFA_MATRICULA_COLUNAS if n_matricula_cols is None else n_matricula_cols
        cols, seps = _matricula_columns_sfa(n)
        after: tuple[int, ...] = ()
    else:
        cols, seps = _matricula_columns_uniatenas()
        n = len(cols)
        after = UNI_SEPARATORS_AFTER
    questions, anchors = question_geometry()
    return Geometry(
        layout=layout,
        n_matricula_cols=n,
        fiducials=fiducials(),
        matricula_columns=tuple(cols),
        matricula_separators=tuple(seps),
        matricula_separators_after=after,
        questions=questions,
        number_anchors=anchors,
    )


def expected_bubble_counts(layout: str, n_matricula_cols: int | None = None) -> tuple[int, int]:
    """(bolhas de resposta, bolhas de matrícula) esperadas pelo PRD."""
    if layout == LAYOUT_SFA:
        n = SFA_MATRICULA_COLUNAS if n_matricula_cols is None else n_matricula_cols
        return N_QUESTIONS * len(ALTERNATIVES), n * 10
    return N_QUESTIONS * len(ALTERNATIVES), 7 * 10 + 11
