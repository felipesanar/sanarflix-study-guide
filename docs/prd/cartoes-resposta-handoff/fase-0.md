# Handoff — Fase 0: Cartão SFA (gerador, template e fixtures)

- **Entrega 1:** 13/10/2026, tag `cartoes-fase-0` (commit `015fe5ad`). Já está no remoto.
- **Revisão:** 16/10/2026, tag **`cartoes-fase-0.1`**, depois das decisões de operação do João e do time. **Esta é a versão válida**; a tag `cartoes-fase-0` fica como histórico (o cartão dela tinha matrícula em bolhas, cartão genérico e QR `SFA1`).
- **Branch:** `feat/cartoes-resposta` (merge com `origin/main` feito em 16/10, sem conflito).
- **Testes:** `services/cartao-omr` → **92 passed**. A suíte do front não foi rodada: a fase só tocou `services/` e `docs/`.
- **Portões de produção:** nenhum. Houve **um SELECT agregado** em 13/10 (aprovado pelo João), registrado na seção 4.

## 1. Decisões que mudaram o escopo (16/10/2026)
O João e o time decidiram:
1. **Todo cartão é pessoal**, com o QR do `user_id`. **Acabou o cartão genérico.**
2. **Sem matrícula em bolhas no `sfa`.** Só o UniAtenas mantém.
3. "Respondentes que não estavam na lista" **não é um problema.**
4. **Sem alternativa E no cartão**, em definitivo (a alternativa E do Academy, de 14/10, foi uma exceção).
5. **Operação:** tela do Academy para emitir os cartões (IES + simulado + alunos selecionados pelo time interno) → PDF → impressão → IES escaneia → o João roda o script local (depois, nuvem) → upload com os alunos identificados pelo **ID do Academy**.
6. **O João vai implementar a importação por ID.**

O PRD foi atualizado para a **revisão 4** com tudo isso (seções 1.1, 5.1, 5.2, 6, 7, 8, 9, 10, 12 e 13).

## 2. O que existe
Pacote `services/cartao-omr/` (Python, `py -m venv`; todas as dependências do PRD instalam por wheel no Windows com Python 3.14).

| Arquivo | Papel |
|---|---|
| `cartao_omr/layout.py` | Todas as medidas (mm) e a geometria dos dois layouts. Fonte única. |
| `cartao_omr/card.py` | Desenha o PDF (`reportlab` + `segno`) e escreve os templates a partir da **mesma** geometria. |
| `cartao_omr/models.py` | `CardSpec`, formato do QR `SFA2` e `parse_qr` (leitura inversa, para a Fase 1). |
| `cartao_omr/cli.py` | `cartao-omr modelo [--layout]` e `cartao-omr gerar-cartoes` (roster CSV falso; sem banco). |
| `cartao_omr/roster.py` | Lê o CSV `user_id,nome[,ies]`, ordenado por nome sem acentos. O banco entra na Fase 2. |
| `templates/sfa_v2.json`, `uniatenas_v1.json` | Coordenadas exatas (contrato 7.1). O `sfa_v1.json` foi removido. |
| `templates/exemplo_sfa.pdf`, `exemplo_uniatenas.pdf` | PDFs de exemplo para a conferência visual do João. |
| `tools/make_fixtures.py` | Gera cartões preenchidos e digitalizados sintéticos + gabarito JSON. |
| `tests/` | 92 testes (template, modelo/QR, PDF, CLI, fixtures). |

### Cartão personalizado (`sfa`)
- Nome impresso após "ALUNO:" e QR `SFA2:S:<SIM8>:<UID32>` (maiúsculas, modo alfanumérico). Abaixo do QR, os 8 primeiros caracteres do `user_id`.
- Bloco esquerdo: quadro **CARTÃO PESSOAL** (conferir o nome, avisar o aplicador, não trocar de cartão, não escrever sobre o QR). É a mitigação do risco de troca de cartão.
- Sem bolhas de matrícula: `matricula: null` no template.

