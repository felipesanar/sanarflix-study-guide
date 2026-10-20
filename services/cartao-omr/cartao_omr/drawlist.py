"""Lista de desenho do cartão (campo `draw` dos templates).

O gerador Python e o do Academy (TypeScript) **só interpretam esta lista**: nenhum dos dois tem medida
própria. Mudar o layout é mudar `layout.py`, rodar `cartao-omr modelo` e commitar os JSON.

Convenções: mm, origem no canto superior esquerdo, y para baixo. Larguras de linha (`lw`) em pontos.
Cores em `#rrggbb`. Operações, na ordem de desenho:

  rect     {x0, y0, x1, y1, fill?, stroke?, lw?}
  circle   {cx, cy, d, fill?, stroke?, lw?}
  line     {x0, y0, x1, y1, color, lw}
  poly     {pts: [[x, y], ...], color, lw}                     (pontas e juntas arredondadas)
  text     {x, y, s, font, size, color, align?}                (y = linha de base)
  text     {slot, x, y, font, size, min_size, max_w, color, align?}   (texto variável; ver SLOTS)
  numbers  {font, size, color, items: [[questão, x_direita, y_base], ...]}   (alinhado à direita)
  bubbles  {stroke, lw, fill, letter_color, letter_size, letter_dy}  (todas as bolhas de `questions` e
                                                                      `matricula.columns` do template)
  qr       {box: [x0, y0, x1, y1], quiet, ec, color}           (conteúdo = payload do cartão)

SLOTS: `titulo`, `subtitulo`, `aluno`, `matricula`, `label`. O texto é encolhido de 0,25 pt em 0,25 pt até caber em
`max_w` (mm) ou chegar a `min_size`; se ainda não couber, é cortado com reticências. Slot vazio não desenha.
"""
from __future__ import annotations

from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit

from . import layout as L

BLACK = "#000000"
WHITE = "#ffffff"
GRAY_STROKE = "#7f7f7f"
GRAY_LETTER = "#a6a6a6"
GRAY_TEXT = "#333333"
GRAY_LABEL = "#404040"

# Por layout: o sfa_v3 usa o slot `matricula` e a fonte Courier-Bold (versão 2); o UniAtenas segue na 1.
DRAW_VERSION = {"sfa": 2, "uniatenas": 1}

SLOTS = ("titulo", "subtitulo", "aluno", "matricula", "label")


def _r(v: float) -> float:
    return round(float(v), 3)


def _gray_hex(v: int) -> str:
    return f"#{v:02x}{v:02x}{v:02x}"


def baseline_offset(size_pt: float) -> float:
    """mm da linha de base abaixo do centro visual de um texto de capitulares."""
    return size_pt * 0.3528 * 0.36


def _rect(box, fill=None, stroke=None, lw=0.5) -> dict:
    op = {"op": "rect", "x0": _r(box[0]), "y0": _r(box[1]), "x1": _r(box[2]), "y1": _r(box[3])}
    if fill:
        op["fill"] = fill
    if stroke:
        op["stroke"] = stroke
        op["lw"] = lw
    return op


def _circle(cx, cy, d, fill=None, stroke=None, lw=0.5) -> dict:
    op = {"op": "circle", "cx": _r(cx), "cy": _r(cy), "d": _r(d)}
    if fill:
        op["fill"] = fill
    if stroke:
        op["stroke"] = stroke
        op["lw"] = lw
    return op


def _line(x0, y0, x1, y1, color=BLACK, lw=0.5) -> dict:
    return {"op": "line", "x0": _r(x0), "y0": _r(y0), "x1": _r(x1), "y1": _r(y1), "color": color, "lw": lw}


def _text(x, y, s, font="Helvetica", size=8.0, color=BLACK, align="left") -> dict:
    op = {"op": "text", "x": _r(x), "y": _r(y), "s": s, "font": font, "size": size, "color": color}
    if align != "left":
        op["align"] = align
    return op


def _slot(slot, x, y, font, size, color, max_w=None, min_size=None, align="left") -> dict:
    op = {"op": "text", "slot": slot, "x": _r(x), "y": _r(y), "font": font, "size": size, "color": color}
    if max_w is not None:
        op["max_w"] = _r(max_w)
        op["min_size"] = min_size
    if align != "left":
        op["align"] = align
    return op


