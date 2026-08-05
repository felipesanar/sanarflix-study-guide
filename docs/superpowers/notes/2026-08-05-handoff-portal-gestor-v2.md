# Handoff — Portal do Gestor v2 · 05/08/2026

Escrito para uma sessão nova assumir do zero. Ler inteiro antes de agir.
Contexto do autor: Felipe Souza (lead de produto/eng) + João Vitor Nader (estagiário, executa).

---

## 1. Onde estamos, em números

| | |
|---|---|
| Branch única | `feat/portal-gestor-v2` · HEAD `a4a7364d` · **empurrada** |
| Suíte | **843/843 em 80 arquivos** · type-check exit 0 · build ✓ |
| Fases entregues | **0, 0b, 1, 2, 3, 4** |
| Fase 5 (Detalhamento) | **em andamento pelo João** desde 05/08 14:19, nada empurrado ainda |
| Fase 6 | 10 tarefas, **todas do Felipe**, nada iniciado |
| Cards da revisão (Ordem 100–121) | **22 de 22 fechados** |
| Migrations em produção | 12 do 1º lote (04/08) + 11 do 2º (05/08) = **23 aplicadas** |
| Prazo combinado | sex **07/08** (Felipe manteve, mesmo avisado do risco) |

Tags de fase: `fase-0`, `fase-0b`, `fase-1`, `fase-2`, `fase-3`. **Falta criar `fase-4`** — não criei porque o commit acabou de sair.

---

## 2. Regras que não se negociam

**Nada do v2 vai para a `main` até a entrega.** Só assets e documentação. O **PR #17** fica em *draft* até a Fase 6 — é a linha de entrega, não o merge de uma fase. A fronteira de fase é uma **tag anotada**, e a revisão acontece por range (`git diff fase-3..fase-4`).

**A branch absorve a `main` periodicamente** (`git merge origin/main`), porque o Lovable publica direto em produção. Depois de absorver, `src/integrations/supabase/types.ts` é **regenerado**, nunca resolvido à mão.

**A régua de desempenho vive só em `src/features/gestor/lib/regras.ts`.** `NIVEL_CRITICO_MAX = 30`, `PROFICIENCIA_MINIMA = 60`, `NIVEL_EXCELENTE_MIN = 80`. Este projeto já teve **5 réguas incompatíveis** porque cada um cravou o número onde estava mexendo.

**Dado ausente é TRAÇO, nunca zero** (spec §4.10). Zero afirma "medimos e deu zero". E vale nos canais escondidos: um defeito real desta semana estava num `aria-valuenow={percentual ?? 0}` — o rótulo visível dizia travessão e o leitor de tela ouvia "0 por cento".

**"Nota TRI" não existe** como métrica; o rótulo único é "Proficiência". **Conceito ENAMED não tem média.** O rótulo é **"atual"**, não "último".

**O vazio da Cascata de Diagnóstico é o caminho principal, não a exceção.** Com o corte em 30, **87,9% dos recortes** não têm nenhum tema crítico (100% excluindo a IES de teste `B2B`). Uma coordenadora que vê espaço em branco conclui que quebrou.

---

## 3. As armadilhas que morderam — leia antes de repetir

**Editar migration já aplicada faz o SQL novo NUNCA rodar.** O Supabase registra migration aplicada pelo **prefixo da versão**. Mudar o conteúdo de um arquivo aplicado deixa a correção no repo parecendo pronta, sem nunca executar. Quase escrevi 9 correções em arquivos mortos. **Regra: migration nova sempre, partindo do corpo da anterior.**

**Não existe caminho autenticado para produção nesta máquina.** O MCP do Supabase aponta para `lljn`, **não** para o `gvqv` de produção. O CLI não tem token, não há `.env`, e o repo só traz a chave anon. Ler ou escrever schema/dado de produção **depende de outra pessoa**: João pelo SQL Editor, ou o agente do Lovable.

**Três formas de confirmar estado de produção sem acesso:** (1) pedir ao agente do Lovable um `SELECT` em `pg_proc`; (2) `git log origin/main` nas migrations que ele gera; (3) **`src/integrations/supabase/types.ts`, que é gerado do `gvqv`** — é a fonte confiável de "quais RPCs existem em prod". Teste que mocka `supabase.rpc` **não prova** que a função existe.

