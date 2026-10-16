# Handoff — Fase E: emissão dos cartões em TypeScript (no Academy)

- **Data:** 16/10/2026
- **Resultado: concluída (E1 + E2).** Pendente só o aceite físico do João (imprimir um cartão gerado aqui e ver o leitor ler o scan).
- **Branch:** `feat/cartoes-resposta`. **Tag:** `cartoes-fase-e`.
- **Onde está o código desta fase:** num *worktree* separado, `C:\Users\joao.nader\work\sanarflix-cartoes` (a branch está aberta lá; o checkout do OneDrive ficou em outra branch, usada pelas sessões de correção da P8). Qualquer `git push origin feat/cartoes-resposta` funciona de qualquer um dos dois diretórios.
- **Testes:** `services/cartao-omr` → **140 passed** (eram 121); front, `src/features/cartoes` → **192 passed**; `tsc` do app: 0 erros; `vite build` OK.
- **Portões de produção:** nenhum. A tela só lê, com a sessão do admin.

## 1. O que foi feito

### Python (contrato)
- **`cartao_omr/drawlist.py` (novo):** monta a **lista de desenho** (`draw`) a partir da geometria de `layout.py`: retângulos, círculos, linhas, textos (com *slots* `titulo`, `subtitulo`, `aluno`, `label`), numeração, bolhas e QR. Documentada no topo do arquivo.
- **`card.py`:** os templates ganharam `draw` e `draw_version`; o PDF passou a ser desenhado **interpretando esse `draw`**. Conferido contra o gerador antigo: 3 dos 4 cartões de referência saíram idênticos pixel a pixel, e o UniAtenas diferiu em 78 pixels por 1 nível de cinza.
- **`tools/gen_qr_golden.py`:** gera os vetores de QR (`src/features/cartoes/__tests__/qr-golden.json`, 86 casos + 50 payloads `SFA2`) com o `segno`; um teste Python falha se o JSON ficar desatualizado.
- **`tools/emitir_ts.mts`:** roda o código do Academy pelo Node (TypeScript nativo, sem compilar), para testes e para conferir um PDF fora do navegador.
- **Testes novos:** `test_emissao_ts.py` (17: paridade com o Python), `test_qr_golden.py` (2), helper `tests/cardcheck.py`.

### TypeScript (`src/features/cartoes/`)
| Arquivo | Papel |
|---|---|
| `qr.ts` | Gerador de QR (ISO 18004), nível Q, versões 1 a 9, alfanumérico e byte. **Sem dependência nova.** |
| `payload.ts` | Formato `SFA2` (`buildPayload`, `parseQr`, `sim8`), espelho de `models.py`. |
| `render.ts` | Interpreta `template.draw` com `jspdf` (já era do projeto). `fitText` igual ao do Python. |
| `emitir.ts` | `montarSpecs`, `ordenarAlunos` (sem acento, como o roster), `gerarPdf`, `nomeDoArquivo`. |
| `emitir.worker.ts`, `gerar.ts` | Geração em **Web Worker**, com fallback na thread principal; cancelar = `AbortController`. |
| `templates.ts` | Importa `services/cartao-omr/templates/*.json` direto (sem cópia) e a lista `IES_UNIATENAS`. |
| `api.ts` | Consultas de leitura: simulados, IES, alunos (paginado, sem quem tem papel de equipe). |
| `types.ts` | Tipos. |

### Tela
`src/components/admin/simulados/CartoesTab.tsx`, nova aba **Cartões-resposta** em Admin → Simulados (`SimuladosPage.tsx`). Fluxo: simulado → IES (a única do simulado já vem escolhida) → data → modelo (pessoal, ou UniAtenas pré-selecionado para as IES do grupo) → alunos (turma toda marcada, busca por nome ou matrícula) → **Gerar PDF**, com progresso e botão de cancelar → download.

### Configuração
- `tsconfig.app.json`: `resolveJsonModule: true` (os templates e os vetores são JSON).
- `vite.config.ts`: `worker: { format: "es" }`. **Necessário:** sem isso o `vite build` falha (o formato padrão de worker, `iife`, não aceita a divisão de código do `jspdf`). A mudança é só para workers.

