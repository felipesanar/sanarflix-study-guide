"""Linha de comando `cartao-omr` (Fase 0: `modelo` e `gerar-cartoes`)."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from . import __version__
from . import layout as L
from .card import (
    build_example_pdf,
    specs_personalizados,
    specs_uniatenas,
    write_cards_pdf,
    write_template,
)
from .config import RUNS_DIR, TEMPLATES_DIR
from .roster import load_roster_csv

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Cartões-resposta do SanarFlix Academy: gerador, template e (nas próximas fases) leitor.",
)


def _version(value: bool) -> None:
    if value:
        typer.echo(f"cartao-omr {__version__}")
        raise typer.Exit()


@app.callback()
def _main(
    version: bool = typer.Option(False, "--version", callback=_version, is_eager=True, help="Mostra a versão."),
) -> None:
    pass


def _check_layout(layout: str) -> str:
    if layout not in L.LAYOUTS:
        raise typer.BadParameter(f"use um de: {', '.join(L.LAYOUTS)}")
    return layout


@app.command("modelo")
def modelo(
    layout: Optional[str] = typer.Option(
        None, "--layout", help="sfa ou uniatenas. Sem a opção, gera os dois."),
    saida: Path = typer.Option(TEMPLATES_DIR, "--saida", help="Pasta de saída."),
) -> None:
    """Gera o template JSON e um PDF de exemplo (dados fictícios) de cada layout."""
    layouts = [_check_layout(layout)] if layout else list(L.LAYOUTS)
    for lay in layouts:
        tpl = write_template(lay, saida / f"{L.TEMPLATE_VERSION[lay]}.json")
        pdf = saida / f"exemplo_{lay}.pdf"
        pages = build_example_pdf(lay, pdf)
        typer.echo(f"{lay}: {tpl}  |  {pdf} ({pages} pág.)")


@app.command("gerar-cartoes")
def gerar_cartoes(
    simulado: str = typer.Option(..., "--simulado", help="ID (UUID) do simulado; vai no QR."),
    modelo_cartao: str = typer.Option("sfa", "--modelo", help="sfa (padrão) ou uniatenas."),
    roster: Optional[Path] = typer.Option(
        None, "--roster",
        help="CSV matricula,nome[,ies] com os alunos que farão a prova (sfa). Na emissão pelo Academy vem da tela."),
    copias: int = typer.Option(1, "--copias", min=1, help="Cópias do cartão UniAtenas."),
    nome_simulado: str = typer.Option("", "--nome-simulado", help="Texto do título."),
    ies: str = typer.Option("", "--ies", help="Nome da IES no cabeçalho."),
    data: str = typer.Option("", "--data", help="Data da prova, ex.: 25/10/2026."),
    saida: Optional[Path] = typer.Option(None, "--saida", help="PDF de saída (padrão: runs/cartoes_<simulado>/)."),
) -> None:
    """Gera o PDF para impressão: um cartão por aluno do roster (sfa) ou o cartão UniAtenas."""
    if modelo_cartao not in (L.LAYOUT_SFA, L.LAYOUT_UNIATENAS):
        raise typer.BadParameter("use sfa ou uniatenas", param_hint="--modelo")
    try:
        if modelo_cartao == L.LAYOUT_UNIATENAS:
            if roster:
                raise typer.BadParameter("o cartão UniAtenas não é personalizado", param_hint="--roster")
            specs = specs_uniatenas(copias, simulado, nome_simulado, ies or "UniAtenas", data)
        else:
            if not roster:
                raise typer.BadParameter("o cartão sfa é pessoal: informe os alunos com --roster", param_hint="--roster")
            specs = specs_personalizados(load_roster_csv(roster), simulado, nome_simulado, ies, data)
        if not specs:
            raise typer.BadParameter("o roster está vazio", param_hint="--roster")
        dest = saida or RUNS_DIR / f"cartoes_{simulado}" / f"cartoes_{modelo_cartao}_{simulado}.pdf"
        dest.parent.mkdir(parents=True, exist_ok=True)
        pages = write_cards_pdf(dest, specs, title=f"Cartões — simulado {simulado}")
    except ValueError as exc:
        typer.echo(f"Erro: {exc}", err=True)
        raise typer.Exit(2) from exc
    typer.echo(f"{pages} cartão(ões) em {dest}")


if __name__ == "__main__":
    app()
