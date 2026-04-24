## Objetivo

Hoje, ao subir um simulado pelo Portal do Admin, as imagens das questões precisam ser fornecidas como URLs prontas em uma coluna do XLSX. O processo é manual e propenso a erro. Vamos adotar o padrão validado em outro projeto: **as imagens são coladas diretamente nas células do XLSX** (em duas colunas — uma para o enunciado, outra para o comentário) e o sistema as extrai, envia para o Storage do Supabase e vincula automaticamente a cada questão.

## O que muda do ponto de vista do admin

1. Baixa o novo template `.xlsx` com 2 colunas extras dedicadas a imagens (`Imagem do Enunciado` e `Imagem do Comentário`).
2. Cola a imagem **dentro** da célula correspondente (Excel/LibreOffice → Inserir → Imagem na célula).
3. Faz o upload normalmente. O sistema:
   - Lê o texto da planilha
   - Extrai as imagens embutidas
   - Sobe cada imagem ao bucket público `imagensSimulado`
   - Salva a URL pública nos campos da questão
   - Mostra preview com as imagens já vinculadas antes de confirmar

A coluna antiga `Imagem/Gráfico/Tabela` (URL como texto) continua aceita como fallback, para não quebrar planilhas antigas.

## Mudanças técnicas

### 1. Banco de dados (1 migração)

Adicionar coluna `imagem_comentario` em `questoes_simulado` (text, nullable). A coluna `imagem` existente continua armazenando a imagem do enunciado.

```sql
ALTER TABLE public.questoes_simulado
  ADD COLUMN imagem_comentario text;
```

### 2. Novo extrator de imagens (frontend)

Criar `src/utils/xlsxImageExtractor.ts`:

- Recebe o `ArrayBuffer` do XLSX.
- Usa **JSZip** (já presente no projeto via `xlsx`? — se não, adicionar `jszip`) para abrir o XLSX como ZIP.
- Lê `xl/media/*` (binários das imagens).
- Lê `xl/worksheets/_rels/sheet1.xml.rels` → resolve referência ao `drawing1.xml`.
- Lê `xl/drawings/_rels/drawing1.xml.rels` → mapeia `rId → caminho de mídia`.
- Parseia `xl/drawings/drawing1.xml` capturando `<xdr:twoCellAnchor>` / `<xdr:oneCellAnchor>` para extrair a célula (linha + coluna) onde cada imagem está ancorada.
- Filtra por coluna alvo e retorna 2 mapas indexados por número da linha (descontando o header):
  - `enunciadoImages: Record<rowIndex, { base64, mimeType }>` — coluna do enunciado
  - `comentarioImages: Record<rowIndex, { base64, mimeType }>` — coluna do comentário

As colunas alvo serão definidas pelo cabeçalho (busca o índice de "Imagem do Enunciado" e "Imagem do Comentário" no header), em vez de hard-codar `F` e `M` — assim o template pode evoluir sem quebrar o extrator.

### 3. Edge Function nova: `admin-upload-simulado-images`

Criar `supabase/functions/admin-upload-simulado-images/index.ts`. Por que uma edge function dedicada? Subir imagens via `supabase.storage` direto do browser exigiria uma policy de Storage permitindo escrita autenticada — preferimos centralizar a validação e usar service role no servidor.

Fluxo:

1. **CORS** padrão do projeto.
2. **AuthN/AuthZ duplo:**
   - Cliente anon valida o JWT via `auth.getUser()`.
   - Cliente service role chama RPC `has_role(_user_id, 'admin')` para confirmar que é admin (segue o padrão estabelecido em `mem://architecture/user-roles-and-permissions`).
3. **Body validado** com Zod:
   ```ts
   {
     simulado_id: string (uuid),
     images: Array<{
       ordem: number,
       slot: 'enunciado' | 'comentario',
       data: string (base64),
       mime: string
     }>
   }
   ```
4. Para cada imagem:
   - Decodifica base64 → `Uint8Array`.
   - Faz upload em `imagensSimulado` no caminho `${simulado_id}/${ordem}_${slot}.${ext}` com `upsert: true` (idempotente — permite reupload).
   - Pega `getPublicUrl()`.
5. Retorna `{ urls: Array<{ ordem, slot, url }> }`.

Não escreve em `questoes_simulado` — apenas devolve as URLs. A escrita das questões continua no fluxo client-side existente, agora populando `imagem` e `imagem_comentario` com as URLs retornadas.

### 4. Refatorar `SimuladosTab.tsx`

#### 4.1 Novo template (`handleDownloadTemplate`)

