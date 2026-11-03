# Handoff: continuar o Bloco B do Engajamento SanarFlix (a partir da B3)

> Para a sessão que for retomar. Leia este arquivo inteiro, depois a spec e o plano, e só então comece a B3.

## Seu papel

Você IMPLEMENTA o front do Engajamento SanarFlix no SanarFlix Academy, tarefa por tarefa, seguindo duas specs já aprovadas. Toda decisão de produto, de dados e de arquitetura já está nelas. Você não decide nada que não esteja lá: quando faltar informação, **pare e pergunte ao João**.

Leia, inteiros e nesta ordem:
1. `docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md` (regras, contratos das RPCs, textos literais §12, cores §13, validações §14).
2. `docs/superpowers/plans/2026-10-22-engajamento-sanarflix.md` (tarefas B3 a B16, com checkboxes).

Não use nenhum outro documento de "mart/arquitetura/engajamento" (inclusive no OneDrive): estão deprecados.

## Estado em 26/10/2026

- **Bloco A (back-end) concluído e em produção.** 9 migrations aplicadas, 10 RPCs validadas na PARACATU, cron diário rodando sozinho (24, 25 e 26/10, todos `ok`). O portão A→B foi **aprovado pelo João**. **Nenhuma tarefa do Bloco B cria ou altera tabela, função ou RPC.** Se faltar um campo, pare e pergunte.
- **B1 commitada** (`bb00f552`): `api/types-engajamento.ts`, `lib/engajamento.ts`, `hooks/useFiltrosEngajamento.ts`, `api/engajamento.ts` (8 hooks de RPC + `buscarExportAlunos` e `buscarListaCompleta`), `export` em `useEnvelope`.
- **B2 commitada** (`1e1cb42a`): rotas, `EngajamentoLayout`, filtros, abas, faixa, estado "IES sem dados", item na sidebar com selo NOVO. As 3 abas ainda são placeholders `BlocoGestor estado="loading"`.
- **Próxima: B3** (componentes de gráfico). Depois B4 a B16 em ordem.
- Branch: `feat/engajamento-sanarflix`, pasta `C:\Users\joao.nader\work\sanarflix-engajamento`. HEAD no momento deste handoff: o commit deste arquivo (depois de `1e1cb42a`). **Nada foi enviado por push.**

## Regras do projeto (não negociáveis)

