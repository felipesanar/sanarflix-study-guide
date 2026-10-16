# Cartões-resposta — mapa do projeto (estado em 16/10/2026)

Comece por aqui. Este arquivo responde: **o que é cada sigla, onde está cada coisa, o que está pronto e por onde continuar.**

## 1. O projeto em três linhas
O time da Sanar emite **cartões-resposta em PDF** (um por aluno, com o ID do aluno em QR). A IES imprime, aplica a prova e devolve o scan. Um **script local** lê o scan e gera a planilha de respostas, que o admin importa no Academy. Especificação completa: `docs/prd/2026-10-07-cartoes-resposta.md`.

## 2. Vocabulário (as siglas que se misturaram)
| Sigla | O que é | Onde fica a lista |
|---|---|---|
| **Fase 0, 1, 2, 3, E** | As **etapas de construção** do projeto, feitas uma por sessão. | PRD, seção 8 |
| **P1 a P8** | **Pendências**: decisões ou tarefas em aberto, quase todas **suas** (não são código). Numeração do PRD. | PRD, seção 13 |
| **F1 a F6** | **Achados** da auditoria de segurança da P8 ("o `user_id` impresso no QR é seguro?"). Cada um é uma falha, ou um risco, encontrada no código do Academy. | `p8-auditoria-user-id.md` |
| **tag** (`cartoes-fase-1`) | Um **marcador** no histórico do git: "o projeto estava assim no fim da Fase 1". | `git tag` |
| **branch** | Uma **linha de trabalho** do git. Cada coisa que muda o código vive numa branch. | `git branch` |
| **worktree** | Uma **segunda pasta** ligada ao mesmo repositório, com outra branch aberta ao mesmo tempo. Evita duas sessões trocarem a branch uma debaixo da outra. | `git worktree list` |

## 3. Onde está cada coisa

### 3.1 Três lugares
| Lugar | Caminho | O que é |
|---|---|---|
| **A. GitHub** (`origin`) | `github.com/felipesanar/sanarflix-study-guide` | A cópia oficial e compartilhada. A `main` é o que o Lovable publica. |
| **B. Pasta do projeto (worktree)** | `C:\Users\joao.nader\work\sanarflix-cartoes` | **Onde mora o trabalho dos cartões.** Branch `feat/cartoes-resposta`. Fora do OneDrive. |
| **C. Pasta do OneDrive** | `...\OneDrive - Editora Sanar S.A\Documentos\Academy Project\sanarflix-study-guide` | O clone "original". Hoje está parado na branch `fix/session-security-auth`, com a correção F1 **sem commit** dentro. |

> B e C são o **mesmo repositório** (`.git` único, que fica em C). Commits e tags feitos em B aparecem em C e vice-versa; só os arquivos abertos mudam.

### 3.2 Branches
| Branch | O que tem | Está no GitHub? |
|---|---|---|
| `main` | O produto publicado (Lovable). Nada dos cartões entrou aqui ainda. | sim |
| **`feat/cartoes-resposta`** | **Todo o projeto dos cartões**: PRD, serviço Python, leitor, emissão em TypeScript, tela. 14 commits à frente da `main`. | **parcial:** o GitHub tem até a **Fase 1**. A **Fase E** e as **tags** só existem no seu computador. |
| `fix/session-security-auth` | Correção **F1**. | **não** (e ainda nem foi commitada) |
| `fix/gestor-ai-insights-authz-antes-do-cache` | Correção **F2** (1 commit). | **não** |

## 4. O que está pronto
| Etapa | Estado | Tag |
|---|---|---|
| **Fase 0** (cartão, templates, fixtures) | **Pronta** e aprovada por você | `cartoes-fase-0.2` |
| **Fase 1** (leitor de uma página) | **Pronta** (GO). Nas fixtures sintéticas acerta 100%, mas elas não provam os limiares: o piloto real confirma. | `cartoes-fase-1` |
| **Fase E** (emissão em TypeScript + tela) | **Pronta** no código e nos testes. Falta o **aceite físico** (imprimir e escanear). | `cartoes-fase-e` |
| **Fase 2** (ligar ao banco, identificar o aluno, gerar a planilha) | **Não começou.** Começa por um portão de produção (criar o papel `cartao_omr_reader`), que precisa da sua aprovação. | – |
| **Fase 3** (piloto real e manual de uso) | **Não começou.** Precisa de cartões impressos e preenchidos por voluntários. | – |

