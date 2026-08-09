# Movimento, loading e fluidez do Portal do Gestor — Implementation Plan

> Spec de origem: `C:\Users\felipe.souza\Downloads\12-movimento-e-loading.md` (29 seções). Auditoria completa feita antes de qualquer edição — 4 agentes de leitura cobrindo Partes III, IV, V/VI/VII, VIII/X. Achados literais dos agentes preservados no histórico da sessão; este documento resume decisões e organiza a execução.

**Goal:** fechar os gaps reais entre a spec de movimento/loading e o código, mais os gaps que a própria spec não previu (sidebar sem motion, transição de rota, momentos de filtro global) apontados pelo usuário.

**Achado-chave da auditoria:** esta spec **já foi parcialmente implementada** em rodadas anteriores (`useCountUp.ts`, `GestorSkeleton.tsx`, `placeholderData` como equivalente de `keepPreviousData`, testes `movimento.test.tsx`/`movimentoGraficos.test.tsx`, comentários citando "spec §X" no código). Não é construção do zero — é fechamento de gap, com um conflito real já identificado.

## Exclusão explícita — não implementar

**Animação de entrada dos gráficos (spec §18) fica FORA.** `EvolucaoChart.tsx`, `AreasChart.tsx`, `DispersaoChart.tsx` têm `isAnimationActive={false}` cravado por decisão do Felipe em 05/08 (comentário em `gestor-theme.css:322-329`, travado por `movimentoGraficos.test.tsx`): "animação que não existe não precisa ser suprimida e ligar movimento novo na véspera do piloto seria estrear mudança visual não validada". Reativar precisa de decisão de produto nova, não de execução desta spec. **Efeito colateral não documentado na decisão original, registrado aqui**: a mesma flag também desliga a interpolação de série ao trocar recorte (spec §10/§15/§19-5) — não só a entrada. Isso fica registrado, não corrigido nesta rodada.

**Contador de notificação (item 22 dos 22 comportamentos) fica FORA.** Não existe feature de contagem de notificação hoje (`GestorShell.tsx` tem um sino sem número associado) — não faz sentido animar um dado que não existe. Se a feature nascer, a animação (`scale(1→1.2→1)`, 200ms) entra junto.

## Decisões de produto tomadas nesta sessão

1. Rank de severidade em skeletons: cobertura prioriza os blocos mais vistos (KpiCard, gráfico de evolução, cascata, tabela de questões, sidebar) sobre os de menor tráfego (card-resumo de alunos/diagnóstico, cronograma) — se o tempo não fechar para os 12, os de menor tráfego ficam documentados como pendência, não implementados pela metade.
2. `useDelayedLoading` (400ms) entra em TODOS os blocos que hoje mostram skeleton imediato — mas a "moldura" estática de cada bloco (título, borda, filtros) passa a entrar com o reveal da Parte VI imediatamente, independente do delay do skeleton — é isso que resolve o "parece travado" apontado pelo usuário: resposta visual imediata (estrutura) + skeleton só depois de 400ms se a rede realmente demorar.
3. Sidebar (pedido novo, fora da spec original): item de navegação ganha indicador de página ativa que desliza (mesmo padrão do segmentado de semestre), ícone com transição de cor, e é o alvo do prefetch-no-hover que faltava.
4. Transição de rota (pedido novo): confirmado que NÃO há bloqueio real (ver "Achado" abaixo) — o que falta é só o reveal em cascata da Parte VI, que faz a troca parecer intencional em vez de abrupta.

**Achado sobre transição de rota:** `GestorShell.tsx` não tem nenhum gate de loading antes do `<Outlet>` (só um `<Suspense>` para o code-split lazy, que é instantâneo após o primeiro carregamento). Cada bloco já tem query/skeleton próprios. A rota já troca imediatamente — o gap real é ausência de motion na entrada (Parte VI, §16), que é o que faz a troca parecer "pop" seco em vez de fluida.

## Onda 1 — Infraestrutura (1 agente, base para tudo depois)

**Arquivos:** `src/features/gestor/gestor-theme.css` (ajustes de token), `src/features/gestor/hooks/useDelayedLoading.ts` (novo), `src/features/gestor/hooks/usePrefersReducedMotion.ts` (novo), `src/features/gestor/api/prefetch.ts` (3 funções novas: prefetch de aluno, de próximo nível da cascata, de próxima página).

