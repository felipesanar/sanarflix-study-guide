"""Etapa 4: leitura do QR (PRD 7.2). `zxing-cpp`, primeiro no recorte retificado, depois na página."""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import cv2
import numpy as np
import zxingcpp

from ..models import QrData, parse_qr

QR_MARGIN_MM = 3.0


@dataclass
class QrRead:
    text: str | None          # texto do QR SFA2 lido (None se nada válido)
    data: QrData | None
    source: str               # de onde saiu: 'recorte', 'recorte_x2', 'pagina_retificada', 'pagina'...
    other_texts: list[str]    # QR/códigos lidos que NÃO são cartões SFA2 (para diagnóstico)


def _candidates(rect: np.ndarray | None, page: np.ndarray, template: dict, dpi: float
                ) -> Iterator[tuple[str, np.ndarray]]:
    k = dpi / 25.4
    if rect is not None:
        x0, y0, x1, y1 = template["qr_box_mm"]
        x0, y0 = max(int((x0 - QR_MARGIN_MM) * k), 0), max(int((y0 - QR_MARGIN_MM) * k), 0)
        x1, y1 = int((x1 + QR_MARGIN_MM) * k), int((y1 + QR_MARGIN_MM) * k)
        crop = rect[y0:y1, x0:x1]
        yield "recorte", crop
        yield "recorte_x2", cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        _, otsu = cv2.threshold(cv2.GaussianBlur(crop, (0, 0), 0.8), 0, 255,
                                cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        yield "recorte_binario", otsu
        yield "pagina_retificada", rect
    yield "pagina", page


def read_qr(rect: np.ndarray | None, page: np.ndarray, template: dict, dpi: float = 200) -> QrRead:
    """Lê o QR do cartão. `rect` é a página retificada (ou None se o alinhamento falhou)."""
    outros: list[str] = []
    for source, img in _candidates(rect, page, template, dpi):
        if img.size == 0:
            continue
        for r in zxingcpp.read_barcodes(img, formats=zxingcpp.BarcodeFormat.QRCode):
            data = parse_qr(r.text)
            if data is not None:
                return QrRead(r.text.strip(), data, source, outros)
            outros.append(r.text)
    return QrRead(None, None, "nenhum", outros)
