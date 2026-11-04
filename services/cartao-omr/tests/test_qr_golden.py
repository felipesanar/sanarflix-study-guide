"""Os vetores de QR usados pelo teste do TypeScript (`src/features/cartoes/__tests__/qr-golden.json`)
precisam ser exatamente o que o `segno` e o `models.py` produzem hoje."""
from __future__ import annotations

import json

import segno

from tools import gen_qr_golden as gen


def test_vetores_de_qr_estao_em_dia():
    atual = gen.OUT.read_text(encoding="utf-8").replace("\r\n", "\n")
    esperado = json.dumps(gen.build(), ensure_ascii=False, indent=None, separators=(",", ":")) + "\n"
    assert atual == esperado, "rode `python tools/gen_qr_golden.py` e commite o JSON"


def test_vetores_cobrem_as_versoes_1_a_9_e_os_dois_modos():
    dados = json.loads(gen.OUT.read_text(encoding="utf-8"))
    assert {c["version"] for c in dados["casos"]} == set(range(1, 10))
    modos = {segno.make(c["text"], error="q", micro=False, boost_error=False).mode for c in dados["casos"]}
    assert {"alphanumeric", "byte"} <= modos
    assert len(dados["payloads"]) == 66  # 40 com matrícula, 16 do plano B (e-mail) e 10 do UniAtenas
