"""Serializador (`resultado.json`) e worker da leitura pelo Academy, contra uma edge function simulada."""
from __future__ import annotations

import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from typer.testing import CliRunner

from cartao_omr import worker
from cartao_omr.card import specs_genericos, specs_personalizados, write_cards_pdf
from cartao_omr.cli import app
from cartao_omr.models import RosterEntry
from cartao_omr.processar import CARTAO_GENERICO, NAO_IDENTIFICADOS, RESPOSTAS, processar_pdf
from cartao_omr.serializar import VERSAO_JSON, recortes_do_resultado, resultado_para_json

from conftest import ROOT

FIXTURES = ROOT / "tests" / "fixtures"
SIM = "9d6c1f0e-0a5b-4c3a-8d2e-123456789abc"
runner = CliRunner()


def _pdf_misto() -> bytes:
    """Dois cartões pessoais em branco e um genérico no fim."""
    alunos = [RosterEntry(nome="Ana Teste", matricula="2023001"), RosterEntry(nome="Bia Teste", matricula="2023002")]
    specs = specs_personalizados(alunos, SIM, "Simulado", "IES X") + specs_genericos(1, SIM, "Simulado", "IES X")
    buf = io.BytesIO()
    write_cards_pdf(buf, specs)
    return buf.getvalue()


# ------------------------------------------------------------------ serializador
def test_json_leva_as_respostas_de_cada_pagina(tmp_path):
    gab = json.loads((FIXTURES / "sfa_personalizado_realista.gabarito.json").read_text(encoding="utf-8"))
    res = processar_pdf(FIXTURES / gab["file"], gab["simulado_id"], tmp_path, 100)
    dados = resultado_para_json(res)
    assert dados["versao"] == VERSAO_JSON
    assert dados["resumo"]["paginas"] == len(dados["paginas"]) == len(gab["pages"])
    for pg, lida in zip(dados["paginas"], res.paginas):
        assert pg["pagina"] == lida.pagina and pg["destino"] == lida.destino
        if lida.destino != "ignorada":
            assert pg["respostas"] == {str(q): v for q, v in lida.respostas.items()}
            assert set(pg["respostas"]) == {str(q) for q in range(1, 101)}
        assert pg["duvidas"] == {str(q): v for q, v in lida.duvidas.items()}
        assert len(pg["pendencias"]) == len(lida.pendencias)
    json.dumps(dados)  # serializável


def test_recortes_sem_repeticao():
    dados = {"paginas": [
        {"pendencias": [{"recorte": "recortes/a.png"}, {"recorte": None}], "imagem": "recortes/p1.png"},
        {"pendencias": [{"recorte": "recortes/a.png"}]},
    ]}
    assert recortes_do_resultado(dados) == ["recortes/a.png", "recortes/p1.png"]


def test_processar_json_grava_resultado(tmp_path):
    pdf = tmp_path / "scan.pdf"
    pdf.write_bytes(_pdf_misto())
    saida = tmp_path / "saida"
    r = runner.invoke(app, ["processar", str(pdf), "--simulado", SIM, "--questoes", "10", "--saida", str(saida), "--json"])
    assert r.exit_code == 0, r.output
    dados = json.loads((saida / "resultado.json").read_text(encoding="utf-8"))
    assert [p["destino"] for p in dados["paginas"]] == [RESPOSTAS, RESPOSTAS, NAO_IDENTIFICADOS]
    assert set(dados["paginas"][0]["respostas"]) == {str(q) for q in range(1, 11)}


