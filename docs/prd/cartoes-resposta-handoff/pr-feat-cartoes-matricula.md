# PR: `feat/cartoes-matricula` → `main`

> Rascunho da descrição e do checklist do pull request. **Não foi aberto.** Para abrir: `gh pr create --base main --head feat/cartoes-matricula --title "<título>" --body-file docs/prd/cartoes-resposta-handoff/pr-feat-cartoes-matricula.md` (apague este bloco e a seção "Checklist do autor" antes, ou cole só o corpo).

## Título sugerido
`feat(cartoes): cartões-resposta com nome e matrícula (plano B por e-mail), emissão no Academy e leitor local`

## Resumo
Primeira entrega do projeto de **correção automática de cartões-resposta** (PDF escaneado → planilha de importação), que nunca esteve na `main`. Cobre o ciclo inteiro:

1. **Emissão (Academy):** nova aba **Admin → Simulados → Cartões-resposta** gera, no navegador, um PDF com **um cartão por aluno**, com o **nome e a matrícula impressos** e a matrícula também num **QR**. Quem não tem matrícula utilizável (vazia, fora do formato ou repetida) recebe o **plano B**: cartão identificado pelo **e-mail** no QR, com o campo MATRÍCULA em branco para o aluno escrever. Filtro por **semestre**; lista de quem ficou de fora (sem nenhum dos dois) com CSV; CSV da emissão. O grupo **UniAtenas** segue com o cartão único (matrícula em bolhas).
2. **Leitura (script local, `services/cartao-omr`):** `cartao-omr processar <pdf> --simulado <id>` lê o PDF escaneado (visão computacional determinística, **sem LLM e sem banco**) e gera `respostas_<simulado>.xlsx` com a matrícula (ou o e-mail) na coluna 1, mais pendências, recortes e relatório.
3. **Importação:** a planilha entra pela tela **Importar respostas** que já existe (1ª coluna aceita Matrícula/RA ou e-mail, já na `main`).
4. **Provas:** o **ID do simulado** aparece (discreto, selecionável) embaixo do nome em Simulados → Provas, porque é o `--simulado` do script.

Contexto e decisões: `docs/prd/2026-10-07-cartoes-resposta.md` (rev. 9) e `docs/prd/cartoes-resposta-handoff/` (`LEIA-ME.md` e `fase-matricula.md`, o mais recente).

## O que muda no app (front)
| Arquivo | Mudança |
|---|---|
| `src/components/admin/simulados/CartoesTab.tsx` (novo) | Tela de emissão |
| `src/features/cartoes/` (novo) | Gerador de QR, formato do payload, interpretador do desenho do cartão (jsPDF), montagem dos cartões, classificação dos alunos, filtro de semestre, Web Worker, consultas de leitura |
| `src/experiences/admin/pages/SimuladosPage.tsx` | Nova sub-aba `?tab=cartoes` |
| `src/components/admin/simulados/ProvasTab.tsx` | ID do simulado embaixo do nome (+8 linhas) |
| `vite.config.ts` | `worker.format = "es"` (o worker de emissão usa o jsPDF, que tem imports dinâmicos; sem isso o `vite build` falha) |
| `tsconfig.app.json` | `resolveJsonModule: true` (os templates do cartão são JSON importados direto de `services/cartao-omr/templates`) |

- **Só leitura no banco:** a tela lê `simulados_admin`, `ies`, `users` (`id, nome, matricula_ra, email, semestre`) e `user_roles` (só `user_id, role`, para o selo de equipe), com a sessão do admin. **Não grava nada**, **não há migration**, **não há Edge Function nova ou alterada** por este PR.
- **Dados pessoais:** o PDF é gerado no navegador e nada é enviado a servidor. Nomes, matrículas e e-mails não saem do Academy.
- **Peso:** a aba é um chunk carregado sob demanda (`CartoesTab` 67 kB / 18 kB gzip; worker 45 kB; `jspdf` já era dependência e só carrega ao gerar). Nada entra no bundle inicial.

## O que é novo fora do app
- `services/cartao-omr/` (Python 3.11+, Windows primeiro): gerador do cartão e dos templates, pipeline de leitura (alinhamento por marcadores, QR, OMR), `processar`, planilha. **Não roda no deploy do Lovable**; é uma ferramenta local do time (README com o runbook).
- `docs/prd/`: PRD (rev. 9), handoffs, guia de 1 página para as IES (`cartoes-resposta-guia-ies.md`).
- Fixtures sintéticas (`services/cartao-omr/tests/fixtures`, ~7 MB de PDFs com nomes e matrículas **fictícios**).

## Como funciona o cartão (resumo)
- QR `SFA2:M:<SIM8>:<MATRÍCULA>` (maiúsculas), ou `SFA2:E:<SIM8>:<E-MAIL>` no plano B (minúsculas, até 58 caracteres), ou `SFA2:A:<SIM8>` (UniAtenas). `SIM8` são os 8 primeiros caracteres do ID do simulado e evitam misturar cartões de provas diferentes. **O `user_id` não vai no cartão.**
- Template `sfa_v4` (caixa do QR de 36 mm) e `uniatenas_v1` (inalterado). A geometria mora num só lugar (`layout.py`); o Python e o TypeScript só interpretam a mesma lista de desenho, e testes de paridade comparam os dois pixel a pixel.
- O leitor nunca adivinha: marca fraca, X, ✓, ponto ou dupla marcação viram célula em branco, amarela e com comentário; QR ilegível, página ilegível, simulado diferente e duplicidades viram pendência. Página escaneada duas vezes com respostas idênticas: mantém uma e avisa.

