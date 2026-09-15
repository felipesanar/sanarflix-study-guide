# Contagem de participantes no Cronograma de Simulados

## Como funciona hoje

O número ao lado de cada simulado na tela de Início vem da função `get_gestor_cronograma` no banco. Ela:

1. lista os simulados "pais" da instituição (só os que não são reaplicação);
2. monta o grupo pai + reaplicações;
3. conta alunos distintos que têm registro de resposta ou de finalização em qualquer simulado do grupo.

Ou seja, a soma pai + filhos **já está prevista** na função. O problema é outro.

## Causa confirmada do número errado

No exemplo do "1º Simulado UVA - 08/09/26 e 11/09/26":

- pai (`5d395a8b`): 16 alunos com respostas
- reaplicação (`6de79f4b`): 6 alunos com respostas

A função só considera simulados marcados como tipo "simulado_enamed". O pai está marcado assim, mas a **reaplicação está com esse campo em branco**. Por isso ela é descartada na hora de montar o grupo e os 6 alunos não entram na conta — resultado: 16 em vez de 22.

## Mudança proposta

Ajustar `get_gestor_cronograma` para que a reaplicação seja sempre tratada como parte do grupo do seu pai, independentemente de como o campo de tipo dela esteja preenchido. O filtro de tipo continua valendo para decidir **quais simulados aparecem** na lista (só os pais ENAMED), mas não para descartar reaplicações desses pais.

Efeito: o cronograma passa a mostrar 22 participantes nesse simulado, e o mesmo vale para qualquer outro caso de reaplicação.

Sem mudança de código do app e sem mexer em outras telas: a correção é só nessa função.

## Detalhes técnicos

- Migration aditiva com `CREATE OR REPLACE FUNCTION public.get_gestor_cronograma(uuid)`, preservando assinatura, `STABLE SECURITY DEFINER`, `SET search_path = public`, guards (`has_role` + `gestor_pode_acessar_ies`) e ACLs atuais.
- CTE `sims` (lista exibida): inalterada — mantém `type = 'simulado_enamed'` e `simulado_pai_id IS NULL`.
- CTE `grupo`: passa a ler `public.simulados_admin` sem o filtro de `type`, mantendo `COALESCE(simulado_pai_id, id) IN (SELECT id FROM sims)`. Assim o pai continua entrando por ser ENAMED e os filhos entram por vínculo, com `type` nulo ou não.
- CTE `com_tri`: mesmo ajuste, para que a existência de TRI de uma reaplicação também conte para o grupo.
- CTE `participacao`: sem alteração — o `UNION` de `simulados_finalizados` e `answer_progress` já deduplica por `(pai_id, user_id)`, então um aluno que respondeu pai e filho conta uma vez.
- Validação após aplicar: conferir que o grupo de `5d395a8b` retorna 22 participantes e que a contagem de outros simulados ENAMED sem reaplicação não muda.
