

# Plano: Suporte a "INTERNATO" no Semestre do Guia de Estudos

## Contexto

Atualmente, o importador de Guia de Estudos **rejeita** qualquer valor de semestre que nao seja um numero de 1 a 12. Porem, o banco de dados (`conteudos.semestre`, tipo `text`) ja armazena valores como `"INTERNATO"`, e o frontend do Guia de Estudos ja faz tratamento parcial para exibi-lo. O problema esta apenas na **validacao do importador**.

## O que sera feito

### 1. Atualizar a validacao de semestre no importador

**Arquivo:** `src/components/admin/study-guide-import/utils/parseFile.ts` (funcao `validateAndNormalize`, linhas ~408-422)

- Antes de tentar `parseInt`, verificar se o valor e uma variacao de "internato" (case-insensitive: `internato`, `Internato`, `INTERNATO`)
- Se for internato, **padronizar para `"INTERNATO"`** (maiusculo)
- Se for numerico, manter a validacao atual (1-12)
- Se nao for nenhum dos dois, continuar rejeitando como erro

Logica:

```text
semestreRaw (trimmed, uppercase)
  |
  +-- matches /^INTERNATO$/i ? --> semestre = "INTERNATO" (valido)
  +-- parseInt valido 1-12?    --> semestre = "3" (valido)
  +-- outro                    --> INVALID_SEMESTRE (erro)
```

### 2. Atualizar metadados de erro

**Arquivo:** `src/components/admin/study-guide-import/utils/errorMetadata.ts`

- Atualizar a `description` e o `tip` do erro `INVALID_SEMESTRE` para refletir que "INTERNATO" agora e aceito
- Remover a sugestao de "substituir INTERNATO por numero"

### 3. Atualizar mensagem de erro

**Arquivo:** `src/components/admin/study-guide-import/utils/parseFile.ts`

- Ajustar a mensagem de erro para: `Semestre invalido: "X". Deve ser um numero de 1 a 12 ou "INTERNATO".`

---

## Secao Tecnica

### Alteracoes especificas

**`parseFile.ts` - funcao `validateAndNormalize` (~linha 408):**

Substituir:
```typescript
const semestreNum = parseInt(String(semestreRaw), 10);
if (!semestreRaw || isNaN(semestreNum) || semestreNum < 1 || semestreNum > 12) {
  // erro INVALID_SEMESTRE
}
// ...
semestre: String(semestreNum),
```

Por:
```typescript
const semestreStr = String(semestreRaw).trim();
const isInternato = /^internato$/i.test(semestreStr);
const semestreNum = parseInt(semestreStr, 10);
const isValidNumeric = !isNaN(semestreNum) && semestreNum >= 1 && semestreNum <= 12;

if (!semestreRaw || (!isInternato && !isValidNumeric)) {
  // erro INVALID_SEMESTRE com mensagem atualizada
}
// ...
semestre: isInternato ? 'INTERNATO' : String(semestreNum),
```

**`errorMetadata.ts` - entrada `INVALID_SEMESTRE`:**

- `description`: `'O campo semestre deve conter um numero de 1 a 12 ou "INTERNATO".'`
- `tip`: `'Valores aceitos: numeros de 1 a 12 e "INTERNATO" (para semestres 9-12). Outros textos como "N/A" ou "INTEGRAL" nao sao aceitos.'`

### Nenhuma alteracao necessaria em:
- **Edge Function** (`admin-upload-study-guide`): ja recebe `semestre` como string, sem validacao de tipo
- **Tabela `conteudos`**: coluna `semestre` ja e `text`, ja contem `"INTERNATO"`
- **Frontend do Guia** (`StudyGuide.tsx`): ja trata `internato` -> `"INTERNATO"` na exibicao
- **`get-study-contents`**: busca todos os conteudos da IES sem filtro de semestre

