"""Roster dos alunos.

Só leitura de um CSV (`matricula,nome[,ies][,email]`), para testes e para o `gerar-cartoes` por linha de comando.
Na emissão pelo Academy a lista vem da tela. Não há ligação com o banco (decisão de 20/10/2026).
"""
from __future__ import annotations

import csv
import unicodedata
from pathlib import Path

from .models import RosterEntry, email_problem, matricula_problem, normalize_email, normalize_matricula


def _sort_key(nome: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return sem_acento.casefold()


def load_roster_csv(path: Path) -> list[RosterEntry]:
    """Lê o CSV e devolve o roster ordenado por nome (sem considerar acentos).

    Cada aluno precisa de `matricula` utilizável ou, sem ela, de `email` (plano B). A coluna `email` é opcional.
    """
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        cols = {c.strip().lower() for c in (reader.fieldnames or [])}
        if "nome" not in cols or not ({"matricula", "email"} & cols):
            raise ValueError("o CSV do roster precisa ter as colunas nome e matricula (e, opcionalmente, email)")
        entries: list[RosterEntry] = []
        seen: set[str] = set()
        for n, raw in enumerate(reader, start=2):
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
            nome = row["nome"]
            mat, email = normalize_matricula(row.get("matricula")), normalize_email(row.get("email"))
            if not nome:
                raise ValueError(f"linha {n}: nome é obrigatório")
            if mat and matricula_problem(mat):
                raise ValueError(f"linha {n}: matrícula fora do formato aceito ({mat})")
            if not mat:
                if not email:
                    raise ValueError(f"linha {n}: informe a matrícula ou, sem ela, o e-mail")
                if email_problem(email):
                    raise ValueError(f"linha {n}: e-mail não pode ir no QR ({email})")
            chave = mat or email
            if chave in seen:
                raise ValueError(f"linha {n}: {'matrícula' if mat else 'e-mail'} repetido(a) ({chave})")
            seen.add(chave)
            entries.append(RosterEntry(mat, nome, row.get("ies", ""), "" if mat else email))
    entries.sort(key=lambda e: (_sort_key(e.nome), e.matricula or e.email))
    return entries
