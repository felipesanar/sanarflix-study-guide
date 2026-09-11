# Liberar o 1º Simulado UVA até 15:35 de hoje

## O que verifiquei no cadastro do simulado

O simulado "1º Simulado UVA - 11/09/26" está assim hoje:

- Situação: ativo
- Liberado desde: 11/09/2026, 08:23 (horário de Brasília)
- Encerramento: 11/09/**2029**, 13:25 — ano digitado errado
- Duração: 300 minutos
- Instituições: 2 vinculadas

Ou seja, o campo de encerramento está com o ano 2029 em vez de 2026. Hoje isso não impede
ninguém de fazer a prova (a data está no futuro), mas o prazo real que você quer — hoje às
15:35 — não está registrado em lugar nenhum.

## Onde a alteração é feita

Apenas no cadastro do próprio simulado, no campo de data de encerramento. É uma mudança de
dado, não de código: nada no site precisa ser alterado, porque a tela de simulados já esconde
a prova automaticamente quando o prazo de encerramento passa.

## O que vou fazer

Ajustar o encerramento do simulado para **11/09/2026 às 15:35 (horário de Brasília)**,
mantendo tudo o mais igual: situação ativa, data de liberação, duração de 300 minutos e as
duas instituições vinculadas. Nenhuma resposta de aluno já registrada é afetada.

Resultado esperado: até 15:35 de hoje os alunos da UVA continuam podendo iniciar e enviar a
prova; depois desse horário o simulado deixa de aparecer como disponível.

## Detalhes técnicos

- Tabela `public.simulados_admin`, linha `id = 6de79f4b-7d75-4d94-9201-6e28aba056f5`.
- `UPDATE` de `data_encerramento` para `2026-09-11 18:35:00+00` (15:35 UTC-3), via alteração
  de dados — sem migration, sem DDL, sem `DELETE`/`TRUNCATE`.
- O corte de disponibilidade já é aplicado em `simuladosApi.listarSimulados`
  (`data_encerramento >= agora`), portanto nenhuma alteração em `src/` é necessária.
