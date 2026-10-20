"""Gerador do cartão SFA: monta o template (fonte da verdade) e desenha o PDF a partir dele.

`layout.py` guarda as medidas; `drawlist.py` as transforma na lista de desenho (`draw`) que vai dentro
do template. Este módulo escreve o template e **interpreta essa mesma lista** para gerar o PDF (o
Academy faz o mesmo em TypeScript), então PDF e template não podem divergir.
Só preto e tons de cinza; nenhum fundo, logo ou textura.
"""
from __future__ import annotations

import io
import json
import re
from collections.abc import Iterable
from pathlib import Path

import segno
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas

from . import layout as L
from .drawlist import DRAW_VERSION, build_draw
from .models import MODEL_PERSONALIZADO, MODEL_UNIATENAS, CardSpec, RosterEntry, normalize_matricula


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


# Pior caso previsto: simulado_id em UUID e matrícula de 24 caracteres.
_UUID_EXEMPLO = "ffffffff-ffff-4fff-bfff-ffffffffffff"
_MATRICULA_EXEMPLO = "A" * 24


PAYLOAD_FORMAT = {
    L.LAYOUT_SFA: "SFA2:M:<SIM8>:<MATRICULA>; maiúsculas, matrícula [A-Z0-9./-] de 1 a 24 caracteres",
    L.LAYOUT_UNIATENAS: "SFA2:A:<SIM8>; maiúsculas, hex sem hífens",
}


def build_template(layout: str) -> dict:
    geo = L.build_geometry(layout)
    fid = {k: [L._r(x), L._r(y), L._r(w)] for k, (x, y, w) in geo.fiducials.items()}
    questions = {
        str(q): {alt: b.as_list() for alt, b in alts.items()}
        for q, alts in geo.questions.items()
    }
    columns = [
        [{"symbol": b.symbol, "c": b.as_list()} for b in col.bubbles]
        for col in geo.matricula_columns
    ]
    tem_matricula = layout == L.LAYOUT_UNIATENAS
    worst = CardSpec(
        model=MODEL_PERSONALIZADO if layout == L.LAYOUT_SFA else MODEL_UNIATENAS,
        simulado_id=_UUID_EXEMPLO,
        matricula=_MATRICULA_EXEMPLO,
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
            "draw": "lista de desenho do cartão (ver cartao_omr/drawlist.py); leitor e emissor só a interpretam",
        },
        "page_mm": [L.PAGE_W, L.PAGE_H],
        "useful_area_mm": list(L.USEFUL),
        "fiducials_mm": fid,
        "qr_box_mm": list(L.QR_BOX),
        "qr": {
            "error_level": L.QR_ERROR.upper(),
            "quiet_modules": L.QR_QUIET_MODULES,
            "payload_format": PAYLOAD_FORMAT[layout],
            "example": worst.qr_payload,
            "worst_case": qr_info(worst.qr_payload),
        },
        "alternatives": list(L.ALTERNATIVES),
        "questions": questions,
        # Só o UniAtenas tem matrícula em bolhas; no sfa a identificação é só pelo QR.
        "matricula": {
            "format": "uniatenas",
            "n_columns": len(columns),
            "columns": columns,
            "separators_after": list(geo.matricula_separators_after),
        } if tem_matricula else None,
        "crops_mm": {
            "nome": list(L.ALUNO_BOX[:3]) + [L.ALUNO_BOX[3] + 1.0],
            **({"matricula": list(L.MATRICULA_FRAME)} if tem_matricula
               else {"matricula_impressa": list(L.PESSOAL_MATRICULA_CROP)}),
        },
        "blocks_mm": {
            "titulo": list(L.TITLE_BOX),
            "aluno": list(L.ALUNO_BOX),
            ("matricula" if tem_matricula else "pessoal"): list(L.MATRICULA_FRAME),
            "instrucoes": list(L.INSTRUCOES_FRAME),
            "grade": [L.GRID_X0, L.GRID_FIRST_CY - L.GRID_ROW_PITCH / 2,
                      L.GRID_X0 + L.GRID_COLUMNS * L.GRID_COL_W,
                      L.GRID_FIRST_CY + (L.GRID_ROWS - 0.5) * L.GRID_ROW_PITCH],
        },
        "draw_version": DRAW_VERSION[layout],
        "draw": build_draw(layout),
    }


_DRAW_MARK = "__DRAW__"


