"""Leitura de uma página inteira: render -> alinhamento -> QR -> OMR (PRD 7.2). Sem banco, sem I/O."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np

from ..config import DEFAULT_CONFIG, TEMPLATES_DIR, ReadConfig
from ..layout import LAYOUT_SFA, LAYOUT_UNIATENAS, TEMPLATE_VERSION
from . import omr
from .align import Alignment, AlignError, align_page, rectify
from .qr import QrRead, read_qr
from .render import is_blank

# status da página
OK = "ok"
EM_BRANCO = "pagina_em_branco"
ILEGIVEL = "pagina_ilegivel"


@lru_cache(maxsize=None)
def load_template(layout: str) -> dict:
    path = TEMPLATES_DIR / f"{TEMPLATE_VERSION[layout]}.json"
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass
class PageResult:
    status: str                                   # ok | pagina_em_branco | pagina_ilegivel
    reason: str = ""
    layout: str | None = None                     # sfa | uniatenas | None (QR ilegível e sem dica)
    qr: QrRead | None = None
    qr_ilegivel: bool = False
    alignment: Alignment | None = None
    answers: dict[int, omr.Cell] = field(default_factory=dict)
    matricula: omr.MatriculaRead | None = None
    rect: np.ndarray | None = None                # página retificada (só com keep_rect=True), para os recortes

    @property
    def matricula_qr(self) -> str | None:
        """Matrícula impressa no QR do cartão pessoal (None no UniAtenas ou se o QR não foi lido)."""
        return self.qr.data.matricula if self.qr and self.qr.data else None

    @property
    def identificacao(self) -> str | None:
        """Chave do aluno para a planilha: matrícula do QR (sfa) ou das bolhas (UniAtenas, se válida)."""
        if self.layout == LAYOUT_UNIATENAS:
            return self.matricula.value if self.matricula and self.matricula.valid else None
        return self.matricula_qr


def read_page(gray: np.ndarray, cfg: ReadConfig = DEFAULT_CONFIG, layout_hint: str | None = None,
              dpi: int | None = None, keep_rect: bool = False) -> PageResult:
    """Lê uma página já renderizada em cinza (200 dpi por padrão)."""
    d = dpi or cfg.render_dpi
    # o alinhamento usa só os marcadores, iguais nos dois layouts
    base_tpl = load_template(LAYOUT_SFA)
    try:
        al = align_page(gray, base_tpl, cfg, d)
    except AlignError as exc:
        if is_blank(gray, cfg):
            return PageResult(EM_BRANCO, "página quase toda branca e sem marcadores")
        qr = read_qr(None, gray, base_tpl, d)  # ajuda no diagnóstico: de qual cartão era
        return PageResult(ILEGIVEL, exc.reason, layout=qr.data.layout if qr.data else layout_hint, qr=qr,
                          qr_ilegivel=qr.data is None)
    rect = rectify(gray, al, base_tpl, cfg, d)
    qr = read_qr(rect, gray, base_tpl, d)
    layout = qr.data.layout if qr.data else layout_hint
    res = PageResult(OK, layout=layout, qr=qr, qr_ilegivel=qr.data is None, alignment=al,
                     rect=rect if keep_rect else None)
    flat = omr.flatten(rect, d)
    res.answers = omr.read_answers(rect, base_tpl, d, cfg, flat)  # a grade é igual nos dois layouts
    if layout == LAYOUT_UNIATENAS:
        res.matricula = omr.read_matricula(rect, load_template(LAYOUT_UNIATENAS), d, cfg, flat)
    return res
