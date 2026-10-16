"""Tipos de dados compartilhados e o formato do QR.

Formato do QR (revisão 4 do PRD), em maiúsculas para o QR usar o modo alfanumérico (mais compacto):
    personalizado (sfa)  SFA2:S:<SIM8>:<UID32>   SIM8 = 8 primeiros hex do simulado_id; UID32 = user_id sem hífens
    UniAtenas            SFA2:A:<SIM8>
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from .layout import LAYOUT_SFA, LAYOUT_UNIATENAS

QR_PREFIX = "SFA2"
QR_KIND_PERSONALIZADO = "S"
QR_KIND_UNIATENAS = "A"

MODEL_PERSONALIZADO = "personalizado"
MODEL_UNIATENAS = "uniatenas"
MODELS = (MODEL_PERSONALIZADO, MODEL_UNIATENAS)

_QR_RE = re.compile(rf"^{QR_PREFIX}:(?:S:([0-9A-F]{{8}}):([0-9A-F]{{32}})|A:([0-9A-F]{{8}}))$")


@dataclass(frozen=True)
class RosterEntry:
    user_id: str
    nome: str
    ies: str = ""


@dataclass(frozen=True)
class QrData:
    kind: str            # "S" personalizado | "A" uniatenas
    sim8: str
    user_id: str | None  # UUID com hífens, minúsculo (só no personalizado)

    @property
    def layout(self) -> str:
        return LAYOUT_SFA if self.kind == QR_KIND_PERSONALIZADO else LAYOUT_UNIATENAS


def sim8(simulado_id: str) -> str:
    """Referência curta do simulado, usada no QR e na checagem de `simulado_divergente`."""
    return _as_uuid("simulado_id", simulado_id).hex[:8].upper()


def parse_qr(text: str) -> QrData | None:
    """Interpreta o texto de um QR. Devolve None se não for um cartão SFA2 válido."""
    m = _QR_RE.match(text.strip())
    if not m:
        return None
    if m.group(1):
        return QrData(QR_KIND_PERSONALIZADO, m.group(1), str(uuid.UUID(hex=m.group(2).lower())))
    return QrData(QR_KIND_UNIATENAS, m.group(3), None)


@dataclass(frozen=True)
class CardSpec:
    """Conteúdo variável de um cartão. A geometria vem do layout."""

    model: str
    simulado_id: str
    nome_simulado: str = ""
    ies: str = ""
    data: str = ""
    aluno_nome: str = ""  # só no personalizado
    user_id: str = ""     # só no personalizado
    label: str = ""       # código legível sob o QR

    @property
    def layout(self) -> str:
        return LAYOUT_UNIATENAS if self.model == MODEL_UNIATENAS else LAYOUT_SFA

    @property
    def qr_payload(self) -> str:
        ref = sim8(self.simulado_id)
        if self.model == MODEL_PERSONALIZADO:
            uid = _as_uuid("user_id", self.user_id).hex.upper()
            return f"{QR_PREFIX}:{QR_KIND_PERSONALIZADO}:{ref}:{uid}"
        if self.model == MODEL_UNIATENAS:
            return f"{QR_PREFIX}:{QR_KIND_UNIATENAS}:{ref}"
        raise ValueError(f"modelo desconhecido: {self.model!r}")


def _as_uuid(campo: str, valor: str) -> uuid.UUID:
    try:
        return uuid.UUID(valor.strip())
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"{campo} precisa ser um UUID: {valor!r}") from exc
