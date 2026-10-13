# Handoff — Fase 0: Cartão SFA (gerador, template e fixtures)

- **Data:** 13/10/2026
- **Branch:** `feat/cartoes-resposta` (merge com `origin/main` feito no início: já estava atualizada)
- **Tag:** `cartoes-fase-0`
- **Testes:** `services/cartao-omr` → **82 passed**. A suíte do front não foi rodada: a fase só tocou `services/` e `docs/`.
- **Portões de produção:** nenhum, como previsto. Houve **uma consulta SELECT agregada** (seção 3), aprovada pelo João na sessão.

## 1. O que foi feito
Pacote `services/cartao-omr/` (Python, venv com `py -m venv`; todas as dependências do PRD instalam por wheel no Windows, Python 3.14):

| Arquivo | Papel |
|---|---|
| `cartao_omr/layout.py` | Todas as medidas (mm) e a geometria dos dois layouts. Fonte única. |
| `cartao_omr/card.py` | Desenha o PDF (`reportlab` + `segno`) e escreve os templates a partir da **mesma** geometria. |
| `cartao_omr/cli.py` | `cartao-omr modelo [--layout]` e `cartao-omr gerar-cartoes` (sem banco). |
| `cartao_omr/roster.py` | Lê o CSV falso `user_id,nome[,ies]`, ordenado por nome sem considerar acentos. A parte do banco entra na Fase 2. |
| `cartao_omr/models.py`, `config.py` | Tipos e caminhos. |
| `templates/sfa_v1.json`, `uniatenas_v1.json` | Coordenadas exatas (contrato da seção 7.1, com campos extras, ver 2.3). |
| `templates/exemplo_sfa.pdf`, `exemplo_uniatenas.pdf` | **PDFs de exemplo para a conferência visual do João** (aceite da fase). |
| `tools/make_fixtures.py` | Gera cartões preenchidos e "digitalizados" + gabarito JSON. |
| `tests/` | 82 testes (template, PDF, CLI, fixtures). |
| `README.md`, `.gitignore`, `.env.example`, `pyproject.toml` | Instalação, regras de dados pessoais e segredos. |

Modelos gerados: **personalizado** (QR `SFA1|sfa|<sim>|U|<user_id>`), **genérico** (`SFA1|sfa|<sim>|G`) e **UniAtenas** (`SFA1|uniatenas|<sim>|G`).

### Testes exigidos pelo PRD
- `sfa`: 400 bolhas de resposta e N×10 de matrícula (N = 12 → 120); `uniatenas`: 400 e 7×10 + 11 = 81. ✔
- Sem sobreposição entre bolhas (folga mínima de 0,4 mm). ✔
- Bolhas, QR e blocos dentro da área útil (x 20–190, y 20–277). ✔
- QR gerado é lido de volta pelo `zxing-cpp`, a 200 e a 150 dpi, nos três modelos. ✔
- Extras: marcadores e bolhas do PDF renderizado estão nas posições do template; só preto e cinza; PDF determinístico; template do disco sincronizado com o gerador; nomes longos não invadem o QR.

### Fixtures (`tests/fixtures/`, 6,3 MB, 25 páginas)
`sfa_personalizado_limpo`, `sfa_generico_realista`, `sfa_dificil`, `uniatenas_realista` (cada um com `.gabarito.json`) e `roster_ficticio.csv`.
Cobrem tudo o que a Fase 0 pede: caneta preta/azul com cobertura de 65–100%, marcas fracas, duplas, rasuradas, X, ✓, ponto, círculo, sujeira, questões em branco, matrícula preenchida (com zero à esquerda, colunas em branco à direita, `G` na 3ª coluna do UniAtenas, matrículas com defeito), rotação até ±3,8° (o gerador aceita ±5°) e 180°, escala 95–105%, translação, perspectiva leve, ruído, JPEG, 150/200/300 dpi, fundo escuro, páginas em branco intercaladas e uma página ilegível proposital (marcador coberto).
`python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes` gera ~200 páginas para a calibração da Fase 1 (não versionar).

## 2. Decisões e desvios do PRD

### 2.1 Desvio de geometria (precisa de olhar do João)
- **Passo vertical da matrícula: 5,0 mm no `sfa` e 4,5 mm no `uniatenas`, em vez de 5,5 mm.** Com 5,5 mm, título + caixa de 6 mm + 10 bolhas de 4 mm dão ~112 mm, e o PRD exige o bloco superior em y ≤ 108 mm. O UniAtenas (11 bolhas na coluna 3) piora. As bolhas continuam com 4 mm de diâmetro; no UniAtenas sobra 0,5 mm entre bolhas vizinhas. Se a Fase 1 mostrar vazamento de tinta para a bolha vizinha, a saída é reduzir o diâmetro da bolha de matrícula do UniAtenas para 3,6 mm.
- **Quadro da matrícula e das instruções: y de 44 a 108 mm** (o PRD cita 106 em um trecho e 108 em outro).
- **UniAtenas:** colunas de 7 mm (não 6) e vãos de 5 mm com o hífen impresso; o bloco todo fica centrado nos 72 mm.
- **`sfa`:** coluna de 6 mm até N = 12 (72 mm). Para N de 13 a 14 a coluna estreita para 72/N mm. Acima de 14, erro.
- **Marcador de orientação:** fica a 3 mm do `tl`, como no PRD, o que invade a folga de 4 mm daquele marcador (o teste ignora esse lado).
- **Instruções:** o exemplo "duas bolhas" ganhou uma linha própria, porque a lista do PRD tem 5 incorretos e só cabem 4 ao lado do rótulo.
- **Fonte:** Helvetica padrão do PDF (sem TTF), para não depender de fonte instalada.

