# Importar respostas: colunas por posição e textos como branco

## 1. Colunas de questão lidas pela posição
- A planilha passa a ter só: 1ª coluna = Matrícula/RA, depois uma coluna por questão, em ordem.
- O nome do cabeçalho das questões deixa de importar ("1", "Questão 1", "Q1", "Q.01"… tudo vale). A 2ª coluna é a questão 1, a 3ª é a questão 2, e assim por diante.
- A 1ª coluna é sempre tratada como Matrícula/RA, qualquer que seja o nome do cabeçalho.
- Total de colunas exigido = 1 + número de questões do simulado (ex.: 101 para simulado de 100 questões). Se vier diferente, a planilha é recusada no Passo 2 com a mensagem: "A planilha tem X colunas; este simulado exige Y (1 de Matrícula/RA + Z questões)."
- Colunas totalmente vazias no final (sobra comum do Excel) são ignoradas antes da contagem.

## 2. Colunas opcionais removidas
- Saem `tempo_minutos`, `saidas_aba` e `finalizado_em` da planilha e do template.
- Tempo passa a ser sempre a duração do simulado; saídas de aba = 0; data de finalização = a data padrão do Passo 1 (ou o momento da importação).

## 3. Textos na célula viram "em branco"
- A célula só é considerada resposta se tiver apenas letras A–E e os separadores `( ) / , ;` e espaço (maiúsculas/minúsculas indiferentes).
- Qualquer outra coisa ("BLANK", "EM BRANCO", "BRANCO", "NULO", "-", "*", "X", números…) é gravada como não respondida.
- Com isso "BLANK" não é mais confundido com marcação dupla B+A.
- A regra de marcação dupla atual ("(A/D)" etc.) continua igual.
- O pré-teste passa a mostrar quantas células com texto foram tratadas como branco.

## 4. Template
- "Baixar template" gera: `matricula_ra`, `Questão 1` … `Questão N`, sem colunas extras.

## Detalhes técnicos
- `ImportarRespostasTab.tsx`: ler com `XLSX.utils.sheet_to_json(ws, { header: 1 })` (matriz), aparar colunas vazias à direita, validar `row0.length === 1 + total_questoes`, mapear índice `i` → questão `i`. Remover detecção de tempo/saídas/data e `detectRaHeader` como pré-requisito. Contagem de células-texto calculada no cliente e enviada ao resumo.
- `importar-respostas-types.ts`: nova `isRespostaValida(raw)` com regex `^[A-Ea-e()\/,;\s]+$`; `ParsedRow` sem campos opcionais.
- Edge `admin-import-simulado-responses`: `extractLetters` retorna `[]` quando a célula não passa na regex acima (defesa dupla); resumo do dry-run ganha `text_as_blank_cells`. RPC `admin_import_responses_batch` não muda.
- `ImportarDryRunStep.tsx`: aviso de células-texto; `ImportarPlanilhaStep.tsx`: texto de ajuda e erro de contagem de colunas.
- Testes unitários: cabeçalhos variados, contagem de colunas, "BLANK"/"EM BRANCO"/"(A,B)"/"a".
