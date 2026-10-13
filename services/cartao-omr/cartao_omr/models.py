"""Tipos de dados compartilhados."""
from __future__ import annotations

from dataclasses import dataclass

from .layout import LAYOUT_SFA, LAYOUT_UNIATENAS

QR_PREFIX = "SFA1"

MODEL_PERSONALIZADO = "personalizado"
MODEL_GENERICO = "generico"
MODEL_UNIATENAS = "uniatenas"


@dataclass(frozen=True)
class RosterEntry:
    user_id: str
    nome: str
    ies: str = ""


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
        _check_token("simulado_id", self.simulado_id)
        if self.model == MODEL_PERSONALIZADO:
            _check_token("user_id", self.user_id)
            return f"{QR_PREFIX}|sfa|{self.simulado_id}|U|{self.user_id}"
        if self.model == MODEL_GENERICO:
            return f"{QR_PREFIX}|sfa|{self.simulado_id}|G"
        if self.model == MODEL_UNIATENAS:
            return f"{QR_PREFIX}|uniatenas|{self.simulado_id}|G"
        raise ValueError(f"modelo desconhecido: {self.model!r}")


def _check_token(campo: str, valor: str) -> None:
    if not valor or "|" in valor or valor != valor.strip():
        raise ValueError(f"{campo} inválido para o QR: {valor!r}")
