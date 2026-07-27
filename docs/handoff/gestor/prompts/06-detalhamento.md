# Fase 6 — Detalhamento por Simulados, 1 simulado (`/gestor/detalhamento`)

Regras: **nunca "todos"**; seleção explícita de 1+; TRI existe só aqui; áreas/temas em % de acerto.

**Ordem da página (obrigatória):**

1. **Barra de filtros**: `FiltroSemestre` + `SeletorSimulados` (multi) + atalho "Ver cronograma" que abre o **drawer do cronograma** (reaproveitar o componente da fase 2 — o gestor não deve voltar à home).
   - Simulado previsto / em processamento aparece **desabilitado com motivo**.
   - Aviso não-bloqueante acima de 5 selecionados.
   - Nenhum selecionado → **estado vazio** com o seletor em evidência e nenhuma requisição de métrica.

2. **Nota de reatividade**: os indicadores reagem ao semestre e aos simulados.

3. **3 KPIs**: Percentual de acerto médio · Conceito ENAMED (projetado) · Proficiência média.

4. **Evolução do recorte** (linha + meta). Um único semestre no filtro → distribuição daquele semestre.

5. **Acerto por área e por semestre** (bloco único, sem toggle próprio — segue o filtro global):
   - `6º ano`: todos os semestres visíveis, **11º e 12º em evidência**, demais esmaecidos;
   - `Geral`: todos iguais; `Por semestre`: só o filtrado em evidência;
   - **clique cruzado**: semestre clicado → áreas recalculam; área clicada → semestres recalculam; segundo clique limpa; transição de 200ms.

6. **Dispersão Nota × Semestre** (pontos = alunos, linha de tendência).

7. **Visão de Alunos do simulado**: Aluno · Semestre · **Número de acertos** · **Nota TRI** · Proficiência · Situação.
   - ordenação, paginação, "Ocultar não participantes";
   - linha clicada → **drawer do aluno** (TRI, % de acerto, situação, posição/percentil, acerto por grande área, exportar/copiar) e a linha fica selecionada.

8. **Detalhamento das Questões — último componente da página**:
   - toolbar: filtro de **Grande área** + ordenação **Ordem da prova · Mais erradas · Mais acertadas**;
   - colunas `Nº · Grande área · Especialidade · Tema · Índice de acerto`;
   - linha expande com enunciado completo, alternativas A–D (correta destacada) e distribuição por alternativa com distrator dominante sinalizado;
   - `<button>` na célula do número, `aria-expanded`/`aria-controls`.

**Aceite:** 0 simulados → vazio; 1 simulado → tudo acima; gabarito `processing` → bloco desabilitado com motivo e **sem número**; testes cobrindo cada um.
