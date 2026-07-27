# Fase 8 — Acabamento: motion, acessibilidade, dark, performance

Última fase antes do piloto. Nada de feature nova — só acabamento.

**1. Motion** (`docs/07-motion.md`)
- Aplicar os tokens `motion-1..5` e as curvas padrão em hover, press, foco, toggle, expansão, drawer, cascata e gráficos.
- Animar **só** `transform` e `opacity`. Interrupção cancela a anterior.
- Reveal em cascata na primeira pintura (máx. 3 níveis, 40ms de defasagem).
- `prefers-reduced-motion: reduce` → quase instantâneo, sem deslocamento, sem count-up.

**2. Acessibilidade** (`docs/11-acessibilidade.md`)
- Percorrer cada tela só com teclado; foco visível em tudo; drawer com trap + ESC + retorno de foco.
- `aria-current`, `aria-expanded`, `aria-sort`, `role="status"`/`alert` nos estados.
- Gráficos com `<title>/<desc>` e alternativa tabular.
- `axe` no CI sem violação séria/crítica; zoom 200% sem perda.

**3. Tema escuro**
- Conferir cada nível de superfície (degraus perceptíveis), texto sem branco puro, hover que **clareia**, foco visível, sem sombra herdada do claro, séries de gráfico recoloridas, logo na variante branca.
- Visual regression nos dois temas.

**4. Performance**
- Virtualizar tabelas > 100 linhas; memoizar linhas e pontos; `charts/` em chunk separado.
- Medir LCP < 2.5s, INP < 200ms, CLS < 0.1 na Visão Geral com dados reais.
- Verificar no Profiler que trocar o filtro não re-renderiza a página inteira.

**5. Telemetria e flag**
- Eventos de `docs/13-plano-de-entrega.md`, **sem PII**.
- Feature flag `portal_gestor_v2` por instituição, com rollback por desligamento.

**6. Auditoria final de consistência**
- O mesmo componente idêntico onde aparecer; mesmos espaçamentos, rótulos e formatos;
- nenhum hex/px solto; nenhum resquício de tema claro no escuro;
- estados vazio/carregando/erro tão bem tratados quanto o estado cheio.
