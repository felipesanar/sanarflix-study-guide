# Fase 1 — Fundação

Implemente a base do Portal do Gestor. Nada de tela de conteúdo ainda.

**Entregar:**

1. **Tema e tokens**
   - Integrar `tokens/tokens.light.css` e `tokens/tokens.dark.css` como camada sobre o Dendê (`[data-theme]`).
   - Onde existir token Dendê equivalente, apontar para ele em vez de duplicar hex.
   - Preferência de tema persistida + `prefers-color-scheme` na primeira visita.

2. **Tipos e dados**
   - Copiar `contracts/types.ts` para `src/features/gestor/api/types.ts` (adaptando ao lint do repo).
   - Cliente de API + React Query (`staleTime` 5min, `keepPreviousData`, `retry: 1`).
   - MSW com as fixtures de `contracts/fixtures/` para dev e testes.

3. **Shell**
   - `GestorLayout`: sidebar fixa de 240px + conteúdo rolável. **Sem header no topo do conteúdo.**
   - Sidebar: lockup `assets/academy/lockup.svg` (48px de altura; variante `-white` no tema escuro) → seletor de IES → navegação → rodapé (notificações, perfil).
   - **Seletor de IES**: dropdown apenas para `admin_b2b` e `gestor_grupo`; para `gestor_ies`, rótulo estático sem afordância de clique.
   - Itens de navegação com estados `default | hover | active | focus` e `aria-current`.

4. **Rotas e filtros**
   - `/gestor`, `/gestor/visao-geral`, `/gestor/detalhamento` (code-split).
   - Hook `useFiltrosGestor` lendo/gravando na **URL**: `semestre` (`6ano | geral | 1..12`) e `simulados`.
   - `FiltroSemestre` (segmented `6º ano (Padrão) · Geral · Por semestre` + dropdown) reutilizável nas duas telas.

5. **Transversais**
   - `Skeleton` (reserva altura), `EstadoVazio`, `EstadoErro` (com "Tentar novamente"), `TooltipRastreabilidade`, `BadgeStatus`, `Paginacao`.
   - Error boundary **por bloco**.
   - Formatadores em `lib/formatters.ts` (%, TRI 0–100, proficiência 0–100, conceito 1–5, data `dd/MM/yyyy`) com testes.
   - Regras em `lib/regras.ts`: `ehProficiente(p) => p > 60`, `calcularVariacao` (null se faltou em algum simulado), `agregarPorSimulado` (nunca média única).

**Critério de aceite:** app navega entre as três rotas com o shell final, filtro na URL, tema claro/escuro, mocks respondendo, testes dos formatadores e regras passando.
