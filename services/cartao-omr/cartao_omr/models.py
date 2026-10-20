"""Tipos de dados compartilhados e o formato do QR.

Formato do QR (revisão 8 do PRD), em maiúsculas para o QR usar o modo alfanumérico (mais compacto):
    personalizado (sfa)  SFA2:M:<SIM8>:<MATRICULA>   SIM8 = 8 primeiros hex do simulado_id
    UniAtenas            SFA2:A:<SIM8>
O cartão não leva o `user_id`: a identidade do aluno é a matrícula (a mesma 1ª coluna da importação).
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from .layout import LAYOUT_SFA, LAYOUT_UNIATENAS

QR_PREFIX = "SFA2"
QR_KIND_PERSONALIZADO = "M"
QR_KIND_UNIATENAS = "A"

MODEL_PERSONALIZADO = "personalizado"
MODEL_UNIATENAS = "uniatenas"
MODELS = (MODEL_PERSONALIZADO, MODEL_UNIATENAS)

# Matrícula impressa e no QR: só caracteres do modo alfanumérico do QR (sem espaço), até 24.
MATRICULA_MAX = 24
_MATRICULA_RE = re.compile(rf"^[A-Z0-9./-]{{1,{MATRICULA_MAX}}}$")
_QR_RE = re.compile(
    rf"^{QR_PREFIX}:(?:{QR_KIND_PERSONALIZADO}:([0-9A-F]{{8}}):([A-Z0-9./-]{{1,{MATRICULA_MAX}}})"
    rf"|{QR_KIND_UNIATENAS}:([0-9A-F]{{8}}))$"
)


def normalize_matricula(valor: str | None) -> str:
    """`trim` + maiúsculas, a mesma comparação da importação (`lower(trim(matricula_ra))`)."""
    return (valor or "").strip().upper()


def matricula_problem(valor: str | None) -> str | None:
    """Motivo pelo qual a matrícula não pode ser impressa no cartão (None se estiver ok)."""
    m = normalize_matricula(valor)
    if not m:
        return "sem_matricula"
    if not _MATRICULA_RE.match(m):
        return "formato_nao_suportado"
    return None


@dataclass(frozen=True)
class RosterEntry:
    matricula: str
    nome: str
    ies: str = ""


@dataclass(frozen=True)
class QrData:
    kind: str                # "M" personalizado | "A" uniatenas
    sim8: str
    matricula: str | None    # maiúsculas (só no personalizado)

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
        return QrData(QR_KIND_PERSONALIZADO, m.group(1), m.group(2))
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
    matricula: str = ""   # só no personalizado (normalizada ao montar o QR)
    label: str = ""       # código legível sob o QR

    @property
    def layout(self) -> str:
        return LAYOUT_UNIATENAS if self.model == MODEL_UNIATENAS else LAYOUT_SFA

    @property
    def matricula_normalizada(self) -> str:
        return normalize_matricula(self.matricula)

    @property
    def qr_payload(self) -> str:
        ref = sim8(self.simulado_id)
        if self.model == MODEL_PERSONALIZADO:
            problema = matricula_problem(self.matricula)
            if problema:
                raise ValueError(f"matrícula não pode ser impressa ({problema}): {self.matricula!r}")
            return f"{QR_PREFIX}:{QR_KIND_PERSONALIZADO}:{ref}:{self.matricula_normalizada}"
        if self.model == MODEL_UNIATENAS:
            return f"{QR_PREFIX}:{QR_KIND_UNIATENAS}:{ref}"
        raise ValueError(f"modelo desconhecido: {self.model!r}")


def _as_uuid(campo: str, valor: str) -> uuid.UUID:
    try:
        return uuid.UUID(valor.strip())
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"{campo} precisa ser um UUID: {valor!r}") from exc
