# Cartões-resposta — mapa do projeto (estado em 16/10/2026, depois da reorganização das pastas)

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

### 3.1 Todas as pastas ficam em `C:\Users\joao.nader\work`
Elas são o **mesmo repositório** (o `.git` fica em `sanarflix-principal`); cada pasta tem **uma branch aberta**. O arquivo `C:\Users\joao.nader\work\LEIA-ME.txt` resume isso e tem os comandos.

| Pasta | Branch aberta | Para quê |
|---|---|---|
| `sanarflix-principal` | `main` | Repositório central, **parado na `main`**. Não se edita; serve para criar pastas novas e consultar. |
| **`sanarflix-cartoes`** | `feat/cartoes-resposta` | **Projeto dos cartões.** As Fases 2 e 3 acontecem aqui. |
| `sanarflix-fix-f1-session-security` | `fix/session-security-auth` | Correção F1. |
| `sanarflix-fix-f2-gestor-ai` | `fix/gestor-ai-insights-authz-antes-do-cache` | Correção F2. |

**Regra de ouro: uma tarefa = uma pasta = uma sessão do Claude.** Abra o Claude **na pasta da tarefa**. O Claude guarda memória e contexto por pasta, e foi abrir várias sessões na mesma pasta que embaralhou as branches. Para uma tarefa nova: `.\nova-tarefa.ps1 -Nome <nome> -Branch <branch>` (na pasta `work`); para fechar: `.\encerrar-tarefa.ps1 -Nome <nome>`.

**Não use** a pasta antiga do OneDrive (`...\Academy Project\sanarflix-study-guide`): é uma cópia de segurança, que pode ser apagada depois dos pushes.

### 3.2 Onde cada branch está publicada
| Branch | O que tem | No GitHub? |
|---|---|---|
| `main` | O produto publicado (Lovable). Nada dos cartões entrou aqui ainda. | sim |
| **`feat/cartoes-resposta`** | **Todo o projeto dos cartões**: PRD, serviço Python, leitor, emissão em TypeScript, tela. | **parcial:** o GitHub tem até a **Fase 1**. A **Fase E**, os documentos novos e **todas as tags** só existem no seu computador. |
| `fix/session-security-auth` | Correção **F1** (1 commit). | **não** |
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
| **F1** | **Alta** | `session-security`: qualquer pessoa com um ID derruba todas as sessões desse usuário, sem login. | **Escrito, testado (21 testes) e commitado** (`a445c712`) na branch `fix/session-security-auth`. Não publicado. |
| **F2** | Média | `gestor-ai-insights`: devolve o texto de IA sobre um aluno a qualquer usuário logado, antes de checar se é gestor da IES. | **Escrito, testado (22 testes) e commitado** (`7ae97889`) na branch `fix/gestor-ai-insights-authz-antes-do-cache`. Não publicado. |
| F3 | Baixa | `get_user_roles`/`has_role` mostram o papel de qualquer ID a quem está logado. | **Sem conserto.** Recomendação: aceitar por escrito. |
| F4 | Média (fora do tema) | `send-study-reminder` é um relé de e-mail aberto. | **Nada feito.** |
| F5 | Baixa | `check-and-send-reminders` e `notify-performance-released` podem ser disparadas por qualquer um. | **Nada feito.** |
| F6 | Higiene | O papel `anon` tem privilégio total nas tabelas (o RLS é que protege). | **Nada feito.** |

> **"Pronto" para F1 e F2 quer dizer código, testes e commit prontos, não em produção.** Falta, para cada uma: publicar a branch (`git push -u origin <branch>`), abrir o pull request, mesclar na `main` e a função ser publicada no Supabase.

## 7. Onde continuar (recomendação)
1. **Trabalho dos cartões** (Fase 2 em diante): na pasta `sanarflix-cartoes`.
2. **Correções da P8** (F1, F2, F4...): cada uma na **sua pasta** (`nova-tarefa.ps1`), nunca na `sanarflix-principal`.
3. **Ordem sugerida:**
   1. Publicar o que já existe: de qualquer pasta, `git push origin feat/cartoes-resposta`, `git push origin --tags`, `git push -u origin fix/session-security-auth` e `git push -u origin fix/gestor-ai-insights-authz-antes-do-cache`.
   2. Fechar F1 e F2 (pull request, mesclar, publicar a função). É o que libera imprimir cartões reais.
   3. Aceite físico da Fase E.
   4. Fase 2.
   5. Fase 3 (piloto).

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