def _poly(pts, color=BLACK, lw=0.8) -> dict:
    return {"op": "poly", "pts": [[_r(x), _r(y)] for x, y in pts], "color": color, "lw": lw}


def _wrap(text: str, width_mm: float, font="Helvetica", size=7.0) -> list[str]:
    return simpleSplit(text, font, size, width_mm * mm)


# ---------------------------------------------------------------------------- blocos
def _header() -> list[dict]:
    w_title = L.TITLE_BOX[2] - L.TITLE_BOX[0]
    return [
        _slot("titulo", L.TITLE_BOX[0], 24.6, "Helvetica-Bold", 13.0, BLACK, w_title, 8.0),
        _slot("subtitulo", L.TITLE_BOX[0], 28.0, "Helvetica", 8.5, GRAY_TEXT, w_title, 6.5),
        _text(L.ALUNO_LABEL_X, 37.6, "ALUNO:", "Helvetica-Bold", 11.0),
        _line(L.ALUNO_LINE_X0, L.ALUNO_LINE_Y, L.ALUNO_BOX[2], L.ALUNO_LINE_Y, BLACK, 0.5),
        _slot("aluno", L.ALUNO_LINE_X0 + 1.5, 37.8, "Helvetica", 10.5, BLACK,
              L.ALUNO_BOX[2] - L.ALUNO_LINE_X0 - 2, 7.0),
    ]


def _pessoal() -> list[dict]:
    """Bloco do layout sfa: matrícula impressa (a mesma do QR) e avisos de que o cartão é nominal."""
    f = L.PESSOAL_FRAME
    mat_w = f[2] - f[0] - 6.0
    ops = [
        _rect(f, stroke=GRAY_STROKE, lw=0.5),
        _text(f[0] + 3, L.MAT_TITLE_BASELINE, "MATRÍCULA", "Helvetica-Bold", 10.0),
        _slot("matricula", f[0] + 3, L.PESSOAL_MATRICULA_BASELINE, "Courier-Bold", 16.0, BLACK, mat_w, 9.0),
        _line(f[0] + 3, L.PESSOAL_AVISOS_RULE_Y, f[2] - 3, L.PESSOAL_AVISOS_RULE_Y, GRAY_STROKE, 0.5),
    ]
    avisos = [
        "Confira se o nome (ALUNO) e a matrícula impressos neste cartão são os seus.",
        "Se não forem os seus, avise o aplicador antes de marcar qualquer resposta.",
        "Não troque de cartão com colegas.",
        "Este cartão é identificado automaticamente pelo código QR: não escreva nem cole nada sobre ele.",
    ]
    y = L.PESSOAL_AVISOS_Y0
    for texto in avisos:
        linhas = _wrap(texto, f[2] - f[0] - 9.0, "Helvetica", 7.5)
        ops.append(_text(f[0] + 3, y, "•", "Helvetica", 7.5))
        for ln in linhas:
            ops.append(_text(f[0] + 6, y, ln, "Helvetica", 7.5))
            y += 3.7
        y += 2.2
    return ops


def _matricula(geo: L.Geometry) -> list[dict]:
    f = L.MATRICULA_FRAME
    ops = [
        _rect(f, stroke=GRAY_STROKE, lw=0.5),
        _text(f[0] + 3, L.MAT_TITLE_BASELINE, "MATRÍCULA", "Helvetica-Bold", 10.0),
    ]
    for col in geo.matricula_columns:
        ops.append(_rect(col.box, fill=WHITE, stroke=GRAY_STROKE, lw=0.5))
    for sx, sy in geo.matricula_separators:
        ops.append(_line(sx - 1.2, sy, sx + 1.2, sy, BLACK, 1.1))
    return ops


