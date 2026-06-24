## Objetivo

No Desempenho Institucional, o gestor passa a ver o 3º Simulado FAI + Repescagem + 2ª Repescagem como **um único simulado unificado**. Implementação como **mecanismo reutilizável**: qualquer simulado pode ser marcado como repescagem de um simulado "pai", e o gestor visualiza o pai já consolidado.

Regras acordadas:
- **Resultado por aluno**: última tentativa (a mais recente entre as 3 que ele fez).
- **Filtro**: as 3 entradas individuais somem do seletor — só aparece o "pai" (3º Simulado FAI).
- **TRI/Conceito/Sanção**: mantém os valores do simulado pai original (3º Simulado FAI), sem recalcular.
- **Escopo**: apenas a tela `/desempenho-institucional` (V2). Aluno, ranking, "Meus simulados" e demais áreas continuam vendo os 3 simulados separadamente.

## Mudanças

### 1. Banco — coluna `simulado_pai_id` + vínculo dos 3 FAI

Migração:
- `ALTER TABLE simulados_admin ADD COLUMN simulado_pai_id uuid REFERENCES simulados_admin(id) ON DELETE SET NULL;`
- Índice em `simulado_pai_id`.
- Backfill: marca as 2 repescagens FAI apontando para o 3º Simulado FAI.

### 2. Backend — RPCs do Desempenho Institucional consideram filhos

Atualizar (mantendo assinatura `p_simulado_id, p_ies_id`):
- `get_institutional_simulados` — passa a **excluir** simulados que tenham `simulado_pai_id != null` (filhos somem do seletor do gestor).
- `get_institutional_performance` e `get_institutional_student_scores` — quando `p_simulado_id` é um "pai", expandem internamente para `pai ∪ filhos` (`WHERE simulado_id = p_simulado_id OR simulado_pai_id_da_questao = p_simulado_id`) e, **por aluno**, escolhem a **última tentativa** (maior `finalizado_em` em `simulados_finalizados`), usando só essas respostas no `answer_progress`.
- `get_institutional_tri` — **sem mudança**: retorna o TRI já gravado para o simulado pai em `resultados_ies_tri` (decisão do gestor).
- `get_institutional_evolution` / `get_institutional_evolution_tri` — também filtram filhos para não duplicar pontos no gráfico de evolução.

### 3. Frontend — sem mudanças funcionais

`useInstitutionalPerformanceData.ts` e `DesempenhoInstitucionalV2.tsx` continuam iguais. Como os filhos somem da listagem e as RPCs já agregam, a tela exibe naturalmente o "3º Simulado FAI" com dados consolidados.

Único ajuste estético opcional: exibir um pequeno badge "Inclui repescagens" no header quando o simulado selecionado tiver filhos (consulta extra leve).

### 4. Áreas explicitamente intactas

- `/simulados` (aluno e gestor) — segue listando os 3 separadamente, cada um iniciável.
- `SimuladoDesempenho` individual do aluno — inalterado.
- Ranking, Caderno de Erros, Analytics gerais — inalterados.
- Mocks/testes do Desempenho V2 — inalterados.

## Detalhes técnicos

Tabelas relevantes: `simulados_admin`, `simulados_finalizados`, `answer_progress`, `questoes_simulado`, `resultados_ies_tri`, `resultados_alunos_tri`.

Lógica "última tentativa por aluno" dentro das RPCs:
```sql
WITH grupo AS (
  SELECT id FROM simulados_admin
  WHERE id = p_simulado_id OR simulado_pai_id = p_simulado_id
),
ultima AS (
  SELECT DISTINCT ON (sf.user_id) sf.user_id, sf.simulado_id, sf.finalizado_em
  FROM simulados_finalizados sf
  WHERE sf.simulado_id IN (SELECT id FROM grupo)
  ORDER BY sf.user_id, sf.finalizado_em DESC
)
-- joins de answer_progress restringem a (user_id, simulado_id) ∈ ultima
```

Riscos & validação:
- Conferir se `answer_progress` tem `simulado_id` por linha (sim — usado pelas RPCs atuais) para filtrar respostas pela tentativa escolhida.
- Conferir contagem de alunos: dedup natural pela CTE `ultima` (1 linha por `user_id`).
- Conceito/PCP do bloco TRI ficará "descolado" do % de acerto unificado — é intencional (decisão do gestor). Documentar com tooltip.

## Fora de escopo

- UI no admin para vincular simulado pai/filho (pode entrar em pedido seguinte; por enquanto o vínculo dos 3 FAI vai por migração e novos casos podem ser feitos via SQL pontual).
- Recalcular TRI agregando as 3 provas.
- Alterar a experiência do aluno.
