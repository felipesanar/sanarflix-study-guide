# Fase 3 — Visão Geral: panorama executivo (`/gestor/visao-geral`)

**Regras que não podem ser violadas:** sem Nota TRI nesta tela; exatamente 4 indicadores; conceito ENAMED sempre rotulado "projetado".

**Entregar:**

1. **Barra de filtros** com o `FiltroSemestre` da fase 1 (padrão `6º ano`) + linha de contexto do recorte.

2. **4 KpiCards**, nesta ordem:
   1. Conceito ENAMED · badge "projetado" · "projeção institucional · escala 1 a 5"
   2. Alunos proficientes · "acima de 60 de proficiência"
   3. Percentual de acerto · "questões certas no período"
   4. Simulados realizados · "do contrato Academy 2026" + trilha + link "Ver cronograma"
   - Os três primeiros trazem a régua `1º simulado · anterior · atual` e o delta vs. anterior.
   - A régua **some** quando só há 1 simulado realizado; com 2, mostra dois pontos.
   - Ícone `info` abre o `TooltipRastreabilidade` com `meta.criterio` vindo da API.
   - Número protagonista 40–44px/800, tabular-nums, count-up em `motion-5`.

3. **Gráfico protagonista — evolução** (Visx/Nivo, ver `docs/06-data-viz.md`):
   - linha + área com gradiente da marca, meta 60 tracejada, ponto atual com halo;
   - tooltip com nome do simulado, valor e nº de participantes;
   - toggle **Grande área | Aluno** (não existe "Geral") com cross-fade das séries;
   - com 1 simulado realizado: ponto único rotulado, sem linha, com a nota explicativa;
   - `role="img"` + `<title>/<desc>` + alternativa tabular.

**Estados:** cada bloco com loading/empty/error/partial independentes.

**Aceite:** trocar o filtro recalcula sem piscar (`keepPreviousData`), URL reflete o recorte, testes cobrindo "sem TRI aqui" e "ENAMED nunca é média".
