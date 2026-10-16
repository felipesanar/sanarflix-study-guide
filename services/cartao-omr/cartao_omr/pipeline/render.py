"""Etapa 1: a página do PDF vira imagem em tons de cinza (PRD 7.2, passo 1)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pymupdf

from ..config import DEFAULT_CONFIG, ReadConfig


def open_pdf(path: Path | str | bytes) -> pymupdf.Document:
    if isinstance(path, bytes):
        return pymupdf.open(stream=path, filetype="pdf")
    return pymupdf.open(path)


def render_page(doc: pymupdf.Document, index: int, dpi: int | None = None,
                cfg: ReadConfig = DEFAULT_CONFIG) -> np.ndarray:
    """Renderiza a página `index` (0-based) em cinza, `uint8`, na resolução `dpi` (padrão 200)."""
    pix = doc[index].get_pixmap(dpi=dpi or cfg.render_dpi, colorspace=pymupdf.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()


def is_blank(gray: np.ndarray, cfg: ReadConfig = DEFAULT_CONFIG) -> bool:
    """Página quase toda branca: pouquíssimos pixels escuros na região central e fundo claro.

    Só vale se não houver marcadores; quem chama decide a ordem (um cartão sem marcas tem texto
    e fiduciais, então passa folgado do limite).
    """
    h, w = gray.shape
    centro = gray[h // 10: h - h // 10, w // 10: w - w // 10]
    if centro.size == 0:
        return True
    return float((centro < 110).mean()) < cfg.blank_dark_fraction and float(np.median(centro)) > 170