### Cartão UniAtenas
QR `SFA2:A:<SIM8>`, matrícula `NN-X-NNNNN` em 8 colunas (a 3ª com `G`), nome manuscrito. Sem personalização.

### QR (por que mudou)
O formato `SFA1` com dois UUIDs dava versão 7 e módulo de **0,566 mm** (~4,5 px a 200 dpi). O `SFA2` dá:

| Cartão | Versão | Módulo |
|---|---|---|
| `sfa` | 4 | **0,732 mm** |
| UniAtenas | 1 | **1,034 mm** |

Lido pelo `zxing-cpp` em 200, 150 e 100 dpi, nos dois modelos. O `SIM8` (8 primeiros hex do `simulado_id`) basta para detectar cartão de outro simulado.

### Fixtures (`tests/fixtures/`, 6,6 MB, 28 páginas)
`sfa_personalizado_limpo`, `sfa_personalizado_realista`, `sfa_dificil`, `uniatenas_realista` (cada um com `.gabarito.json`) e `roster_ficticio.csv`.
Cobrem: caneta preta/azul com cobertura de 65–100%, marcas fracas, duplas, rasuradas, X, ✓, ponto, círculo, sujeira, questões em branco, rotação (até ±3,8° nas fixtures; o gerador aceita ±5°) e 180°, escala 95–105%, translação, perspectiva leve, ruído, JPEG, 150/200/300 dpi, fundo escuro, páginas em branco, **QR danificado** (uma página; o gerador confere que o `zxing-cpp` não lê), marcador coberto (uma página ilegível) e, no UniAtenas, matrículas com `G` e com defeito (coluna dupla, coluna faltando).
`python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes` gera ~250 páginas para a calibração da Fase 1 (não versionar).

## 3. Desvios do PRD
- **Passo vertical da matrícula do UniAtenas: 4,5 mm** (o PRD pedia 5,5). Caixa de 6 mm + título + 11 bolhas de 4 mm não cabem em y ≤ 108 mm com 5,5. Há 0,5 mm entre bolhas vizinhas. Se a Fase 1 mostrar vazamento de tinta, reduzir o diâmetro da bolha de matrícula do UniAtenas para 3,6 mm. Colunas de 7 mm e vãos de 5 mm com hífen impresso.
- **Quadros do bloco superior: y de 44 a 108 mm** (o PRD citava 106 e 108).
- **Marcador de orientação** a 3 mm do `tl`, como no PRD, o que invade a folga de 4 mm daquele marcador.
- **Instruções:** o exemplo "duas bolhas" ganhou uma linha própria.
- **Fonte:** Helvetica padrão do PDF.
- **Template:** campos extras (`layout`, `conventions`, `useful_area_mm`, `qr`, `blocks_mm`, `matricula.n_columns`). **`[x, y, w]` nos marcadores = canto superior esquerdo + lado** (para a homografia use `x + w/2`, `y + w/2`).
- **`gerar-cartoes`:** `--simulado` e os `user_id` precisam ser UUIDs; `--roster` é obrigatório no `sfa`; aceita `--nome-simulado`, `--ies`, `--data` e `--saida`. O UniAtenas usa "UniAtenas" como IES se `--ies` faltar.

## 4. Consulta em produção feita na entrega 1 (somente leitura)
Projeto `gvqvrmkizemwsasmupmo`, em 13/10/2026: SELECT agregado de `users` × `ies` (contagem de `matricula_ra`, comprimento máximo e se só tem dígitos). Servia para definir N, o número de colunas da matrícula do `sfa`. **Perdeu o efeito** com a decisão de remover a matrícula do `sfa`; o que ainda vale é a fotografia dos dados:
- Nove registros de IES sem nenhuma matrícula cadastrada (B2B, B2C, Claretiano, FAI, UEA, a IES de teste e as 3 unidades da USCS) e o Integrado (e o Integrado Macapá) com letras. Isso confirma que a matrícula não serve de chave universal.
- Comprimentos de matrícula de 4 a 11 dígitos nas demais.
- Os 6 campi UniAtenas (PARACATU 512, PASSOS 399, PORTO SEGURO 103, SETE LAGOAS 288, SORRISO 124, VALENÇA 168 com matrícula) têm formato próprio, não numérico puro.