Correções de token em `gestor-theme.css`: `.gp-hover-surface` 140ms→80ms (`--gp-motion-1`, tabela §2.1 da spec diz hover de linha/nav é 80ms); alfa do anel de foco claro 0.35→0.16 (escuro já está certo em 0.28); documentar `--gp-brand-surface-soft` como o token de linha selecionada (já existe, nunca foi consumido pela tabela).

## Onda 2 — 10 agentes em paralelo (dependem só da Onda 1, sem sobreposição de arquivo entre si)

- **B1 — Sidebar**: `shell/SidebarNav.tsx`, `shell/SidebarIes.tsx`. Token de hover (80ms), indicador de página ativa deslizando, ícone com transição de cor, skeleton de 2 barras (13px/70% + 10px/50%) em vez do retângulo único, prefetch no hover do item.
- **B2 — Rotas e reveal**: `routes/VisaoGeral.tsx`, `routes/Detalhamento.tsx`, `routes/Inicio.tsx`. Reveal em cascata na montagem (opacity+translateY(8px), 320ms, 40ms de defasagem, máx. 3 níveis, só na primeira montagem da rota — nunca ao voltar de drawer/paginar/trocar filtro). `useDelayedLoading` nos skeletons de bloco.
- **B3 — KpiCard e cards-resumo**: `components/KpiCard.tsx`, `components/VisaoDeAlunos.tsx` (card-resumo de alunos), o card-resumo do diagnóstico (achar em `routes/VisaoGeral.tsx`). Skeleton composto (título→hint→número 44px→régua) em vez do bloco genérico; `useDelayedLoading`.
- **B4 — Gráficos**: `charts/EvolucaoChart.tsx`, `charts/AreasChart.tsx`, `charts/DispersaoChart.tsx`, `components/GraficoProtagonista.tsx`. Skeleton com eixos reais desenhados (nunca retângulo); opacidade de série esmaecida 18%→40%; troca de modo sem remontar eixos (não usar `key={modo}` no wrapper todo); curva do indicador de toggle `--gp-ease` em vez de `ease-out`. NÃO tocar em `isAnimationActive` (ver exclusão).
- **B5 — Cascata**: `components/CascataDiagnostico.tsx`. Skeleton de 3 nós (nome 50% + barra de % 30px); hover com token/curva certos + `--gp-surface-2` + clareamento no escuro; accordion exclusivo com colapso/abertura simultâneos (320ms compartilhados, não desmontar-e-montar); entrada do painel lateral (grid-split) com fade+translateX; prefetch no hover do nó.
- **B6 — Drawers**: `components/DrawerAluno.tsx`, `components/DrawerTemas.tsx`, `components/DrawerTemasDetalhamento.tsx`. Skeleton de corpo em grade 2×2 + barras (em vez de blocos genéricos); `useDelayedLoading`.
- **B7 — Tabelas**: `components/tabela/TabelaGestor.tsx`, `components/TabelaAlunos.tsx`, `components/TabelaAlunosSimulado.tsx`, `components/TabelaQuestoes.tsx`, `components/tabela/Paginacao.tsx`, `components/SeletorSimulados.tsx`. Linha selecionada com `--gp-brand-surface-soft` + barra de 3px crescendo por `scaleY` do centro; foco interno (`inset`) na linha; checkbox de simulado com `scale(0.6→1)`; chips com `active:scale(0.96)`; prefetch no hover de linha (150ms de atraso) e no hover da próxima página; skeleton próprio para `TabelaQuestoes` (toolbar+cabeçalho real+5 linhas); saída animada da linha expandida de questão (hoje só tem entrada).
- **B8 — Cronograma e Acerto por área**: `components/CronogramaSimulados.tsx` (skeleton com pílula de status separada), `components/AcertoPorAreaESemestre.tsx` (skeleton com trilhos/rótulos reais; opacidade esmaecida 40%→35%).
- **B9 — Feedback**: `components/AcoesRecorte.tsx` (ícone de copiar troca para `check` com `scale(0.8→1)`, volta em 1.6s; botão de exportar preserva largura e mostra spinner), `components/AvisosSanar.tsx` (ponto de "não lido" com fade de saída, fundo com transição de 200ms), `components/EstadoVazio.tsx` (`role="status"` ausente), `components/EstadoErro.tsx` (botão "Tentar novamente" com spinner enquanto a query está em voo).
- **B10 — Motion global (botão, tooltip, badge, card de direcionamento)**: `components/ui/button.tsx` (`active:scale(0.97)` + tom mais claro), `components/ui/tooltip.tsx` (duração 80ms abrir/140ms fechar, `translateY(4px)`, remover `zoom-in-95`), `components/Tag.tsx`, `components/BadgeStatus.tsx` (cross-fade de 200ms na troca de variante), `components/DirecionadoresGestor.tsx` (token em vez de valor hardcoded, `:active` com `translateY(0) scale(0.995)`).

