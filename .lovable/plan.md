

# Corrigir Espacamento entre Alternativas, Comentario e Questoes

## Problema Principal

O comentario do professor, quando nao cabe na pagina atual, e movido para a proxima pagina. Isso deixa um enorme espaco vazio apos a ultima alternativa. Alem disso, os separadores entre questoes adicionam espaco excessivo.

## Correcoes

### 1. Reduzir gap apos alternativas antes do comentario
- Linha 804: reduzir `yPos += 5` para `yPos += 3`

### 2. Reduzir gap apos o comentario
- Linha 846: reduzir `yPos += commentHeight + 10` para `yPos += commentHeight + 6`

### 3. Reduzir separador entre questoes
- Linha 850: reduzir `yPos += 10` para `yPos += 6`
- Linha 854: reduzir `yPos += 10` para `yPos += 6`

### 4. Eliminar espaco vazio quando comentario pula de pagina
- Quando o comentario nao couber e pular para nova pagina, adicionar o separador de questao ANTES da quebra de pagina (na pagina atual), preenchendo o espaco vazio
- Alternativamente: se o espaco restante na pagina for maior que 50% da pagina e o comentario nao cabe, mover a ultima alternativa junto com o comentario para a proxima pagina

### 5. Reduzir gap entre alternativas individuais
- Linha 689: de `blockHeight + 3` para `blockHeight + 2`

### 6. Reduzir gap apos enunciado
- Linha 757: de `yPos += 8` para `yPos += 6`

## Secao Tecnica

### Arquivos modificados
- `src/utils/pdfProvaRevisada.ts` - Ajustes de espacamento em 6 pontos

### Logica de page-break inteligente
Quando o comentario nao cabe na pagina atual:
1. Desenhar o separador de questao na pagina atual (preenche o vazio)
2. Quebrar pagina
3. Desenhar o comentario no topo da nova pagina
4. Nao adicionar separador duplicado apos o comentario

Isso elimina o espaco vazio visivel no screenshot.

