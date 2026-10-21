# Importar respostas: identificar aluno por Matrícula/RA ou e-mail (remover ID)

## O que muda para o admin
- A 1ª coluna da planilha aceita **Matrícula/RA ou e-mail do aluno** (o que estiver no QR Code do cartão-resposta).
- Reconhecimento automático por linha: se o valor tem "@" e formato de e-mail, procura pelo e-mail; senão, pela Matrícula/RA, como hoje. Pode misturar na mesma planilha.
- A identificação por ID do aluno deixa de existir: um valor no formato de ID passa a ser tratado como RA e cairá em "Matrícula/RA não encontrada".
- O resto não muda: 1 coluna de identificação + 1 por questão, regras de branco e marcação dupla, modos pular/substituir.

## Regras do e-mail
- Comparação sem diferenciar maiúsculas/minúsculas e ignorando espaços nas pontas.
- E-mail não cadastrado → "E-mail não cadastrado".
- E-mail cadastrado, mas o aluno não é de nenhuma IES do simulado → "Aluno não pertence às IES do simulado" (não importa).
- Mesmo aluno duas vezes (ex.: uma linha pelo RA e outra pelo e-mail) → recusado como duplicado no pré-teste.

## Telas
- Ajuda e mensagens: "1ª coluna: Matrícula/RA ou e-mail do aluno".
- Modelo baixado: cabeçalho da 1ª coluna vira `matricula_ra_ou_email`.
- Pré-teste e relatório: coluna "Identificado por" mostra "RA" ou "E-mail".

## Detalhes técnicos
- Edge `admin-import-simulado-responses`: trocar classificação `isUuid` por `isEmail`; remover a busca por `users.id`; buscar por e-mail com `supabaseAdmin.from('users').select('id, nome, email, semestre, id_ies').in('email', ...)` em lotes de 500 (normalizado em minúsculas; fallback `ilike` não necessário se e-mails são gravados em minúsculas — verificar no banco e, se houver maiúsculas, comparar via lista normalizada). Escopo pela IES do simulado (`ies_ids`), mesmo padrão já usado para ID. Motivos: `email_not_found`, `email_not_in_ies`; remover `id_not_found`/`id_not_in_ies`. `identificado_por: 'ra' | 'email'`. Deduplicação por `user_id` (`duplicate_student_in_file`) mantida. Sem mudança no banco; `admin_import_responses_batch` intocada.
- Front: `importar-respostas-types.ts` (remover `isUuid`, adicionar `isEmail`, labels novas, tipo `identificado_por`), `ImportarRespostasTab.tsx` (template, textos, relatório), `ImportarDryRunStep.tsx` (rótulo "E-mail"), `ImportarPlanilhaStep.tsx` (ajuda).
- Testes: substituir os de `isUuid` por `isEmail` (e-mail reconhecido com maiúsculas/espaços; RA como `23-1-20297` não é e-mail; UUID não é e-mail).