### 2.2 Escolhas de implementação
- **QR:** nível Q, 4 módulos de zona de silêncio dentro dos 30 × 30 mm. No pior caso (UUIDs no simulado e no aluno) é versão 7, 45 módulos, **0,566 mm por módulo** (≈ 4,5 px a 200 dpi). O UniAtenas é versão 5 (0,667 mm). Mais denso do que isso, o QR passaria a ser um risco; está registrado em `qr.worst_case` no template.
- **Rótulo sob o QR:** 8 primeiros caracteres do `user_id` (personalizado), `G-0001…` (genérico), `UNIATENAS`.
- **`gerar-cartoes`:** além do PRD, aceita `--nome-simulado`, `--ies`, `--data`, `--matricula-colunas` e `--saida`. Sem `--roster` gera só genéricos. O UniAtenas usa "UniAtenas" como IES se `--ies` faltar.
- **`crops_mm.nome`** = linha do aluno (x 20–150, y 30–41); **`crops_mm.matricula`** = quadro inteiro.

### 2.3 Template: campos além do contrato 7.1
`layout`, `conventions` (unidades, origem e significado de `[x,y,w]`), `useful_area_mm`, `qr` (`error_level`, `quiet_modules`, `worst_case`), `blocks_mm`, `matricula.n_columns`. **Convenção dos marcadores: `[x, y, w]` com `x, y` = canto superior esquerdo do quadrado** (não o centro; para a homografia, use `x + w/2`, `y + w/2`).

## 3. Consulta em produção (somente leitura)
Projeto `gvqvrmkizemwsasmupmo` (ref confirmado antes da chamada). SELECT agregado do PRD, executado em 13/10/2026:

| IES | com matrícula | max_len | só dígitos |
|---|---|---|---|
| Fame | 30 | 4 | sim |
| Famp | 10 | 10 | sim |
| Fatec | 1 | 10 | sim |
| Funepe | 136 | 5 | sim |
| **Integrado** | 7 | 9 | **não** |
| **Integrado Macapá** | 1 | 9 | **não** |
| UNIFIP | 699 | 11 | sim |
| UNIVILLE | 39 | 10 | sim |
| UVA | 26 | 10 | sim |
| PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO, VALENÇA | 512 / 399 / 103 / 288 / 124 / 168 | 10 | não (campi UniAtenas, layout próprio) |
| B2B, B2C, Claretiano, FAI, TESTE_IES, UEA, USCS (3 unidades) | 0 | – | – |

- **N:** o maior comprimento entre as IES só com dígitos é 11 (UNIFIP). **Mantido N = 12** (11 + 1 de folga). É só um parâmetro (`--matricula-colunas`), não exige redesenho.
- **Regra de parada do PRD acionada:** `Integrado` (7 alunos) e `Integrado Macapá` (1) têm matrícula **com letras** e não pertencem ao grupo UniAtenas. A grade do `sfa` só cobre dígitos. **Não foi redesenhado nada; a decisão é do João** (ver "Pendências"). Impacto limitado: esses 8 alunos são identificados pelo QR no cartão personalizado; só o cartão genérico ficaria sem leitura de matrícula, indo para Pendências com o recorte do nome.

## 4. Pendências
1. **João decide o que fazer com Integrado / Integrado Macapá** (opções: manter a grade de dígitos e aceitar as pendências; ou grade alfanumérica só para essas IES; ou pedir à IES matrícula numérica). Posso rodar uma consulta mascarada (dígito → `9`, letra → `A`) para ver o formato, **mediante nova aprovação**.
2. **Conferência visual** dos dois PDFs de exemplo (aceite da fase): `services/cartao-omr/templates/exemplo_sfa.pdf` (página 1 personalizado, página 2 genérico) e `exemplo_uniatenas.pdf`. Imprimir em A4 a 100% também ajuda a validar o tamanho das bolhas.
3. **P4 (PRD seção 13):** confirmar com a UniAtenas se `G` é a única letra possível na 3ª posição. O layout foi feito com `G`, como o PRD manda.
4. P2, P3, P5 seguem abertas (não bloqueiam a Fase 1).

