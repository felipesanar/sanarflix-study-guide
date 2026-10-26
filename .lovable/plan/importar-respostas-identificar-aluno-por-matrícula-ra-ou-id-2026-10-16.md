# Importar respostas: identificar aluno por Matrícula/RA ou ID do aluno

## O que muda para o admin
- A 1ª coluna da planilha continua sendo a identificação do aluno, mas agora aceita **Matrícula/RA ou ID do aluno** (o código do cartão-resposta / QR Code).
- Não precisa escolher nada: o sistema reconhece cada linha sozinho. Se o valor tem o formato de ID (ex.: `3f2a9c1e-...-...`), procura pelo ID; senão, procura pela Matrícula/RA, como hoje.
- Pode misturar na mesma planilha linhas com ID e linhas com RA.
- O resto não muda: 1 coluna de identificação + 1 coluna por questão, regras de branco e marcação dupla, modos pular/substituir.

## Regras de validação do ID
- ID não encontrado → "ID do aluno não encontrado".
- ID encontrado, mas o aluno não é de nenhuma IES do simulado → "Aluno não pertence às IES do simulado" (não importa).
- Mesmo aluno duas vezes na planilha (por exemplo, uma linha por ID e outra pelo RA dele) → recusado como duplicado no pré-teste.
- O ID é comparado sem diferenciar maiúsculas/minúsculas e ignorando espaços.

## Telas
- Passo da planilha: texto de ajuda passa a dizer "1ª coluna: Matrícula/RA ou ID do aluno".
- Modelo baixado: cabeçalho da 1ª coluna vira `matricula_ra_ou_id`.
- Pré-teste e relatório: mostram nome do aluno e como foi identificado (RA ou ID).

## Detalhes técnicos
- Nova RPC aditiva `admin_lookup_users_by_id_in_ies(p_ies_ids uuid[], p_ids uuid[])` (SECURITY DEFINER, `search_path public`, só service role/admin, REVOKE de anon/PUBLIC), retornando `user_id, nome, email, id_ies, semestre, in_ies`.
- Edge `admin-import-simulado-responses`: classificar cada identificador com regex de UUID; buscar IDs e RAs em paralelo; deduplicar pelo `user_id` resolvido (motivo `duplicate_student_in_file`); novos motivos `id_not_found`, `id_not_in_ies`; resultado ganha `identificado_por: 'ra' | 'id'`. RPC `admin_import_responses_batch` não muda.
- Front: `importar-respostas-types.ts` (labels dos motivos, helper `isUuid`), `ImportarPlanilhaStep.tsx` (ajuda), `ImportarRespostasTab.tsx` (template, coluna no relatório), `ImportarDryRunStep.tsx` (coluna "Identificado por").
- Testes unitários: detecção UUID vs RA, duplicado por ID+RA do mesmo aluno.
