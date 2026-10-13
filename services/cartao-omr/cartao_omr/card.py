"""Gerador do cartão SFA: desenha o PDF e escreve o template (fonte da verdade).

O mesmo `Geometry` (layout.py) alimenta o desenho e o JSON, então PDF e template
não podem divergir. Só preto e tons de cinza; nenhum fundo, logo ou textura.
"""
from __future__ import annotations

import io
import json
import re
from collections.abc import Iterable
from pathlib import Path

import segno
from reportlab.lib.colors import Color
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas

from . import layout as L
from .models import (
    MODEL_GENERICO,
    MODEL_PERSONALIZADO,
    MODEL_UNIATENAS,
    CardSpec,
    RosterEntry,
)

BLACK = Color(0, 0, 0)
WHITE = Color(1, 1, 1)


def _gray(v: int) -> Color:
    return Color(v / 255, v / 255, v / 255)


# =============================================================== template
def qr_info(payload: str) -> dict:
    """Versão, nº de módulos e tamanho do módulo (mm) de um QR dentro da caixa."""
    qr = segno.make(payload, error=L.QR_ERROR, micro=False, boost_error=False)
    modules = qr.symbol_size(border=0)[0]
    box_w = L.QR_BOX[2] - L.QR_BOX[0]
    return {
        "version": qr.version,
        "modules": modules,
        "module_mm": round(box_w / (modules + 2 * L.QR_QUIET_MODULES), 4),
    }


# Pior caso previsto: simulado_id e user_id em UUID (36 caracteres cada).
_UUID_EXEMPLO = "00000000-0000-4000-8000-000000000000"


def build_template(layout: str, n_matricula_cols: int | None = None) -> dict:
    geo = L.build_geometry(layout, n_matricula_cols)
    fid = {k: [L._r(x), L._r(y), L._r(w)] for k, (x, y, w) in geo.fiducials.items()}
    questions = {
        str(q): {alt: b.as_list() for alt, b in alts.items()}
        for q, alts in geo.questions.items()
    }
    columns = [
        [{"symbol": b.symbol, "c": b.as_list()} for b in col.bubbles]
        for col in geo.matricula_columns
    ]
    worst = CardSpec(
        model=MODEL_PERSONALIZADO if layout == L.LAYOUT_SFA else MODEL_UNIATENAS,
        simulado_id=_UUID_EXEMPLO,
        user_id=_UUID_EXEMPLO,
    )
    return {
        "template_version": L.TEMPLATE_VERSION[layout],
        "layout": layout,
        "conventions": {
            "units": "mm",
            "origin": "canto superior esquerdo da página; x para a direita, y para baixo",
            "fiducials_mm": "[x, y, w]: x e y são o canto superior esquerdo do quadrado preto; w é o lado",
            "bubbles": "[cx, cy, d]: centro e diâmetro",
            "boxes": "[x0, y0, x1, y1]",
        },
        "page_mm": [L.PAGE_W, L.PAGE_H],
        "useful_area_mm": list(L.USEFUL),
        "fiducials_mm": fid,
        "qr_box_mm": list(L.QR_BOX),
        "qr": {
            "error_level": L.QR_ERROR.upper(),
            "quiet_modules": L.QR_QUIET_MODULES,
            "worst_case": qr_info(worst.qr_payload),
        },
        "alternatives": list(L.ALTERNATIVES),
        "questions": questions,
        "matricula": {
            "format": "digits" if layout == L.LAYOUT_SFA else "uniatenas",
            "n_columns": geo.n_matricula_cols,
            "columns": columns,
            "separators_after": list(geo.matricula_separators_after),
        },
        "crops_mm": {
            "nome": list(L.ALUNO_BOX[:3]) + [L.ALUNO_BOX[3] + 1.0],
            "matricula": list(L.MATRICULA_FRAME),
        },
        "blocks_mm": {
            "titulo": list(L.TITLE_BOX),
            "aluno": list(L.ALUNO_BOX),
            "matricula": list(L.MATRICULA_FRAME),
            "instrucoes": list(L.INSTRUCOES_FRAME),
            "grade": [L.GRID_X0, L.GRID_FIRST_CY - L.GRID_ROW_PITCH / 2,
                      L.GRID_X0 + L.GRID_COLUMNS * L.GRID_COL_W,
                      L.GRID_FIRST_CY + (L.GRID_ROWS - 0.5) * L.GRID_ROW_PITCH],
        },
    }