## 5. Portões não executados
Nenhum previsto na Fase 0. O primeiro é o da Fase 2 (papel `cartao_omr_reader`).

## 6. Notas para a próxima fase (Fase 1 — pipeline de leitura)
- **Contrato do gabarito** (`tests/fixtures/*.gabarito.json`): por questão, `truth` (`marcada|branco|multipla|ambigua`), `strict`, `tolerated`, `letter(s)`, `kind` e `cov` (cobertura de tinta medida em A–D). Por página, `scan.mm_to_px` (homografia 3×3 do mm do template para o pixel), `dpi`, rotação, `flip180`, fundo, `legible` e `matricula` (`columns`, `value`, `status`, `defect`).
- **Métrica de acerto por bolha** = só questões `strict` (marcada, branco, multipla, sujeira). Nas não estritas (fraca, X, ✓, ponto, círculo, rasura) o leitor pode responder `truth` ou algo de `tolerated`, **mas nunca uma letra errada**. Páginas com `kind: "branco"` esperam `pagina_em_branco`; `legible: false` espera `pagina_ilegivel`.
- O conjunto de referência tem ~25 páginas (~10 mil bolhas): serve para desenvolver, mas para medir 99,8% com significância use `--preset completo` (e outras sementes).
- Os QRs das fixtures foram lidos pelo `zxing-cpp` em 100% das páginas legíveis (a página inteira, em 150/200/300 dpi, inclusive a 180°). O `zxing-cpp` já trata a rotação do QR.
- A rotação de ±5° em tela A4 corta os marcadores; o gerador aumenta a tela (`scan.pad_mm`) em vez de cortá-los. Páginas reais de ADF podem ter tela exatamente A4 e perder cantos; isso é caso de `pagina_ilegivel`.
- O leitor deve usar `templates/*.json` (nunca medir o PDF) e o campo `qr.worst_case.module_mm` como referência de resolução mínima do QR.
- Dependências: `opencv-python-headless` 5.0 e `numpy` 2.5 resolveram sem problema; `cv2.getPerspectiveTransform`, `cv2.warpPerspective` e `zxingcpp.read_barcodes(np.ndarray)` funcionam como esperado.

## 7. Próximos passos
**Meus (Claude):**
1. Fase 1: `pipeline/render.py`, `align.py`, `qr.py`, `omr.py`, `tools/eval_accuracy.py` e a calibração de `T_ALTO`, `T_BAIXO` e `GAP_MIN` sobre as fixtures. É go/no-go.
2. Se você decidir pela grade alfanumérica para Integrado, ajustar `layout.py` e regenerar templates, PDFs de exemplo e fixtures.

**Do João:**
1. Abrir `exemplo_sfa.pdf` e `exemplo_uniatenas.pdf`, conferir contra a referência visual e dizer se aprova ou o que mudar (aceite da Fase 0).
2. Decidir sobre Integrado / Integrado Macapá (pendência 1) e responder a P4 com a UniAtenas.
3. Dizer se faço o `push` da branch e da tag `cartoes-fase-0` (o push fica com você se o modo automático barrar).
4. Para a Fase 3 (adiantar): separar um simulado de teste e voluntários para preencher cartões com gabarito conhecido.

## 8. Prompt de início da Fase 1
```
Você vai executar a Fase 1 — Pipeline de leitura (go/no-go) do PRD de correção de cartões-resposta do SanarFlix Academy (V0, sem LLM).

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch: feat/cartoes-resposta. Nunca commitar/pushar na main.
Comece com `git branch --show-current` e `git fetch origin && git merge origin/main` (regra 1 da seção 4).
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/2026-10-07-cartoes-resposta.md — seções 3, 4, 5, 7 e a Fase 1 na seção 8.
2. docs/prd/cartoes-resposta-handoff/fase-0.md — entregas, desvios e notas da fase anterior.

Estado atual: tag cartoes-fase-0. Existem services/cartao-omr/ com o gerador (layout.py, card.py, cli.py), os templates sfa_v1.json e uniatenas_v1.json, 25 páginas de fixtures sintéticas com gabarito em tests/fixtures/ e 82 testes verdes. N (colunas da matrícula sfa) = 12, provisório. Nenhum portão de produção foi necessário; a única ida ao banco foi um SELECT agregado, já registrado no handoff.
Atenção nesta fase: não há leitor ainda; criar pipeline/{render,align,qr,omr}.py como funções puras e tools/eval_accuracy.py. Métricas só sobre questões `strict` do gabarito; nas não estritas, nunca uma letra errada. Gerar o conjunto grande com `python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes` para medir 99,8% com significância. Pendências do João que podem mudar o layout: matrículas com letras em Integrado/Integrado Macapá e a letra G do UniAtenas (P4). Se o aceite não for atingido depois da calibração, parar e reportar com números e exemplos (no-go).

Execute só a Fase 1. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-1, handoff, prompt da fase seguinte, próximos passos meus/do João).
```