## 5. Achado importante: a importação atual não é a que o PRD descrevia
Conferido em 16/10/2026 em `ImportarRespostasTab.tsx`, `importar-respostas-types.ts` e `admin-import-simulado-responses/index.ts`:
- A tela lê **a 1ª aba por posição**: coluna 1 = **Matrícula/RA**, colunas 2 a N+1 = questões 1 a N, **exatamente 1 + N colunas**.
- A Edge Function resolve matrícula → `user_id` dentro das IES do simulado (`admin_lookup_users_by_ra_in_ies`).
- **Não aceita email, nem ID.** O formato `email | 1..N | tempo_minutos | …` das revisões 1 a 3 do PRD não existe desde 25/09/2026.

Consequência: **P6 (importação por ID)**, que o João vai implementar, **bloqueia o uso ponta a ponta**. O PRD agora manda a planilha sair com `id_aluno` na coluna 1 (o `users.id`) e `Questão 1…N` nas demais.

## 6. Pendências
1. **P6 — Importação por ID** (João): aceitar `users.id` na coluna 1. Contrato que o script vai gerar: coluna 1 = UUID, cabeçalho `id_aluno`, depois `Questão 1…N`. Se preferir outro cabeçalho ou formato, avisar antes da Fase 2.
2. **P7 — Tela de emissão** (João / equipe do Academy): como ela gera o PDF. Opções: chamar o mesmo serviço do `cartao-omr` (uma fonte da verdade) ou portar o desenho para TypeScript lendo `templates/*.json` (risco de divergência). Não bloqueia as Fases 1 a 3.
3. **P8 — `user_id` no QR:** confirmar que nenhum endpoint do app o trata como credencial. Antes de imprimir os primeiros cartões.
4. **Conferência visual** dos novos PDFs de exemplo (aceite da fase). Os anteriores, com matrícula no `sfa`, não valem mais.
5. P4 (letra `G` do UniAtenas), P2, P3 e P5 seguem abertas.
6. **Push:** o commit da revisão e a tag `cartoes-fase-0.1` ainda não foram enviados (o modo automático barrou o push em 16/10).

## 7. Portões não executados
Nenhum previsto na Fase 0. O primeiro é o da Fase 2 (papel `cartao_omr_reader`; agora com `users(id, nome, id_ies, matricula_ra)`, sem `email`).

## 8. Notas para a próxima fase (Fase 1 — pipeline de leitura)
- **Gabarito** (`tests/fixtures/*.gabarito.json`): por questão, `truth` (`marcada|branco|multipla|ambigua`), `strict`, `tolerated`, `letter(s)`, `kind` e `cov` (cobertura medida em A–D). Por página, `scan.mm_to_px` (homografia 3×3 do mm do template para o pixel), `dpi`, rotação, `flip180`, fundo, `legible`, `qr`, `qr_legivel` e `matricula` (`null` no `sfa`).
- **Métrica de acerto por bolha** = só questões `strict`. Nas não estritas (fraca, X, ✓, ponto, círculo, rasura) o leitor pode responder `truth` ou algo de `tolerated`, **mas nunca uma letra errada**.
- `kind: "branco"` espera `pagina_em_branco`; `legible: false` espera `pagina_ilegivel`; `qr_legivel: false` espera `qr_ilegivel` (a página ainda é lida e fica **sem aluno**, para o João atribuir pelo nome impresso).
- Use `models.parse_qr` para interpretar o QR. O tipo (`S`/`A`) escolhe o template; o `SIM8` detecta `simulado_divergente`.
- **Matrícula só existe no UniAtenas.** O `sfa` não tem bloco de matrícula para ler.
- O conjunto de referência tem 28 páginas (~10 mil bolhas): serve para desenvolver; para medir 99,8% com significância use `--preset completo` e outras sementes.
- O `zxing-cpp` já trata rotação e lê o QR da página inteira, inclusive a 180° e a 150 dpi.
- A rotação de ±5° em tela A4 corta os marcadores; o gerador aumenta a tela (`scan.pad_mm`). Páginas reais de ADF podem perder cantos: isso é `pagina_ilegivel`.
- O leitor deve usar `templates/*.json` (nunca medir o PDF).

