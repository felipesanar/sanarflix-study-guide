# Importação de respostas: gravação final, idempotência e histórico de lotes

## 1. Liberar a etapa final da importação (aprovado)
A rotina que grava as respostas (`admin_import_responses_batch`) hoje só aceita chamadas de um administrador logado direto, e o servidor de importação é recusado. Ajuste mínimo: o guard passa a aceitar também o service role (`auth.role() = 'service_role'` OU `has_role(auth.uid(),'admin')`). O resto da lógica fica idêntico. O servidor de importação já confere se quem pediu é admin antes de chamar.

## 2. Idempotência — situação atual
Resposta curta: **sim, hoje um aluno não fica com respostas duplicadas no mesmo simulado**, pelos seguintes motivos já presentes na rotina:
- Trava por aluno + simulado durante a gravação (duas importações simultâneas do mesmo aluno não se atropelam).
- Se o aluno já tem finalização naquele simulado:
  - modo "pular": nada é gravado, fica registrado como "pulado";
  - modo "substituir": as respostas antigas vão para o histórico, são apagadas, e as novas são gravadas como nova tentativa.
- O mesmo aluno repetido dentro do mesmo lote é ignorado.
- RA duplicado na planilha já é recusado no pré-teste.

Brecha restante: não existe trava no banco impedindo duas linhas de resposta para a mesma questão do mesmo aluno — a proteção depende só da rotina. Reforço proposto (aditivo): índice único parcial em `answer_progress (user_id, simulado, question_id)`, criado **somente se** uma checagem prévia confirmar que não há duplicatas existentes; se houver, reporto a quantidade e não crio o índice sem sua autorização (sem apagar dados).

## 3. Erro em "Últimos lotes"
Causa confirmada: não é falta de importações. Desde o endurecimento de segurança, as rotinas `admin_list_import_batches` e `admin_get_batch_records` só podem ser executadas pelo service role, então o painel (admin logado) é recusado.
Correção: devolver permissão de execução ao usuário logado (`GRANT EXECUTE ... TO authenticated`) — as rotinas continuam checando internamente que é admin, então só administradores veem.
Além disso, na tela:
- Sem lotes: mensagem clara "Nenhuma importação feita ainda. Os lotes aparecem aqui depois da primeira importação." (sem ícone de erro).
- Erro real: texto em linguagem simples ("Não foi possível carregar o histórico de importações. Tente novamente em instantes.") em vez da mensagem técnica.

## Detalhes técnicos
- Migration aditiva: `CREATE OR REPLACE` de `admin_import_responses_batch` só com o guard alterado; `GRANT EXECUTE` em `admin_list_import_batches(int)` e `admin_get_batch_records(uuid)` para `authenticated`; checagem de duplicatas + índice único parcial condicional.
- `ImportarHistoricoLotes.tsx`: estado vazio dedicado quando a lista vem vazia; mapear erro para mensagem amigável.
- Validação: rodar pré-teste + importação real de um aluno de teste, reimportar o mesmo arquivo nos modos pular/substituir e conferir contagem de `answer_progress` por aluno/simulado; abrir "Últimos lotes" como admin.
