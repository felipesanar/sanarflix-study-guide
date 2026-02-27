

## Reformular Validacao de Semestres no Import de Guia de Estudos

### Problema Atual
A validacao de semestre no importador aceita apenas numeros de 1 a 12 e o texto "INTERNATO". Qualquer outro valor textual (como "TUTORIA", "INTEGRAL", etc.) e rejeitado como erro. Isso impede a importacao de conteudos com semestres customizados que ja existem ou que a IES deseja criar.

### Nova Logica

O sistema passara a funcionar em 3 etapas:

1. **Buscar semestres existentes** -- Ao rodar a validacao, o sistema consulta os semestres ja cadastrados no banco para cada IES mapeada (via RPC `get_distinct_semestres`)
2. **Comparar com normalizacao** -- Os semestres do arquivo sao normalizados (trim, uppercase, sem acentos, sem espacos extras) para comparacao com os existentes. Ex: "internato" == "INTERNATO", "tutoria " == "TUTORIA"
3. **Identificar semestres novos** -- Semestres que nao existem no banco sao listados como "novos" e apresentados ao usuario na tela de validacao para confirmacao antes de prosseguir

### Mudancas por Arquivo

**`src/components/admin/study-guide-import/utils/parseFile.ts`**
- Alterar `validateAndNormalize` para receber um parametro opcional `existingSemestres: string[]`
- Remover a validacao rigida de 1-12 + INTERNATO
- Nova logica: se o semestre e numerico valido (>= 1) OU e um texto nao-vazio, ele e aceito
- Normalizar semestres textuais: `trim().toUpperCase()` para armazenamento, mas comparar via normalizacao completa (sem acentos, sem espacos)
- Se `existingSemestres` e fornecido, classificar cada semestre como "existente" ou "novo"
- Retornar lista de semestres novos encontrados no `ValidationResult`

**`src/components/admin/study-guide-import/types.ts`**
- Adicionar campo `newSemestres?: string[]` ao `ValidationResult`
- Adicionar tipo `SemestreStatus` com info de semestre novo vs existente

**`src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**
- No `runValidation`, antes de validar, buscar semestres existentes para cada IES mapeada usando `supabase.rpc('get_distinct_semestres', { p_ies_id })`
- Passar esses semestres existentes para `validateAndNormalize`
- Se houver semestres novos, exibir na tela de validacao e exigir confirmacao do usuario
- Adicionar estado `approvedNewSemestres` para controlar a aprovacao

**`src/components/admin/study-guide-import/components/ValidationSummary.tsx`**
- Adicionar secao de "Semestres Novos Detectados" com checkboxes para o usuario aprovar cada um
- Mostrar para qual IES cada semestre novo sera criado
- Bloquear o botao "Importar" ate que todos os semestres novos sejam aprovados ou removidos

**`src/components/admin/study-guide-import/utils/errorMetadata.ts`**
- Remover/atualizar a entrada `INVALID_SEMESTRE` -- agora so sera erro se o campo estiver completamente vazio
- Adicionar novo codigo `NEW_SEMESTRE` do tipo "info" para semestres nao existentes no banco

### Fluxo do Usuario

```text
1. Upload do arquivo (CSV/XLSX)
2. Mapear abas para IES
3. Clicar "Validar"
   -> Sistema busca semestres existentes de cada IES no banco
   -> Compara semestres do arquivo (normalizados) com existentes
   -> Se encontrar "TUTORIA" e ela nao existe: marca como "novo"
   -> Se encontrar "internato" e "INTERNATO" existe: reconhece como existente
4. Tela de validacao mostra:
   - Erros reais (campo vazio, materia faltando, etc.)
   - Secao "Semestres Novos": lista com checkbox para cada um
   - Usuario marca quais deseja criar
5. Importar -- semestres novos sao incluidos normalmente na tabela conteudos
```

### Normalizacao para Comparacao

```text
Funcao: normalizeSemestreForCompare(value)
  1. trim()
  2. toUpperCase()
  3. remove acentos (NFD + strip diacritics)
  4. remove espacos duplicados
  
Exemplos:
  "internato"     -> "INTERNATO"  (match com existente)
  "TUTORIA"       -> "TUTORIA"    (novo, pedir confirmacao)
  " Internato  "  -> "INTERNATO"  (match com existente)
  "3"             -> "3"          (numerico, aceito direto)
  "3º Semestre"   -> "3 SEMESTRE" (aceito, armazenado como "3")
```

### Armazenamento

- Semestres numericos: armazenados como string do numero (ex: "3", "10")
- Semestres textuais: armazenados em UPPERCASE sem espacos extras (ex: "INTERNATO", "TUTORIA")
- Isso garante consistencia na tabela `conteudos`