**O sandbox do Lovable não fala com o GitHub.** Só vê `main` e branches de backup — não consegue ler `feat/*`. Para entregar SQL a ele: `get_file_upload_url` → `PUT` do arquivo → `send_message` com `files[]`. **Máximo 10 anexos por mensagem.** Preserva byte a byte. Sem `PGHOST`, ele aplica DDL criando edge function descartável — exija confirmação da remoção da function, da entrada do `config.toml` e do secret, e confira em `git log origin/main` (é verificável: uma existiu 79 segundos).

**Teste que tranca comportamento errado — aconteceu três vezes.** Dois testes afirmavam a chamada a uma RPC dropada com `supabase.rpc` mockado, deixando a suíte verde sobre caminho 404. Um teste afirmava o desempate errado do TRI. Uma asserção de `queryKey` era tautológica e não pegou um componente passando o semestre como id de IES.

**`LIKE '%nome_da_funcao%'` sobre `pg_get_functiondef` casa comentário.** Um relatório de agente afirmou `usa_helper = true` e estava certo por sorte. A garantia vem dos testes de asserção do repo, que removem comentário (`codeOnly`) antes de afirmar.

**Colisão de timestamp em migration aconteceu em duas rodadas seguidas** quando agentes paralelos escolhem timestamp sozinhos. Dar faixa explícita por agente. E os testes de asserção leem o `.sql` **pelo caminho** — renomear quebra o teste.

**`contexto` preso na IES do token: três aparições em três fases.** `get_gestor_contexto()` não recebe `p_ies_id` e sua queryKey não tem `ies`, então `contexto.iesAtual` e `contexto.contrato` **nunca acompanham a troca de instituição**. Apareceu no rótulo do dropdown (Fase 2), no rodapé do cronograma e nas mensagens de WhatsApp (Fase 3), e no cabeçalho do "Copiar resumo" (Fase 4 — o texto ia para ata de colegiado com a IES errada). **Ao ler qualquer coisa de `contexto`, pergunte se aquilo deveria seguir o recorte da URL.**

**Trabalho paralelo quebra código em silêncio, nas duas direções.** Um fix meu na queryKey do envelope parou a atualização otimista do João sem nenhum teste acusar. E eu dupliquei a Task 34 dele criando **três arquivos com nomes idênticos**, por ter disparado agentes sem dar `fetch` imediatamente antes.

**Auto-relato de agente não é verificação.** 21 correções foram reportadas como "corrigido"; verificação independente contra o critério de cada card achou **9 incompletas**.

---

## 4. Decisões do Felipe já tomadas — não reabrir

**Telefone do aluno (card 116):** qualquer gestor pode ver, e o admin também. O guard de `get_gestor_aluno_contato` aceitar `gestao.enabled OR gestao.portal_v2` está **correto**. Reduzir a uma chave quebra o `StudentAnalyticsDrawer`, que está em produção na `main`.

**Repescagem é segunda chamada**, para quem não conseguiu fazer o original. Logo o aluno tem **uma nota só** por simulado pai. Medido em produção: **zero** duplicatas. Portanto o desempate `score_proprio DESC` nas quatro RPCs de TRI é **arbitrário-mas-estável, não regra de negócio**. Se um dia aparecer duplicata, o certo é acender `meta.partial` e investigar — nunca ajustar o desempate.

**Coluna `competencia` "não vale pra nada"** (João). Decisão: **não normalizar**, nem as 13 linhas sujas. Havia ~1.300 linhas de whitespace puro que o `btrim` esvaziaria — risco sem ganho.

**`NIVEL_CRITICO_MAX` = 30**, definitivo, sem depender do Leonardo.

**IES do piloto: FAI.** A chave `gestao.portal_v2` está ligada só nela. **Lembrete obrigatório da Fase 6:** antes do merge final, decidir explicitamente se continua ligada e avisar o CX — senão os gestores da FAI ganham o portal novo sem aviso no instante do merge.

