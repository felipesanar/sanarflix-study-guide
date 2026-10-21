"""Tipos de dados compartilhados e o formato do QR.

Formato do QR (revisão 9 do PRD):
    personalizado, com matrícula (sfa)  SFA2:M:<SIM8>:<MATRICULA>   maiúsculas, modo alfanumérico (compacto)
    personalizado, plano B por e-mail   SFA2:E:<SIM8>:<EMAIL>       minúsculas, modo byte (maior)
    UniAtenas                           SFA2:A:<SIM8>
SIM8 = 8 primeiros hex do simulado_id. O cartão não leva o `user_id`: o aluno é identificado pela matrícula
(a mesma 1ª coluna da importação) ou, quando o cadastro não tem matrícula utilizável, pelo e-mail.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from .layout import LAYOUT_SFA, LAYOUT_UNIATENAS

QR_PREFIX = "SFA2"
QR_KIND_PERSONALIZADO = "M"      # matrícula
QR_KIND_EMAIL = "E"              # plano B: e-mail
QR_KIND_UNIATENAS = "A"

MODEL_PERSONALIZADO = "personalizado"
MODEL_UNIATENAS = "uniatenas"
MODELS = (MODEL_PERSONALIZADO, MODEL_UNIATENAS)

# Matrícula impressa e no QR: só caracteres do modo alfanumérico do QR (sem espaço), até 24.
MATRICULA_MAX = 24
_MATRICULA_RE = re.compile(rf"^[A-Z0-9./-]{{1,{MATRICULA_MAX}}}$")

# E-mail no QR: minúsculas, sem espaço; até 58 caracteres mantém o QR na versão 6 (módulo >= 0,73 mm na caixa de 36 mm).
EMAIL_MAX = 58
_EMAIL_PARTES = r"[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+"
_EMAIL_RE = re.compile(rf"^{_EMAIL_PARTES}$")

_QR_RE = re.compile(
    rf"^{QR_PREFIX}:(?:{QR_KIND_PERSONALIZADO}:([0-9A-F]{{8}}):([A-Z0-9./-]{{1,{MATRICULA_MAX}}})"
    rf"|{QR_KIND_EMAIL}:([0-9A-F]{{8}}):({_EMAIL_PARTES})"
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


def normalize_email(valor: str | None) -> str:
    """`trim` + minúsculas: a chave de comparação do e-mail."""
    return (valor or "").strip().lower()


def email_problem(valor: str | None) -> str | None:
    """Motivo pelo qual o e-mail não pode ir no QR (None se estiver ok)."""
    e = normalize_email(valor)
    if not e:
        return "sem_email"
    if len(e) > EMAIL_MAX:
        return "email_longo_demais"
    if not _EMAIL_RE.match(e):
        return "email_invalido"
    return None


def normalize_identificacao(valor: str | None) -> str:
    """Chave do aluno na planilha: e-mail em minúsculas ou matrícula em maiúsculas (e-mail tem `@`, matrícula não)."""
    v = (valor or "").strip()
    return normalize_email(v) if "@" in v else normalize_matricula(v)


@dataclass(frozen=True)
class RosterEntry:
    """Um aluno do roster. Identificado pela matrícula; sem matrícula utilizável, pelo e-mail."""

    matricula: str
    nome: str
    ies: str = ""
    email: str = ""


@dataclass(frozen=True)
class QrData:
    kind: str                # "M" matrícula | "E" e-mail | "A" uniatenas
    sim8: str
    matricula: str | None    # maiúsculas (só no tipo M)
    email: str | None = None  # minúsculas (só no tipo E)

    @property
    def layout(self) -> str:
        return LAYOUT_UNIATENAS if self.kind == QR_KIND_UNIATENAS else LAYOUT_SFA

    @property
    def identificacao(self) -> str | None:
        """O que vai na coluna 1 da planilha: a matrícula ou o e-mail (None no UniAtenas)."""
        return self.matricula or self.email


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
    if m.group(3):
        if len(m.group(4)) > EMAIL_MAX:
            return None
        return QrData(QR_KIND_EMAIL, m.group(3), None, m.group(4))
    return QrData(QR_KIND_UNIATENAS, m.group(5), None)


@dataclass(frozen=True)
class CardSpec:
    """Conteúdo variável de um cartão. A geometria vem do layout."""

    model: str
    simulado_id: str
    nome_simulado: str = ""
    ies: str = ""
    data: str = ""
    aluno_nome: str = ""  # só no personalizado
    matricula: str = ""   # só no personalizado, quando identificado pela matrícula
    email: str = ""       # só no personalizado, plano B: sem matrícula, o QR leva o e-mail
    label: str = ""       # código legível sob o QR

    @property
    def layout(self) -> str:
        return LAYOUT_UNIATENAS if self.model == MODEL_UNIATENAS else LAYOUT_SFA

    @property
    def matricula_normalizada(self) -> str:
        return normalize_matricula(self.matricula)

    @property
    def email_normalizado(self) -> str:
        return normalize_email(self.email)

    @property
    def por_email(self) -> bool:
        return self.model == MODEL_PERSONALIZADO and bool(self.email.strip()) and not self.matricula.strip()

    @property
    def qr_payload(self) -> str:
        ref = sim8(self.simulado_id)
        if self.model == MODEL_PERSONALIZADO:
            if self.matricula.strip() and self.email.strip():
                raise ValueError("o cartão é identificado ou pela matrícula ou pelo e-mail, não pelos dois")
            if self.por_email:
                problema = email_problem(self.email)
                if problema:
                    raise ValueError(f"e-mail não pode ir no QR ({problema}): {self.email!r}")
                return f"{QR_PREFIX}:{QR_KIND_EMAIL}:{ref}:{self.email_normalizado}"
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
