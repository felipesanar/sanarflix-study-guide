"""Formato do QR (SFA2) e validações."""
from __future__ import annotations

import pytest

from cartao_omr.models import CardSpec, QrData, parse_qr, sim8

SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
UID = "7f3a9c21-5b1e-4f0a-9c3d-0123456789ab"


def test_payload_personalizado_e_compacto_e_maiusculo():
    p = CardSpec(model="personalizado", simulado_id=SIM, user_id=UID).qr_payload
    assert p == "SFA2:S:9D6C1F0E:7F3A9C215B1E4F0A9C3D0123456789AB"
    assert len(p) == 48


def test_payload_uniatenas():
    assert CardSpec(model="uniatenas", simulado_id=SIM).qr_payload == "SFA2:A:9D6C1F0E"


def test_parse_qr_devolve_o_user_id_com_hifens():
    data = parse_qr("SFA2:S:9D6C1F0E:7F3A9C215B1E4F0A9C3D0123456789AB")
    assert data == QrData("S", "9D6C1F0E", UID)
    assert data.layout == "sfa"
    ua = parse_qr("SFA2:A:9D6C1F0E")
    assert ua == QrData("A", "9D6C1F0E", None) and ua.layout == "uniatenas"


@pytest.mark.parametrize("texto", [
    "", "SFA1|sfa|x|G", "SFA2:S:9D6C1F0E", "SFA2:S:9D6C1F0E:7F3A", "SFA2:A:9D6C1F0E:EXTRA",
    "SFA2:X:9D6C1F0E", "sfa2:a:9d6c1f0e", "SFA2:S:9D6C1F0G:7F3A9C215B1E4F0A9C3D0123456789AB",
])
def test_parse_qr_recusa_o_que_nao_e_cartao(texto):
    assert parse_qr(texto) is None


def test_ida_e_volta_do_payload():
    spec = CardSpec(model="personalizado", simulado_id=SIM, user_id=UID.upper())
    data = parse_qr(spec.qr_payload)
    assert data.user_id == UID and data.sim8 == sim8(SIM)


@pytest.mark.parametrize("sim,uid", [("sim-1", UID), (SIM, "123"), (SIM, ""), ("a|b", UID)])
def test_ids_que_nao_sao_uuid_sao_recusados(sim, uid):
    with pytest.raises(ValueError):
        CardSpec(model="personalizado", simulado_id=sim, user_id=uid).qr_payload


def test_modelo_generico_nao_existe_mais():
    with pytest.raises(ValueError):
        CardSpec(model="generico", simulado_id=SIM).qr_payload
