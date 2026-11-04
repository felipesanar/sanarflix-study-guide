"""Etapa 5: leitura das bolhas (PRD 7.2). Funções puras sobre a página retificada (1 px = 25,4/dpi mm).

Para cada bolha mede-se a fração de pixels de tinta num círculo de 70% do diâmetro (fora do
contorno cinza e da letra clara), depois de achatar a iluminação. O resultado é normalizado pela
mediana das bolhas da própria página (que são, em sua maioria, vazias).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import cv2
import numpy as np

from ..config import DEFAULT_CONFIG, ReadConfig

MARCADA, BRANCO, MULTIPLA, AMBIGUA = "marcada", "branco", "multipla", "ambigua"


@dataclass
class Cell:
    """Resultado de uma questão (ou de uma coluna da matrícula)."""

    kind: str                       # marcada | branco | multipla | ambigua
    symbols: list[str]              # marcada: 1 símbolo; multipla: os que passaram de t_alto; senão []
    scores: dict[str, float] = field(default_factory=dict)

    @property
    def value(self) -> str | None:
        return self.symbols[0] if self.kind == MARCADA else None


def flatten(gray: np.ndarray, dpi: float) -> np.ndarray:
    """Divide pelo fundo local: papel = 1,0; tinta preta ~0,1; contorno/letra ~0,5–0,7. float32."""
    small_k = 4
    small = cv2.resize(gray, None, fx=1 / small_k, fy=1 / small_k, interpolation=cv2.INTER_AREA)
    ksz = max(3, int(round(6.5 * dpi / 25.4 / small_k)) | 1)  # maior que uma bolha cheia (4,5 mm)
    closed = cv2.morphologyEx(small, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksz, ksz)))
    bg = cv2.GaussianBlur(closed, (0, 0), 2.0)
    bg = cv2.resize(bg, (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_LINEAR)
    return gray.astype(np.float32) / np.maximum(bg.astype(np.float32), 40.0)


def ink_mask(flat: np.ndarray, t_ink: float) -> np.ndarray:
    return (flat < t_ink).astype(np.uint8)


def _disc(r_px: float) -> tuple[np.ndarray, int]:
    n = int(np.ceil(r_px)) + 1
    yy, xx = np.mgrid[-n:n + 1, -n:n + 1]
    return (xx * xx + yy * yy) <= r_px * r_px, n


def bubble_fractions(ink: np.ndarray, bubbles: list[tuple[float, float, float]], dpi: float,
                     cfg: ReadConfig = DEFAULT_CONFIG) -> np.ndarray:
    """Fração de tinta em cada bolha `[cx, cy, d]` (mm) -> array de floats em [0, 1]."""
    k = dpi / 25.4
    out = np.zeros(len(bubbles), np.float32)
    cache: dict[float, tuple[np.ndarray, int]] = {}
    for i, (cx, cy, d) in enumerate(bubbles):
        r = d / 2 * cfg.radius_frac * k
        mask, n = cache.setdefault(round(r, 3), _disc(r))
        x, y = int(round(cx * k)), int(round(cy * k))
        sub = ink[y - n:y + n + 1, x - n:x + n + 1]
        if sub.shape != mask.shape:
            continue  # bolha fora da imagem
        out[i] = sub[mask].mean()
    return out


def normalize(fractions: np.ndarray) -> np.ndarray:
    """Tira a linha de base da página (mediana) e reescala para [0, 1]."""
    base = float(np.median(fractions))
    return np.clip((fractions - base) / max(1.0 - base, 1e-3), 0.0, 1.0)


def classify(scores: dict[str, float], cfg: ReadConfig = DEFAULT_CONFIG) -> Cell:
    """Regras do PRD 7.2: marcada, branco, multipla ou ambigua."""
    ordem = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    altos = [s for s, v in ordem if v >= cfg.t_alto]
    top = ordem[0][1]
    second = ordem[1][1] if len(ordem) > 1 else 0.0
    if len(altos) >= 2:
        return Cell(MULTIPLA, sorted(altos), scores)
    if len(altos) == 1:
        if second < cfg.t_baixo and top - second >= cfg.gap_min:
            return Cell(MARCADA, [altos[0]], scores)
        return Cell(AMBIGUA, [], scores)
    if top < cfg.t_baixo:
        return Cell(BRANCO, [], scores)
    return Cell(AMBIGUA, [], scores)


KIND_CODES = (MARCADA, BRANCO, MULTIPLA, AMBIGUA)


def classify_batch(scores: np.ndarray, cfg: ReadConfig = DEFAULT_CONFIG) -> tuple[np.ndarray, np.ndarray]:
    """Versão vetorizada de `classify` (calibração). `scores` é (N, k).

    Devolve (códigos, índice da bolha mais escura): código = posição em KIND_CODES.
    """
    srt = np.sort(scores, axis=1)[:, ::-1]
    top, second = srt[:, 0], srt[:, 1]
    n_alto = (scores >= cfg.t_alto).sum(axis=1)
    kind = np.full(len(scores), 3, np.int8)                                   # ambigua
    marcada = (n_alto == 1) & (second < cfg.t_baixo) & (top - second >= cfg.gap_min)
    kind[marcada] = 0
    kind[(n_alto == 0) & (top < cfg.t_baixo)] = 1                             # branco
    kind[n_alto >= 2] = 2                                                     # multipla
    return kind, scores.argmax(axis=1)


def read_answers(rect: np.ndarray, template: dict, dpi: float, cfg: ReadConfig = DEFAULT_CONFIG,
                 flat: np.ndarray | None = None) -> dict[int, Cell]:
    flat = flatten(rect, dpi) if flat is None else flat
    ink = ink_mask(flat, cfg.t_ink)
    alts = template["alternatives"]
    qs = sorted(template["questions"], key=int)
    bubbles = [tuple(template["questions"][q][a]) for q in qs for a in alts]
    norm = normalize(bubble_fractions(ink, bubbles, dpi, cfg))
    out: dict[int, Cell] = {}
    for i, q in enumerate(qs):
        vals = norm[i * len(alts):(i + 1) * len(alts)]
        out[int(q)] = classify({a: float(v) for a, v in zip(alts, vals)}, cfg)
    return out


@dataclass
class MatriculaRead:
    value: str | None               # 'NN-X-NNNNN' ou None
    valid: bool
    columns: list[Cell]
    reason: str = ""                # ex.: 'coluna 3: ambigua'


def read_matricula(rect: np.ndarray, template: dict, dpi: float, cfg: ReadConfig = DEFAULT_CONFIG,
                   flat: np.ndarray | None = None) -> MatriculaRead:
    """Matrícula em bolhas do UniAtenas. Todas as colunas são obrigatórias (PRD 7.2, passo 6)."""
    mat = template.get("matricula")
    if not mat:
        raise ValueError("o template não tem matrícula (layout sfa)")
    flat = flatten(rect, dpi) if flat is None else flat
    ink = ink_mask(flat, cfg.t_ink)
    cols = mat["columns"]
    bubbles = [tuple(b["c"]) for col in cols for b in col]
    norm = normalize(bubble_fractions(ink, bubbles, dpi, cfg))
    cells: list[Cell] = []
    pos = 0
    for col in cols:
        syms = [b["symbol"] for b in col]
        vals = norm[pos:pos + len(col)]
        pos += len(col)
        cells.append(classify({s: float(v) for s, v in zip(syms, vals)}, cfg))
    for i, c in enumerate(cells, start=1):
        if c.kind != MARCADA:
            return MatriculaRead(None, False, cells, f"coluna {i}: {c.kind}")
    text = ""
    for i, c in enumerate(cells, start=1):
        text += c.value
        if i in mat["separators_after"]:
            text += "-"
    return MatriculaRead(text, True, cells)
