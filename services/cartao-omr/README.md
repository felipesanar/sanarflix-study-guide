# cartao-omr

Correção automática de cartões-resposta do SanarFlix Academy (PDF digitalizado → planilha de importação).
**V0, local, sem LLM.** Especificação completa em `docs/prd/2026-10-07-cartoes-resposta.md`.

> **Estado: Fase 0.** Existem o gerador do cartão, os templates e as fixtures sintéticas.
> O leitor (`processar`) entra nas Fases 1 e 2; o runbook completo, na Fase 3.

## Instalação no Windows

Requer Python 3.11 ou superior (testado com 3.14). Todas as dependências têm wheel para Windows; não há DLL externa.

```bash
cd services/cartao-omr
py -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Se o projeto estiver numa pasta do OneDrive, o `.venv` (milhares de arquivos) sincroniza à toa. Prefira criar o venv fora dela, por exemplo
`py -m venv %LOCALAPPDATA%\cartao-omr-venv`, e usar o `python.exe` de lá no lugar de `.venv\Scripts\python.exe`.

Teste:

```bash
.venv\Scripts\python.exe -m pytest
```

## Comandos (Fase 0)

```bash
# Template JSON + PDF de exemplo dos dois layouts (padrão: templates/)
cartao-omr modelo
cartao-omr modelo --layout uniatenas

# Cartões para impressão: um personalizado por aluno do roster + genéricos no fim
cartao-omr gerar-cartoes --simulado <id> --roster roster.csv --genericos 30 \
    --nome-simulado "SIMULADO ENAMED 2026" --ies "Faculdade X" --data 25/10/2026

# Cartão UniAtenas (o mesmo PDF serve para todos os alunos)
cartao-omr gerar-cartoes --simulado <id> --modelo uniatenas --copias 1
```

Sem instalar o script, use `.venv\Scripts\python.exe -m cartao_omr <comando>`.

- `roster.csv` tem as colunas `user_id,nome` (e, opcional, `ies`). **Nesta fase é um CSV falso**; a ligação com o banco entra na Fase 2.
- A saída padrão de `gerar-cartoes` é `runs/cartoes_<simulado>/`, que está no `.gitignore`.
  PDFs com nomes de alunos reais **nunca** entram no Git.
- Impressão: só frente, escala 100% (sem "ajustar à página"), A4, papel de 75 a 90 g/m².

## Como o cartão é definido

`cartao_omr/layout.py` guarda todas as medidas (mm). `card.py` desenha o PDF e escreve
`templates/sfa_v1.json` e `templates/uniatenas_v1.json` **a partir da mesma geometria**, então PDF e template não divergem.
O template é a única fonte de coordenadas do leitor. Se mudar o `layout.py`, rode `cartao-omr modelo` e commite os templates
(um teste falha se o JSON do disco estiver desatualizado).

Convenções do template: mm, origem no canto superior esquerdo, y para baixo; marcadores `[x, y, w]` (canto superior esquerdo e lado);
bolhas `[cx, cy, d]` (centro e diâmetro).

Dois layouts: `sfa` (matrícula só com dígitos; N colunas, padrão 12) e `uniatenas` (matrícula `NN-X-NNNNN`, 8 colunas, `G` na 3ª).
Três modelos de cartão: personalizado e genérico (layout `sfa`) e UniAtenas.

## Fixtures sintéticas

```bash
python tools/make_fixtures.py                                   # conjunto de referência -> tests/fixtures/
python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes   # ~200 páginas, não versionar
```

Simula caneta preta e azul (cobertura de 65 a 100%), marcas fracas, duplas, rasuradas, X, ✓, ponto e círculo, questões em branco,
nome e matrícula manuscritos, rotação (±5° e 180°), escala (95 a 105%), translação, perspectiva leve, ruído, desfoque, JPEG,
150/200/300 dpi, fundo claro ou escuro e páginas em branco intercaladas. Cada PDF vem com um `.gabarito.json`
(descrição dos campos no topo de `tools/make_fixtures.py`). Tudo é fictício: nomes falsos e UUIDs derivados da semente (`--seed`).

## Segredos

A string de conexão do papel somente leitura (Fase 2) fica em `.env`, que **nunca** é commitado.
Copie `.env.example` para `.env`. A service role key é proibida neste serviço.
