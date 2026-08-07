"""Decodifica os HTML de referência do handoff para uma forma legível/grepável.

Os arquivos `gestor-sanarflix-{LIGHT,DARK}.html` têm 2.4MB cada e são "bundled
pages": o documento real vem escapado como string JSON dentro de um `<script>`
no fim do arquivo. Abrir no navegador funciona, mas `grep`/`Read` não — o texto
está com `\\n`, `\\"` e `/` no lugar das quebras, aspas e barras.

Este script extrai o documento e grava, em `extracted/`:
  - `{LIGHT,DARK}.html`         documento inteiro, já desescapado
  - `{LIGHT,DARK}.css`          só os blocos <style> concatenados
  - `{LIGHT,DARK}.markup.html`  só o markup, sem os <style>

Rodar:  python docs/handoff/gestor/design/extrair-referencia.py

Como consultar depois: a referência estiliza quase tudo inline, então procure
pelo TEXTO VISÍVEL do componente e leia o bloco em volta. Ex.:

    grep -n "Alunos proficientes" extracted/LIGHT.html

e então fatie em python com PYTHONIOENCODING=utf-8 (no Windows o cp1252 quebra
com acento).
"""
import json
import os
import re

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "extracted")

# Uma string JSON completa, respeitando escapes. O documento é, de longe, a
# maior string literal do arquivo — por isso `max(..., key=len)`.
STRING_JSON = re.compile(r'"(?:\\.|[^"\\])*"', re.S)


def main() -> None:
    os.makedirs(SAIDA, exist_ok=True)
    for tema in ("LIGHT", "DARK"):
        origem = os.path.join(AQUI, f"gestor-sanarflix-{tema}.html")
        bruto = open(origem, encoding="utf-8", errors="ignore").read()
        documento = json.loads(max(STRING_JSON.findall(bruto), key=len))

        estilos = "\n\n/* ===== próximo bloco de estilo ===== */\n\n".join(
            re.findall(r"<style[^>]*>(.*?)</style>", documento, re.S)
        )
        markup = re.sub(r"<style[^>]*>.*?</style>", "", documento, flags=re.S)

        for nome, conteudo in (
            (f"{tema}.html", documento),
            (f"{tema}.css", estilos),
            (f"{tema}.markup.html", markup),
        ):
            open(os.path.join(SAIDA, nome), "w", encoding="utf-8", newline="\n").write(conteudo)

        print(f"{tema}: documento {len(documento):,} · css {len(estilos):,} · markup {len(markup):,}")


if __name__ == "__main__":
    main()