# ------------------------------------------------------------------ worker contra uma edge function simulada
class _Edge:
    """Edge function `cartao-leitura-worker` + Storage, num servidor HTTP local."""

    def __init__(self, pdf: bytes, token: str = "segredo", falhar_em: str | None = None):
        self.pdf, self.token, self.falhar_em = pdf, token, falhar_em
        self.chamadas: list[dict] = []
        self.uploads: dict[str, bytes] = {}
        edge = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):  # silencioso
                pass

            def _responder(self, codigo: int, corpo: dict | bytes):
                dados = corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode()
                self.send_response(codigo)
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)

            def do_GET(self):
                self._responder(200, edge.pdf) if self.path == "/scan.pdf" else self._responder(404, {})

            def do_PUT(self):
                n = int(self.headers["Content-Length"])
                edge.uploads[self.path.removeprefix("/upload/")] = self.rfile.read(n)
                self._responder(200, {})

            def do_POST(self):
                if self.headers.get("Authorization") != f"Bearer {edge.token}":
                    return self._responder(401, {"error": "unauthorized"})
                corpo = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                edge.chamadas.append(corpo)
                acao = corpo["acao"]
                if acao == edge.falhar_em:
                    return self._responder(500, {"error": "boom"})
                base = f"http://127.0.0.1:{edge.porta}"
                if acao == "obter":
                    return self._responder(200, {"leitura": {"id": corpo["leitura_id"], "simulado_id": SIM,
                                                             "total_questoes": 10},
                                                 "download_url": f"{base}/scan.pdf"})
                if acao == "urls_recortes":
                    return self._responder(200, {"urls": {c: f"{base}/upload/{c}" for c in corpo["caminhos"]}})
                return self._responder(200, {"ok": True})

        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.porta = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.porta}"

    def acoes(self) -> list[str]:
        return [c["acao"] for c in self.chamadas]


@pytest.fixture
def edge():
    e = _Edge(_pdf_misto())
    yield e
    e.srv.shutdown()


def test_worker_caminho_feliz(edge, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", edge.url)
    monkeypatch.setenv("CARTAO_WORKER_TOKEN", "segredo")
    monkeypatch.setenv("CARTAO_WORKER_RUN_URL", "https://github.com/x/y/actions/runs/1")
    assert worker.main(["--leitura", "L1"]) == 0
    assert edge.acoes() == ["obter", "urls_recortes", "concluir"]
    assert edge.chamadas[0]["run_url"] == "https://github.com/x/y/actions/runs/1"
    assert all(c["leitura_id"] == "L1" for c in edge.chamadas)

    dados = edge.chamadas[-1]["resultado"]
    generico = dados["paginas"][2]
    assert generico["destino"] == NAO_IDENTIFICADOS and generico["motivo"] == CARTAO_GENERICO
    # o recorte do nome/matrícula e a página inteira foram enviados
    assert generico["imagem"] == "recortes/pagina_0003_pagina.png"
    assert set(edge.uploads) == set(recortes_do_resultado(dados))
    assert all(b[:8] == b"\x89PNG\r\n\x1a\n" for b in edge.uploads.values())
    # páginas identificadas sem dúvida não ganham imagem
    assert "imagem" not in dados["paginas"][0]


def test_worker_falha_avisa_a_edge(monkeypatch):
    e = _Edge(b"isto nao e um pdf")
    try:
        monkeypatch.setenv("SUPABASE_URL", e.url)
        monkeypatch.setenv("CARTAO_WORKER_TOKEN", "segredo")
        assert worker.main(["--leitura", "L2"]) == 1
        assert e.acoes() == ["obter", "falhar"]
        assert e.chamadas[-1]["erro"]
    finally:
        e.srv.shutdown()


def test_worker_token_errado_falha(edge, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", edge.url)
    monkeypatch.setenv("CARTAO_WORKER_TOKEN", "errado")
    assert worker.main(["--leitura", "L3"]) == 1
    assert edge.chamadas == []


def test_worker_modo_falhar(edge, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", edge.url)
    monkeypatch.setenv("CARTAO_WORKER_TOKEN", "segredo")
    assert worker.main(["--leitura", "L4", "--falhar", "run cancelado"]) == 0
    assert edge.chamadas == [{"acao": "falhar", "leitura_id": "L4", "erro": "run cancelado"}]


def test_worker_sem_variaveis(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("CARTAO_WORKER_TOKEN", raising=False)
    assert worker.main(["--leitura", "L5"]) == 2
