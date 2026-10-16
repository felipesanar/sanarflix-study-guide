"""Gera fixtures sintéticas: cartões preenchidos à mão e "digitalizados", com gabarito em JSON.

Tudo é fictício (nomes falsos, UUIDs derivados de uma semente). Nada aqui toca banco ou dado real.

Uso (com o venv ativo, dentro de services/cartao-omr):
    python tools/make_fixtures.py                       # conjunto de referência -> tests/fixtures/
    python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes
    python tools/make_fixtures.py --seed 7 --saida %TEMP%/fx

Cada PDF vem com `<nome>.gabarito.json`. Resumo do que o gabarito diz de cada questão:
  truth      marcada | branco | multipla | ambigua  (classe esperada pelo leitor, PRD 7.2)
  strict     true nos casos limpos; é o que entra na métrica de acerto por bolha.
             false nos casos difíceis (marca fraca, X, ✓, ponto, círculo, rasura): o leitor pode
             responder `truth` ou uma das classes de `tolerated`, mas NUNCA uma letra errada.
  cov        cobertura de tinta medida em cada bolha (A–D), útil para calibrar T_ALTO/T_BAIXO.
  scan.mm_to_px   homografia 3x3 do mm do template para o pixel da página digitalizada.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import random
import sys
import unicodedata
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
import pymupdf
import zxingcpp

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cartao_omr import layout as L  # noqa: E402
from cartao_omr.card import (  # noqa: E402
    build_template,
    specs_personalizados,
    specs_uniatenas,
    write_cards_pdf,
)
from cartao_omr.models import RosterEntry  # noqa: E402

GENERATOR_VERSION = 1
FIXTURES_DIR = ROOT / "tests" / "fixtures"
CENTER = np.array([L.PAGE_W / 2, L.PAGE_H / 2])
FID_MARGIN_MM = 1.5  # folga mínima entre os marcadores e a borda da imagem (páginas legíveis)

PRIMEIROS = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isabela", "João",
             "Larissa", "Marcos", "Natália", "Otávio", "Paula", "Rafael", "Sílvia", "Tiago", "Úrsula", "Vitor"]
SOBRENOMES = ["Teste", "Fictício", "Exemplo", "Sintético", "Modelo", "Amostra"]


def ascii_only(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


# ============================================================ perfis
@dataclass(frozen=True)
class Profile:
    name: str
    mix: dict[str, float]            # tipo de preenchimento -> peso
    rot_deg: float                   # rotação máxima (graus)
    scale: tuple[float, float]
    shift_mm: float
    persp_mm: float                  # desvio máximo dos cantos (mm)
    dpis: tuple[int, ...]
    flip180_p: float = 0.0
    dark_bg_p: float = 0.0
    color_p: float = 0.4             # chance de página colorida (senão cinza)
    noise: tuple[float, float] = (1.5, 3.5)
    blur: tuple[float, float] = (0.4, 0.8)   # sigma em px a 200 dpi
    jpeg: tuple[int, int] = (55, 70)
    mat_defect_p: float = 0.0
    specks: tuple[int, int] = (3, 12)
    cov_min: float = 0.65            # cobertura mínima de uma marca "marcada" (0,65 a 1,0 por padrão)


PROFILES = {
    # Estresse: resolução baixa, borrão e JPEG pesados, marcas mais leves. Não é critério de aceite;
    # serve para ver onde o leitor começa a errar e se erra de forma segura (ambígua, nunca letra errada).
    "estresse": Profile(
        "estresse",
        {"marcada": 0.70, "branco": 0.05, "sujeira": 0.04, "multipla": 0.05, "fraca": 0.05, "x": 0.03,
         "visto": 0.02, "ponto": 0.02, "circulo": 0.01, "rasurada": 0.03},
        rot_deg=5.0, scale=(0.95, 1.05), shift_mm=4.0, persp_mm=1.5, dpis=(100, 150),
        flip180_p=0.3, dark_bg_p=0.4, color_p=0.5, noise=(5.0, 9.0), blur=(1.2, 2.0), jpeg=(25, 45),
        mat_defect_p=0.2, specks=(20, 70), cov_min=0.45,
    ),
    "limpo": Profile(
        "limpo", {"marcada": 0.88, "branco": 0.08, "multipla": 0.04},
        rot_deg=1.5, scale=(0.99, 1.01), shift_mm=2.0, persp_mm=0.0, dpis=(200,), color_p=0.25,
    ),
    "realista": Profile(
        "realista",
        {"marcada": 0.74, "branco": 0.05, "sujeira": 0.02, "multipla": 0.04, "fraca": 0.04, "x": 0.03,
         "visto": 0.02, "ponto": 0.01, "circulo": 0.01, "rasurada": 0.04},
        rot_deg=3.5, scale=(0.97, 1.03), shift_mm=3.0, persp_mm=0.3, dpis=(150, 200, 200, 300),
        color_p=0.25, noise=(2.0, 4.0), blur=(0.5, 1.0), jpeg=(50, 70), mat_defect_p=0.12, specks=(5, 25),
    ),
    "dificil": Profile(
        "dificil",
        {"marcada": 0.70, "branco": 0.05, "sujeira": 0.03, "multipla": 0.05, "fraca": 0.05, "x": 0.03,
         "visto": 0.02, "ponto": 0.02, "circulo": 0.01, "rasurada": 0.04},
        rot_deg=5.0, scale=(0.95, 1.05), shift_mm=4.0, persp_mm=1.0, dpis=(150, 200, 300),
        flip180_p=0.5, dark_bg_p=0.4, color_p=0.25, noise=(3.0, 5.0), blur=(0.7, 1.3), jpeg=(45, 65),
        mat_defect_p=0.2, specks=(10, 40),
    ),
}


# ============================================================ tinta
class Ink:
    """Camada de tinta (alpha 0..1) desenhada em mm sobre a página renderizada."""

    def __init__(self, h: int, w: int, dpi: int, rng: random.Random):
        self.a = np.zeros((h, w), np.float32)
        self.k = dpi / 25.4
        self.rng = rng

    # ---- primitivas ----
    def _paste(self, local: np.ndarray, x0: int, y0: int) -> None:
        h, w = local.shape
        ys, xs = max(y0, 0), max(x0, 0)
        ye, xe = min(y0 + h, self.a.shape[0]), min(x0 + w, self.a.shape[1])
        if ye <= ys or xe <= xs:
            return
        sub = local[ys - y0:ye - y0, xs - x0:xe - x0]
        self.a[ys:ye, xs:xe] = np.maximum(self.a[ys:ye, xs:xe], sub)

    def blob(self, cx: float, cy: float, d: float, coverage: float, strength: float = 1.0) -> None:
        """Preenchimento a caneta: rabisco paralelo recortado por um contorno irregular."""
        rng, k = self.rng, self.k
        R = d / 2 * rng.uniform(0.95, 1.12) * k
        off = np.array([rng.gauss(0, 0.2), rng.gauss(0, 0.2)]) * k
        S = int(2 * R * 1.6) + 8
        c0 = S / 2
        ang = np.linspace(0, 2 * math.pi, 22, endpoint=False)
        rad = R * (1 + np.array([rng.gauss(0, 0.05) for _ in ang]))
        poly = np.stack([c0 + off[0] + rad * np.cos(ang), c0 + off[1] + rad * np.sin(ang)], 1).astype(np.int32)
        clip = np.zeros((S, S), np.uint8)
        cv2.fillPoly(clip, [poly], 255)
        if coverage >= 0.96:
            body = clip.copy()
        else:
            body = np.zeros((S, S), np.uint8)
            w = max(2.0, 0.55 * k)
            sp = w / max(coverage, 0.08)
            th = math.radians(rng.uniform(15, 75))
            ux, uy = math.cos(th), math.sin(th)      # direção do traço
            nx, ny = -uy, ux                         # normal
            t = -R * 1.5
            while t < R * 1.5:
                wob = rng.gauss(0, 0.12 * k)
                p0 = (c0 + nx * (t + wob) - ux * R * 1.6, c0 + ny * (t + wob) - uy * R * 1.6)
                p1 = (c0 + nx * (t - wob) + ux * R * 1.6, c0 + ny * (t - wob) + uy * R * 1.6)
                cv2.line(body, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])),
                         255, max(1, int(round(w))), cv2.LINE_AA)
                t += sp
            body = cv2.bitwise_and(body, clip)
        local = (body.astype(np.float32) / 255.0) * strength
        self._paste(local, int(round(cx * k - c0)), int(round(cy * k - c0)))

    def _stroke_layer(self, strokes, width_mm: float, strength: float = 1.0):
        """strokes: lista de polilinhas em mm. Devolve (layer local, x0, y0)."""
        k = self.k
        pts = np.array([p for s in strokes for p in s])
        x0, y0 = int(pts[:, 0].min() * k) - 6, int(pts[:, 1].min() * k) - 6
        x1, y1 = int(pts[:, 0].max() * k) + 6, int(pts[:, 1].max() * k) + 6
        layer = np.zeros((y1 - y0, x1 - x0), np.uint8)
        for s in strokes:
            arr = np.array([[p[0] * k - x0, p[1] * k - y0] for p in s], np.float32)
            cv2.polylines(layer, [(arr * 16).astype(np.int32)], False, 255,
                          max(1, int(round(width_mm * k))), cv2.LINE_AA, shift=4)
        return layer.astype(np.float32) / 255.0 * strength, x0, y0

    def jitter(self, s: float = 0.15) -> float:
        return self.rng.gauss(0, s)

    def x_mark(self, cx: float, cy: float, d: float) -> None:
        r = d / 2 * self.rng.uniform(0.8, 1.2)
        j = self.jitter
        strokes = [[(cx - r + j(), cy - r + j()), (cx + r + j(), cy + r + j())],
                   [(cx - r + j(), cy + r + j()), (cx + r + j(), cy - r + j())]]
        layer, x0, y0 = self._stroke_layer(strokes, 0.45)
        self._paste(layer, x0, y0)

    def check_mark(self, cx: float, cy: float, d: float) -> None:
        r = d / 2 * self.rng.uniform(0.9, 1.3)
        j = self.jitter
        stroke = [(cx - r * 0.8 + j(), cy + j()), (cx - r * 0.2 + j(), cy + r * 0.7 + j()),
                  (cx + r * 1.1 + j(), cy - r * 0.9 + j())]
        layer, x0, y0 = self._stroke_layer([stroke], 0.5)
        self._paste(layer, x0, y0)

    def dot(self, cx: float, cy: float) -> None:
        self.blob(cx + self.jitter(0.2), cy + self.jitter(0.2), self.rng.uniform(0.9, 1.5), 1.0)

    def ring(self, cx: float, cy: float, d: float) -> None:
        r = d / 2 * 1.2
        pts = [(cx + r * math.cos(a) + self.jitter(0.08), cy + r * math.sin(a) + self.jitter(0.08))
               for a in np.linspace(0, 2 * math.pi, 28)]
        layer, x0, y0 = self._stroke_layer([pts], 0.55)
        self._paste(layer, x0, y0)

    def speck(self, cx: float, cy: float) -> None:
        self.blob(cx + self.jitter(0.6), cy + self.jitter(0.6), self.rng.uniform(0.25, 0.7), 1.0, 0.9)

    def handwriting(self, text: str, x_mm: float, baseline_mm: float, height_mm: float,
                    max_w_mm: float | None = None) -> None:
        """Texto "manuscrito" (fonte script do OpenCV) para o nome e os dígitos das caixas."""
        k = self.k
        font = cv2.FONT_HERSHEY_SCRIPT_SIMPLEX
        scale = 1.0
        (tw, th), _ = cv2.getTextSize(text, font, scale, 2)
        scale = height_mm * k / max(th, 1)
        (tw, th), base = cv2.getTextSize(text, font, scale, 2)
        if max_w_mm and tw > max_w_mm * k:
            scale *= max_w_mm * k / tw
        thick = max(1, int(round(0.4 * k)))
        layer = np.zeros_like(self.a, dtype=np.uint8)
        cv2.putText(layer, text, (int(x_mm * k), int(baseline_mm * k)), font, scale, 255, thick, cv2.LINE_AA)
        self.a = np.maximum(self.a, layer.astype(np.float32) / 255.0)

    def cover_box(self, x0: float, y0: float, x1: float, y1: float, strength: float = 0.95) -> None:
        """Mancha irregular de tinta/sujeira cobrindo uma caixa (usada para danificar o QR)."""
        k, rng = self.k, self.rng
        pts = [(x0, y0), ((x0 + x1) / 2, y0 - 1), (x1, y0), (x1 + 1, (y0 + y1) / 2), (x1, y1),
               ((x0 + x1) / 2, y1 + 1), (x0, y1), (x0 - 1, (y0 + y1) / 2)]
        poly = np.array([[(x + rng.gauss(0, 0.4)) * k, (y + rng.gauss(0, 0.4)) * k] for x, y in pts], np.int32)
        layer = np.zeros_like(self.a, dtype=np.uint8)
        cv2.fillPoly(layer, [poly], 255)
        self.a = np.maximum(self.a, layer.astype(np.float32) / 255.0 * strength)

    def coverage(self, cx: float, cy: float, d: float) -> float:
        """Fração do disco da bolha coberta por tinta (alpha > 0,5)."""
        k, r = self.k, d / 2 * self.k
        x0, y0 = int(cx * k - r) - 1, int(cy * k - r) - 1
        n = int(2 * r) + 3
        yy, xx = np.mgrid[0:n, 0:n]
        disc = (xx + x0 - cx * k) ** 2 + (yy + y0 - cy * k) ** 2 <= r * r
        sub = self.a[y0:y0 + n, x0:x0 + n]
        if sub.shape != disc.shape:
            return 0.0
        return float(((sub > 0.5) & disc).sum() / disc.sum())


# ============================================================ preenchimento
def pick(rng: random.Random, mix: dict[str, float]) -> str:
    kinds, weights = zip(*mix.items())
    return rng.choices(kinds, weights)[0]


def fill_answers(ink: Ink, tpl: dict, prof: Profile, rng: random.Random) -> dict:
    """Desenha as respostas e devolve o gabarito por questão."""
    alts = tpl["alternatives"]
    out: dict[str, dict] = {}
    for q, bubbles in tpl["questions"].items():
        kind = pick(rng, prof.mix)
        letter = rng.choice(alts)
        others = [a for a in alts if a != letter]
        info = {"kind": kind, "truth": "branco", "strict": True, "tolerated": []}
        cx, cy, d = bubbles[letter]
        if kind == "marcada":
            ink.blob(cx, cy, d, rng.uniform(prof.cov_min, 1.0))
            info.update(truth="marcada", letter=letter)
        elif kind == "multipla":
            second = rng.choice(others)
            ink.blob(cx, cy, d, rng.uniform(prof.cov_min, 1.0))
            ink.blob(*bubbles[second][:3], rng.uniform(prof.cov_min, 1.0))
            info.update(truth="multipla", letters=sorted([letter, second]))
        elif kind == "sujeira":
            ink.speck(cx, cy)
            info.update(truth="branco", note="poeira/ponto minúsculo")
        elif kind == "fraca":
            ink.blob(cx, cy, d, rng.uniform(0.18, 0.40), strength=rng.uniform(0.55, 0.8))
            info.update(truth="ambigua", strict=False, tolerated=["branco"], letter=letter)
        elif kind == "x":
            ink.x_mark(cx, cy, d)
            info.update(truth="ambigua", strict=False, tolerated=["branco"], letter=letter)
        elif kind == "visto":
            ink.check_mark(cx, cy, d)
            info.update(truth="ambigua", strict=False, tolerated=["branco"], letter=letter)
        elif kind == "ponto":
            ink.dot(cx, cy)
            info.update(truth="ambigua", strict=False, tolerated=["branco"], letter=letter)
        elif kind == "circulo":
            ink.ring(cx, cy, d)
            info.update(truth="ambigua", strict=False, tolerated=["branco"], letter=letter)
        elif kind == "rasurada":
            second = rng.choice(others)
            ink.blob(cx, cy, d, rng.uniform(0.8, 1.0))
            ink.blob(*bubbles[second][:3], rng.uniform(0.3, 0.55))
            info.update(truth="ambigua", strict=False, tolerated=["multipla"], letter=letter,
                        letters=sorted([letter, second]))
        out[q] = info
    for q, bubbles in tpl["questions"].items():
        out[q]["cov"] = [round(ink.coverage(*bubbles[a]), 2) for a in alts]
    return out


def random_matricula(rng: random.Random) -> list[str]:
    """Matrícula UniAtenas NN-X-NNNNN: 8 dígitos, um por coluna."""
    return [str(rng.randrange(10)) for _ in range(8)]


def matricula_string(cols: list[str | None], separators_after: list[int]) -> str | None:
    if any(c is None for c in cols):
        return None
    out = ""
    for i, c in enumerate(cols, start=1):
        out += c
        if i in separators_after:
            out += "-"
    return out


def fill_matricula(ink: Ink, tpl: dict, prof: Profile, rng: random.Random,
                   force_defect: str | None = None) -> dict | None:
    """Preenche a matrícula UniAtenas. No layout sfa não há matrícula (identificação só pelo QR)."""
    mat = tpl["matricula"]
    if mat is None:
        return None
    cols = mat["columns"]
    values = random_matricula(rng)
    defect = None
    marks: list[str | None] = list(values)
    extra: dict[int, str] = {}
    sorteou = rng.random() < prof.mat_defect_p
    if sorteou or force_defect:
        i = rng.randrange(len(cols))
        defect = force_defect or rng.choice(["coluna_dupla", "coluna_faltando"])
        if defect == "coluna_dupla":
            symbols = [b["symbol"] for b in cols[i]]
            extra[i] = rng.choice([sym for sym in symbols if sym != values[i]])
        else:
            marks[i] = None
    boxes = [c.box for c in L.build_geometry(L.LAYOUT_UNIATENAS).matricula_columns]
    for i, col in enumerate(cols):
        sym_to_c = {b["symbol"]: b["c"] for b in col}
        for sym in filter(None, [marks[i], extra.get(i)]):
            ink.blob(*sym_to_c[sym], rng.uniform(0.7, 1.0))
        if marks[i] is not None:  # dígito escrito à mão na caixa (a máquina ignora)
            bx0, by0, bx1, by1 = boxes[i]
            ink.handwriting(marks[i], bx0 + 1.0, by1 - 1.0, 3.6, max_w_mm=(bx1 - bx0) - 1.0)
    valid = defect is None
    return {
        "value": matricula_string(values, mat["separators_after"]) if valid else None,
        "intended": matricula_string(values, mat["separators_after"]),
        "status": "ok" if valid else "invalida",
        "columns": values,
        "defect": defect,
    }


# ============================================================ digitalização
def _T(tx: float, ty: float) -> np.ndarray:
    return np.array([[1, 0, tx], [0, 1, ty], [0, 0, 1]], float)


def _R(deg: float) -> np.ndarray:
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)


def _S(s: float) -> np.ndarray:
    return np.array([[s, 0, 0], [0, s, 0], [0, 0, 1]], float)


def _apply(H: np.ndarray, pts: np.ndarray) -> np.ndarray:
    p = np.c_[pts, np.ones(len(pts))] @ H.T
    return p[:, :2] / p[:, 2:3]


def scan_geometry(rng: random.Random, prof: Profile, tpl: dict) -> dict:
    flip = rng.random() < prof.flip180_p
    rot = rng.uniform(-prof.rot_deg, prof.rot_deg) + (180.0 if flip else 0.0)
    scale = rng.uniform(*prof.scale)
    shift = (rng.uniform(-prof.shift_mm, prof.shift_mm), rng.uniform(-prof.shift_mm, prof.shift_mm))
    A = _T(*CENTER) @ _S(scale) @ _R(rot) @ _T(*-CENTER)
    corners = np.array([[0, 0], [L.PAGE_W, 0], [L.PAGE_W, L.PAGE_H], [0, L.PAGE_H]], float)
    moved = _apply(A, corners)
    jitter = np.array([[rng.uniform(-prof.persp_mm, prof.persp_mm) for _ in range(2)] for _ in range(4)])
    Hp = cv2.getPerspectiveTransform(moved.astype(np.float32), (moved + jitter).astype(np.float32))
    H = _T(*shift) @ Hp.astype(float) @ A
    # cantos externos dos marcadores -> quanto falta de tela para eles ficarem dentro da imagem
    pts = []
    for name, (x, y, w) in tpl["fiducials_mm"].items():
        if name != "orient":
            pts += [[x, y], [x + w, y], [x, y + w], [x + w, y + w]]
    q = _apply(H, np.array(pts))
    pad_l = max(0.0, FID_MARGIN_MM - q[:, 0].min())
    pad_t = max(0.0, FID_MARGIN_MM - q[:, 1].min())
    pad_r = max(0.0, q[:, 0].max() + FID_MARGIN_MM - L.PAGE_W)
    pad_b = max(0.0, q[:, 1].max() + FID_MARGIN_MM - L.PAGE_H)
    H = _T(pad_l, pad_t) @ H
    return {
        "H_mm": H, "rotation_deg": round(rot - (180.0 if flip else 0.0), 3), "flip180": flip,
        "scale": round(scale, 4), "translate_mm": [round(shift[0], 3), round(shift[1], 3)],
        "perspective_mm": np.round(jitter, 3).tolist(),
        "pad_mm": [round(v, 3) for v in (pad_l, pad_t, pad_r, pad_b)],
        "canvas_mm": [round(L.PAGE_W + pad_l + pad_r, 3), round(L.PAGE_H + pad_t + pad_b, 3)],
    }


def render_page(pdf_bytes: bytes, index: int, dpi: int) -> np.ndarray:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pix = doc[index].get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).copy()


def degrade(img: np.ndarray, prof: Profile, dpi: int, rng: random.Random,
            np_rng: np.random.Generator) -> tuple[np.ndarray, dict]:
    f = img.astype(np.float32)
    h, w = f.shape[:2]
    # iluminação irregular + tom do papel
    tone = rng.uniform(0.93, 1.0)
    yy = np.linspace(-1, 1, h, dtype=np.float32)[:, None]
    xx = np.linspace(-1, 1, w, dtype=np.float32)[None, :]
    g = 1 + rng.uniform(-0.04, 0.04) * yy + rng.uniform(-0.04, 0.04) * xx
    f *= (tone * g)[..., None]
    # poeira
    k = dpi / 25.4
    for _ in range(rng.randint(*prof.specks)):
        cx, cy = rng.randrange(w), rng.randrange(h)
        r = max(1, int(rng.uniform(0.1, 0.3) * k))
        shade = rng.uniform(70, 170)
        cv2.circle(f, (cx, cy), r, (shade, shade, shade), -1, cv2.LINE_AA)
    sigma = rng.uniform(*prof.blur) * dpi / 200
    f = cv2.GaussianBlur(f, (0, 0), sigma)
    f += np_rng.normal(0, rng.uniform(*prof.noise), f.shape).astype(np.float32)
    contrast = rng.uniform(0.92, 1.05)
    f = (f - 128) * contrast + 128 + rng.uniform(-6, 6)
    return np.clip(f, 0, 255).astype(np.uint8), {
        "blur_sigma_px": round(sigma, 2), "paper_tone": round(tone, 3)}


def warp(base: np.ndarray, geo: dict, dpi: int, bg: int) -> np.ndarray:
    k = dpi / 25.4
    S = np.diag([k, k, 1.0])
    Hpx = S @ geo["H_mm"] @ np.linalg.inv(S)
    W = int(round(geo["canvas_mm"][0] * k))
    Hh = int(round(geo["canvas_mm"][1] * k))
    return cv2.warpPerspective(base, Hpx, (W, Hh), flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_CONSTANT, borderValue=(bg, bg, bg))


def jpeg_page(img_rgb: np.ndarray, gray: bool, quality: int) -> bytes:
    if gray:
        img = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    else:
        img = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    assert ok
    return buf.tobytes()


# ============================================================ conjuntos
@dataclass
class SetSpec:
    name: str
    layout: str            # sfa | uniatenas
    model: str             # personalizado | uniatenas
    profile: str
    pages: int             # cartões (sem contar as páginas em branco)
    dpi: tuple[int, ...] | None = None
    blank_after: tuple[int, ...] = ()       # índices (1-based) de cartões seguidos de uma página em branco
    defects: dict[int, str] = field(default_factory=dict)  # índice do cartão -> defeito


def fake_roster(rng: random.Random, n: int, sim_key: str) -> list[RosterEntry]:
    out = []
    for i in range(n):
        nome = f"{rng.choice(PRIMEIROS)} {rng.choice(SOBRENOMES)} {i + 1:03d}"
        out.append(RosterEntry(str(uuid.uuid5(uuid.NAMESPACE_URL, f"fixture/{sim_key}/{i}")), nome))
    return out


def build_set(spec: SetSpec, out_dir: Path, seed: int) -> dict:
    rng = random.Random(f"{seed}/{spec.name}")
    np_rng = np.random.default_rng([seed, *spec.name.encode()])
    prof = PROFILES[spec.profile]
    sim_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"fixture/simulado/{spec.name}"))
    nome_sim = "SIMULADO SINTÉTICO"
    ies = "Faculdade Exemplo" if spec.layout == L.LAYOUT_SFA else "UniAtenas"
    if spec.model == "personalizado":
        roster = fake_roster(rng, spec.pages, spec.name)
        cards = specs_personalizados(roster, sim_id, nome_sim, ies, "25/10/2026")
    else:
        cards = specs_uniatenas(spec.pages, sim_id, nome_sim, ies, "25/10/2026")
    buf = io.BytesIO()
    write_cards_pdf(buf, cards)
    card_pdf = buf.getvalue()
    tpl = build_template(spec.layout)
    dpis = spec.dpi or prof.dpis

    out_pdf = pymupdf.open()
    pages_info: list[dict] = []
    for idx, card in enumerate(cards, start=1):
        dpi = rng.choice(dpis)
        base = render_page(card_pdf, idx - 1, dpi)
        h, w = base.shape[:2]
        ink = Ink(h, w, dpi, rng)
        # nome manuscrito (genérico e UniAtenas) e matrícula
        aluno = None
        if spec.model == "uniatenas":
            aluno = f"{ascii_only(rng.choice(PRIMEIROS))} {rng.choice(SOBRENOMES)} {idx:03d}"
            ink.handwriting(aluno, L.ALUNO_LINE_X0 + 2, L.ALUNO_LINE_Y - 1.2, 6.0, max_w_mm=100)
        else:
            aluno = card.aluno_nome
        forcado = spec.defects.get(idx, "")
        mat = fill_matricula(ink, tpl, prof, rng,
                             forcado.removeprefix("matricula_") if forcado.startswith("matricula_") else None)
        answers = fill_answers(ink, tpl, prof, rng)
        qr_damaged = spec.defects.get(idx) == "qr_danificado"
        if qr_damaged:
            qx0, qy0, qx1, qy1 = tpl["qr_box_mm"]
            ink.cover_box(qx0 - 1, qy0 + 2, qx0 + 21, qy1 - 3)

        # compõe tinta na página
        pen_blue = rng.random() < 0.5
        pen = np.array([22, 38, 118] if pen_blue else [24, 24, 28], np.float32)
        alpha = cv2.GaussianBlur(ink.a, (0, 0), 0.5 * dpi / 200)
        alpha *= rng.uniform(0.9, 0.99)
        alpha *= 0.93 + 0.07 * np.random.default_rng(seed + idx).random(alpha.shape).astype(np.float32)
        comp = base.astype(np.float32) * (1 - alpha[..., None]) + pen * alpha[..., None]
        comp = np.clip(comp, 0, 255).astype(np.uint8)

        geo = scan_geometry(rng, prof, tpl)
        dark = rng.random() < prof.dark_bg_p
        bg = rng.randint(25, 60) if dark else rng.randint(238, 255)
        page_img = warp(comp, geo, dpi, bg)
        defect = spec.defects.get(idx)
        if defect and defect.startswith("matricula_"):
            defect = None  # defeito de matrícula fica registrado em `matricula.defect`
        legible = True
        if defect == "marcador_coberto":
            corner = rng.choice(["tl", "tr", "bl", "br"])
            x, y, wm = tpl["fiducials_mm"][corner]
            pts = np.array([[x - 3, y - 3], [x + wm + 3, y - 3], [x + wm + 3, y + wm + 3], [x - 3, y + wm + 3]])
            q = _apply(geo["H_mm"], pts) * dpi / 25.4
            cv2.fillPoly(page_img, [q.astype(np.int32)], (bg, bg, bg) if not dark else (250, 250, 250))
            legible = False
            defect = f"marcador_coberto:{corner}"
        page_img, deg = degrade(page_img, prof, dpi, rng, np_rng)
        lido = [r.text for r in zxingcpp.read_barcodes(cv2.cvtColor(page_img, cv2.COLOR_RGB2GRAY))]
        if qr_damaged and lido == [card.qr_payload]:
            raise RuntimeError(f"{spec.name} pág. {idx}: o QR deveria estar ilegível mas foi lido")
        gray = rng.random() >= prof.color_p
        quality = rng.randint(*prof.jpeg)
        jpg = jpeg_page(page_img, gray, quality)
        _add_image_page(out_pdf, jpg, page_img.shape[1], page_img.shape[0], dpi)
        k = dpi / 25.4
        mm_to_px = (np.diag([k, k, 1.0]) @ geo["H_mm"]).tolist()
        pages_info.append({
            "page": len(out_pdf), "kind": "cartao", "legible": legible, "defect": defect,
            "model": spec.model, "qr": card.qr_payload, "qr_legivel": not qr_damaged,
            "user_id": card.user_id or None,
            "aluno": aluno, "matricula": mat, "answers": answers,
            "scan": {
                "dpi": dpi, "size_px": [page_img.shape[1], page_img.shape[0]],
                **{k_: v for k_, v in geo.items() if k_ != "H_mm"},
                "background": "escuro" if dark else "claro", "color": "cinza" if gray else "colorida",
                "pen": "azul" if pen_blue else "preta", "jpeg_quality": quality, **deg,
                "mm_to_px": [[round(v, 6) for v in row] for row in mm_to_px],
            },
        })
        if idx in spec.blank_after:
            _blank_page(out_pdf, pages_info, prof, rng, np_rng, dpi, jpeg_q=quality)

    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = out_dir / f"{spec.name}.pdf"
    out_pdf.save(pdf_path, deflate=True, garbage=3)
    meta = {
        "generator": "tools/make_fixtures.py", "generator_version": GENERATOR_VERSION, "seed": seed,
        "file": pdf_path.name, "layout": spec.layout, "template": tpl["template_version"],
        "simulado_id": sim_id,
        "profile": spec.profile, "pages": pages_info,
    }
    (out_dir / f"{spec.name}.gabarito.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    return meta


def _add_image_page(doc: pymupdf.Document, jpg: bytes, w_px: int, h_px: int, dpi: int) -> None:
    wp, hp = w_px * 72 / dpi, h_px * 72 / dpi
    page = doc.new_page(width=wp, height=hp)
    page.insert_image(pymupdf.Rect(0, 0, wp, hp), stream=jpg)


def _blank_page(doc, pages_info, prof, rng, np_rng, dpi, jpeg_q) -> None:
    """Verso do cartão digitalizado: papel quase branco, com ruído e poeira, sem marcadores."""
    w, h = int(L.PAGE_W / 25.4 * dpi), int(L.PAGE_H / 25.4 * dpi)
    img = np.full((h, w, 3), rng.randint(238, 252), np.uint8)
    img, _ = degrade(img, prof, dpi, rng, np_rng)
    gray = rng.random() >= prof.color_p
    _add_image_page(doc, jpeg_page(img, gray, jpeg_q), w, h, dpi)
    pages_info.append({"page": len(doc), "kind": "branco", "legible": False, "defect": None,
                       "expected": "pagina_em_branco", "scan": {"dpi": dpi, "size_px": [w, h]}})


# ============================================================ conjuntos pré-definidos
def preset_referencia() -> list[SetSpec]:
    """Conjunto pequeno, versionado em tests/fixtures (alguns MB)."""
    return [
        SetSpec("sfa_personalizado_limpo", L.LAYOUT_SFA, "personalizado", "limpo", 4, dpi=(200,), blank_after=(2,)),
        SetSpec("sfa_personalizado_realista", L.LAYOUT_SFA, "personalizado", "realista", 6, blank_after=(1, 3)),
        SetSpec("sfa_dificil", L.LAYOUT_SFA, "personalizado", "dificil", 8,
                defects={6: "marcador_coberto", 7: "qr_danificado"}),
        SetSpec("uniatenas_realista", L.LAYOUT_UNIATENAS, "uniatenas", "realista", 6, blank_after=(4,),
                defects={2: "matricula_coluna_dupla", 5: "matricula_coluna_faltando"}),
    ]


def preset_completo() -> list[SetSpec]:
    """Conjunto grande (não versionar): para medir acerto com significância estatística."""
    return [
        SetSpec("sfa_personalizado_limpo", L.LAYOUT_SFA, "personalizado", "limpo", 40, blank_after=(5, 20)),
        SetSpec("sfa_personalizado_realista", L.LAYOUT_SFA, "personalizado", "realista", 60, blank_after=(7, 30)),
        SetSpec("sfa_dificil", L.LAYOUT_SFA, "personalizado", "dificil", 50,
                defects={13: "marcador_coberto", 31: "marcador_coberto", 20: "qr_danificado", 41: "qr_danificado"}),
        SetSpec("uniatenas_limpo", L.LAYOUT_UNIATENAS, "uniatenas", "limpo", 20),
        SetSpec("uniatenas_realista", L.LAYOUT_UNIATENAS, "uniatenas", "realista", 40, blank_after=(10,)),
        SetSpec("uniatenas_dificil", L.LAYOUT_UNIATENAS, "uniatenas", "dificil", 30),
    ]


def preset_estresse() -> list[SetSpec]:
    """Robustez (não versionar): condições piores que as do aceite."""
    return [
        SetSpec("estresse_sfa", L.LAYOUT_SFA, "personalizado", "estresse", 40, blank_after=(9,),
                defects={7: "qr_danificado"}),
        SetSpec("estresse_uniatenas", L.LAYOUT_UNIATENAS, "uniatenas", "estresse", 24),
    ]


PRESETS = {"referencia": preset_referencia, "completo": preset_completo, "estresse": preset_estresse}


def write_roster_csv(path: Path, n: int, seed: int) -> None:
    roster = fake_roster(random.Random(f"{seed}/roster"), n, "roster")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(["user_id", "nome"])
        for r in roster:
            wr.writerow([r.user_id, r.nome])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preset", choices=list(PRESETS), default="referencia")
    ap.add_argument("--saida", type=Path, default=FIXTURES_DIR)
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args(argv)
    total = 0
    for spec in PRESETS[args.preset]():
        meta = build_set(spec, args.saida, args.seed)
        total += len(meta["pages"])
        size = (args.saida / meta["file"]).stat().st_size / 1e6
        print(f"{spec.name}: {len(meta['pages'])} páginas, {size:.2f} MB")
    write_roster_csv(args.saida / "roster_ficticio.csv", 12, args.seed)
    print(f"total: {total} páginas em {args.saida}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
