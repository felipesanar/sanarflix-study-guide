"""Worker da leitura pelo Academy: `python -m cartao_omr.worker --leitura <uuid>`.

Roda no GitHub Actions (workflow `cartao-leitura.yml`), disparado pela tela Admin → Simulados → Leitura de cartões.
Fala só com a edge function `cartao-leitura-worker`, autenticado pelo segredo `CARTAO_WORKER_TOKEN`; **não usa
a service role nem acessa o banco**. Quem grava no banco é a edge function.

Variáveis de ambiente:
  SUPABASE_URL           ex.: https://<projeto>.supabase.co
  CARTAO_WORKER_TOKEN    segredo compartilhado com a edge function
  CARTAO_WORKER_RUN_URL  (opcional) link do run do GitHub Actions, exibido na tela

Passos: `obter` (dados da leitura + URL assinada do PDF) → baixa e lê o PDF → `urls_recortes` (URLs assinadas de
upload) → envia as imagens → `concluir` (o JSON de `serializar.resultado_para_json`). Qualquer erro vira `falhar`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import traceback
import urllib.error
import urllib.request
from pathlib import Path

import cv2

from .processar import IGNORADA, NAO_IDENTIFICADOS, processar_pdf
from .pipeline.render import open_pdf, render_page
from .serializar import recortes_do_resultado, resultado_para_json

FUNCAO = "cartao-leitura-worker"
ALTURA_IMAGEM = 1600  # px da imagem de página inteira mostrada na revisão (~5,4 px/mm)
QUALIDADE_JPEG = 70   # JPEG: ~3,5x menor que PNG num scan realista; bolhas e escrita continuam legíveis
TIPOS = {".png": "image/png", ".jpg": "image/jpeg"}
TIMEOUT = 120


class ErroWorker(RuntimeError):
    pass


class Cliente:
    """Chamadas à edge function `cartao-leitura-worker` e uploads para URLs assinadas."""

    def __init__(self, supabase_url: str, token: str, leitura_id: str):
        self.url = supabase_url.rstrip("/") + f"/functions/v1/{FUNCAO}"
        self.token = token
        self.leitura_id = leitura_id

    def chamar(self, acao: str, **campos) -> dict:
        corpo = json.dumps({"acao": acao, "leitura_id": self.leitura_id, **campos}).encode("utf-8")
        req = urllib.request.Request(self.url, data=corpo, method="POST", headers={
            "Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as exc:
            detalhe = exc.read().decode("utf-8", "replace")[:500]
            raise ErroWorker(f"{acao}: HTTP {exc.code} {detalhe}") from exc

    @staticmethod
    def baixar(url: str, dest: Path) -> None:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as r, open(dest, "wb") as f:
            while bloco := r.read(1 << 20):
                f.write(bloco)

    @staticmethod
    def enviar(url: str, arquivo: Path) -> None:
        tipo = TIPOS.get(arquivo.suffix.lower(), "application/octet-stream")
        req = urllib.request.Request(url, data=arquivo.read_bytes(), method="PUT",
                                     headers={"Content-Type": tipo, "x-upsert": "true"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT):
                pass
        except urllib.error.HTTPError as exc:
            raise ErroWorker(f"upload de {arquivo.name}: HTTP {exc.code}") from exc


def precisa_de_imagem(pg: dict) -> bool:
    """Página que alguém vai olhar na revisão: não identificada ou com dúvida de marcação."""
    return pg["destino"] == NAO_IDENTIFICADOS or (pg["destino"] != IGNORADA and bool(pg["duvidas"]))


def gerar_imagens(pdf: Path, dados: dict, saida: Path) -> None:
    """Imagem de página inteira (`recortes/pagina_NNNN_pagina.jpg`) para as páginas que vão à revisão."""
    alvo = [pg for pg in dados["paginas"] if precisa_de_imagem(pg)]
    if not alvo:
        return
    doc = open_pdf(pdf)
    pasta = saida / "recortes"
    pasta.mkdir(parents=True, exist_ok=True)
    for pg in alvo:
        gray = render_page(doc, pg["pagina"] - 1)
        esc = ALTURA_IMAGEM / gray.shape[0]
        img = cv2.resize(gray, None, fx=esc, fy=esc, interpolation=cv2.INTER_AREA)
        nome = f"pagina_{pg['pagina']:04d}_pagina.jpg"
        cv2.imwrite(str(pasta / nome), img, [cv2.IMWRITE_JPEG_QUALITY, QUALIDADE_JPEG])
        pg["imagem"] = f"recortes/{nome}"


def executar(cliente: Cliente, run_url: str | None = None, log=print) -> dict:
    info = cliente.chamar("obter", run_url=run_url)
    leitura = info["leitura"]
    with tempfile.TemporaryDirectory(prefix="cartao-leitura-") as tmp:
        tmp = Path(tmp)
        pdf = tmp / "scan.pdf"
        log("baixando o PDF…")
        cliente.baixar(info["download_url"], pdf)
        saida = tmp / "saida"
        saida.mkdir()

        def progresso(feitas: int, total: int) -> None:
            if feitas % 25 == 0 or feitas == total:
                log(f"página {feitas}/{total}")

        res = processar_pdf(pdf, leitura["simulado_id"], saida, int(leitura["total_questoes"]), progresso=progresso)
        dados = resultado_para_json(res)
        gerar_imagens(pdf, dados, saida)

        caminhos = recortes_do_resultado(dados)
        if caminhos:
            urls = cliente.chamar("urls_recortes", caminhos=caminhos)["urls"]
            for caminho in caminhos:
                cliente.enviar(urls[caminho], saida / caminho)
            log(f"{len(caminhos)} imagem(ns) enviada(s)")
        cliente.chamar("concluir", resultado=dados)
    r = dados["resumo"]
    log(f"{r['paginas']} página(s): {r['identificadas']} identificada(s), {r['nao_identificadas']} não identificada(s), "
        f"{r['pendencias']} pendência(s).")
    return dados


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m cartao_omr.worker")
    ap.add_argument("--leitura", required=True, help="ID da leitura (tabela cartao_leituras).")
    ap.add_argument("--falhar", metavar="MENSAGEM", help="Só marca a leitura como falha (passo `if: failure()`).")
    args = ap.parse_args(argv)
    url, token = os.environ.get("SUPABASE_URL"), os.environ.get("CARTAO_WORKER_TOKEN")
    if not url or not token:
        print("Erro: defina SUPABASE_URL e CARTAO_WORKER_TOKEN.", file=sys.stderr)
        return 2
    cliente = Cliente(url, token, args.leitura)
    if args.falhar is not None:
        cliente.chamar("falhar", erro=args.falhar[:1000])
        return 0
    try:
        executar(cliente, os.environ.get("CARTAO_WORKER_RUN_URL"))
        return 0
    except Exception as exc:  # noqa: BLE001 — qualquer erro precisa chegar à tela
        traceback.print_exc()
        try:
            cliente.chamar("falhar", erro=f"{type(exc).__name__}: {exc}"[:1000])
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
