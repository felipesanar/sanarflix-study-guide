Ao entrar em `/gestor`, redirecionar para `/gestor/visao-institucional` preservando a querystring, para que a aba "Visão Institucional" já apareça selecionada e com os dados carregados sem o usuário precisar clicar.

## Diagnóstico
- `/gestor` (index) renderiza `GestorIndexRedirect` (`src/experiences/gestor/GestorFeatureGate.tsx`).
- Hoje ele espera `useEffectiveFeatures().loading` terminar; enquanto isso retorna `null`. O layout pai (`GestorLayout`) já pintou header, filtros e abas — daí a tela do print: abas visíveis, conteúdo vazio.
- O `<Navigate>` atual também descarta `location.search`, então links legados `/gestor?modulo=…&iesId=…&simuladoId=…` perdem os filtros.

## Mudança (apenas frontend, escopo mínimo)
Arquivo único: `src/experiences/gestor/GestorFeatureGate.tsx`, apenas em `GestorIndexRedirect`:

1. Redirecionar imediatamente para `/gestor/visao-institucional` (a rota filha já é protegida por `GestorFeatureGate` com a feature `gestao.visao_institucional`, então a verificação de feature continua acontecendo lá — não precisa duplicar aqui).
2. Preservar `location.search` no destino do `<Navigate>` (via `useLocation`), para manter `iesId`, `simuladoId` e demais filtros da URL.
3. Manter o fallback atual (primeiro item disponível do `filterGestorNav`, senão `getDefaultRouteForUser`) para o caso — raro — de a feature `gestao.visao_institucional` estar desligada para a IES: nesse cenário, o gate da rota filha manda de volta a `/gestor`, e aí aguardamos `loading` e caímos no próximo módulo liberado.

Nenhuma alteração em rotas, providers, hooks de dados, layout ou lógica de negócio.

## Validação
- Abrir `/gestor` → URL passa a `/gestor/visao-institucional`, aba destacada, dados renderizados.
- Abrir `/gestor?iesId=…&simuladoId=…` → URL passa a `/gestor/visao-institucional?iesId=…&simuladoId=…`, filtros preservados.
- IES com `gestao.visao_institucional` desligada mas outros módulos ligados → cai no primeiro módulo disponível (comportamento atual).