## 5. Pendências P1 a P8
| # | O que é | Estado | Quem |
|---|---|---|---|
| P1 | Onde roda o N8N (só importa para a V1, a versão na nuvem). | aberta | João |
| P2 | Confirmar os 6 campi do grupo UniAtenas (PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO, VALENÇA). | aberta | João |
| P3 | ~246 alunos UniAtenas sem matrícula cadastrada + 5 cadastros `99-G-99999` (erro de cadastro). | aberta | João / Relacionamento |
| P4 | A letra `G` na matrícula UniAtenas. | **encerrada** (era erro) | – |
| P5 | Avisar as IES do cartão novo (pessoal, um por aluno). | aberta | João / Relacionamento |
| P6 | Importação aceitar o ID do aluno. | **feita** (você implementou) | – |
| P7 | Como a tela gera o PDF. | **feita** (Fase E) | – |
| P8 | O `user_id` no QR é seguro? | **auditada**; **bloqueia imprimir cartões reais** até F1 e F2 estarem em produção | João / Academy |

## 6. Achados F1 a F6 (auditoria da P8)
Contexto: o QR do cartão leva o ID do aluno. Qualquer pessoa pode fotografar um cartão e ficar sabendo esse ID. Isso só é seguro se **saber um ID nunca permitir nada**.

| # | Gravidade | Problema (em uma frase) | Conserto |
|---|---|---|---|
| **F1** | **Alta** | `session-security`: qualquer pessoa com um ID derruba todas as sessões desse usuário, sem login. | **Escrito e testado (21 testes)**, mas **sem commit**, na pasta C, branch `fix/session-security-auth`. Não publicado. |
| **F2** | Média | `gestor-ai-insights`: devolve o texto de IA sobre um aluno a qualquer usuário logado, antes de checar se é gestor da IES. | **Escrito, testado (22 testes) e commitado** (`7ae97889`) na branch `fix/gestor-ai-insights-authz-antes-do-cache`. Não publicado. |
| F3 | Baixa | `get_user_roles`/`has_role` mostram o papel de qualquer ID a quem está logado. | **Sem conserto.** Recomendação: aceitar por escrito. |
| F4 | Média (fora do tema) | `send-study-reminder` é um relé de e-mail aberto. | **Nada feito.** |
| F5 | Baixa | `check-and-send-reminders` e `notify-performance-released` podem ser disparadas por qualquer um. | **Nada feito.** |
| F6 | Higiene | O papel `anon` tem privilégio total nas tabelas (o RLS é que protege). | **Nada feito.** |

> **"Pronto" para F1 e F2 quer dizer código e testes prontos, não em produção.** Falta, para cada uma: commit (F1), publicar a branch, abrir o pull request, mesclar na `main` e a função ser publicada no Supabase.

## 7. Onde continuar (recomendação)
1. **Trabalho dos cartões** (Fase 2 em diante): sempre na **pasta B** (`C:\Users\joao.nader\work\sanarflix-cartoes`), branch `feat/cartoes-resposta`.
2. **Correções da P8** (F1, F2, ...): cada uma em **sua própria pasta**, uma branch por correção, e **nunca na pasta C**. A pasta C deve voltar a ficar parada na `main`, só para consulta.
3. **Ordem sugerida:**
   1. Publicar o que já existe (`git push origin feat/cartoes-resposta` e `git push origin --tags`).
   2. Fechar F1 e F2 (commit, push, pull request, mesclar, publicar a função). É o que libera imprimir cartões reais.
   3. Aceite físico da Fase E.
   4. Fase 2.
   5. Fase 3 (piloto).
4. **Médio prazo:** tirar o clone principal de dentro do OneDrive. A sincronização do OneDrive já bloqueou a limpeza de pastas do `.git` ("Permission denied") e pode corromper o repositório.

## 8. Como retomar uma sessão
```bash
cd C:\Users\joao.nader\work\sanarflix-cartoes
git branch --show-current          # tem que ser feat/cartoes-resposta
git fetch origin && git merge origin/main
cd services\cartao-omr && .venv\Scripts\python.exe -m pytest   # 140 testes
cd ..\.. && npx vitest run src/features/cartoes                # 192 testes
```
O prompt pronto para a Fase 2 está em `prompt-fase-2.md` (mesma pasta deste arquivo).

## 9. Documentos
- `docs/prd/2026-10-07-cartoes-resposta.md`: especificação (revisão 7).
- `fase-0.md`, `fase-1.md`, `fase-e.md`: o que cada fase entregou, desvios e notas.
- `p8-auditoria-user-id.md`: a auditoria de segurança completa.
- `prompt-fase-2.md`: prompt para iniciar a próxima sessão.
