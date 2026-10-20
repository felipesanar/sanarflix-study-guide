"""Linha de comando `cartao-omr`: `modelo`, `gerar-cartoes` e `processar` (PDF escaneado -> planilha)."""
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
from .export_xlsx import escrever_planilha, escrever_relatorio, resumo
from .layout import N_QUESTIONS
from .processar import ler_lista_emissao, processar_pdf
from .roster import load_roster_csv

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Cartões-resposta do SanarFlix Academy: gerador, template e leitor (PDF escaneado -> planilha).",
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


def _progresso(feitas: int, total: int) -> None:
    if feitas % 25 == 0 or feitas == total:
        typer.echo(f"página {feitas}/{total}")


@app.command("processar")
def processar(
    pdf: Path = typer.Argument(..., exists=True, dir_okay=False, help="PDF escaneado com os cartões preenchidos."),
    simulado: str = typer.Option(..., "--simulado", help="ID (UUID) do simulado; confere o QR de cada cartão."),
    questoes: int = typer.Option(
        N_QUESTIONS, "--questoes", min=1, max=N_QUESTIONS,
        help="Total de questões do simulado: a planilha tem exatamente 1 + N colunas (a importação exige)."),
    lista: Optional[Path] = typer.Option(
        None, "--lista", help="CSV da emissão (coluna matricula): aponta cartões fora da lista e alunos sem cartão."),
    layout: Optional[str] = typer.Option(
        None, "--layout", help="Layout a assumir quando o QR não for lido (uniatenas lê a matrícula em bolhas)."),
    saida: Optional[Path] = typer.Option(None, "--saida", help="Pasta de saída (padrão: runs/processar_<simulado>/)."),
) -> None:
    """Lê o PDF e gera respostas_<simulado>.xlsx, recortes das dúvidas e relatorio.json. Só lê arquivos: sem banco."""
    if layout is not None:
        _check_layout(layout)
    dest = saida or RUNS_DIR / f"processar_{simulado}"
    try:
        esperados = ler_lista_emissao(lista) if lista else None
        res = processar_pdf(pdf, simulado, dest, questoes, esperados, layout_hint=layout,
                            progresso=_progresso)
        xlsx = escrever_planilha(res, dest / f"respostas_{simulado}.xlsx")
        escrever_relatorio(res, dest / "relatorio.json")
    except ValueError as exc:
        typer.echo(f"Erro: {exc}", err=True)
        raise typer.Exit(2) from exc
    r = resumo(res)
    typer.echo(f"{r['paginas']} página(s): {r['identificadas']} identificada(s), {r['nao_identificadas']} não identificada(s), "
               f"{r['em_branco']} em branco, {r['ilegiveis']} ilegível(is), {r['simulado_divergente']} de outro simulado; "
               f"{r['pendencias']} pendência(s).")
    typer.echo(f"Planilha: {xlsx}")


if __name__ == "__main__":
    app()