**`user_has_feature` dá `return true` incondicional para `admin` e `atendimento`.** Bypass preservado de propósito. Consequência: Felipe e João **nunca veem o gate real**; testar comportamento de gestor exige conta de gestor, que o CX precisa provisionar.

---

## 5. Decisões abertas, esperando o Felipe

1. **Contrato de `proficiencias` (o mais importante).** `get_gestor_alunos` devolve `proficiencias` como array anônimo `(number|null)[]`, sem `simuladoId` por posição, enquanto as colunas da `TabelaAlunos` vêm de `get_gestor_visao_geral`. As duas RPCs recortam simulados por critérios diferentes — a de visão geral filtra por semestre, a de alunos não. O front hoje **mitiga**; a garantia real é a RPC devolver `{ simuladoId, valor }[]`. É mudança de contrato + migration.
2. **"Exportar recorte" existe como botão e a exportação não.** Hoje o clique mostra "Exportação ainda não está disponível" — honesto e testado. A alternativa é esconder o botão até existir.
3. **`DrawerAluno` sem rodapé de ações.** O plano previa export nos dois drawers. Não há ação sem gate ali; é ausência de funcionalidade. A pergunta é se o gestor deve poder exportar o recorte de **um aluno nominal**.
4. **`Meta` não carrega o tamanho da amostra (`n`).** O `TooltipRastreabilidade` diz "cobertura parcial" sem número, porque inventar seria pior. Adicionar `n` ao envelope exige mudar `get_gestor_visao_geral`.
5. **Hardening de banco** — do raio-X do João de 05/08, escopo próprio, **não deve entrar na Fase 5 nem mexer no prazo**:
   - **O sério:** grants padrão do Postgres dão INSERT/UPDATE/DELETE a `anon`/`authenticated` em quase toda tabela do gestor. Segura hoje porque a RLS está certa, mas sem segunda camada — um `CREATE POLICY` mal escrito vira escrita livre. É uma passada de `REVOKE` no schema inteiro e precisa de inventário de quem escreve o quê antes.
   - `get_institutional_tri` executável por `anon`: existe um **`supabase/migrations/DRAFT_v0_hardening_REVIEW.sql` datado de 03/06**, escrito exatamente para isso, nunca aplicado. Risco prático menor do que soa (o guard no corpo depende de `auth.uid()`, que é nulo sem sessão) — é defesa em profundidade faltando.
   - O João sugeriu unificar o guard de `get_gestor_contexto` com o das outras 10. **Eu discordo:** ela não recebe IES, ela *lista* as IES do seletor; exigir por-IES impediria um `gestor_grupo` de entrar no portal. A correção certa é **`iesDisponiveis` só listar IES que têm a feature**.
   - Resto (sobreposição de policies, `auth.uid()` por linha, índices, patch do Postgres) é dívida técnica, bem triada por ele.

---

## 6. O que ainda não foi verificado

**Nada do portal v2 foi aberto em navegador com sessão de gestor.** Toda a evidência são os 843 testes, o type-check e o build. Ficam sem checagem: claro vs escuro, travessia completa de teclado, ESC nos drawers na rota real, e a conferência visual da FAI. O João deixou isso explicitamente para o Felipe porque exige autenticar com senha.

**O `npm run lint` do repo inteiro não termina** (>600s). Use `npx eslint <caminhos>`. Baseline de três classes, todas esperadas: `prefer-nullish-coalescing` (1 por arquivo, `strictNullChecks` desligado), `react/react-in-jsx-scope` e `react-refresh/only-export-components`.

**Um teste intermitente:** `src/test/components/admin/ContratoSimuladosBoard.test.tsx` falhou uma vez na suíte completa e passa isolado. Provavelmente `waitFor` faltando no teste de submit da Task 13. Não bloqueia, mas corrói o sinal.

---

## 7. Como trabalhar aqui

**O padrão de revisão que deu mais resultado**, e foi de longe o mais valioso do dia:

