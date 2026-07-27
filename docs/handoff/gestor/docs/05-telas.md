# 05 · Especificação tela a tela

Referência visual: abra `design/gestor-sanarflix-LIGHT.html` (e `-DARK.html`) no navegador.

---

## Tela 1 · Início do Gestor  → rota `/gestor`

**Propósito**: orientar. **Nenhum indicador de desempenho vive aqui.**

Layout (dentro do `GestorLayout`):
1. Saudação + linha de contexto da IES.
2. **Dois direcionadores** (cards grandes, lado a lado): "Visão Geral" e "Detalhamento por Simulados". Hover: sobe 1px + borda de marca.
3. Grade `2fr / 1fr`: **Cronograma de Simulados** (âncora) | **Avisos da Sanar**.

Cronograma: próximo simulado em destaque; linhas realizado/agendado/reagendado; bloco "contratados sem data" com *Agendar* e *Falar com consultor*; simulado realizado leva ao Detalhamento já filtrado; rodapé com a proveniência do contrato.

Estados: `loading` (skeleton das duas colunas), `empty` (nenhum simulado contratado), `error`.

---

## Tela 2 · Visão Geral  → rota `/gestor/visao-geral`

**Propósito**: panorama executivo → micro, na mesma página.

Ordem vertical:
1. **Barra de filtros**: `FiltroSemestre` (padrão 6º ano) + contexto do recorte.
2. **Panorama — 4 KPIs** em grade de 4 colunas:
   1. **Conceito ENAMED** · badge "projetado" · "projeção institucional · escala 1 a 5" · valor `4/5` · delta `+1`
   2. **Alunos proficientes** · "acima de 60 de proficiência" · `54%` · `+3` · "56 de 104"
   3. **Percentual de acerto** · "questões certas no período" · `61%` · `+2`
   4. **Simulados realizados** · "do contrato Academy 2026" · `3/7` + trilha + link "Ver cronograma"
   Os três primeiros trazem a régua `1º simulado · anterior · atual`.
3. **Gráfico protagonista** — evolução (ver `06-data-viz.md`), com toggle **Grande área | Aluno**.
4. **Diagnóstico Curricular (resumo)** — três grupos por nível de desempenho (excelente / mediano / crítico) com chips de área; a seta abre a **cascata ao lado**, dividindo o grid em dois; a especialidade abre o **drawer de temas**.
5. **Visão de Alunos (resumo)** — distribuição por evolução + dispersão com linha de tendência.
6. **Insights** — leitura textual curta do recorte (sem linguagem de aluno).
7. Divisor "Detalhe · micro" → **Tabela de alunos** com busca, tag de grupo, proficiência por simulado, tendência e paginação. O nome abre a **visão detalhada** do aluno.

Estados: cada bloco tem `loading | empty | error | partial` independentes — a tela nunca fica em branco por causa de um bloco.

---

## Tela 3 · Detalhamento por Simulados  → rota `/gestor/detalhamento`

**Propósito**: camada investigativa, **sempre por simulado**.

Ordem vertical:
1. **Barra de filtros**: `FiltroSemestre` + `SeletorSimulados` (1+) + atalho "Ver cronograma" (abre o **drawer do cronograma**).
2. **Nota de reatividade**: os indicadores reagem ao semestre e aos simulados; com 2+, as médias recalculam e o ENAMED vira comparativo.
3. **3 KPIs**: Percentual de acerto médio · Conceito ENAMED (projetado) · Proficiência média.
4. **Evolução do recorte** (linha com meta) — com um único semestre no filtro, vira a distribuição daquele semestre.
5. **Acerto por área e por semestre** (clique cruzado).
6. **Dispersão Nota × Semestre** (pontos = alunos, linha de tendência).
7. **Visão de Alunos do simulado** — tabela + `DrawerAluno` + paginação + ordenação.
8. **Detalhamento das Questões** — **último componente da página**; some com 2+ simulados.

**Sub-estados da tela**:
- **Vazio**: nenhum simulado selecionado → estado vazio com o seletor em evidência ("Escolha ao menos um simulado").
- **1 simulado**: leitura completa acima.
- **2+ simulados**: comparativo colapsado (expande sob demanda); questões ocultas; alunos com coluna Variação.

---

## Recursos globais

### Estados & componentes
Biblioteca viva: skeletons, vazio, erro, não contratado, régua de status do cronograma, avisos (lido/não-lido/histórico), tooltip de rastreabilidade, glossário, dado parcial, conflito semestre × simulado, onboarding/virada de semestre, e a matriz de estados de cada componente.

### Movimento & interação
Diretriz de motion — ver `07-motion.md`.

---

## Responsividade

Alvo principal: desktop 1440–1920. Abaixo de 1280 as grades de 4 colunas viram 2; abaixo de 1024 viram 1 e as tabelas ganham rolagem horizontal com a primeira coluna fixa. Drawer vira folha de altura total. Não há versão mobile de produto neste escopo.