Cada agente: só CSS/motion, nenhuma mudança de dado/regra de negócio; roda os testes do próprio escopo; **proibido qualquer comando git** (só leitura de arquivo — lição da sessão de hoje, `git stash`/`reset` concorrente já causou perda de trabalho uma vez).

## Verificação

`tsc --noEmit` + suíte completa após cada onda. Verificação visual em navegador não é viável (autenticação) — reportar isso explicitamente, não fingir cobertura.

## Status final (2026-08-09)

Ondas 1 e 2 completas — 11 agentes no total (1 de infra + 10 em paralelo), todos os itens do escopo implementados. Consolidação final: `tsc --noEmit` limpo, **983/986 testes passando** (3 skips intencionais dos cards de IA, já ocultados numa rodada anterior do dia; 1 falha remanescente é `questoesContratoSort.test.ts`, dívida técnica pré-existente e não relacionada, sendo corrigida em task de background separada).

**Atrito real entre os 10 agentes da Onda 2** (esperado com esse grau de paralelismo, todos tocando arquivos vizinhos/mocks compartilhados) — todos corrigidos na consolidação:
- `SidebarNav.tsx` passou a chamar `useQueryClient()`/`useAuth()` (prefetch no hover) — quebrou 3 suítes que montam `GestorShell`/`SidebarNav` sem os providers necessários (`portalContainer.test.tsx`, `useFiltrosGestor.test.tsx`); corrigido envolvendo os `render()` afetados em `QueryClientProvider` + mock de `AuthContext`.
- `CascataDiagnostico.tsx` passou a importar `AuthContext` (o objeto de contexto, não só `useAuth`) para resolver `userId` do prefetch sem exigir provider — o mock de `AuthContext` em `VisaoGeral.test.tsx` só cobria `useAuth`, e `useContext` num export inexistente lançava, capturado por um `ErrorBoundary` que esvaziava a tela silenciosamente; corrigido fazendo o mock reexportar o módulo real (`vi.importActual`) e só sobrescrever `useAuth`.
- Gaps de tipo pré-existentes (campos `respostas`/`origem`/`alunosMatriculadosNoRecorte`/imagens de questão, adicionados em rodadas anteriores do dia) nunca tinham chegado a alguns fixtures de teste (`regrasCriticas.ts`, `a11y.test.tsx`, `GraficoProtagonista.test.tsx`, `Detalhamento.test.tsx`) nem a um fallback inline em `VisaoGeral.tsx` — corrigidos.
- Um agente (B2) rodou `git status`/`git diff --stat` (só leitura, sem escrita) apesar da instrução de não usar git — não causou dano, mas registra que a instrução "nenhum comando git" precisa ser mais explícita em rodadas futuras (nem leitura).

**Decisões e exclusões desta rodada, para referência futura**: ver seção "Exclusão explícita" acima (animação de entrada dos gráficos e contador de notificação ficaram de fora, de propósito). Alguns itens de menor prioridade dos 12 skeletons/22 comportamentos podem ter ficado com cobertura parcial (ex.: alguns valores de opacidade/duração em componentes não listados explicitamente nas 10 tarefas) — não há verificação visual em navegador nesta rodada (autenticação), então a conformidade pixel-a-pixel com o handoff não foi confirmada olho a olho, só por leitura de código e teste automatizado.
