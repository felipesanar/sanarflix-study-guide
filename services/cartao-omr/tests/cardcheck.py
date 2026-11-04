"""Conferências compartilhadas: um PDF de cartão bate com o template (marcadores, bolhas, cores)?"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pymupdf


def render_gray(pdf: Path | bytes, page: int = 0, dpi: int = 200) -> np.ndarray:
    doc = pymupdf.open(stream=pdf, filetype="pdf") if isinstance(pdf, bytes) else pymupdf.open(pdf)
    pix = doc[page].get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)


def assert_marcadores_e_bolhas(img: np.ndarray, tpl: dict, dpi: int) -> None:
    """Marcadores pretos com a folga branca do PRD; toda bolha com contorno cinza e interior branco."""
    px = dpi / 25.4
    for nome, (x, y, w) in tpl["fiducials_mm"].items():
        assert img[round((y + w / 2) * px), round((x + w / 2) * px)] < 30, nome
        folga = 3.0 if nome == "orient" else 4.0
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            gx = x + w / 2 + dx * (w / 2 + folga - 1.0)
            gy = y + w / 2 + dy * (w / 2 + folga - 1.0)
            if nome == "tl" and dx == 1:
                continue  # ao lado do marcador tl está o de orientação
            if 0 <= gx <= 210 and 0 <= gy <= 297:
                assert img[round(gy * px), round(gx * px)] > 240, (nome, dx, dy)
    bubbles = [tuple(b) for q in tpl["questions"].values() for b in q.values()]
    if tpl["matricula"]:
        bubbles += [tuple(b["c"]) for col in tpl["matricula"]["columns"] for b in col]
    for cx, cy, d in bubbles:
        r = d / 2
        ring = [img[round((cy + r * math.sin(a)) * px), round((cx + r * math.cos(a)) * px)]
                for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
        assert min(ring) < 200, (cx, cy)  # contorno cinza presente
        a = math.radians(45)
        inner = img[round((cy + 0.7 * r * math.sin(a)) * px), round((cx + 0.7 * r * math.cos(a)) * px)]
        assert inner > 235, (cx, cy)  # interior branco
