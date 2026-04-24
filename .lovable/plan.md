## Problema

Você subiu o `SIMULADO_I_-_PLANILHA_OFICIAL_3.xlsx` e as imagens não foram salvas. Investigando:

- Edge function `admin-upload-simulado-images` **não tem nenhum log** → ela nunca foi chamada.
- A planilha **tem 19 imagens embutidas** (em `xl/media/`), corretamente ancoradas:
  - Coluna 5 (= F = `Imagem do Enunciado`) ✅
  - Coluna 12 (= M = `Imagem do Comentário`) ✅
- A estrutura é direta: linha 1 = header, linha 2 = questão 1, linha 3 = questão 2, etc.

## Causa raiz: off-by-one no extractor

O `xdr:row` no XML do drawing já é **0-based**, onde `xdr:row=0` é a linha do header e `xdr:row=N` é a linha da questão N (1-based).

No `xlsxImageExtractor.ts` (linha 219), fazemos:
```ts
const rowIndex = row - 1;  // ❌ subtrai um a mais
```

E no `SimuladosTab.tsx` o consumidor faz:
```ts
const xlsxRow = index + 1;             // questão 1 → xlsxRow = 1
const rawEnunciado = extracted.enunciadoImages[xlsxRow];
```

Resultado: imagem da **questão 1** (em `xdr:row=1`) vira chave `0`, mas o consumidor busca `1`. Tudo desloca em 1 e nada bate → array de imagens enviado para a edge function fica vazio → função nem é chamada.

Por isso:
- Sem logs na edge function
- Nenhuma imagem persistida no `imagensSimulado`
- Campos `imagem` e `imagem_comentario` ficaram nulos

## Correção (1 linha de código)

Em `src/utils/xlsxImageExtractor.ts`, trocar:

```ts
const rowIndex = row - 1;
if (rowIndex < 0) continue;
```

por:

```ts
if (row < 1) continue;          // ignora qualquer ancoragem na linha do header
const rowIndex = row;            // xdr:row N == questão N (1-based)
```

Assim `enunciadoImages[1]` corresponde à questão 1, casando com `xlsxRow = index + 1` no `SimuladosTab.tsx`.

## Como recuperar as imagens das 100 questões já cadastradas

A migração precisa ser feita **manualmente** porque o INSERT em `questoes_simulado` já rodou sem as URLs. Duas opções:

1. **Recomendada (limpa)**: na tela do simulado, usar o botão "Limpar questões" do simulado FUNEPE recém-criado, depois fazer upload do mesmo XLSX novamente — agora com a correção, as imagens serão extraídas e vinculadas.
2. **Alternativa**: criar um simulado novo com o XLSX corrigido e deletar o antigo.

## Arquivos alterados

- `src/utils/xlsxImageExtractor.ts` — 2 linhas (mudança do cálculo de `rowIndex`)

## Validação após o fix

1. Refazer o upload do `SIMULADO_I_-_PLANILHA_OFICIAL_3.xlsx`.
2. No modal de preview, conferir que aparecem miniaturas ao lado das questões correspondentes (questão 3 deve mostrar imagem do enunciado, questão 28 deve mostrar imagem do comentário, etc.).
3. Após confirmar, verificar nos logs de `admin-upload-simulado-images` o registro `count=19` (ou similar).
4. Abrir uma questão como aluno → imagem renderizada.