## 2. Como foi verificado
- **QR:** 86 vetores idênticos ao `segno`, módulo por módulo, versões 1 a 9. Para igualar os dois geradores foi preciso copiar uma esquisitice do `segno`: quando os dados terminam alinhados em byte, ele acrescenta um byte `0x00` antes do enchimento (o QR continua válido para qualquer leitor). Os payloads reais não são afetados.
- **PDF do TypeScript:** páginas A4, QR lido pelo `zxing-cpp` com o payload exato, QR **idêntico** ao do Python (pixel a pixel, a 300 dpi), marcadores e bolhas nas posições do template, só preto e cinza (diferença de até 1 nível por arredondamento de cor do `jspdf`), nomes longos sem invadir o QR, ordem por nome sem acento, e o **leitor da Fase 1 lê o cartão** (QR, alinhamento e 100 questões em branco), nos dois layouts.
- **Navegador (Chrome do painel, com dados simulados no cliente):** a tela carrega 700 alunos, filtra, marca, gera e baixa `cartoes_faculdade-exemplo_simulado-enamed-2026.pdf`. **700 cartões em 13,2 s, PDF de 22,7 MB, pausa máxima da tela de 9 ms.**
- **Build:** `vite build` gera o worker (43,9 kB) e a aba (57,9 kB) como *chunks* carregados só sob demanda.

## 3. Problemas encontrados no caminho (todos corrigidos)
1. **Pluralização na tela:** "cartão" + "es" saía "cartãoes". Pego pelo teste de componente.
2. **Aba em segundo plano:** a primeira versão cedia o fio com `setTimeout`, que o navegador atrasa em aba oculta; uma turma de 700 levaria minutos se a pessoa trocasse de aba. Passou para Web Worker (também baixou o tempo de 23,5 s para 13,2 s).
3. **Build de produção:** falhava por causa do formato de worker (acima).
4. **Node só apaga tipos:** o `qr.ts` usava propriedade em parâmetro de construtor, que o Node não executa sem compilar; reescrito.

## 4. O que NÃO foi verificado
- **Dados reais:** a tela foi testada com dados simulados no cliente. Não entrei com login, então **não conferi** que o admin enxerga todos os alunos da IES em `users` e lê `user_roles` com as políticas reais. Na primeira vez, conferir: o número de alunos listado bate com a IES? Quem tem papel de equipe ficou de fora?
- **Impressão real:** o cartão do TypeScript não foi impresso nem escaneado. O leitor foi testado só com o PDF renderizado.
- **Suíte inteira do front:** 1.870 testes passam e **40 falham**, todos em 6 arquivos do Portal do Gestor (`gestorMigrations*`, `CascataDiagnostico`, `VisaoGeral`, `contratoEnvelopeRpc`). **As mesmas 35 falhas isoladas acontecem na `origin/main` limpa** (216208cc), então são anteriores a esta branch. As 5 a mais da rodada completa são timeouts sob carga (rodei o build ao mesmo tempo). Vale alguém olhar a `main`.

## 5. Decisões e limites
- **`IES_UNIATENAS`** (em `templates.ts`) tem os 6 campi inferidos em 13/10 e **continua sem confirmação (P2)**. Só pré-seleciona o modelo; dá para trocar na tela.
- **Quem é aluno:** usuários da IES sem nenhuma linha em `user_roles`, o mesmo critério das RPCs do gestor.
- **Tamanho:** ~32 KB por cartão (22,7 MB para 700). Para turmas grandes, gerar por turma ou semestre se o e-mail ou o Slack reclamarem do tamanho.
- **Memória:** o PDF inteiro fica na memória do navegador. Testado até 700; para milhares, dividir em vários PDFs.
- **Dados pessoais:** nomes e IDs nunca saem do navegador; o PDF não é enviado nem salvo em lugar nenhum. Cuidado com o arquivo baixado (fica na pasta de downloads de quem emitiu).

## 6. Pendências
1. **P8 (bloqueia a impressão real):** F1 (`session-security`) e F2 (`gestor-ai-insights`) precisam estar corrigidas e publicadas antes de imprimir cartões com o `user_id` em QR. As duas sessões de correção foram abertas; ver o relatório `p8-auditoria-user-id.md`.
2. **Aceite físico (João):** gerar um cartão pela tela, imprimir em A4 a 100%, preencher, escanear e rodar o leitor da Fase 1 (`read_page`) sobre o scan.
3. **P2, P3, P5** seguem abertas.
4. **As duas sessões de correção da P8 rodaram no mesmo diretório do OneDrive** e trocaram a branch de baixo de mim. Se abrir outras, use um worktree por sessão.