## 9. Próximos passos
**Meus (Claude):**
1. Fase 1: `pipeline/render.py`, `align.py`, `qr.py`, `omr.py`, `tools/eval_accuracy.py` e a calibração de `T_ALTO`, `T_BAIXO` e `GAP_MIN`. É go/no-go.

**Do João:**
1. Rodar o push da revisão e da tag (comandos na resposta da sessão).
2. Abrir os novos `exemplo_sfa.pdf` e `exemplo_uniatenas.pdf` e aprovar ou pedir ajustes. Imprimir em A4 a 100% ajuda a validar o tamanho das bolhas.
3. Implementar a importação por ID (P6) e confirmar o formato da coluna 1.
4. Decidir como a tela de emissão gera o PDF (P7) e conferir o P8.
5. Responder à P4 (`G`) com a UniAtenas.
6. Adiantar a Fase 3: simulado de teste e voluntários para preencher cartões pessoais com gabarito conhecido.

## 10. Prompt de início da Fase 1
```
Você vai executar a Fase 1 — Pipeline de leitura (go/no-go) do PRD de correção de cartões-resposta do SanarFlix Academy (V0, sem LLM).

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch: feat/cartoes-resposta. Nunca commitar/pushar na main.
Comece com `git branch --show-current` e `git fetch origin && git merge origin/main` (regra 1 da seção 4).
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/2026-10-07-cartoes-resposta.md (revisão 4) — seções 1.1, 3, 4, 5, 7 e a Fase 1 na seção 8.
2. docs/prd/cartoes-resposta-handoff/fase-0.md — entregas, desvios e notas da fase anterior.

Estado atual: tag cartoes-fase-0.1. Existem services/cartao-omr/ com o gerador (layout.py, card.py, models.py, cli.py), os templates sfa_v2.json (sem matrícula) e uniatenas_v1.json, 28 páginas de fixtures sintéticas com gabarito em tests/fixtures/ e 92 testes verdes. Todo cartão é pessoal, com QR `SFA2:S:<SIM8>:<UID32>`; só o UniAtenas tem matrícula em bolhas e QR `SFA2:A:<SIM8>`. Nenhum portão de produção foi necessário.
Atenção nesta fase: não há leitor ainda; criar pipeline/{render,align,qr,omr}.py como funções puras e tools/eval_accuracy.py. Use models.parse_qr. Métricas só sobre questões `strict` do gabarito; nas não estritas, nunca uma letra errada. Páginas com qr_legivel=false devem virar qr_ilegivel e ficar sem aluno. Gerar o conjunto grande com `python tools/make_fixtures.py --preset completo --saida runs/fixtures_grandes` para medir 99,8% com significância. A matrícula só existe no UniAtenas. Pendências do João que não bloqueiam esta fase: importação por ID (P6), tela de emissão (P7), `user_id` no QR (P8), letra G do UniAtenas (P4). Se o aceite não for atingido depois da calibração, parar e reportar com números e exemplos (no-go).

Execute só a Fase 1. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-1, handoff, prompt da fase seguinte, próximos passos meus/do João).
```
