"""Mede o pipeline de leitura sobre as fixtures e calibra os limiares (Fase 1, PRD seção 8).

Uso (com o venv ativo, em services/cartao-omr):
    python tools/eval_accuracy.py                                   # fixtures versionadas
    python tools/eval_accuracy.py runs/fixtures_grandes             # conjunto grande
    python tools/eval_accuracy.py runs/fixtures_grandes --calibrar  # busca T_ALTO/T_BAIXO/GAP_MIN
    python tools/eval_accuracy.py runs/fixtures_grandes --json saida.json --t-ink 0.5

O que conta (regras do gabarito, ver tools/make_fixtures.py):
  * questões `strict` (marcada, branco, multipla, sujeira): têm que sair exatamente como no gabarito;
  * questões não estritas (marca fraca, X, ✓, ponto, círculo, rasura): `truth` ou `tolerated` ou a
    letra pretendida são aceitos; uma LETRA ERRADA nunca é aceita.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cartao_omr.config import DEFAULT_CONFIG, ReadConfig  # noqa: E402
from cartao_omr.pipeline import omr  # noqa: E402
from cartao_omr.pipeline.page import EM_BRANCO, ILEGIVEL, OK, PageResult, load_template, read_page  # noqa: E402
from cartao_omr.pipeline.render import open_pdf, render_page  # noqa: E402

KINDS = omr.KIND_CODES
ACEITE = {
    "acerto_bolha": 0.998,
    "multipla_lida_como_letra": 0,
    "matricula": 0.995,
    "qr": 0.99,
    "ilegiveis": 0.005,
}


@dataclass
class PageEval:
    conjunto: str
    pagina: int
    gab: dict
    res: PageResult
    erro_alinhamento_mm: float | None


# ============================================================ execução
def _work(task):
    pdf, idx, gab, cfg = task
    doc = open_pdf(pdf)
    img = render_page(doc, idx, cfg.render_dpi, cfg)
    res = read_page(img, cfg)
    err = None
    if res.alignment is not None and gab.get("kind") == "cartao":
        err = _alignment_error_mm(res, gab, cfg)
    return res, err


def _alignment_error_mm(res: PageResult, gab: dict, cfg: ReadConfig) -> float:
    """Erro médio (mm) entre a homografia estimada e a verdadeira, nos centros das bolhas."""
    dpi_true = gab["scan"]["dpi"]
    k_ref = cfg.render_dpi / dpi_true  # a página do PDF é renderizada em outro dpi que o do scan
    h_true = np.diag([k_ref, k_ref, 1.0]) @ np.array(gab["scan"]["mm_to_px"])
    tpl = load_template("sfa")
    pts = np.array([b[:2] for q in tpl["questions"].values() for b in q.values()], np.float64)

    def apply(h):
        p = np.c_[pts, np.ones(len(pts))] @ h.T
        return p[:, :2] / p[:, 2:3]

    d = np.linalg.norm(apply(res.alignment.h_mm_to_px) - apply(h_true), axis=1) / (cfg.render_dpi / 25.4)
    return float(d.mean())


def run(dirs: list[Path], cfg: ReadConfig, workers: int | None = None) -> list[PageEval]:
    tasks, meta = [], []
    for d in dirs:
        for gpath in sorted(d.glob("*.gabarito.json")):
            gab = json.loads(gpath.read_text(encoding="utf-8"))
            for p in gab["pages"]:
                tasks.append((str(d / gab["file"]), p["page"] - 1, p, cfg))
                meta.append((gpath.name.replace(".gabarito.json", ""), p["page"], {**p, "_set": gab}))
    with ProcessPoolExecutor(max_workers=workers) as ex:
        out = list(ex.map(_work, tasks, chunksize=2))
    return [PageEval(m[0], m[1], m[2], r, e) for m, (r, e) in zip(meta, out)]


# ============================================================ métricas
def _scores_arrays(pages: list[PageEval]):
    """Empilha os scores das questões dos cartões lidos: (N,4) + metadados do gabarito."""
    rows, meta = [], []
    for pe in pages:
        if pe.gab["kind"] != "cartao" or pe.res.status != OK:
            continue
        for q, a in pe.gab["answers"].items():
            cell = pe.res.answers[int(q)]
            rows.append([cell.scores[x] for x in "ABCD"])
            meta.append(a)
    return np.array(rows, np.float32), meta


def _intended(a: dict) -> str:
    """Letra que o aluno quis marcar. Na rasura (gabarito antigo, sem `letter`) é a bolha mais coberta."""
    return a.get("letter") or "ABCD"[int(np.argmax(a["cov"]))]


def question_outcomes(scores: np.ndarray, meta: list[dict], cfg: ReadConfig) -> dict:
    kind, argmax = omr.classify_batch(scores, cfg)
    alt = "ABCD"
    n_strict = ok_strict = bolhas = bolhas_ok = 0
    multipla_como_letra = 0
    conf = {t: Counter() for t in ("marcada", "branco", "multipla", "ambigua")}
    nao_estrito = Counter()
    exemplos: dict[str, list] = {"estrito_errado": [], "letra_errada": [], "multipla_como_letra": []}
    for i, a in enumerate(meta):
        pred = KINDS[kind[i]]
        letter = alt[argmax[i]]
        highs = [alt[j] for j in range(4) if scores[i, j] >= cfg.t_alto]
        if a["strict"]:
            truth = a["truth"]
            conf[truth][pred] += 1
            n_strict += 1
            if truth == "marcada":
                ok = pred == "marcada" and letter == a["letter"]
                truth_set = {a["letter"]}
                pred_set = {letter} if pred == "marcada" else None
            elif truth == "multipla":
                ok = pred == "multipla" and highs == a["letters"]
                truth_set = set(a["letters"])
                pred_set = set(highs) if pred == "multipla" else (({letter}) if pred == "marcada" else None)
                if pred == "marcada":
                    multipla_como_letra += 1
                    exemplos["multipla_como_letra"].append((i, a["cov"], scores[i].round(2).tolist()))
            else:  # branco
                ok = pred == "branco"
                truth_set = set()
                pred_set = set() if pred == "branco" else (({letter}) if pred == "marcada" else None)
            ok_strict += ok
            bolhas += 4
            if pred_set is not None:
                bolhas_ok += sum((x in pred_set) == (x in truth_set) for x in alt)
            if not ok and len(exemplos["estrito_errado"]) < 12:
                exemplos["estrito_errado"].append((a["truth"], pred, a.get("letter"), a["cov"],
                                                   scores[i].round(2).tolist()))
        else:
            if pred == a["truth"]:
                nao_estrito["exato"] += 1
            elif pred in a["tolerated"]:
                nao_estrito["tolerado"] += 1
            elif pred == "marcada" and letter == _intended(a):
                nao_estrito["letra_pretendida"] += 1
            elif pred == "marcada":
                nao_estrito["LETRA_ERRADA"] += 1
                if len(exemplos["letra_errada"]) < 12:
                    exemplos["letra_errada"].append((a["kind"], a.get("letter"), letter, a["cov"],
                                                     scores[i].round(2).tolist()))
            else:
                nao_estrito["outro"] += 1
    return {
        "questoes_estritas": n_strict, "questoes_estritas_ok": ok_strict,
        "acerto_questao": ok_strict / max(n_strict, 1),
        "bolhas": bolhas, "bolhas_ok": bolhas_ok, "acerto_bolha": bolhas_ok / max(bolhas, 1),
        "multipla_lida_como_letra": multipla_como_letra,
        "confusao": {k: dict(v) for k, v in conf.items()},
        "nao_estritas": dict(nao_estrito),
        "exemplos": exemplos,
    }


def other_metrics(pages: list[PageEval]) -> dict:
    cart = [p for p in pages if p.gab["kind"] == "cartao"]
    leg = [p for p in cart if p.gab["legible"]]
    leg_5 = [p for p in leg if abs(p.gab["scan"]["rotation_deg"]) <= 5.0]
    ilegiveis = [p for p in leg_5 if p.res.status != OK]
    ilegiv_prop = [p for p in cart if not p.gab["legible"]]
    brancas = [p for p in pages if p.gab["kind"] == "branco"]
    # QR
    qr_ok = qr_tot = 0
    qr_falha = []
    qr_danif = qr_danif_lidos = 0
    for p in leg:
        if p.gab["qr_legivel"]:
            qr_tot += 1
            ok = p.res.qr is not None and p.res.qr.text == p.gab["qr"]
            qr_ok += ok
            if not ok:
                qr_falha.append((p.conjunto, p.pagina))
        else:
            qr_danif += 1
            qr_danif_lidos += p.res.qr is not None and p.res.qr.text is not None
    # matrícula (UniAtenas)
    mat_ok = mat_tot = inv_ok = inv_tot = mat_errada = 0
    mat_falhas = []
    for p in leg:
        m = p.gab["matricula"]
        if not m or p.res.status != OK or p.res.matricula is None:
            continue
        if m["status"] == "ok":
            mat_tot += 1
            ok = p.res.matricula.valid and p.res.matricula.value == m["value"]
            mat_ok += ok
            if not ok:
                mat_falhas.append((p.conjunto, p.pagina, m["value"], p.res.matricula.value, p.res.matricula.reason))
        elif m["status"] == "invalida":
            inv_tot += 1
            inv_ok += not p.res.matricula.valid
            mat_errada += p.res.matricula.valid  # leu uma matrícula errada como válida
    errs = [p.erro_alinhamento_mm for p in leg if p.erro_alinhamento_mm is not None]
    rms = [p.res.alignment.rms_mm for p in leg if p.res.alignment is not None]
    return {
        "paginas": len(pages), "cartoes": len(cart), "legiveis": len(leg),
        "ilegiveis_com_rotacao_ate_5": len(ilegiveis), "legiveis_rot_ate_5": len(leg_5),
        "taxa_ilegiveis": len(ilegiveis) / max(len(leg_5), 1),
        "ilegiveis_exemplos": [(p.conjunto, p.pagina, p.res.reason) for p in ilegiveis][:10],
        "ilegiveis_propositais": len(ilegiv_prop),
        "ilegiveis_propositais_detectadas": sum(p.res.status == ILEGIVEL for p in ilegiv_prop),
        "brancas": len(brancas), "brancas_detectadas": sum(p.res.status == EM_BRANCO for p in brancas),
        "qr_total": qr_tot, "qr_lidos": qr_ok, "taxa_qr": qr_ok / max(qr_tot, 1), "qr_falhas": qr_falha[:10],
        "qr_danificados": qr_danif, "qr_danificados_lidos": qr_danif_lidos,
        "matricula_total": mat_tot, "matricula_ok": mat_ok, "taxa_matricula": mat_ok / max(mat_tot, 1),
        "matricula_falhas": mat_falhas[:10],
        "matricula_defeito_total": inv_tot, "matricula_defeito_recusada": inv_ok,
        "matricula_errada_aceita": mat_errada,
        "alinhamento_erro_medio_mm": float(np.mean(errs)) if errs else None,
        "alinhamento_erro_max_mm": float(np.max(errs)) if errs else None,
        "alinhamento_rms_mm_medio": float(np.mean(rms)) if rms else None,
        "alinhamento_rms_mm_max": float(np.max(rms)) if rms else None,
    }


def evaluate(pages: list[PageEval], cfg: ReadConfig) -> dict:
    scores, meta = _scores_arrays(pages)
    return {"questoes": question_outcomes(scores, meta, cfg), **other_metrics(pages)}


# ============================================================ calibração
def calibrate(pages: list[PageEval], base: ReadConfig) -> list[tuple]:
    scores, meta = _scores_arrays(pages)
    results = []
    for t_alto in np.arange(0.25, 0.81, 0.05):
        for t_baixo in np.arange(0.05, 0.36, 0.025):
            if t_baixo >= t_alto:
                continue
            for gap in (0.05, 0.1, 0.15, 0.2, 0.3, 0.4):
                cfg = replace(base, t_alto=float(t_alto), t_baixo=float(t_baixo), gap_min=float(gap))
                r = question_outcomes(scores, meta, cfg)
                perigosos = r["multipla_lida_como_letra"] + r["nao_estritas"].get("LETRA_ERRADA", 0)
                results.append((perigosos, -r["acerto_bolha"], -r["acerto_questao"],
                                -sum(v for k, v in r["nao_estritas"].items() if k != "outro"),
                                round(float(t_alto), 3), round(float(t_baixo), 3), gap))
    results.sort()
    return results


# ============================================================ relatório
def _pct(x):
    return f"{100 * x:.3f}%"


def report(m: dict, cfg: ReadConfig) -> bool:
    q = m["questoes"]
    print(f"\nLimiares: T_ALTO={cfg.t_alto:.3f}  T_BAIXO={cfg.t_baixo:.3f}  GAP_MIN={cfg.gap_min:.3f}  "
          f"T_INK={cfg.t_ink:.2f}  raio={cfg.radius_frac:.2f}  dpi={cfg.render_dpi}")
    print(f"Páginas: {m['paginas']} ({m['cartoes']} cartões, {m['legiveis']} legíveis)")
    print(f"Questões estritas: {q['questoes_estritas']}  |  bolhas avaliadas: {q['bolhas']}")
    print("\nConfusão (linhas = gabarito, colunas = leitura), só questões estritas:")
    cols = ["marcada", "branco", "multipla", "ambigua"]
    print(f"  {'':10s}" + "".join(f"{c:>10s}" for c in cols))
    for t in ["marcada", "branco", "multipla"]:
        print(f"  {t:10s}" + "".join(f"{q['confusao'][t].get(c, 0):>10d}" for c in cols))
    print(f"\nNão estritas: {q['nao_estritas']}")
    checks = [
        ("acerto por bolha ≥ 99,8%", q["acerto_bolha"] >= ACEITE["acerto_bolha"], _pct(q["acerto_bolha"])),
        ("0 múltipla lida como letra", q["multipla_lida_como_letra"] == 0, q["multipla_lida_como_letra"]),
        ("0 letra errada nas não estritas", q["nao_estritas"].get("LETRA_ERRADA", 0) == 0,
         q["nao_estritas"].get("LETRA_ERRADA", 0)),
        (f"matrícula correta ≥ 99,5% ({m['matricula_ok']}/{m['matricula_total']})",
         m["taxa_matricula"] >= ACEITE["matricula"], _pct(m["taxa_matricula"])),
        ("0 matrícula com defeito aceita como válida", m["matricula_errada_aceita"] == 0, m["matricula_errada_aceita"]),
        (f"QR lido ≥ 99% ({m['qr_lidos']}/{m['qr_total']})", m["taxa_qr"] >= ACEITE["qr"], _pct(m["taxa_qr"])),
        (f"ilegíveis ≤ 0,5% com rotação ≤ ±5° ({m['ilegiveis_com_rotacao_ate_5']}/{m['legiveis_rot_ate_5']})",
         m["taxa_ilegiveis"] <= ACEITE["ilegiveis"], _pct(m["taxa_ilegiveis"])),
    ]
    print("\nAceite da Fase 1 (nas fixtures):")
    for nome, ok, val in checks:
        print(f"  [{'OK' if ok else 'FALHOU'}] {nome}: {val}")
    print(f"\nAcerto por questão (estritas): {_pct(q['acerto_questao'])}")
    print(f"Ilegíveis propositais detectadas: {m['ilegiveis_propositais_detectadas']}/{m['ilegiveis_propositais']}  |  "
          f"em branco detectadas: {m['brancas_detectadas']}/{m['brancas']}  |  "
          f"QR danificado lido: {m['qr_danificados_lidos']}/{m['qr_danificados']}")
    if m["alinhamento_erro_medio_mm"] is not None:
        print(f"Alinhamento: erro médio {m['alinhamento_erro_medio_mm']:.3f} mm (máx {m['alinhamento_erro_max_mm']:.3f}); "
              f"RMS dos marcadores médio {m['alinhamento_rms_mm_medio']:.3f} mm (máx {m['alinhamento_rms_mm_max']:.3f})")
    for chave in ("ilegiveis_exemplos", "qr_falhas", "matricula_falhas"):
        if m[chave]:
            print(f"{chave}: {m[chave]}")
    for chave, ex in q["exemplos"].items():
        if ex:
            print(f"exemplos {chave}:")
            for e in ex[:6]:
                print("   ", e)
    return all(ok for _, ok, _ in checks)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # console do Windows (cp1252) não tem "≥"
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("pastas", nargs="*", type=Path, default=[ROOT / "tests" / "fixtures"])
    ap.add_argument("--calibrar", action="store_true", help="busca T_ALTO/T_BAIXO/GAP_MIN")
    ap.add_argument("--json", type=Path, help="grava as métricas em JSON")
    ap.add_argument("--workers", type=int, default=None)
    for campo in ("t_ink", "t_alto", "t_baixo", "gap_min", "radius_frac"):
        ap.add_argument("--" + campo.replace("_", "-"), type=float, default=None)
    args = ap.parse_args(argv)
    over = {c: getattr(args, c) for c in ("t_ink", "t_alto", "t_baixo", "gap_min", "radius_frac")
            if getattr(args, c) is not None}
    cfg = replace(DEFAULT_CONFIG, **over)
    pages = run(args.pastas, cfg, args.workers)
    if args.calibrar:
        res = calibrate(pages, cfg)
        print("Melhores combinações (perigosos, -acerto_bolha, -acerto_questao, -não_estritas_ok, T_ALTO, T_BAIXO, GAP):")
        for r in res[:15]:
            print("  ", r)
        best = res[0]
        cfg = replace(cfg, t_alto=best[4], t_baixo=best[5], gap_min=best[6])
    m = evaluate(pages, cfg)
    ok = report(m, cfg)
    if args.json:
        args.json.write_text(json.dumps(m, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
