"""Leitura de um PDF inteiro de cartões: página a página, identificação pela matrícula e pendências.

Sem banco e sem rede (decisão de 20/10/2026): o aluno é identificado só pelo que está no cartão
(matrícula do QR no cartão pessoal; matrícula em bolhas no UniAtenas). A coluna 1 da planilha é essa
matrícula (ou, no plano B, pelo e-mail), a chave que a importação do Academy casa com o cadastro. Quem confere se a
matrícula existe nas IES do simulado é o dry-run da importação.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from .config import DEFAULT_CONFIG, ReadConfig
from .layout import LAYOUT_UNIATENAS, N_QUESTIONS
from .models import normalize_identificacao, normalize_matricula, sim8
from .pipeline import omr
from .pipeline.page import EM_BRANCO, ILEGIVEL, OK, PageResult, load_template, read_page
from .pipeline.render import open_pdf, render_page

# tipos de pendência
SIMULADO_DIVERGENTE = "simulado_divergente"
PAGINA_ILEGIVEL = "pagina_ilegivel"
QR_ILEGIVEL = "qr_ilegivel"
MATRICULA_INVALIDA = "matricula_invalida"
ALUNO_DUPLICADO = "aluno_duplicado"
MULTIPLA = "multipla"
AMBIGUA = "ambigua"
RESPOSTA_ALEM_DO_SIMULADO = "resposta_alem_do_simulado"
FORA_DA_LISTA = "fora_da_lista"

# destino de cada página
RESPOSTAS = "respostas"
NAO_IDENTIFICADOS = "nao_identificados"
IGNORADA = "ignorada"


@dataclass
class Pendencia:
    pagina: int
    tipo: str
    detalhe: str = ""
    questao: int | None = None
    recorte: str | None = None  # caminho relativo ao diretório de saída


@dataclass
class PaginaLida:
    pagina: int
    destino: str                                   # respostas | nao_identificados | ignorada
    status: str                                    # ok | pagina_em_branco | pagina_ilegivel | simulado_divergente
    layout: str | None = None
    identificacao: str | None = None               # matrícula (QR ou bolhas) ou e-mail (plano B), normalizada
    via: str | None = None                         # matricula | email
    motivo: str = ""                               # por que não foi identificada
    respostas: dict[int, str | None] = field(default_factory=dict)
    duvidas: dict[int, str] = field(default_factory=dict)    # questão -> multipla | ambigua
    pendencias: list[Pendencia] = field(default_factory=list)


@dataclass
class Resultado:
    simulado_id: str
    total_questoes: int
    paginas: list[PaginaLida]
    ausentes: list[str]                            # da lista de emissão, sem nenhum cartão devolvido
    cfg: ReadConfig
    arquivo: str = ""

    @property
    def pendencias(self) -> list[Pendencia]:
        return [p for pg in self.paginas for p in pg.pendencias]


def ler_lista_emissao(path: Path) -> set[str]:
    """CSV da emissão (coluna `identificacao` ou `matricula`; `,` ou `;`; com ou sem BOM): as chaves esperadas."""
    linhas = Path(path).read_text(encoding="utf-8-sig").splitlines()
    if not linhas:
        raise ValueError("o CSV da lista de emissão está vazio")
    reader = csv.DictReader(linhas, delimiter=";" if ";" in linhas[0] else ",")
    cols = {(c or "").strip().lower(): c for c in (reader.fieldnames or [])}
    col = cols.get("identificacao") or cols.get("matricula")
    if col is None:
        raise ValueError("o CSV da lista de emissão precisa ter a coluna identificacao (ou matricula)")
    out = {normalize_identificacao(r[col]) for r in reader}
    out.discard("")
    return out


def _recorte(res: PageResult, layout_tpl: dict, pagina: int, tipo: str, saida: Path) -> str | None:
    """Salva o recorte do nome e do bloco da matrícula (página retificada) e devolve o caminho relativo."""
    if res.rect is None:
        return None
    k = 200 / 25.4
    caixas = [layout_tpl["crops_mm"]["nome"], layout_tpl["blocks_mm"].get("matricula") or layout_tpl["blocks_mm"]["pessoal"]]
    partes = []
    for x0, y0, x1, y1 in caixas:
        partes.append(res.rect[int(y0 * k):int(y1 * k), int(x0 * k):int(x1 * k)])
    largura = max(p.shape[1] for p in partes)
    partes = [cv2.copyMakeBorder(p, 0, 6, 0, largura - p.shape[1], cv2.BORDER_CONSTANT, value=255) for p in partes]
    img = np.vstack(partes)
    pasta = saida / "recortes"
    pasta.mkdir(parents=True, exist_ok=True)
    nome = f"pagina_{pagina:04d}_{tipo}.png"
    cv2.imwrite(str(pasta / nome), img)
    return f"recortes/{nome}"


def _miniatura(gray: np.ndarray, pagina: int, tipo: str, saida: Path) -> str:
    pasta = saida / "recortes"
    pasta.mkdir(parents=True, exist_ok=True)
    h = 1100
    esc = h / gray.shape[0]
    img = cv2.resize(gray, None, fx=esc, fy=esc, interpolation=cv2.INTER_AREA)
    nome = f"pagina_{pagina:04d}_{tipo}.png"
    cv2.imwrite(str(pasta / nome), img)
    return f"recortes/{nome}"


def ler_pagina(gray: np.ndarray, pagina: int, simulado_id: str, total_questoes: int, saida: Path,
               cfg: ReadConfig = DEFAULT_CONFIG, layout_hint: str | None = None) -> PaginaLida:
    res = read_page(gray, cfg, layout_hint, keep_rect=True)
    if res.status == EM_BRANCO:
        return PaginaLida(pagina, IGNORADA, EM_BRANCO)
    if res.status == ILEGIVEL:
        pg = PaginaLida(pagina, IGNORADA, ILEGIVEL, layout=res.layout, motivo=res.reason)
        pg.pendencias.append(Pendencia(pagina, PAGINA_ILEGIVEL, res.reason,
                                       recorte=_miniatura(gray, pagina, PAGINA_ILEGIVEL, saida)))
        return pg
    assert res.status == OK

    data = res.qr.data if res.qr else None
    if data is not None and data.sim8 != sim8(simulado_id):
        pg = PaginaLida(pagina, IGNORADA, SIMULADO_DIVERGENTE, layout=res.layout,
                        motivo=f"QR do simulado {data.sim8}, esperado {sim8(simulado_id)}")
        pg.pendencias.append(Pendencia(pagina, SIMULADO_DIVERGENTE, pg.motivo))
        return pg

    pg = PaginaLida(pagina, RESPOSTAS, OK, layout=res.layout)
    tpl = load_template(res.layout or "sfa")

    # ---- identificação
    if res.layout is None:
        pg.destino, pg.motivo = NAO_IDENTIFICADOS, QR_ILEGIVEL
        pg.pendencias.append(Pendencia(
            pagina, QR_ILEGIVEL, "QR não foi lido; use --layout uniatenas se for cartão UniAtenas",
            recorte=_recorte(res, tpl, pagina, QR_ILEGIVEL, saida)))
    elif res.layout == LAYOUT_UNIATENAS:
        m = res.matricula
        if m is not None and m.valid:
            pg.identificacao, pg.via = normalize_matricula(m.value), "matricula"
        else:
            pg.destino, pg.motivo = NAO_IDENTIFICADOS, MATRICULA_INVALIDA
            pg.pendencias.append(Pendencia(
                pagina, MATRICULA_INVALIDA, m.reason if m else "matrícula não lida",
                recorte=_recorte(res, tpl, pagina, MATRICULA_INVALIDA, saida)))
    else:
        pg.identificacao = res.identificacao
        pg.via = "email" if res.email_qr else ("matricula" if res.matricula_qr else None)

    # ---- respostas
    for q in range(1, N_QUESTIONS + 1):
        cell = res.answers[q]
        if q > total_questoes:
            if cell.kind != omr.BRANCO:
                pg.pendencias.append(Pendencia(
                    pagina, RESPOSTA_ALEM_DO_SIMULADO, f"questão {q} marcada, mas o simulado tem {total_questoes}",
                    questao=q))
            continue
        if cell.kind == omr.MARCADA:
            pg.respostas[q] = cell.value
        else:
            pg.respostas[q] = None
            if cell.kind in (omr.MULTIPLA, omr.AMBIGUA):
                pg.duvidas[q] = MULTIPLA if cell.kind == omr.MULTIPLA else AMBIGUA
                pg.pendencias.append(Pendencia(pagina, pg.duvidas[q], "célula deixada em branco", questao=q))
    return pg


def processar_pdf(pdf: Path, simulado_id: str, saida: Path, total_questoes: int = N_QUESTIONS,
                  lista: set[str] | None = None, cfg: ReadConfig = DEFAULT_CONFIG,
                  layout_hint: str | None = None, progresso=None) -> Resultado:
    """Lê todas as páginas, marca duplicados e confere com a lista de emissão (se houver)."""
    if not 1 <= total_questoes <= N_QUESTIONS:
        raise ValueError(f"o cartão tem {N_QUESTIONS} questões: informe de 1 a {N_QUESTIONS}")
    sim8(simulado_id)  # valida o UUID
    doc = open_pdf(pdf)
    paginas: list[PaginaLida] = []
    for i in range(len(doc)):
        gray = render_page(doc, i, cfg=cfg)
        paginas.append(ler_pagina(gray, i + 1, simulado_id, total_questoes, saida, cfg, layout_hint))
        if progresso:
            progresso(i + 1, len(doc))

    # duplicidade: a mesma matrícula em 2+ páginas torna todas elas pendentes (nenhuma vai para Respostas)
    por_chave: dict[str, list[PaginaLida]] = defaultdict(list)
    for pg in paginas:
        if pg.destino == RESPOSTAS and pg.identificacao:
            por_chave[pg.identificacao].append(pg)
    for chave, pgs in por_chave.items():
        if len(pgs) > 1:
            outras = ", ".join(str(p.pagina) for p in pgs)
            for pg in pgs:
                pg.destino, pg.motivo = NAO_IDENTIFICADOS, ALUNO_DUPLICADO
                pg.pendencias.append(Pendencia(pg.pagina, ALUNO_DUPLICADO, f"{chave} nas páginas {outras}"))

    # QR de cartão pessoal sem matrícula utilizável não existe (parse_qr exige), então sobra só o tipo `fora_da_lista`
    ausentes: list[str] = []
    if lista is not None:
        lidas = {pg.identificacao for pg in paginas if pg.identificacao}
        for pg in paginas:
            if pg.identificacao and pg.identificacao not in lista:
                pg.pendencias.append(Pendencia(pg.pagina, FORA_DA_LISTA,
                                               f"{pg.identificacao} não está na lista da emissão"))
        ausentes = sorted(lista - lidas)
    return Resultado(simulado_id, total_questoes, paginas, ausentes, cfg, arquivo=Path(pdf).name)
