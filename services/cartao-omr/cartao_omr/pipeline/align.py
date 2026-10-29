"""Etapas 2 e 3: marcadores de canto, orientação, homografia e retificação (PRD 7.2).

A orientação (0°, 90°, 180°, 270°) não exige girar a imagem: os quatro marcadores grandes são
atribuídos a tl/tr/br/bl pelo marcador pequeno (orientação) e pelas distâncias, e a homografia
já leva o mm do template ao pixel da imagem, qualquer que seja a rotação da página.
"""
from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field

import cv2
import numpy as np

from ..config import DEFAULT_CONFIG, ReadConfig

BIG_MM = (5.0, 9.5)       # lado esperado do marcador de canto (7 mm), com folga de escala e borrão
SMALL_MM = (2.6, 5.6)     # lado esperado do marcador de orientação (4 mm)
ORIENT_DIST_MM = (5.0, 13.0)  # centro a centro entre o `tl` e o marcador de orientação (8,5 mm)
MIN_SOLIDITY = 0.84
MIN_SQUARENESS = 0.78


class AlignError(Exception):
    """A página não pôde ser alinhada; `reason` vai para a Pendência (`pagina_ilegivel`)."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class Square:
    center: np.ndarray       # (x, y) em px
    side_mm: float
    corners: np.ndarray      # 4x2 px (minAreaRect)


@dataclass
class Alignment:
    h_mm_to_px: np.ndarray                 # 3x3: mm do template -> pixel da imagem de entrada
    rms_mm: float
    max_mm: float
    markers: dict[str, tuple[float, float]]
    rotation_deg: float                    # 0 = em pé; ~180 = de cabeça para baixo
    n_points: int
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- candidatos
def _binarizations(gray: np.ndarray):
    """Otsu primeiro; depois alguns limiares fixos, para páginas de pouco contraste."""
    blur = cv2.GaussianBlur(gray, (0, 0), 1.0)
    t, otsu = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    yield "otsu", otsu
    for fixed in (90, 120, 150):
        if abs(fixed - t) > 8:
            yield f"t{fixed}", (blur < fixed).astype(np.uint8) * 255


def _squares(binary: np.ndarray, k: float, side_mm: tuple[float, float]) -> list[Square]:
    n, labels, stats, cents = cv2.connectedComponentsWithStats(binary, connectivity=8)
    lo, hi = side_mm[0] * k, side_mm[1] * k
    out: list[Square] = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if not (lo * 0.7 <= max(w, h) <= hi * 1.5 and min(w, h) >= lo * 0.7):
            continue
        if area < 0.5 * lo * lo or area > 1.3 * hi * hi:
            continue
        mask = (labels[y:y + h, x:x + w] == i).astype(np.uint8)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        if not cnts:
            continue
        cnt = max(cnts, key=cv2.contourArea)
        (cx, cy), (rw, rh), _ = cv2.minAreaRect(cnt)
        if min(rw, rh) <= 0:
            continue
        side = (rw + rh) / 2 / k
        if not (side_mm[0] <= side <= side_mm[1]):
            continue
        if min(rw, rh) / max(rw, rh) < MIN_SQUARENESS:
            continue
        if area / (rw * rh) < MIN_SOLIDITY:
            continue
        box = cv2.boxPoints(((cx, cy), (rw, rh), _)) + np.array([x, y], np.float32)
        out.append(Square(np.array([cents[i][0], cents[i][1]]), side, box))
    return out


def _pick_quad(cands: list[Square], tpl_ratio: float) -> list[Square] | None:
    """Escolhe 4 candidatos cujo quadrilátero tem a proporção da página (297/210 sobre os centros)."""
    if len(cands) < 4:
        return None
    best, best_err = None, 1e9
    for combo in itertools.combinations(range(len(cands)), 4):
        pts = np.array([cands[i].center for i in combo])
        c = pts.mean(0)
        order = np.argsort(np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0]))
        p = pts[order]
        sides = [np.linalg.norm(p[j] - p[(j + 1) % 4]) for j in range(4)]
        a, b = (sides[0] + sides[2]) / 2, (sides[1] + sides[3]) / 2
        short, long_ = min(a, b), max(a, b)
        if short <= 0:
            continue
        err = abs(long_ / short - tpl_ratio) / tpl_ratio
        err += abs(sides[0] - sides[2]) / max(a, 1) + abs(sides[1] - sides[3]) / max(b, 1)
        if err < best_err:
            best_err, best = err, [cands[combo[i]] for i in order]
    return best if best is not None and best_err < 0.25 else None


def find_markers(gray: np.ndarray, template: dict, cfg: ReadConfig = DEFAULT_CONFIG,
                 dpi: int | None = None) -> dict[str, Square]:
    """Devolve {'tl','tr','br','bl','orient'} (Square) ou levanta AlignError."""
    k = (dpi or cfg.render_dpi) / 25.4
    fid = template["fiducials_mm"]
    cx = {n: np.array([fid[n][0] + fid[n][2] / 2, fid[n][1] + fid[n][2] / 2]) for n in fid}
    d_short = np.linalg.norm(cx["tl"] - cx["tr"])
    d_long = np.linalg.norm(cx["tl"] - cx["bl"])
    last = "nenhum marcador de canto encontrado"
    for name, binary in _binarizations(gray):
        bigs = _squares(binary, k, BIG_MM)
        quad = _pick_quad(bigs, d_long / d_short)
        if quad is None:
            last = f"só {len(bigs)} marcador(es) de canto candidato(s) ({name})"
            continue
        smalls = _squares(binary, k, SMALL_MM)
        with_orient = []
        for sq in quad:
            d = [np.linalg.norm(s.center - sq.center) / k for s in smalls]
            near = [s for s, dd in zip(smalls, d) if ORIENT_DIST_MM[0] <= dd <= ORIENT_DIST_MM[1]]
            if len(near) == 1:
                with_orient.append((sq, near[0]))
        if len(with_orient) != 1:
            last = f"marcador de orientação {'ausente' if not with_orient else 'ambíguo'} ({name})"
            continue
        tl, orient = with_orient[0]
        rest = [q for q in quad if q is not tl]
        br = max(rest, key=lambda q: np.linalg.norm(q.center - tl.center))
        two = [q for q in rest if q is not br]
        two.sort(key=lambda q: np.linalg.norm(q.center - tl.center))
        tr, bl = two  # a página é mais larga que alta no sentido curto: o mais próximo do tl é o tr
        return {"tl": tl, "tr": tr, "br": br, "bl": bl, "orient": orient}
    raise AlignError(last)


# ---------------------------------------------------------------- homografia
def _template_corners(fid: list[float]) -> np.ndarray:
    x, y, w = fid
    return np.array([[x, y], [x + w, y], [x + w, y + w], [x, y + w]], np.float64)


def _to_mm(h: np.ndarray, pts_px: np.ndarray) -> np.ndarray:
    inv = np.linalg.inv(h)
    p = np.c_[pts_px, np.ones(len(pts_px))] @ inv.T
    return p[:, :2] / p[:, 2:3]


def align_page(gray: np.ndarray, template: dict, cfg: ReadConfig = DEFAULT_CONFIG,
               dpi: int | None = None) -> Alignment:
    """Acha os marcadores e calcula a homografia mm -> px com o erro de reprojeção em mm."""
    marks = find_markers(gray, template, cfg, dpi)
    fid = template["fiducials_mm"]
    centers_mm = np.array([[fid[n][0] + fid[n][2] / 2, fid[n][1] + fid[n][2] / 2]
                           for n in ("tl", "tr", "br", "bl")], np.float32)
    centers_px = np.array([marks[n].center for n in ("tl", "tr", "br", "bl")], np.float32)
    h0 = cv2.getPerspectiveTransform(centers_mm, centers_px).astype(np.float64)

    # refinamento: os 4 cantos de cada marcador (20 pontos), casados pelo vizinho mais próximo
    src, dst = [], []
    for name, sq in marks.items():
        tc = _template_corners(fid[name])
        pred = np.c_[tc, np.ones(4)] @ h0.T
        pred = pred[:, :2] / pred[:, 2:3]
        side_px = max(np.linalg.norm(sq.corners[0] - sq.corners[1]), 1.0)
        for t, pr in zip(tc, pred):
            d = np.linalg.norm(sq.corners - pr, axis=1)
            j = int(d.argmin())
            if d[j] < 0.35 * side_px:
                src.append(t)
                dst.append(sq.corners[j])
    notes: list[str] = []
    h = h0
    if len(src) >= 16:
        h1, _ = cv2.findHomography(np.array(src, np.float64), np.array(dst, np.float64), 0)
        if h1 is not None and np.isfinite(h1).all():
            h = h1
    else:
        notes.append(f"refinamento com {len(src)} pontos; mantida a homografia dos 4 centros")
    all_px = np.array(dst if len(src) >= 16 else centers_px, np.float64)
    all_mm = np.array(src if len(src) >= 16 else centers_mm, np.float64)
    err = np.linalg.norm(_to_mm(h, all_px) - all_mm, axis=1)
    # o marcador de orientação (4 mm) também entra: se estiver fora do lugar, o erro denuncia
    oc = np.array([[fid["orient"][0] + fid["orient"][2] / 2, fid["orient"][1] + fid["orient"][2] / 2]])
    orient_err = float(np.linalg.norm(_to_mm(h, marks["orient"].center[None, :]) - oc))
    rms = float(math.sqrt((err ** 2).mean()))
    mx = float(max(err.max(), orient_err))
    v = h[:2, :2] @ np.array([1.0, 0.0])
    rot = math.degrees(math.atan2(v[1], v[0]))
    if rms > cfg.align_max_mm or orient_err > 2 * cfg.align_max_mm:
        raise AlignError(f"erro de alinhamento alto: rms {rms:.2f} mm, orientação {orient_err:.2f} mm")
    return Alignment(h, rms, mx, {n: (float(s.center[0]), float(s.center[1])) for n, s in marks.items()},
                     rot, len(src), notes)


def mm_to_rect(dpi: float) -> np.ndarray:
    k = dpi / 25.4
    return np.diag([k, k, 1.0])


def rectify(gray: np.ndarray, align: Alignment, template: dict, cfg: ReadConfig = DEFAULT_CONFIG,
            dpi: int | None = None) -> np.ndarray:
    """Imagem canônica A4: 1 px = 25,4/dpi mm, sem rotação nem perspectiva."""
    d = dpi or cfg.render_dpi
    w = int(round(template["page_mm"][0] * d / 25.4))
    h = int(round(template["page_mm"][1] * d / 25.4))
    m = mm_to_rect(d) @ np.linalg.inv(align.h_mm_to_px)
    return cv2.warpPerspective(gray, m, (w, h), flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_CONSTANT, borderValue=255)