def template_json(template: dict) -> str:
    """JSON legível: arrays numéricos e bolhas em uma linha cada, uma operação de desenho por linha."""
    draw = template.get("draw")
    base = {**template, "draw": _DRAW_MARK} if draw is not None else template
    text = json.dumps(base, indent=2, ensure_ascii=False)
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
    if draw is not None:
        linhas = ",\n".join("    " + json.dumps(op, ensure_ascii=False) for op in draw)
        text = text.replace(f'"{_DRAW_MARK}"', "[\n" + linhas + "\n  ]")
    return text + "\n"


def write_template(layout: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(template_json(build_template(layout)), encoding="utf-8")
    return path


# =============================================================== desenho (interpretador reportlab)
def _color(hex_: str) -> Color:
    return HexColor(hex_)


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
            c.setFillColor(_color(fill))
        if stroke is not None:
            c.setStrokeColor(_color(stroke))
            c.setLineWidth(width_pt)
        c.rect(self.x(x0), self.y(y1), (x1 - x0) * mm, (y1 - y0) * mm,
               stroke=int(stroke is not None), fill=int(fill is not None))

    def circle(self, cx, cy, d, *, fill=None, stroke=None, width_pt=0.5):
        c = self.c
        if fill is not None:
            c.setFillColor(_color(fill))
        if stroke is not None:
            c.setStrokeColor(_color(stroke))
            c.setLineWidth(width_pt)
        c.circle(self.x(cx), self.y(cy), d / 2 * mm,
                 stroke=int(stroke is not None), fill=int(fill is not None))

    def line(self, x0, y0, x1, y1, *, color="#000000", width_pt=0.5):
        c = self.c
        c.setStrokeColor(_color(color))
        c.setLineWidth(width_pt)
        c.line(self.x(x0), self.y(y0), self.x(x1), self.y(y1))

    def poly(self, pts, *, color="#000000", width_pt=0.8):
        c = self.c
        c.setStrokeColor(_color(color))
        c.setLineWidth(width_pt)
        c.setLineCap(1)
        c.setLineJoin(1)
        p = c.beginPath()
        p.moveTo(self.x(pts[0][0]), self.y(pts[0][1]))
        for px, py in pts[1:]:
            p.lineTo(self.x(px), self.y(py))
        c.drawPath(p, stroke=1, fill=0)

    def text(self, x, baseline, s, *, font="Helvetica", size=8.0, color="#000000", align="left"):
        c = self.c
        c.setFillColor(_color(color))
        c.setFont(font, size)
        if align == "left":
            c.drawString(self.x(x), self.y(baseline), s)
        elif align == "right":
            c.drawRightString(self.x(x), self.y(baseline), s)
        else:
            c.drawCentredString(self.x(x), self.y(baseline), s)


def fit_text(s: str, font: str, size: float, max_w_mm: float, min_size: float) -> tuple[str, float]:
    """Reduz o corpo (0,25 pt por vez) até caber; se ainda não couber, corta com reticências."""
    while size > min_size and stringWidth(s, font, size) > max_w_mm * mm:
        size -= 0.25
    if stringWidth(s, font, size) <= max_w_mm * mm:
        return s, size
    while len(s) > 1 and stringWidth(s + "…", font, size) > max_w_mm * mm:
        s = s[:-1]
    return s.rstrip() + "…", size


def slot_values(spec: CardSpec) -> dict[str, str]:
    """Textos variáveis do cartão. Slot vazio não é desenhado."""
    titulo = "CARTÃO-RESPOSTA" + (f" — {spec.nome_simulado}" if spec.nome_simulado else "")
    partes = []
    if spec.ies:
        partes.append(f"Instituição: {spec.ies}")
    if spec.data:
        partes.append(f"Data: {spec.data}")
    return {
        "titulo": titulo,
        "subtitulo": "  •  ".join(partes),
        "aluno": spec.aluno_nome if spec.model == MODEL_PERSONALIZADO else "",
        "matricula": spec.matricula_normalizada if spec.model == MODEL_PERSONALIZADO else "",
        "label": spec.label,
    }


def _draw_qr(p: _Page, op: dict, payload: str) -> None:
    qr = segno.make(payload, error=op["ec"].lower(), micro=False, boost_error=False)
    modules = qr.symbol_size(border=0)[0]
    x0, y0, x1, _ = op["box"]
    mod = (x1 - x0) / (modules + 2 * op["quiet"])
    ox, oy = x0 + op["quiet"] * mod, y0 + op["quiet"] * mod
    for r, row in enumerate(qr.matrix):
        c = 0
        while c < modules:
            if row[c]:
                start = c
                while c < modules and row[c]:
                    c += 1
                p.rect(ox + start * mod, oy + r * mod, ox + c * mod, oy + (r + 1) * mod, fill=op["color"])
            else:
                c += 1


def _draw_bubbles(p: _Page, op: dict, template: dict) -> None:
    def one(cx: float, cy: float, d: float, letter: str) -> None:
        p.circle(cx, cy, d, fill=op["fill"], stroke=op["stroke"], width_pt=op["lw"])
        p.text(cx, cy + op["letter_dy"], letter, size=op["letter_size"], color=op["letter_color"], align="center")

    alts = template["alternatives"]
    for q in sorted(template["questions"], key=int):
        for a in alts:
            cx, cy, d = template["questions"][q][a]
            one(cx, cy, d, a)
    mat = template.get("matricula")
    if mat:
        for col in mat["columns"]:
            for b in col:
                cx, cy, d = b["c"]
                one(cx, cy, d, b["symbol"])


def draw_card(canvas: Canvas, template: dict, spec: CardSpec) -> None:
    """Desenha um cartão interpretando `template["draw"]`."""
    if spec.layout != template["layout"]:
        raise ValueError(f"cartão {spec.model} não combina com o layout {template['layout']}")
    p = _Page(canvas)
    slots = slot_values(spec)
    for op in template["draw"]:
        kind = op["op"]
        if kind == "rect":
            p.rect(op["x0"], op["y0"], op["x1"], op["y1"], fill=op.get("fill"), stroke=op.get("stroke"),
                   width_pt=op.get("lw", 0.5))
        elif kind == "circle":
            p.circle(op["cx"], op["cy"], op["d"], fill=op.get("fill"), stroke=op.get("stroke"),
                     width_pt=op.get("lw", 0.5))
        elif kind == "line":
            p.line(op["x0"], op["y0"], op["x1"], op["y1"], color=op["color"], width_pt=op["lw"])
        elif kind == "poly":
            p.poly(op["pts"], color=op["color"], width_pt=op["lw"])
        elif kind == "text":
            s, size = op.get("s"), op["size"]
            if "slot" in op:
                s = slots[op["slot"]]
                if not s:
                    continue
                if "max_w" in op:
                    s, size = fit_text(s, op["font"], size, op["max_w"], op["min_size"])
            p.text(op["x"], op["y"], s, font=op["font"], size=size, color=op["color"],
                   align=op.get("align", "left"))
        elif kind == "numbers":
            for q, x, y in op["items"]:
                p.text(x, y, str(q), font=op["font"], size=op["size"], color=op["color"], align="right")
        elif kind == "bubbles":
            _draw_bubbles(p, op, template)
        elif kind == "qr":
            _draw_qr(p, op, spec.qr_payload)
        else:
            raise ValueError(f"operação de desenho desconhecida: {kind!r}")


def write_cards_pdf(
    dest: Path | io.BufferedIOBase,
    specs: Iterable[CardSpec],
    title: str = "Cartões-resposta SFA",
) -> int:
    """Escreve um PDF A4 com uma página por cartão. Devolve o nº de páginas."""
    specs = list(specs)
    if not specs:
        raise ValueError("nenhum cartão para gerar")
    layouts = {s.layout for s in specs}
    if len(layouts) != 1:
        raise ValueError("todos os cartões de um PDF precisam ter o mesmo layout")
    template = build_template(layouts.pop())
    target = str(dest) if isinstance(dest, Path) else dest
    c = Canvas(target, pagesize=(L.PAGE_W * mm, L.PAGE_H * mm), invariant=1, pageCompression=1)
    c.setTitle(title)
    c.setAuthor("SanarFlix Academy")
    c.setCreator("cartao-omr")
    for spec in specs:
        draw_card(c, template, spec)
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
            matricula=normalize_matricula(r.matricula),
            label=normalize_matricula(r.matricula),
        )
        for r in roster
    ]


def specs_uniatenas(
    copias: int, simulado_id: str, nome_simulado: str = "", ies: str = "UniAtenas", data: str = ""
) -> list[CardSpec]:
    return [
        CardSpec(model=MODEL_UNIATENAS, simulado_id=simulado_id, nome_simulado=nome_simulado,
                 ies=ies, data=data, label="UNIATENAS")
        for _ in range(copias)
    ]


def build_example_pdf(layout: str, dest: Path) -> int:
    """PDF de exemplo (dados fictícios) usado na conferência visual."""
    sim = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
    nome = "SIMULADO ENAMED 2026"
    if layout == L.LAYOUT_SFA:
        specs = specs_personalizados(
            [RosterEntry("2023001234", "Maria Exemplo da Silva")],
            sim, nome, "Faculdade Exemplo", "25/10/2026",
        )
    else:
        specs = specs_uniatenas(1, sim, nome, "UniAtenas", "25/10/2026")
    return write_cards_pdf(dest, specs, title=f"Exemplo — cartão {layout}")