Adicionar 2 colunas no template gerado:
- `Imagem do Enunciado` (vazia, para o admin colar a imagem)
- `Imagem do Comentário` (vazia, para o admin colar a imagem)

Manter `Imagem/Gráfico/Tabela` (URL como fallback) com aviso "opcional — use as colunas de imagem embutida".

#### 4.2 Novo `handleFileUpload`

Em vez de `reader.readAsBinaryString`, usar `reader.readAsArrayBuffer` (precisamos do buffer cru para o JSZip).

```text
ArrayBuffer
   ├── SheetJS → linhas de texto (como hoje)
   └── xlsxImageExtractor → mapas { ordem: { base64, mime } }
```

Após processar, monta o array de questões com placeholder `__pendingImage` para as imagens embutidas, e dispara o upload:

```ts
const { data, error } = await supabase.functions.invoke(
  'admin-upload-simulado-images',
  { body: { simulado_id: 'TEMP', images: [...] } }
)
```

**Atenção:** o `simulado_id` ainda não existe nesse momento (o simulado só é criado no `handleConfirmPreview`). Duas opções:

- **(A) Upload em 2 passos:** preview com imagens em base64 (Object URL local) → ao confirmar, cria o simulado, depois chama a edge function com o `simulado_id` real, recebe as URLs e insere as questões já com URL.
- **(B) Bucket de staging:** sobe primeiro em `imagensSimulado/_pending/{uuid}/` e move ao confirmar.

Vou pela **opção A** — mais simples, sem lixo no Storage se o admin desistir. O preview usa `URL.createObjectURL` do blob local; o upload real só roda no `handleConfirmPreview`.

#### 4.3 Novo `handleConfirmPreview` / submit

Sequência:
1. Cria o simulado em `simulados_admin` (já existente).
2. Chama `admin-upload-simulado-images` com `simulado_id` real + todas as imagens em base64.
3. Mescla as URLs retornadas nos objetos de questão (`imagem` e `imagem_comentario`).
4. `INSERT` em `questoes_simulado` (já existente).

Se o upload de imagens falhar, faz rollback: deleta o simulado recém-criado para não deixar simulado órfão.

#### 4.4 Preview modal

Adicionar miniatura das imagens (enunciado e comentário) ao lado de cada questão no modal de preview, para o admin conferir o vínculo antes de confirmar.

#### 4.5 Visualização e edição de questões

A função `handleVisualizarQuestoes` precisa renderizar `imagem_comentario` também. O modal de edição (se existir hoje) precisa do mesmo campo.

### 5. Export para reedição

Na exportação `.xlsx` de questões (`handleExportarQuestoes`), as imagens não são re-embutidas (limitação de SheetJS). Em vez disso, as colunas exportadas trazem as URLs. Adicionar nota no header do export.

## Pontos críticos

- **JSZip:** verificar se já está como dependência transitiva. Se não, adicionar `jszip` aos `dependencies`.
- **Tamanho do payload:** XLSX com muitas imagens pode gerar payload grande em base64 (≈ 33% maior que o binário). Edge functions do Supabase têm limite de ~6MB por request. Vamos:
  - Comprimir/redimensionar imagens > 1024px no cliente (canvas) antes do envio.
  - Se o payload total estourar 5MB, dividir em batches de N imagens por request.
- **Idempotência:** o `upsert: true` no Storage permite reupload da mesma questão sem erro; `INSERT` em `questoes_simulado` não é idempotente — se a inserção falhar parcialmente, a função "Limpar questões" existente já cobre o reset.
- **Memória do projeto:** registrar em `mem://features/admin/simulados-image-upload` o novo padrão (colunas alvo, edge function, bucket, formato de path).

## Estrutura de arquivos

```
supabase/
├── migrations/
│   └── <timestamp>_add_imagem_comentario_to_questoes.sql   (novo)
└── functions/
    └── admin-upload-simulado-images/
        └── index.ts                                         (novo)

src/
├── utils/
│   └── xlsxImageExtractor.ts                                (novo)
└── components/admin/
    └── SimuladosTab.tsx                                     (refatorado)
```

## Perguntas antes de implementar

1. **Compressão de imagem:** ok aplicar redimensionamento automático (máx 1024px no maior lado, JPEG 85%) para imagens grandes antes do envio? Reduz payload e melhora carregamento da prova.
2. **Compatibilidade retroativa:** manter a coluna `Imagem/Gráfico/Tabela` (URL como texto) como fallback ou remover do template novo?
3. **Edição posterior:** ao editar uma questão existente no admin, você quer poder substituir a imagem (upload manual de arquivo único) ou só re-importar a planilha inteira?