- Não crie branch nem worktree. **Nunca commite na `main`** (o Lovable empurra para ela). Não toque em `C:\Users\joao.nader\work\sanarflix-principal` nem nas outras pastas de `work\`. Não use a cópia do OneDrive.
- **Push e PR só quando o João pedir.**
- **Nenhuma migration nem RPC nova.** Supabase de produção: ref `gvqvrmkizemwsasmupmo`. Não rode refresh nem escreva no banco.
- Textos da UI: **literalmente** os da spec §12. Cores: só os tokens da §13; nenhum hex/rgb no código do gestor (o guard `tema.test.tsx` reprova).
- Todo gráfico usa `FiguraGrafico` (§10.6); todo bloco usa `BlocoGestor` com os estados da §11.
- Fixtures de teste: derivadas do exemplo JSON da §8 da RPC correspondente, em `src/features/gestor/__tests__/fixtures/engajamento/*.ts`. Nunca invente chave que a RPC não emite (o `contratoEnvelopeRpc.test.ts` protege isso).
- **Números:** o critério é sempre "tela = RPC = consulta de validação na fonte" (§14). Se não bater, pare e mostre ao João a consulta e os dois valores. Nunca ajuste a validação para bater.
- Commits: um por tarefa, mensagem sugerida no plano, checkboxes do plano marcados no mesmo commit.
- Ao fim de cada fase (e a cada tarefa grande), liste os **próximos passos separados em "Claude" e "João"**.
- Sempre que o plano pedir "ok do João" para algo (push, PR, mudança de escopo), espere o "ok" explícito.

## Como rodar as coisas (aprendido na prática)

- Testes: `node node_modules/vitest/vitest.mjs run <caminho>`. Type-check: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` (~50 s). `npx` não resolve nesta pasta.
- **Critério de toda tarefa: nenhuma falha NOVA** em relação ao baseline. A suíte tem 40 falhas pré-existentes em 11 arquivos (26 em `src/features/gestor`, 14 em `src/test/unit`). Lint não é critério. A lista do baseline está em `docs/superpowers/notes/2026-10-22-engajamento-baseline-testes.md`. Receita de comparação: rode `... vitest run src/features/gestor > saida.txt`, tire as cores com `sed 's/\x1b\[[0-9;]*m//g'`, pegue as linhas `^ FAIL ` (sem o sufixo ` NNNms`), e compare com as do arquivo de baseline com `comm -13` (o que aparecer é falha nova).
- **Dev server:** use `preview_start` com `name: "dev-node"`. O `npm run dev` não funciona neste worktree (o `node_modules` é um link sem `.bin`). O `dev-node` está em `.claude/launch.json`, **modificado localmente e fora do git: não commite esse arquivo** (use `git add` por caminho, nunca `git add -A`).
- O cliente Supabase já aponta para produção, então não precisa de `.env`.
- **Login: eu (Claude) não digito senha.** Peça ao João para logar no navegador do painel (gestor da PARACATU ou admin) e abra `http://localhost:8080/gestor/engajamento?ies=d86c32ba-2d09-4c7e-a426-1d981ec7b595`. PARACATU = `d86c32ba-2d09-4c7e-a426-1d981ec7b595` (521 alunos). Para viewport estreito, `resize_window` (mobile) e depois `preset: desktop`; para tema escuro/claro, o botão "Alternar tema claro/escuro" da sidebar.
- Se o MCP do navegador pedir permissão de site, avise o João e siga adiante em vez de insistir.

## Armadilhas já encontradas

1. **Fim de linha.** Vários arquivos existentes são CRLF (ex.: `SidebarNav.tsx`, testes do gestor). `sed -i` e `Edit` com strings multilinha falham ou reescrevem o arquivo inteiro. Edite com um script `node` que normaliza para LF, troca e **restaura CRLF** (`bruto.includes('\r\n')`). Confira com `git diff --stat` que a mudança ficou mínima.
2. **`cd` persiste entre comandos Bash.** Comece cada comando com `cd "C:/Users/joao.nader/work/sanarflix-engajamento"`.
3. **Texto de marca no escuro:** `--gp-brand-strong` tem contraste baixo sobre fundo escuro. Use classes `text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]`, não `style={{ color }}` (o `style` não tem variante `dark:`).
4. **Testes que usam `useLocation`/`Outlet` precisam** de `vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'))`. Sem isso o mock global faz `useLocation` devolver "/".
5. **Datas em teste:** `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)` fixa "hoje" sem travar os timers do React.
6. **`BlocoGestor` exige `children`** (passe `{null}` em placeholder). `GestorShell` tem `Suspense key={pathname}`, então a troca de aba remonta o layout; o cache de React Query torna isso barato.
7. **Nome acessível de link com selo:** texto + `<span aria-label>` sem espaço sai "Engajamentonovo". Um `{' '}` literal antes do `<span>` resolve (em contêiner flex o espaço não aparece).
8. Mude uma regra de teste só com **mutação**: depois de um teste passar de primeira, quebre o código de propósito e confira que o teste falha (feito na regra 8 da §9.6); restaure em seguida.
9. Não use `recharts` nesta entrega (§10.6): gráficos são HTML/CSS e SVG simples, para não ter `ResizeObserver` em teste.

## Decisões de implementação já tomadas (vetáveis pelo João)

- `setSemestre(null)` remove só `eng_sem` e **não** apaga o aluno (nada foi "escrito"); `setSemestre(n)` apaga o aluno. `setAluno(id)` apaga `eng_sem`.
- `queryParaAba`: Questões e Conteúdos removem só o `aluno`; a Visão geral remove só o `tipo`. Chaves de outras telas do portal sobrevivem.
- `useEngajamentoVisaoGeral` limpa o aluno da URL **só** quando a RPC responde `aluno_fora_do_recorte` (precisa receber o recorte completo de `useFiltrosEngajamento()`, com `setAluno`).
- `deltaPp` arredonda a diferença das taxas brutas (`Math.round(atual − anterior)`).
- Selects são nativos (`<select>`), estilizados com tokens. `BotaoExportarAba` fica **desabilitado** até a B13.
- Atualizei fora da lista da §15.3, por enumerarem itens da nav e a §2.2 mandar: `GestorShell.test.tsx` (3 → 4 itens) e `Direcionadores.test.tsx` (filtro do grupo "Desempenho Institucional"). Está no commit da B2.
- Na RPC `lista`, foram incluídas as guardas `filtro_conflitante` e `aluno_fora_do_recorte` da §7.3 (o corpo da §8.3 não as listava).
- Divergências da spec anotadas, sem alterar o texto dela: a V15 diz 75,0% e o correto é 338÷452 = 74,8%; o JWT de exemplo da §14 usa `public.eng_hoje()` com role `authenticated`, o que falha.

## Pendências e riscos conhecidos

- O refresh diário levou 15 min 30 s e 17 min 27 s nas execuções manuais e 18 min 23 s no 1º cron; as duas seguintes levaram ≈ 2 min 30 s. Se alguma execução voltar a passar de 15 min, avise o João (§3.3 item 9). Não mexa no pipeline.
- `get_gestor_engajamento_conteudos` na Integrado: 1,45 s com cache quente (limite 2 s). Se a tela de Conteúdos ficar lenta, é o primeiro suspeito.
- A conferência final (B16) compara cada número visível com a RPC e com as validações V1 a V19 da §14. Em Python/SQL de teste, use datas literais (não `eng_hoje()`) ao simular o JWT.

## Memória do projeto

Há notas persistentes em `C:\Users\joao.nader\.claude\projects\C--Users-joao-nader-work-sanarflix-principal\memory\` (`engajamento-sanarflix-bloco-a-concluido.md` e a spec de 22/10). Elas já refletem este estado.
