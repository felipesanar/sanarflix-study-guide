# Importar respostas: identificar por Matrícula/RA + marcação dupla

## 1. Identificador do aluno passa a ser Matrícula/RA
- A planilha passa a exigir a coluna `matricula_ra` (aceita variações: "RA", "Matrícula", "matricula", "registro acadêmico"). E-mail deixa de ser usado.
- O aluno é encontrado pela combinação **RA + IES vinculada ao simulado** (um mesmo RA pode existir em faculdades diferentes; dentro da mesma IES hoje não há RA repetido).
- Comparação ignora espaços nas pontas, maiúsculas/minúsculas e zeros à esquerda não serão removidos (RA "00123" ≠ "123").
- Novos motivos de erro no pré-teste e no relatório:
  - RA vazio
  - RA duplicado na planilha
  - RA não encontrado nas IES do simulado
  - RA encontrado em mais de uma IES do simulado (ambíguo — aluno não é importado)
- Template baixado, instruções, cartões do pré-teste, relatório XLSX e histórico de lotes passam a mostrar o RA (e o nome do aluno, quando encontrado) no lugar do e-mail.

Atenção: hoje só **2.421 de 8.691** usuários têm RA cadastrado. Alunos sem RA cairão em "não encontrado" até terem o RA preenchido (edição em Admin > Usuários ou cadastro em lote com RA).

## 2. Células com mais de uma alternativa (ex.: "(A/D)", "A,D", "AD")
- A célula é lida extraindo todas as letras A–E marcadas.
- Uma letra: comportamento atual.
- Duas ou mais letras:
  - Se uma delas é o gabarito → grava a **outra** (primeira não-gabarito) → conta como erro.
  - Se nenhuma é o gabarito → grava a **primeira** letra → conta como erro.
  - Sempre `respondida? = true`.
  - Questão anulada continua valendo acerto para todos, como hoje.
- O pré-teste mostra quantas células com marcação dupla foram encontradas e em quantos alunos, e o relatório indica essas linhas como aviso.

## Detalhes técnicos
- Nova RPC `admin_lookup_users_by_ra_in_ies(p_ies_ids uuid[], p_ras text[])` (SECURITY DEFINER, `search_path public`, só admin via `has_role`, REVOKE de anon/PUBLIC) retornando `ra, user_id, nome, email, id_ies, semestre, match_count`. Migration aditiva; a RPC por e-mail permanece intacta.
- Edge Function `admin-import-simulado-responses`: payload `rows[].matricula_ra` no lugar de `email`; `validateRow` com novos motivos; `normalizeResposta(raw, gabarito)` implementa a regra de dupla marcação e retorna flag `multi`; resumo do dry-run ganha `multi_marked_cells`/`multi_marked_rows`. RPC `admin_import_responses_batch` não é alterada (continua recebendo `user_id` + respostas já normalizadas).
- Frontend: `importar-respostas-types.ts` (`detectRaHeader`, `ParsedRow.matricula_ra`, `REASON_LABEL`), `ImportarRespostasTab.tsx` (parse, template, envio, relatório), `ImportarDryRunStep.tsx` (alerta de marcação dupla), `ImportarPlanilhaStep.tsx` (texto).
- Testes unitários para detecção da coluna RA e para a regra de dupla marcação.
