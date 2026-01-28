
# Plano: Corrigir Exibição de Questões Não Respondidas na Aba de Desempenho

## Problema Identificado

A função de banco de dados `get_questions_by_subspecialty` está usando **LEFT JOIN** com a tabela `answer_progress`, o que faz com que questões de simulados que o aluno não realizou apareçam no modal de revisão.

**Comportamento atual:**
- O LEFT JOIN retorna TODAS as questões que correspondem aos filtros (tema, área, especialidade)
- Questões não respondidas aparecem com `acertou = false` e `user_answer = NULL`
- Isso inclui questões de simulados que o aluno nunca fez

**Comportamento esperado:**
- Apenas questões que o aluno efetivamente respondeu devem aparecer
- Cada aluno só pode ver questões dos simulados que ele realizou

## Solução Técnica

### 1. Alterar a função `get_questions_by_subspecialty`

Mudar de `LEFT JOIN` para `INNER JOIN` na tabela `answer_progress`:

```sql
CREATE OR REPLACE FUNCTION public.get_questions_by_subspecialty(
  sub_name text, 
  p_simulado_id uuid DEFAULT NULL::uuid, 
  area_name text DEFAULT NULL::text, 
  specialty_name text DEFAULT NULL::text
)
RETURNS TABLE(
  id text, 
  gabarito text, 
  enunciado text, 
  a text, b text, c text, d text, 
  comentario text, 
  imagem text, 
  dificuldade text, 
  acertou boolean, 
  user_answer text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  return query
  select
    q.id::text,
    q.correta,
    q.enunciado,
    q.alternativa_a,
    q.alternativa_b,
    q.alternativa_c,
    q.alternativa_d,
    q.comentario,
    q.imagem,
    coalesce(q.grau_dificuldade, 'Médio'),
    ap.correct,                    -- Não precisa mais de COALESCE
    upper(ap.resposta_usuario)
  from public.questoes_simulado q
  INNER JOIN public.answer_progress ap  -- Mudança: LEFT JOIN → INNER JOIN
    on q.id = ap.question_id
   and ap.user_id = auth.uid()
   and (p_simulado_id is null or ap.simulado = p_simulado_id)
  where q.tema = sub_name
    and (area_name is null or q.grande_area = area_name)
    and (specialty_name is null or q.especialidade = specialty_name)
    and (p_simulado_id is null or q.simulado_id = p_simulado_id)
  limit 10;
end;
$$;
```

**Mudanças principais:**
1. `LEFT JOIN` → `INNER JOIN`: Garante que só retorne questões que existem em `answer_progress` para o usuário atual
2. Remoção do `COALESCE(ap.correct, false)`: Com INNER JOIN, `ap.correct` sempre terá valor

## Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Questões mostradas | Todas do tema/área | Apenas as respondidas pelo aluno |
| Questões de outros simulados | Aparecem como "não respondidas" | Não aparecem |
| Segurança de dados | Vazamento de questões entre simulados | Isolamento por usuário |

## Verificação

Após a implementação:
1. O aluno só verá questões dos simulados que ele efetivamente realizou
2. O modal de revisão não exibirá mais questões com status "Não Respondida" de simulados não realizados
3. A contagem de questões por tema/especialidade será consistente com as respostas do aluno

## Arquivos Afetados

- **Migração SQL**: Nova migração para atualizar a função `get_questions_by_subspecialty`

## Observações

- As demais funções RPC (`get_user_performance_aggregates`, `get_user_simulados`, `get_all_user_performance_by_area`) já usam `WHERE ap.user_id = auth.uid()` corretamente e filtram apenas dados do usuário autenticado
- A mudança é isolada apenas na função de busca de questões para o modal de revisão