## 7. Notas para a próxima fase (Fase 2 — identificação, roster e planilha)
- Nada do que a Fase 1 entregou mudou; `layout.py` e os templates continuam iguais (só ganharam `draw`). `read_page` e `PageResult` valem como descritos em `fase-1.md`.
- O roster do banco (Fase 2) vai alimentar o **`gerar-cartoes`** do Python **e** serve de conferência da tela: o `user_id` do QR precisa pertencer ao roster do simulado (`aluno_fora_do_roster`).
- O QR agora é gerado por dois códigos. Qualquer mudança no formato `SFA2` tem que ser feita em `models.py` **e** `payload.ts`, e os vetores regenerados (`gen_qr_golden.py`).
- Convenção do worktree: rodar `pytest` com o venv de `services/cartao-omr/.venv` do worktree; a suíte de paridade precisa de `node_modules` na raiz (no worktree é uma junção para o do OneDrive).

## 8. Próximos passos
**Meus (Claude):**
1. **Fase 2** (identificação, roster e planilha), a começar pelo portão do papel `cartao_omr_reader` (migration aditiva com `GRANT SELECT` mínimo; precisa da sua aprovação explícita).
2. Se pedido: fechar a P8 (F1, F2 e F4 já têm sessões abertas) ou investigar as 35 falhas antigas do Gestor na `main`.

**Do João:**
1. Rodar o push da branch e da tag `cartoes-fase-e` (comandos na resposta da sessão).
2. **Abrir a tela com seu login** (Admin → Simulados → Cartões-resposta) e conferir a lista de alunos de uma IES pequena; gerar um PDF e olhar.
3. Fazer o aceite físico (imprimir, preencher, escanear).
4. Fechar a P8 antes de imprimir qualquer cartão real.
5. Resolver P2, P3 (inclui os 5 cadastros `99-G-99999`) e P5.
6. Para a Fase 3: simulado de teste e voluntários com gabarito conhecido, escaneados em 200 e 300 dpi.

## 9. Prompt de início da Fase 2
```
Você vai executar a Fase 2 — Identificação, roster e planilha de saída do PRD de correção de cartões-resposta do SanarFlix Academy (V0, sem LLM).

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch: feat/cartoes-resposta. Nunca commitar/pushar na main.
Comece com `git branch --show-current` e `git fetch origin && git merge origin/main` (regra 1 da seção 4). Se outro checkout estiver usando a branch, use um worktree próprio.
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/2026-10-07-cartoes-resposta.md (revisão 7) — seções 1.1, 3, 4, 5, 7 e a Fase 2 na seção 8.
2. docs/prd/cartoes-resposta-handoff/fase-1.md (seções 3 e 8) e fase-e.md (seções 4 e 7).

Estado atual: tag cartoes-fase-e. Existem services/cartao-omr/ com o gerador de cartões (layout.py, drawlist.py, card.py, models.py, cli.py), os templates sfa_v2.json e uniatenas_v1.json (agora com a lista de desenho `draw`), o pipeline de leitura de uma página (cartao_omr/pipeline/; `read_page` devolve um PageResult), tools/eval_accuracy.py, e 140 testes Python verdes. No front, src/features/cartoes/ e a aba Admin → Simulados → Cartões-resposta emitem os cartões em TypeScript (192 testes). Limiares do OMR: T_ALTO 0,50, T_BAIXO 0,20, GAP_MIN 0,30 (as fixtures não discriminam limiares; só o piloto da Fase 3 confirma). A importação do Academy já aceita o UUID do aluno ou a Matrícula/RA na 1ª coluna (cabeçalho `matricula_ra_ou_id`). O papel `cartao_omr_reader` ainda NÃO existe: é o portão de produção desta fase.
Atenção nesta fase: o portão do papel `cartao_omr_reader` exige aprovação explícita do João (migration aditiva, GRANT SELECT mínimo em simulados_admin(id,nome,ies_ids), questoes_simulado(simulado_id,numero_questao,ordem), users(id,nome,id_ies,matricula_ra) e ies(id,nome); senha informada pelo João fora do Git; validar pela information_schema; lembrar do ACL padrão, que dá privilégio total a anon/authenticated em tabela nova). Se a ferramenta for barrada pelo modo automático, avise o João e não contorne com execute_sql. A planilha tem 1 + N colunas por posição: coluna 1 = UUID do aluno, depois Questão 1…N. Há 35 falhas antigas de testes do Portal do Gestor na main (fora do escopo). A P8 tem 2 correções pendentes no código do Academy (F1 e F2): não bloqueiam esta fase, mas bloqueiam a impressão de cartões reais.

Execute só a Fase 2. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-2, handoff, prompt da fase seguinte, próximos passos meus/do João).
```
