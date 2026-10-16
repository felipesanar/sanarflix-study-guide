"""Gera os vetores de referência do gerador de QR em TypeScript (`src/features/cartoes/qr.ts`).

Cada caso traz o texto e a matriz de módulos que o `segno` (nível Q, sem micro QR) produz; o teste
`src/features/cartoes/__tests__/qr.test.ts` exige a mesma matriz, módulo por módulo. Também guarda os
payloads `SFA2` esperados (`models.py`) para o teste do formato no TypeScript.

    python tools/gen_qr_golden.py            # reescreve o JSON
    python tools/gen_qr_golden.py --check    # sai com 1 se o JSON versionado estiver desatualizado
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import uuid
from pathlib import Path

import segno

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from cartao_omr.models import CardSpec, sim8  # noqa: E402

OUT = ROOT.parent.parent / "src" / "features" / "cartoes" / "__tests__" / "qr-golden.json"
ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 $%*+-./:"


def matrix(text: str) -> tuple[int, list[str]]:
    qr = segno.make(text, error="q", micro=False, boost_error=False)
    rows = ["".join("1" if v else "0" for v in row) for row in qr.matrix]
    return qr.version, rows


def build() -> dict:
    rnd = random.Random(20261016)
    textos: list[str] = []
    payloads = []
    for i in range(40):
        sim = str(uuid.UUID(int=rnd.getrandbits(128), version=4))
        uid = str(uuid.UUID(int=rnd.getrandbits(128), version=4))
        s = CardSpec(model="personalizado", simulado_id=sim, user_id=uid if i % 2 else uid.upper())
        textos.append(s.qr_payload)
        payloads.append({"model": "personalizado", "simulado_id": sim, "user_id": s.user_id,
                         "sim8": sim8(sim), "payload": s.qr_payload})
    for _ in range(10):
        sim = str(uuid.UUID(int=rnd.getrandbits(128), version=4))
        s = CardSpec(model="uniatenas", simulado_id=sim)
        textos.append(s.qr_payload)
        payloads.append({"model": "uniatenas", "simulado_id": sim, "user_id": None,
                         "sim8": sim8(sim), "payload": s.qr_payload})
    # alfanumérico de vários tamanhos (versões 1 a 8), sempre com letra para não virar modo numérico
    for n in list(range(1, 12)) + [20, 27, 34, 40, 48, 60, 77, 90, 104, 118, 140, 170]:
        textos.append("Q" + "".join(rnd.choice(ALNUM) for _ in range(n - 1)))
    # byte (minúsculas) de vários tamanhos (versões 1 a 9)
    for n in (1, 5, 9, 14, 20, 32, 46, 60, 74, 80, 90, 110, 128):
        textos.append("".join(rnd.choice("abcdefghijklmnopqrstuvwxyz,;_") for _ in range(n)))
    casos = []
    for t in textos:
        version, rows = matrix(t)
        casos.append({"text": t, "version": version, "rows": rows})
    return {"gerado_por": "services/cartao-omr/tools/gen_qr_golden.py", "ec": "Q", "casos": casos, "payloads": payloads}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    texto = json.dumps(build(), ensure_ascii=False, indent=None, separators=(",", ":")) + "\n"
    if args.check:
        atual = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if atual.replace("\r\n", "\n") != texto:
            print(f"{OUT} está desatualizado; rode `python tools/gen_qr_golden.py`", file=sys.stderr)
            return 1
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(texto, encoding="utf-8", newline="\n")
    print(f"{len(build()['casos'])} casos em {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
