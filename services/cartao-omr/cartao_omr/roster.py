"""Roster dos alunos.

Só leitura de um CSV (`matricula,nome[,ies]`), para testes e para o `gerar-cartoes` por linha de comando.
Na emissão pelo Academy a lista vem da tela. Não há ligação com o banco (decisão de 20/10/2026).
"""
from __future__ import annotations

import csv
import unicodedata
from pathlib import Path

from .models import RosterEntry, matricula_problem, normalize_matricula


def _sort_key(nome: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return sem_acento.casefold()


def load_roster_csv(path: Path) -> list[RosterEntry]:
    """Lê o CSV e devolve o roster ordenado por nome (sem considerar acentos)."""
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        cols = {c.strip().lower() for c in (reader.fieldnames or [])}
        if not {"matricula", "nome"} <= cols:
            raise ValueError("o CSV do roster precisa ter as colunas matricula e nome")
        entries: list[RosterEntry] = []
        seen: set[str] = set()
        for n, raw in enumerate(reader, start=2):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
            mat, nome = normalize_matricula(row["matricula"]), row["nome"]
            if not mat or not nome:
                raise ValueError(f"linha {n}: matricula e nome são obrigatórios")
            if matricula_problem(mat):
                raise ValueError(f"linha {n}: matrícula fora do formato aceito ({mat})")
            if mat in seen:
                raise ValueError(f"linha {n}: matrícula repetida ({mat})")
            seen.add(mat)
            entries.append(RosterEntry(mat, nome, row.get("ies", "")))
    entries.sort(key=lambda e: (_sort_key(e.nome), e.matricula))
    return entries
