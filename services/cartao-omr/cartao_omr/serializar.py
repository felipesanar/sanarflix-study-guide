"""Resultado da leitura em JSON: o que o worker envia ao Academy (e o `processar --json` grava ao lado do xlsx).

Ao contrário do `relatorio.json`, leva as respostas de cada página, para a tela de revisão montar as linhas
da importação sem precisar do xlsx. As chaves das respostas e dúvidas viram texto ("1".."100"), como no JSON.
"""
from __future__ import annotations

import json
from pathlib import Path

from .export_xlsx import resumo
from .processar import Resultado

VERSAO_JSON = 1


def resultado_para_json(res: Resultado) -> dict:
    paginas = []
    for pg in res.paginas:
        paginas.append({
            "pagina": pg.pagina,
            "destino": pg.destino,
            "status": pg.status,
            "layout": pg.layout,
            "identificacao": pg.identificacao,
            "via": pg.via,
            "motivo": pg.motivo,
            "respostas": {str(q): v for q, v in sorted(pg.respostas.items())},
            "duvidas": {str(q): v for q, v in sorted(pg.duvidas.items())},
            "pendencias": [
                {"tipo": p.tipo, "detalhe": p.detalhe, "questao": p.questao, "recorte": p.recorte}
                for p in pg.pendencias
            ],
        })
    return {
        "versao": VERSAO_JSON,
        "resumo": resumo(res),
        "ausentes_da_lista": res.ausentes,
        "paginas": paginas,
    }


def recortes_do_resultado(dados: dict) -> list[str]:
    """Caminhos relativos (`recortes/...`) citados no JSON, sem repetição e na ordem em que aparecem."""
    vistos: dict[str, None] = {}
    for pg in dados["paginas"]:
        for p in pg["pendencias"]:
            if p.get("recorte"):
                vistos.setdefault(p["recorte"], None)
        if pg.get("imagem"):
            vistos.setdefault(pg["imagem"], None)
    return list(vistos)


def escrever_json(res: Resultado, dest: Path) -> Path:
    dest.write_text(json.dumps(resultado_para_json(res), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dest
