# cartao-omr

Correção automática de cartões-resposta do SanarFlix Academy (PDF digitalizado → planilha de importação).
**V0, local, sem LLM.** Especificação completa em `docs/prd/2026-10-07-cartoes-resposta.md` (revisão 8).

> **Estado: Fases 0, 1, 2 e E (rev. 8).** Existem o gerador do cartão, os templates, as fixtures sintéticas, o pipeline de leitura
> de uma página (`cartao_omr/pipeline/`), a emissão dos cartões no Academy, em TypeScript, e o comando `processar` (PDF -> planilha, sem banco).
> Falta o aceite físico (imprimir e escanear) e o piloto; o runbook completo entra na Fase 3.

## Como a operação funciona

1. Uma tela do Academy (a construir) emite os cartões: o time seleciona a IES, o simulado e os alunos. O PDF sai pronto para imprimir.
2. **Cada cartão é pessoal**: traz o **nome e a matrícula** do aluno impressos e a matrícula também num QR. Não há cartão genérico. Aluno sem matrícula utilizável no cadastro (vazia, fora do formato ou repetida) não recebe cartão: a tela lista quem ficou de fora e baixa um CSV.
3. A IES aplica a prova, escaneia os cartões preenchidos num PDF e devolve.
4. O script (`cartao-omr processar`) lê o PDF localmente, **sem banco**, e gera a planilha de respostas com a matrícula na coluna 1: é a chave que a importação do Academy já casa com `users.matricula_ra`.

Exceção: o grupo **UniAtenas** usa um cartão único, sem personalização, em que o aluno marca a matrícula em bolhas (`NN-X-NNNNN`).

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

## Comandos

```bash
# Template JSON + PDF de exemplo dos dois layouts (padrão: templates/)
cartao-omr modelo
cartao-omr modelo --layout uniatenas

# Um cartão por aluno do roster (ordenado por nome)
cartao-omr gerar-cartoes --simulado <uuid-do-simulado> --roster roster.csv \
    --nome-simulado "SIMULADO ENAMED 2026" --ies "Faculdade X" --data 25/10/2026

# Cartão UniAtenas (o mesmo PDF serve para todos os alunos)
cartao-omr gerar-cartoes --simulado <uuid-do-simulado> --modelo uniatenas --copias 1

# PDF escaneado -> respostas_<simulado>.xlsx (+ recortes/ e relatorio.json), sem banco
cartao-omr processar scan.pdf --simulado <uuid-do-simulado> --questoes 100 \
    --lista lista_da_emissao.csv          # opcional: baixada na tela de emissão
cartao-omr processar scan.pdf --simulado <uuid> --layout uniatenas   # se o QR do UniAtenas não for lido
```

Sem instalar o script, use `.venv\Scripts\python.exe -m cartao_omr <comando>`.

- `--simulado` precisa ser um UUID. O `roster.csv` é `matricula,nome` (opcional `ies`); a matrícula usa só `A-Z`, `0-9`, `.`, `/` e `-` (até 24 caracteres) e não pode se repetir. Na emissão pelo Academy a lista vem da tela.
- `processar`: `--questoes N` é o total de questões do simulado (a planilha tem exatamente `1 + N` colunas, como a importação exige; marcas depois da questão N viram pendência). Saída padrão em `runs/processar_<simulado>/`.
  Abas do xlsx: `Respostas` (a única que a importação lê), `Pendências`, `Não identificados`, `Resumo`. Dúvidas (`multipla`/`ambigua`) ficam em branco, amarelas e com comentário. A coluna 1 é texto (preserva zeros e letras).
- A saída padrão de `gerar-cartoes` é `runs/cartoes_<simulado>/`, que está no `.gitignore`.
  PDFs com nomes de alunos reais **nunca** entram no Git.
- Impressão: só frente, escala 100% (sem "ajustar à página"), A4, papel de 75 a 90 g/m².

## Pipeline de leitura (Fase 1)

`cartao_omr/pipeline/` são funções puras, sem banco e sem arquivos:

| Módulo | O que faz |
|---|---|
| `render.py` | página do PDF → imagem em cinza (200 dpi); detecta página em branco |
| `align.py` | acha os 4 marcadores de canto e o de orientação, calcula a homografia mm → pixel (qualquer rotação: 0°, 90°, 180°, 270°) e retifica a página |
| `qr.py` | lê o QR (`zxing-cpp`) e interpreta com `models.parse_qr` |
| `omr.py` | mede a tinta em cada bolha e classifica: `marcada`, `branco`, `multipla` ou `ambigua`; lê a matrícula do UniAtenas |
| `page.py` | `read_page(gray)` junta tudo e devolve um `PageResult` (status `ok`, `pagina_em_branco` ou `pagina_ilegivel`); `identificacao` é a matrícula do QR (sfa) ou das bolhas (UniAtenas) |

`cartao_omr/processar.py` usa essas funções para ler o PDF inteiro, e `export_xlsx.py` escreve a planilha.

