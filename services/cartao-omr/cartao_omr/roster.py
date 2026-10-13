"""Roster dos alunos.

Fase 0: só leitura de um CSV falso (`user_id,nome[,ies]`) para testes.
A ligação com o banco (psycopg, só SELECT) entra na Fase 2.
"""
from __future__ import annotations

import csv
import unicodedata
from pathlib import Path

from .models import RosterEntry


def _sort_key(nome: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return sem_acento.casefold()


def load_roster_csv(path: Path) -> list[RosterEntry]:
    """Lê o CSV e devolve o roster ordenado por nome (sem considerar acentos)."""
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        cols = {c.strip().lower() for c in (reader.fieldnames or [])}
        if not {"user_id", "nome"} <= cols:
            raise ValueError("o CSV do roster precisa ter as colunas user_id e nome")
        entries: list[RosterEntry] = []
        seen: set[str] = set()
        for n, raw in enumerate(reader, start=2):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
            uid, nome = row["user_id"], row["nome"]
            if not uid or not nome:
                raise ValueError(f"linha {n}: user_id e nome são obrigatórios")
            if uid in seen:
                raise ValueError(f"linha {n}: user_id repetido ({uid})")
            seen.add(uid)
            entries.append(RosterEntry(uid, nome, row.get("ies", "")))
    entries.sort(key=lambda e: (_sort_key(e.nome), e.user_id))
    return entries
