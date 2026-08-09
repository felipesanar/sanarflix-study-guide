# Remover a linha "Recorte · Período" das telas do gestor

A linha cinza sob os filtros ("Recorte: 6º ano (11º e 12º em evidência) · Período 31/05/2026 — 31/05/2026" com o ícone de rastreabilidade ao lado) sai de todas as telas.

## O que muda

- **Visão Geral**: linha removida do cabeçalho, abaixo do filtro de semestre.
- **Detalhamento de simulados**: linha removida, abaixo do seletor de simulados.
- Nada mais muda: a faixa "atualizando…" durante a troca de recorte continua, os tooltips de rastreabilidade dos cards de KPI e dos drawers continuam, e o filtro de semestre segue igual.

## Detalhes técnicos

- Remover o uso de `<ContextoDoRecorte …>` em `src/features/gestor/routes/VisaoGeral.tsx` (linha 400) e `src/features/gestor/routes/Detalhamento.tsx` (linha 411), junto dos imports.
- Excluir `src/features/gestor/components/ContextoDoRecorte.tsx`; mover o helper `rotuloSemestre` para um módulo compartilhado (ou para o `FiltroSemestre`) se algum consumidor ainda precisar do rótulo.
- Ajustar `src/features/gestor/__tests__/VisaoGeral.test.tsx`: remover as asserções de `contexto-recorte` (linhas ~218-219) e o bloco de teste "o ContextoDoRecorte não encosta o semestre NOVO no período do recorte anterior" (~626-646), mantendo a cobertura de `faixa-transicao-recorte`.
- Rodar os testes do gestor e o typecheck para confirmar que nenhum import órfão ficou.