```python
from cartao_omr.pipeline.page import read_page
from cartao_omr.pipeline.render import open_pdf, render_page

doc = open_pdf("cartoes.pdf")
res = read_page(render_page(doc, 0))
res.identificacao, res.matricula_qr, res.qr_ilegivel, res.answers[1].kind, res.answers[1].value
```

Limiares em `cartao_omr/config.py` (`ReadConfig`). Para medir e calibrar:

```bash
python tools/eval_accuracy.py                                   # fixtures versionadas
python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes
python tools/eval_accuracy.py runs/fixtures_grandes --calibrar  # busca T_ALTO / T_BAIXO / GAP_MIN
python tools/make_fixtures.py --preset estresse --saida runs/fixtures_estresse   # resolução baixa, ruído, JPEG pesado
```

O avaliador imprime a matriz de confusão, os critérios de aceite e exemplos dos erros. Questões "não estritas"
(marca fraca, X, ✓, ponto, círculo, rasura) podem sair como `ambigua`, mas **nunca** como uma letra errada.

## Como o cartão é definido

`cartao_omr/layout.py` guarda todas as medidas (mm). `card.py` desenha o PDF e escreve
`templates/sfa_v3.json` e `templates/uniatenas_v1.json` **a partir da mesma geometria**, então PDF e template não divergem.
O template é a única fonte de coordenadas do leitor. Se mudar o `layout.py`, rode `cartao-omr modelo` e commite os templates
(um teste falha se o JSON do disco estiver desatualizado).

Convenções do template: mm, origem no canto superior esquerdo, y para baixo; marcadores `[x, y, w]` (canto superior esquerdo e lado);
bolhas `[cx, cy, d]` (centro e diâmetro). No `sfa_v3`, `matricula` (bolhas) é `null`; a matrícula impressa é texto, com recorte em `crops_mm.matricula_impressa`.

**QR** (formato `SFA2`, maiúsculas, modo alfanumérico):

| Cartão | Conteúdo | Versão / módulo |
|---|---|---|
| personalizado (`sfa`) | `SFA2:M:<SIM8>:<MATRICULA>` | 3 (pior caso, 24 caracteres) / 0,75 mm |
| UniAtenas | `SFA2:A:<SIM8>` | 1 / 1,03 mm |

`SIM8` são os 8 primeiros hex do `simulado_id`; `MATRICULA` é a `matricula_ra` normalizada (`trim`, maiúsculas), o último campo. O tipo antigo `SFA2:S` (com `user_id`) não existe mais. `cartao_omr.models.parse_qr` faz a leitura inversa.

## Emissão dos cartões no Academy (TypeScript)

A tela **Admin → Simulados → Cartões-resposta** gera o PDF no próprio navegador, sem serviço externo. O código está em
`src/features/cartoes/` (na raiz do repositório) e usa **os mesmos templates** deste serviço:

- Cada template tem a **lista de desenho** (`draw`, descrita em `cartao_omr/drawlist.py`). O Python (`card.py`) e o
  TypeScript (`render.ts`) só a interpretam; nenhum dos dois tem medida própria.
- O QR é gerado por `qr.ts`, sem dependência nova, e é idêntico ao do `segno` (conferido em 86 vetores: `python tools/gen_qr_golden.py`
  gera `src/features/cartoes/__tests__/qr-golden.json`).
- `tools/emitir_ts.mts` roda o mesmo código pelo Node, para testar e para conferir um PDF fora do navegador:

```bash
node services/cartao-omr/tools/emitir_ts.mts entrada.json saida.pdf   # na raiz do repositório; Node 22.18+ e `npm install`
```

  `entrada.json`: `{"layout": "sfa", "simuladoId": "<uuid>", "nomeSimulado": "...", "ies": "...", "data": "25/10/2026",
  "alunos": [{"matricula": "2023001234", "nome": "..."}]}` (ou `"layout": "uniatenas", "copias": 1`).
- `tests/test_emissao_ts.py` executa esse script e compara o PDF com o do Python (pula se não houver Node ou `node_modules`).
  Os testes do front: `npx vitest run src/features/cartoes`.

Se mudar o `layout.py`: rode `cartao-omr modelo` (regenera os templates e a lista de desenho) e commite; os testes de
sincronia falham até isso ser feito.

## Fixtures sintéticas

```bash
python tools/make_fixtures.py                                   # conjunto de referência -> tests/fixtures/
python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes   # ~250 páginas, não versionar
```

Simula caneta preta e azul (cobertura de 65 a 100%), marcas fracas, duplas, rasuradas, X, ✓, ponto e círculo, questões em branco,
matrícula e nome manuscritos (UniAtenas), QR danificado, marcador coberto, rotação (±5° e 180°), escala (95 a 105%), translação,
perspectiva leve, ruído, desfoque, JPEG, 150/200/300 dpi, fundo claro ou escuro e páginas em branco intercaladas.
Cada PDF vem com um `.gabarito.json` (descrição dos campos no topo de `tools/make_fixtures.py`).
Tudo é fictício: nomes e matrículas falsos e UUIDs de simulado derivados da semente (`--seed`).

## Segredos

Este serviço **não acessa o banco** (rev. 8): não há `.env`, papel de leitura nem credencial. A service role key é proibida.
