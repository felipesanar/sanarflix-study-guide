# Corrigir a lista de respondentes na exclusão de simulados

## O que aconteceu
A verificação já partia das respostas (answer_progress filtrado pelo simulado). Mas ela também busca pessoas na tabela de notas TRI dos alunos, e lá a coluna se chama `student_id`, não `user_id`. Esse nome errado faz a verificação inteira falhar, e por isso o aviso continua aparecendo em todos os simulados.

## Correção
- Usar answer_progress filtrado pelo simulado como fonte principal dos respondentes, como você sugeriu. Para a data, usar a de finalização ou de início, já que as respostas não têm data.
- Continuar somando, como garantia, quem só aparece em simulado iniciado, finalizado, histórico de respostas ou nota TRI, assim ninguém fica de fora da conta.
- Corrigir também a exclusão, que apaga as notas TRI pelo mesmo nome de coluna errado.

## Detalhes técnicos
- Migration com `CREATE OR REPLACE` para `admin_simulado_delete_check` e `admin_delete_simulado`. Nas duas, a tabela resultados_alunos_tri passa a ser lida por `student_id`. O resto da lógica (limite de 5, modos, auditoria) não muda.
- Validação: chamar a verificação do "Simulado teste" (c5a421bb…) com uma conta de admin no preview e confirmar que a lista aparece.