def template_json(template: dict) -> str:
    """JSON legível: arrays numéricos e bolhas em uma linha cada."""
    text = json.dumps(template, indent=2, ensure_ascii=False)
    text = re.sub(
        r"\[\s*(-?\d[^\[\]{}\"]*?)\s*\]",
        lambda m: "[" + re.sub(r"\s+", " ", m.group(1)) + "]",
        text,
    )
    text = re.sub(
        r'\{\s*"symbol": "(.)",\s*"c": (\[[^\]]*\])\s*\}',
        r'{"symbol": "\1", "c": \2}',
        text,
    )
    return text + "\n"


def write_template(layout: str, path: Path, n_matricula_cols: int | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(template_json(build_template(layout, n_matricula_cols)), encoding="utf-8")
    return path


# =============================================================== desenho
class _Page:
    """Canvas com coordenadas em mm, origem no topo-esquerdo."""

    def __init__(self, canvas: Canvas):
        self.c = canvas

    def x(self, v: float) -> float:
        return v * mm

    def y(self, v: float) -> float:
        return (L.PAGE_H - v) * mm

    def rect(self, x0, y0, x1, y1, *, fill=None, stroke=None, width_pt=0.5):
        c = self.c
        if fill is not None:
            c.setFillColor(fill)
        if stroke is not None:
            c.setStrokeColor(stroke)
            c.setLineWidth(width_pt)
        c.rect(self.x(x0), self.y(y1), (x1 - x0) * mm, (y1 - y0) * mm,
               stroke=int(stroke is not None), fill=int(fill is not None))

    def circle(self, cx, cy, d, *, fill=None, stroke=None, width_pt=0.5):
        c = self.c
        if fill is not None:
            c.setFillColor(fill)
        if stroke is not None:
            c.setStrokeColor(stroke)
            c.setLineWidth(width_pt)
        c.circle(self.x(cx), self.y(cy), d / 2 * mm,
                 stroke=int(stroke is not None), fill=int(fill is not None))

    def line(self, x0, y0, x1, y1, *, color=BLACK, width_pt=0.5):
        c = self.c
        c.setStrokeColor(color)
        c.setLineWidth(width_pt)
        c.line(self.x(x0), self.y(y0), self.x(x1), self.y(y1))

    def poly(self, pts, *, color=BLACK, width_pt=0.8):
        c = self.c
        c.setStrokeColor(color)
        c.setLineWidth(width_pt)
        c.setLineCap(1)
        c.setLineJoin(1)
        p = c.beginPath()
        p.moveTo(self.x(pts[0][0]), self.y(pts[0][1]))
        for px, py in pts[1:]:
            p.lineTo(self.x(px), self.y(py))
        c.drawPath(p, stroke=1, fill=0)

    def text(self, x, baseline, s, *, font="Helvetica", size=8.0, color=BLACK, align="left"):
        c = self.c
        c.setFillColor(color)
        c.setFont(font, size)
        if align == "left":
            c.drawString(self.x(x), self.y(baseline), s)
        elif align == "right":
            c.drawRightString(self.x(x), self.y(baseline), s)
        else:
            c.drawCentredString(self.x(x), self.y(baseline), s)


def _baseline_offset(size_pt: float) -> float:
    """mm da linha de base abaixo do centro visual de um texto de capitulares."""
    return size_pt * 0.3528 * 0.36


def _fit(s: str, font: str, size: float, max_w_mm: float, min_size: float) -> tuple[str, float]:
    """Reduz o corpo até caber; se ainda não couber, corta com reticências."""
    while size > min_size and stringWidth(s, font, size) > max_w_mm * mm:
        size -= 0.25
    if stringWidth(s, font, size) <= max_w_mm * mm:
        return s, size
    while len(s) > 1 and stringWidth(s + "…", font, size) > max_w_mm * mm:
        s = s[:-1]
    return s.rstrip() + "…", size


def _draw_bubble(p: _Page, cx: float, cy: float, d: float, letter: str) -> None:
    p.circle(cx, cy, d, fill=WHITE, stroke=_gray(L.BUBBLE_STROKE_GRAY), width_pt=L.BUBBLE_STROKE_PT)
    p.text(cx, cy + _baseline_offset(L.BUBBLE_LETTER_PT), letter, size=L.BUBBLE_LETTER_PT,
           color=_gray(L.BUBBLE_LETTER_GRAY), align="center")


def _draw_fiducials(p: _Page, geo: L.Geometry) -> None:
    for x, y, w in geo.fiducials.values():
        p.rect(x, y, x + w, y + w, fill=BLACK)


def _draw_header(p: _Page, spec: CardSpec) -> None:
    title = "CARTÃO-RESPOSTA" + (f" — {spec.nome_simulado}" if spec.nome_simulado else "")
    title, size = _fit(title, "Helvetica-Bold", 13.0, L.TITLE_BOX[2] - L.TITLE_BOX[0], 8.0)
    p.text(L.TITLE_BOX[0], 24.6, title, font="Helvetica-Bold", size=size)
    parts = []
    if spec.ies:
        parts.append(f"Instituição: {spec.ies}")
    if spec.data:
        parts.append(f"Data: {spec.data}")
    if parts:
        sub, sub_size = _fit("  •  ".join(parts), "Helvetica", 8.5, L.TITLE_BOX[2] - L.TITLE_BOX[0], 6.5)
        p.text(L.TITLE_BOX[0], 28.0, sub, size=sub_size, color=_gray(0x33))

    p.text(L.ALUNO_LABEL_X, 37.6, "ALUNO:", font="Helvetica-Bold", size=11)
    p.line(L.ALUNO_LINE_X0, L.ALUNO_LINE_Y, L.ALUNO_BOX[2], L.ALUNO_LINE_Y, width_pt=0.5)
    if spec.model == MODEL_PERSONALIZADO and spec.aluno_nome:
        nome, nsize = _fit(spec.aluno_nome, "Helvetica", 10.5, L.ALUNO_BOX[2] - L.ALUNO_LINE_X0 - 2, 7.0)
        p.text(L.ALUNO_LINE_X0 + 1.5, 37.8, nome, size=nsize)


def _draw_qr(p: _Page, spec: CardSpec) -> None:
    qr = segno.make(spec.qr_payload, error=L.QR_ERROR, micro=False, boost_error=False)
    modules = qr.symbol_size(border=0)[0]
    mod = (L.QR_BOX[2] - L.QR_BOX[0]) / (modules + 2 * L.QR_QUIET_MODULES)
    ox = L.QR_BOX[0] + L.QR_QUIET_MODULES * mod
    oy = L.QR_BOX[1] + L.QR_QUIET_MODULES * mod
    for r, row in enumerate(qr.matrix):
        c = 0
        while c < modules:
            if row[c]:
                start = c
                while c < modules and row[c]:
                    c += 1
                p.rect(ox + start * mod, oy + r * mod, ox + c * mod, oy + (r + 1) * mod, fill=BLACK)
            else:
                c += 1
    if spec.label:
        p.text((L.QR_BOX[0] + L.QR_BOX[2]) / 2, L.QR_LABEL_Y, spec.label, size=6.0,
               color=_gray(0x40), align="center")


def _draw_matricula(p: _Page, geo: L.Geometry) -> None:
    f = L.MATRICULA_FRAME
    p.rect(*f, stroke=_gray(L.BUBBLE_STROKE_GRAY), width_pt=0.5)
    p.text(f[0] + 3, L.MAT_TITLE_BASELINE, "MATRÍCULA", font="Helvetica-Bold", size=10)
    for col in geo.matricula_columns:
        p.rect(*col.box, fill=WHITE, stroke=_gray(L.BUBBLE_STROKE_GRAY), width_pt=0.5)
        for b in col.bubbles:
            _draw_bubble(p, b.cx, b.cy, b.d, b.symbol)
    for sx, sy in geo.matricula_separators:
        p.line(sx - 1.2, sy, sx + 1.2, sy, width_pt=1.1)


def _example_bubble(p: _Page, cx: float, cy: float, d: float = 4.8) -> None:
    p.circle(cx, cy, d, fill=WHITE, stroke=_gray(L.BUBBLE_STROKE_GRAY), width_pt=L.BUBBLE_STROKE_PT)


def _draw_instrucoes(p: _Page) -> None:
    from reportlab.lib.utils import simpleSplit

    f = L.INSTRUCOES_FRAME
    p.rect(*f, stroke=_gray(L.BUBBLE_STROKE_GRAY), width_pt=0.5)
    p.text(f[0] + 3, L.MAT_TITLE_BASELINE, "INSTRUÇÕES", font="Helvetica-Bold", size=10)
    bullets = [
        "Use caneta esferográfica preta ou azul-escura.",
        "Preencha a bolha por completo.",
        "Não rasure, não dobre, não escreva fora dos campos.",
    ]
    y = 54.6
    for text in bullets:
        lines = simpleSplit(text, "Helvetica", 7.0, (f[2] - f[0] - 8.0) * mm)
        p.text(f[0] + 3, y, "•", size=7.0)
        for ln in lines:
            p.text(f[0] + 6, y, ln, size=7.0)
            y += 3.4
        y += 1.8
    # exemplos
    row_correct, row_wrong, row_two = 82.0, 92.0, 101.0
    xs = [124.5, 131.0, 137.5, 144.0]
    p.text(f[0] + 3, row_correct + 1.0, "CORRETO:", font="Helvetica-Bold", size=7.5)
    p.circle(xs[0], row_correct, 4.8, fill=BLACK)
    p.text(f[0] + 3, row_wrong + 1.0, "INCORRETO:", font="Helvetica-Bold", size=7.5)
    # X
    _example_bubble(p, xs[0], row_wrong)
    p.line(xs[0] - 1.4, row_wrong - 1.4, xs[0] + 1.4, row_wrong + 1.4, width_pt=0.8)
    p.line(xs[0] - 1.4, row_wrong + 1.4, xs[0] + 1.4, row_wrong - 1.4, width_pt=0.8)
    # ✓
    _example_bubble(p, xs[1], row_wrong)
    p.poly([(xs[1] - 1.5, row_wrong + 0.1), (xs[1] - 0.4, row_wrong + 1.3), (xs[1] + 1.6, row_wrong - 1.5)])
    # ponto
    _example_bubble(p, xs[2], row_wrong)
    p.circle(xs[2], row_wrong, 1.1, fill=BLACK)
    # círculo vazado
    p.circle(xs[3], row_wrong, 5.0, stroke=BLACK, width_pt=1.6)
    # duas bolhas
    p.text(f[0] + 3, row_two + 1.0, "Duas bolhas:", size=6.5, color=_gray(0x33))
    p.circle(xs[0], row_two, 4.8, fill=BLACK)
    p.circle(xs[0] + 6.0, row_two, 4.8, fill=BLACK)


def _draw_grid(p: _Page, geo: L.Geometry) -> None:
    for q, alts in geo.questions.items():
        ax, ay = geo.number_anchors[q]
        p.text(ax, ay + _baseline_offset(L.NUMBER_PT), str(q), font="Helvetica-Bold",
               size=L.NUMBER_PT, align="right")
        for b in alts.values():
            _draw_bubble(p, b.cx, b.cy, b.d, b.symbol)


def _draw_footer(p: _Page) -> None:
    p.text(L.PAGE_W / 2, L.FOOTER_Y + 0.7, L.FOOTER_TEXT, size=6.0,
           color=_gray(L.BUBBLE_STROKE_GRAY), align="center")


def draw_card(canvas: Canvas, geo: L.Geometry, spec: CardSpec) -> None:
    if spec.layout != geo.layout:
        raise ValueError(f"cartão {spec.model} não combina com o layout {geo.layout}")
    p = _Page(canvas)
    _draw_fiducials(p, geo)
    _draw_header(p, spec)
    _draw_qr(p, spec)
    _draw_matricula(p, geo)
    _draw_instrucoes(p)
    _draw_grid(p, geo)
    _draw_footer(p)


def write_cards_pdf(
    dest: Path | io.BufferedIOBase,
    specs: Iterable[CardSpec],
    n_matricula_cols: int | None = None,
    title: str = "Cartões-resposta SFA",
) -> int:
    """Escreve um PDF A4 com uma página por cartão. Devolve o nº de páginas."""
    specs = list(specs)
    if not specs:
        raise ValueError("nenhum cartão para gerar")
    layouts = {s.layout for s in specs}
    if len(layouts) != 1:
        raise ValueError("todos os cartões de um PDF precisam ter o mesmo layout")
    geo = L.build_geometry(layouts.pop(), n_matricula_cols)
    target = str(dest) if isinstance(dest, Path) else dest
    c = Canvas(target, pagesize=(L.PAGE_W * mm, L.PAGE_H * mm), invariant=1, pageCompression=1)
    c.setTitle(title)
    c.setAuthor("SanarFlix Academy")
    c.setCreator("cartao-omr")
    for spec in specs:
        draw_card(c, geo, spec)
        c.showPage()
    c.save()
    return len(specs)


# =============================================================== conjuntos de cartões
def specs_personalizados(
    roster: Iterable[RosterEntry],
    simulado_id: str,
    nome_simulado: str = "",
    ies: str = "",
    data: str = "",
) -> list[CardSpec]:
    return [
        CardSpec(
            model=MODEL_PERSONALIZADO,
            simulado_id=simulado_id,
            nome_simulado=nome_simulado,
            ies=r.ies or ies,
            data=data,
            aluno_nome=r.nome,
            user_id=r.user_id,
            label=r.user_id[:8],
        )
        for r in roster
    ]


def specs_genericos(
    quantidade: int, simulado_id: str, nome_simulado: str = "", ies: str = "", data: str = ""
) -> list[CardSpec]:
    return [
        CardSpec(model=MODEL_GENERICO, simulado_id=simulado_id, nome_simulado=nome_simulado,
                 ies=ies, data=data, label=f"G-{i:04d}")
        for i in range(1, quantidade + 1)
    ]


def specs_uniatenas(
    copias: int, simulado_id: str, nome_simulado: str = "", ies: str = "UniAtenas", data: str = ""
) -> list[CardSpec]:
    return [
        CardSpec(model=MODEL_UNIATENAS, simulado_id=simulado_id, nome_simulado=nome_simulado,
                 ies=ies, data=data, label="UNIATENAS")
        for _ in range(copias)
    ]


def build_example_pdf(layout: str, dest: Path, n_matricula_cols: int | None = None) -> int:
    """PDF de exemplo (dados fictícios) usado na conferência visual."""
    sim = "00000000-0000-4000-8000-0000000000aa"
    nome = "SIMULADO ENAMED 2026"
    if layout == L.LAYOUT_SFA:
        specs = specs_personalizados(
            [RosterEntry("7f3a9c21-0000-4000-8000-000000000001", "Maria Exemplo da Silva")],
            sim, nome, "Faculdade Exemplo", "25/10/2026",
        ) + specs_genericos(1, sim, nome, "Faculdade Exemplo", "25/10/2026")
    else:
        specs = specs_uniatenas(1, sim, nome, "UniAtenas", "25/10/2026")
    return write_cards_pdf(dest, specs, n_matricula_cols, title=f"Exemplo — cartão {layout}")