## Como foi testado
- **Python:** `cd services/cartao-omr && .venv/Scripts/python.exe -m pytest` → 229 testes (paridade Python × TypeScript, leitura sobre fixtures sintéticas a 100–300 dpi, `processar`, planilha no formato da importação com espelho do `parseMatrizRespostas`).
- **Front:** `npx vitest run src/features/cartoes` → 280 testes (tela, classificação, filtro de semestre, QR com vetores do Python, CSVs); `ProvasTabId.test.tsx`.
- `npx tsc -p tsconfig.app.json --noEmit` → 0 erros. `npx vite build` → OK.
- **Suíte inteira do front:** 1.961 passam e 40 falham, **todas as 40 em 11 arquivos do Portal do Gestor** (`features/gestor/*` e `gestorMigrations*`). Conferi numa cópia limpa da `origin/main`: **as mesmas 40 falham lá** (baseline). Este PR não introduz falhas.
- **Em papel (João, 21/10/2026):** (1) cartões de 5 alunos da UVA, com marcações corretas, em branco, dupla, ✓, X e ponto: 5/5 identificados, nenhuma letra errada, as 18 marcações inválidas foram para revisão; (2) **plano B por e-mail**, com dry-run no app e `--lista`; (3) **página repetida**; (4) **UniAtenas** (matrícula em bolhas, casos de erro e QR). Detalhes em `fase-matricula.md`.

## Riscos e pontos para o revisor
1. **Tamanho:** ~80 arquivos e ~45 mil linhas, mas a maior parte é JSON de template/gabarito e fixtures. O que roda no app são os 3 arquivos acima, o `src/features/cartoes/` e dois ajustes de configuração.
2. **Binários no Git:** os PDFs de fixtures foram regenerados três vezes nesta branch (cada regeneração soma ~5 MB ao histórico). Aceitável hoje; vale squash ao mesclar.
3. **`vite.config.ts` e `tsconfig.app.json`** mudam para todo o app (só afetam workers e importação de JSON). O `vite build` passa e o chunk do worker sai normal.
4. **Limiares do leitor sem calibração real:** brancos pontuam até 0,19 (corte 0,20) e marcas válidas a partir de 0,53 (corte 0,50). Falha segura (vira revisão), mas pode gerar mais pendências em outro scanner/papel. A calibração depende de uma turma real escaneada.
5. **UniAtenas em papel:** aprovado pelo João em 29/10 (cartão certo identificado e importado no dry-run; duas marcas na mesma coluna e coluna em branco foram para Pendências/Não identificados com recorte; `--simulado` trocado gera `simulado_divergente`).
6. **Qualidade do cadastro:** muitas IES têm quase todos os alunos sem `matricula_ra` (Famp, Fame, B2C, UEA, Claretiano, USCS, FAI): nelas o **e-mail vira o caminho principal**. Não conferi a qualidade de `users.email`; quem ficar sem e-mail utilizável aparece no painel "fora do PDF".
7. **Ordem de deploy:** a importação por e-mail já está na `main`; este PR não depende de nada além dela.
8. **Backlog de segurança do Academy** (F1, F2, F4, F5 em `p8-auditoria-user-id.md`) é independente deste PR: o cartão não carrega mais o `user_id`.

## Checklist do autor
- [x] `tsc` sem erros e `vite build` OK
- [x] Testes da feature verdes (Python e front); falhas restantes iguais às da `main`
- [x] Sem migration, sem Edge Function, sem escrita no banco
- [x] Sem dados reais no Git (fixtures sintéticas; `runs/` e `*.pdf` fora de `templates/` e `tests/fixtures/` ignorados)
- [x] PRD, handoff, runbook e guia das IES atualizados
- [x] Teste físico do cartão UniAtenas (aprovado em 29/10)
- [ ] Calibração dos limiares com uma turma real

## Checklist do revisor
- [x] Abrir Admin → Simulados → Cartões-resposta com um login de admin e escolher uma IES pequena: o total da tela bate com o da IES; a **equipe** (professores, gestores) aparece com selo e desmarcada (corrigido em 29/10 após o teste do João na UVA)
- [ ] Conferir o painel "fora do PDF" e o CSV; o selo "por e-mail" e o aviso do plano B
- [ ] Filtrar por semestre e gerar o PDF: só os alunos filtrados entram, e o nome do arquivo traz `_sem-N`
- [ ] Abrir o PDF: nome, matrícula (ou campo em branco no plano B), QR e rótulo sob o QR
- [ ] Simulados → Provas mostra o ID embaixo de cada nome
- [ ] Revisar `vite.config.ts` e `tsconfig.app.json` (mudanças globais pequenas)
- [ ] `cartao-omr processar` num PDF gerado pela própria tela (cartão em branco): todas as páginas identificadas, 100 questões em branco
- [ ] Dry-run da importação com o xlsx gerado (sem confirmar)

## Depois de mesclar
- Squash recomendado.
- Lovable publica o front; a aba aparece só para admin (mesma regra das demais abas de Simulados).
- Operação: ler o runbook em `services/cartao-omr/README.md` e enviar às IES o `docs/prd/cartoes-resposta-guia-ies.md`.
