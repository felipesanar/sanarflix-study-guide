

## Diagnóstico: Causa Raiz dos 400 Bad Request

Todos os 24 erros têm um padrão em comum: **nomes com caracteres acentuados** (ê, ã, ô, ú, ç, á). Exemplos do relatório:

- `LisbÃ´a` → deveria ser `Lisboa` (com ô)
- `CorrÃªa` → deveria ser `Corrêa`
- `JÃºlia` → deveria ser `Júlia`
- `GuimarÃ£es` → deveria ser `Guimarães`

O problema é **encoding/charset do CSV**. O arquivo CSV foi salvo em Latin-1 (Windows-1252, padrão do Excel brasileiro). O código atual usa `XLSX.read(arrayBuffer, { type: 'array' })` que interpreta os bytes como UTF-8, corrompendo todos os caracteres acentuados. O nome corrompido falha na validação Zod do edge function (regex `^[a-zA-ZÀ-ÿ\s\-'.]+$`), retornando 400.

---

## Plano de Correção

### 1. Frontend — Detecção inteligente de encoding para CSV (`UsersTab.tsx`)

Para arquivos CSV, em vez de passar o ArrayBuffer diretamente ao XLSX:

1. Ler o arquivo como texto com `TextDecoder('utf-8')`
2. Detectar mojibake procurando padrões como `Ã£`, `Ã©`, `Ãª`, `Ã´`, `Ã§` no texto decodificado
3. Se mojibake detectado, re-decodificar com `TextDecoder('windows-1252')` (Latin-1)
4. Passar o texto limpo ao `XLSX.read(text, { type: 'string' })` em vez de `{ type: 'array' }`
5. Para arquivos `.xlsx`, manter o fluxo atual (XLSX binário não tem esse problema)

### 2. Edge Function — Logging melhorado (`b2b-create-user`)

Adicionar log do nome recebido quando a validação falha, para facilitar diagnóstico futuro:
```
[Validation] Failed for email X: nome="JÃºlia..." -> regex failed
```

### 3. Frontend — Melhor relatório de erro de validação

Quando o edge function retorna 400 com `VALIDATION_ERROR`, capturar o campo `details` da resposta (que contém a mensagem Zod) e exibi-lo no relatório em vez do genérico "Edge Function returned a non-2xx status code".

---

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/components/admin/UsersTab.tsx` | Detecção de encoding CSV (UTF-8 vs Latin-1), leitura como string para CSV |
| `supabase/functions/b2b-create-user/index.ts` | Log do nome quando validação falha |

