# Fase 7 — Comparativo (2 ou mais simulados)

Regra central: **agregação honesta**. Uma coluna por simulado, nunca média única. Conceito ENAMED não tem média.

**Comportamento ao selecionar 2+ simulados:**

1. O Detalhamento troca para o modo comparativo (mesma rota, mesmo esqueleto).
2. **"Detalhamento das Questões" fica oculto.**
3. O comparativo abre **colapsado**: um card por simulado com % de acerto, Conceito ENAMED (projetado) e Proficiência média + delta vs. o anterior; o simulado atual em destaque (borda de marca).
4. Ação **"Ver comparativo completo"** expande:
   - métricas lado a lado (uma coluna por simulado, com delta);
   - **questões comparadas por tema** (não por número da questão);
   - **alunos com coluna Variação** — preenchida **apenas** para quem participou de todos os simulados comparados; caso contrário `—`.
5. Se apenas 1 simulado realizado existir, o seletor não oferece comparação; com exatamente 2, mostra os dois — daí em diante segue a régua normal.

**Aceite (testes obrigatórios):**
- 2 simulados → dois valores de ENAMED, jamais uma média;
- aluno ausente em um dos simulados → `variacao === null` e célula `—`;
- alternar de 2 para 1 simulado devolve a página ao modo detalhado com as questões no fim;
- comparativo colapsado é o estado inicial.