1. **Achar** — N dimensões em paralelo, **Opus**, somente leitura, com os fatos já decididos passados como lista explícita de "não reporte" (senão os agentes gastam rodada reabrindo decisão).
2. **Refutar** — um cético em **Opus** por achado, instruído a marcar `refutado: true` na dúvida. Nas quatro revisões esse filtro matou 14 de 40, 2 de 22, e 2 de 25.
3. **Corrigir** — um agente **Sonnet** por arquivo, com o agrupamento calculado em tempo de execução a partir dos achados, para dois nunca editarem o mesmo componente. Cada um registra em `nao_corrigidos` o que exige tocar arquivo de outro grupo.
4. **Fechar** — um agente **Opus** com a árvore inteira: resolve o cross-cutting, roda suíte/type-check/build/lint. **Este agente justificou existir**: a árvore estava em 826 passed / 4 failed depois das correções paralelas.

**Sempre `git fetch` imediatamente antes de disparar agentes.** Duas vezes hoje informação de horas atrás causou trabalho duplicado. E a sessão pode virar o dia — confira a data.

**Sempre ler a DM do João antes de agir sobre estado de produção.** A informação de que "as migrations já estão em produção" estava lá e evitou nove correções em arquivos mortos.

**Verificar antes de dizer que está pronto, não depois.**

---

## 8. Identificadores e caminhos

| | |
|---|---|
| Produção (Supabase) | `gvqvrmkizemwsasmupmo` — hardcoded em `src/integrations/supabase/client.ts` |
| MCP do Supabase aponta para | `lljnbysgcwvkhlnaqxtt` — **não é produção** |
| Kanban | `Tasks - SanarFlix Academy B2B` · página `773aaa3d6ee248a581c5de6fadf925c6` · data source `a2caf0e1-3573-4074-9249-343bc263ad58` |
| Cards da revisão | `Ordem` 100 a 121 |
| Molde de card (10 seções) | `3aab3b75c7e1818faf65e3bbc3e99e2e` |
| Notion: João | `326d872b-594c-81b4-aa07-000260deb3cc` · Felipe `214d872b-594c-814d-96be-00029e8dc131` |
| Slack: João | `U0AKWHZLMQV` · Felipe `U091LKBA8QM` |
| Lovable | projeto `0567bb51-c70e-4f66-a5f1-67d7783d65ce`, workspace `uKNXI4OLE2DgYlOIqixH` |
| PR de entrega | #17, draft |
| Spec | `docs/superpowers/specs/2026-07-25-portal-gestor-v2-design.md` |
| Plano (69 tarefas) | `docs/superpowers/plans/2026-07-25-portal-gestor-v2.md` |
| Design navegável, offline | `docs/handoff/gestor/design/gestor-sanarflix-LIGHT.html` |
| Dev server | `.claude/launch.json` → `dev`, porta 8080 |

**Regra do Felipe:** toda tarefa, desta frente e das futuras, vive no kanban central. Não criar banco por projeto — o que separa é a propriedade `Projeto`. Título começa com verbo no infinitivo, **sem prefixo `Task N`** (o número vive em `Ordem`).

**Untracked na raiz:** `Nova Visão do Gestor SanarFlix.zip`. Não é artefato de nenhuma fase; decidir se entra no `.gitignore` ou sai da árvore.

**`lib/rotulos.ts` nunca foi criado** (era da Task 42) e a abertura da Fase 5 no plano diz que ela "reusa `lib/rotulos.ts` desta fase". Hoje `ROTULO_NIVEL` vive em `ChipNivel.tsx` e `ROTULO_TENDENCIA` em `TabelaAlunos.tsx`. Quem começar a Fase 5 vai procurar e não achar.

---

## 9. Próximos passos sugeridos

1. Criar a tag `fase-4` no commit `a4a7364d` e empurrar.
2. Abrir o localhost e fazer a passada visual da Visão Geral — é a lacuna real de verificação.
3. Decidir os itens 1 e 2 da seção 5.
4. Fase 6 (10 tarefas do Felipe) pode começar em paralelo à Fase 5 do João: são QA, tema escuro, telemetria, LGPD e rollout — arquivos diferentes do Detalhamento.
5. Abrir cards do hardening de banco, sem entrar no prazo da entrega.
