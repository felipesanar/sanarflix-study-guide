# Fase 5 — Visão de Alunos (dentro da Visão Geral)

Copy obrigatória: **"Ver visão detalhada"** — nunca "drill-down". Sem linguagem de aluno, sem checklist.

**Entregar:**

1. **Distribuição por evolução**: três grupos — consistentemente proficiente · em variação · consistentemente não proficiente — com quantidade e percentual.

2. **Dispersão Nota × Semestre** com **linha de tendência** (regressão linear), linha de corte 60 discreta, ponto = aluno, hover com anel e tooltip. Com um único semestre filtrado, vira **distribuição daquele semestre** (coluna de pontos com jitter + mediana em destaque) e o rótulo explica a mudança.

3. **Tabela de alunos**: Aluno (+ **tag do grupo** ao lado do nome) · Semestre · Proficiência por simulado (`72 · 75 · 78`) · Tendência.
   - busca, ordenação (`aria-sort`), paginação servidor + virtualização;
   - `—` para quem não participou (fora de qualquer média);
   - truncamento com tooltip; números à direita, tabular.

4. **Visão detalhada do aluno** (drawer): notas por simulado, sparkline de evolução, comparativo entre grandes áreas (**% de acerto**), área crítica e foco sugerido só quando houver dado. Ações Exportar / Copiar resumo.

**Estados:** loading (5 linhas skeleton), vazio com ação, erro com retry, `—` por célula.

**Aceite:** tabela de 104 alunos rola a 60fps; teclado completo no drawer; testes de "aluno ausente não entra na média" e "tag do grupo em toda linha".
