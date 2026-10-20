"""Formato do QR (SFA2) e validações."""
from __future__ import annotations

import pytest

from cartao_omr.models import CardSpec, QrData, matricula_problem, normalize_matricula, parse_qr, sim8

SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
MAT = "2023001234"


def test_payload_personalizado_e_compacto_e_maiusculo():
    p = CardSpec(model="personalizado", simulado_id=SIM, matricula=MAT).qr_payload
    assert p == "SFA2:M:9D6C1F0E:2023001234"
    assert CardSpec(model="personalizado", simulado_id=SIM, matricula=" ab-12.3/x ").qr_payload == \
        "SFA2:M:9D6C1F0E:AB-12.3/X"


def test_payload_do_pior_caso_cabe_na_versao_3():
    p = CardSpec(model="personalizado", simulado_id=SIM, matricula="A" * 24).qr_payload
    assert len(p) == 40  # modo alfanumérico, nível Q: versão 3 comporta 47


def test_payload_uniatenas_nao_mudou():
    assert CardSpec(model="uniatenas", simulado_id=SIM).qr_payload == "SFA2:A:9D6C1F0E"


def test_parse_qr_devolve_a_matricula():
    data = parse_qr("SFA2:M:9D6C1F0E:99-G-12345")
    assert data == QrData("M", "9D6C1F0E", "99-G-12345")
    assert data.layout == "sfa"
    ua = parse_qr("SFA2:A:9D6C1F0E")
    assert ua == QrData("A", "9D6C1F0E", None) and ua.layout == "uniatenas"


@pytest.mark.parametrize("texto", [
    "", "SFA1|sfa|x|G", "SFA2:M:9D6C1F0E", "SFA2:M:9D6C1F0E:", "SFA2:A:9D6C1F0E:EXTRA",
    "SFA2:X:9D6C1F0E", "sfa2:a:9d6c1f0e", "SFA2:M:9D6C1F0G:123", "SFA2:M:9D6C1F0E:ab",
    "SFA2:M:9D6C1F0E:" + "1" * 25, "SFA2:M:9D6C1F0E:12 34",
    # o formato antigo, com user_id, não é mais um cartão
    "SFA2:S:9D6C1F0E:7F3A9C215B1E4F0A9C3D0123456789AB",
])
def test_parse_qr_recusa_o_que_nao_e_cartao(texto):
    assert parse_qr(texto) is None


@pytest.mark.parametrize("mat", ["1", "2023001234", "99-G-99999", "A1.B2/C3", "X" * 24])
def test_ida_e_volta_do_payload(mat):
    spec = CardSpec(model="personalizado", simulado_id=SIM, matricula=mat.lower())
    data = parse_qr(spec.qr_payload)
    assert data.matricula == mat and data.sim8 == sim8(SIM)


@pytest.mark.parametrize("mat", ["", "   ", "12 34", "12:34", "12_34", "Ç123", "1" * 25, "12#4"])
def test_matricula_que_nao_cabe_no_cartao_e_recusada(mat):
    with pytest.raises(ValueError):
        CardSpec(model="personalizado", simulado_id=SIM, matricula=mat).qr_payload


def test_matricula_problem_e_normalize():
    assert normalize_matricula("  ab-1 ") == "AB-1"
    assert normalize_matricula(None) == ""
    assert matricula_problem(None) == "sem_matricula"
    assert matricula_problem("  ") == "sem_matricula"
    assert matricula_problem("12 34") == "formato_nao_suportado"
    assert matricula_problem("12345") is None


@pytest.mark.parametrize("sim", ["sim-1", "a|b", ""])
def test_simulado_que_nao_e_uuid_e_recusado(sim):
    with pytest.raises(ValueError):
        CardSpec(model="personalizado", simulado_id=sim, matricula=MAT).qr_payload


def test_modelo_generico_nao_existe_mais():
    with pytest.raises(ValueError):
        CardSpec(model="generico", simulado_id=SIM).qr_payload