def _instrucoes() -> list[dict]:
    f = L.INSTRUCOES_FRAME
    ops = [
        _rect(f, stroke=GRAY_STROKE, lw=0.5),
        _text(f[0] + 3, L.MAT_TITLE_BASELINE, "INSTRUÇÕES", "Helvetica-Bold", 10.0),
    ]
    bullets = [
        "Use caneta esferográfica preta ou azul-escura.",
        "Preencha a bolha por completo.",
        "Não rasure, não dobre, não escreva fora dos campos.",
    ]
    y = 54.6
    for text in bullets:
        linhas = _wrap(text, f[2] - f[0] - 8.0, "Helvetica", 7.0)
        ops.append(_text(f[0] + 3, y, "•", "Helvetica", 7.0))
        for ln in linhas:
            ops.append(_text(f[0] + 6, y, ln, "Helvetica", 7.0))
            y += 3.4
        y += 1.8

    row_correct, row_wrong, row_two = 82.0, 92.0, 101.0
    xs = [124.5, 131.0, 137.5, 144.0]
    ex = lambda cx, cy: _circle(cx, cy, 4.8, fill=WHITE, stroke=GRAY_STROKE, lw=L.BUBBLE_STROKE_PT)  # noqa: E731
    ops.append(_text(f[0] + 3, row_correct + 1.0, "CORRETO:", "Helvetica-Bold", 7.5))
    ops.append(_circle(xs[0], row_correct, 4.8, fill=BLACK))
    ops.append(_text(f[0] + 3, row_wrong + 1.0, "INCORRETO:", "Helvetica-Bold", 7.5))
    # X
    ops += [ex(xs[0], row_wrong),
            _line(xs[0] - 1.4, row_wrong - 1.4, xs[0] + 1.4, row_wrong + 1.4, BLACK, 0.8),
            _line(xs[0] - 1.4, row_wrong + 1.4, xs[0] + 1.4, row_wrong - 1.4, BLACK, 0.8)]
    # ✓
    ops += [ex(xs[1], row_wrong),
            _poly([(xs[1] - 1.5, row_wrong + 0.1), (xs[1] - 0.4, row_wrong + 1.3), (xs[1] + 1.6, row_wrong - 1.5)])]
    # ponto
    ops += [ex(xs[2], row_wrong), _circle(xs[2], row_wrong, 1.1, fill=BLACK)]
    # círculo vazado
    ops.append(_circle(xs[3], row_wrong, 5.0, stroke=BLACK, lw=1.6))
    # duas bolhas
    ops.append(_text(f[0] + 3, row_two + 1.0, "Duas bolhas:", "Helvetica", 6.5, GRAY_TEXT))
    ops.append(_circle(xs[0], row_two, 4.8, fill=BLACK))
    ops.append(_circle(xs[0] + 6.0, row_two, 4.8, fill=BLACK))
    return ops


def build_draw(layout: str) -> list[dict]:
    geo = L.build_geometry(layout)
    ops: list[dict] = []
    for x, y, w in geo.fiducials.values():
        ops.append(_rect((x, y, x + w, y + w), fill=BLACK))
    ops += _header()
    ops.append({"op": "qr", "box": [_r(v) for v in L.QR_BOX], "quiet": L.QR_QUIET_MODULES,
                "ec": L.QR_ERROR.upper(), "color": BLACK})
    ops.append(_slot("label", (L.QR_BOX[0] + L.QR_BOX[2]) / 2, L.QR_LABEL_Y, "Helvetica", 6.0, GRAY_LABEL,
                     align="center"))
    ops += _matricula(geo) if geo.matricula_columns else _pessoal()
    ops += _instrucoes()
    off = baseline_offset(L.NUMBER_PT)
    ops.append({
        "op": "numbers", "font": "Helvetica-Bold", "size": L.NUMBER_PT, "color": BLACK,
        "items": [[q, _r(ax), _r(ay + off)] for q, (ax, ay) in sorted(geo.number_anchors.items())],
    })
    ops.append({
        "op": "bubbles", "stroke": GRAY_STROKE, "lw": L.BUBBLE_STROKE_PT, "fill": WHITE,
        "letter_color": GRAY_LETTER, "letter_size": L.BUBBLE_LETTER_PT,
        "letter_dy": _r(baseline_offset(L.BUBBLE_LETTER_PT)),
    })
    ops.append(_text(L.PAGE_W / 2, L.FOOTER_Y + 0.7, L.FOOTER_TEXT, "Helvetica", 6.0,
                     _gray_hex(L.BUBBLE_STROKE_GRAY), align="center"))
    return ops
