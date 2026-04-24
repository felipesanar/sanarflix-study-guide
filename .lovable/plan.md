## Diagnóstico atual

Confirmei via banco e logs:

1. **A Edge Function `admin-upload-simulado-images` NUNCA foi chamada** (sem logs de execução).
2. O simulado mais recente "SIMULADO I - PLANILHA OFICIAL (3)" tem **0 imagens salvas** (nem `imagem`, nem `imagem_comentario`).
3. O bucket `imagensSimulado` tem apenas **1 arquivo legado** (de um simulado antigo). Nenhuma imagem nova foi enviada.
4. O bucket está **público** e as **RLS de `questoes_simulado` estão corretas** — alunos da IES conseguem ler. Não é problema de policy.

**Causa real:** o extrator `xlsxImageExtractor.ts` está retornando `matchedEnunciado=0, matchedComentario=0` para essa planilha. O log do console mostrou `[SimuladosTab] Imagens extraídas: Object` mas você não expandiu — é quase certo que todos os contadores estão em zero. Sem imagens detectadas no cliente, o `imagesPayload` fica vazio e a Edge Function nem é invocada.

**Hipóteses prováveis** (ordem de probabilidade):
- A planilha usa **"Inserir Imagem na Célula"** (recurso recente do Excel/Sheets) — essas imagens ficam em `xl/cellimages.xml` + função `=IMAGE()`, **não em `xl/drawings/drawing1.xml`**. O extrator atual só lê drawings clássicos, então acha 0 âncoras.
- Ou as imagens estão como `xdr:absoluteAnchor` (sem célula de origem) — também não suportado.
- Ou estão em `xl/media/` mas o `drawing1.xml` referencia `xdr:colOff/rowOff` apontando para fora das colunas 4 (Enunciado) e 10 (Comentário).

## Plano

### 1. Logs verbosos no extrator (`src/utils/xlsxImageExtractor.ts`)
- Logar `totalMedia`, lista de `xdr:row`/`xdr:col` de cada âncora encontrada.
- Logar se `xl/cellimages.xml` existe (formato novo).
- Logar âncoras `absoluteAnchor` separadamente.

### 2. Suporte ao formato "Imagem na célula" (`xl/cellimages.xml`)
Quando o XLSX usa esse formato, mapear cada `cellimage` por seu `r:id` → arquivo de mídia, e cruzar com células da planilha que contêm `=DISPIMG("ID_…", …)` ou `=_xlfn.DISPIMG(...)`. Isso permite identificar a linha/coluna da imagem mesmo sem âncora geométrica.

### 3. Suporte a `xdr:absoluteAnchor`
Se houver âncoras absolutas, calcular linha/coluna pelo offset em EMUs (914400 EMU/in) usando largura padrão de coluna — fallback aproximado.

### 4. Console.log no modo prova (`src/pages/ModoProva.tsx`)
Após `buscarQuestoesSimulado`, adicionar:

```ts
const comImagem = questoesData.filter(q => q.imagem).length;
console.log('[ModoProva] Simulado aberto', {
  simuladoId,
  totalQuestoes: questoesData.length,
  questoesComImagem: comImagem,
  primeirasImagens: questoesData.slice(0, 5).map(q => ({ id: q.id, imagem: q.imagem ?? null })),
});
```

Isso confirma de forma definitiva, no lado do aluno, se o problema é (a) imagens nunca salvas no banco ou (b) salvas mas não renderizadas.

### 5. Toast mais informativo no admin
Quando `totalEmbedded === 0` mas o XLSX tem `totalMedia > 0`, mostrar toast de **alerta** explicando: "Detectamos N imagens no arquivo, mas nenhuma está ancorada nas colunas Enunciado/Comentário. Verifique o formato."

### 6. Verificação prática após o deploy
Você re-sobe a planilha; com os novos logs eu vejo exatamente onde está a quebra (formato da planilha vs. extrator) e ajusto o parser conforme necessário.

## Arquivos afetados
- `src/utils/xlsxImageExtractor.ts` (logs + suporte cellimages/absoluteAnchor)
- `src/pages/ModoProva.tsx` (console.log de abertura)
- `src/components/admin/SimuladosTab.tsx` (toast de alerta quando 0 matches)
