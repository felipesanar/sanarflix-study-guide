# Diagnóstico — Guia de Estudos INTEGRADO não aparece

## Causa raiz (confirmada no banco)

A tela "Seu guia" chama a edge function `get-study-contents`, que filtra `conteudos.semestre` por uma lista fixa de variantes:

```
[ "2", "2º Semestre", "2º semestre" ]
```

Mas a importação recente do INTEGRADO gravou os valores em **CAIXA ALTA**:

| semestre (gravado) | nº de linhas |
|---|---|
| `2º SEMESTRE` | 103 |
| `3º SEMESTRE` | 90 |
| `4º SEMESTRE` | 113 |

Como `2º SEMESTRE ≠ 2º Semestre` no `.in(...)`, o backend retorna 0 linhas → UI mostra "Nenhum conteúdo disponível".

A coluna `semestre` em `conteudos` é texto livre; o pipeline de import preservou a capitalização do arquivo, e a edge function não normaliza na leitura.

## Plano de correção (2 camadas)

### 1. Dados — migração aditiva (UPDATE, sem DELETE/TRUNCATE)

Canonizar o formato armazenado em `conteudos.semestre` para o padrão usado em todo o resto do sistema (`Nº Semestre` ou número puro). Manter a regra mínima:

- `UPDATE conteudos SET semestre = initcap(semestre)` apenas onde `semestre ~* '^\d+º\s+SEMESTRE$'`, resultando em `"2º Semestre"`, `"3º Semestre"`, `"4º Semestre"`.
- Aplicar `trim()` no mesmo UPDATE para remover espaços extras.

Verificar pós-migração:
```sql
SELECT DISTINCT semestre FROM conteudos
WHERE id_ies = '72b19e77-c569-4bf7-a433-44563df1015f';
```
Esperado: `"2º Semestre"`, `"3º Semestre"`, `"4º Semestre"`.

### 2. Backend — defesa em profundidade na edge function

Em `supabase/functions/get-study-contents/index.ts` (bloco `possibleValues`), trocar o `.in('semestre', uniqueValues)` por matching **case-insensitive**:

```ts
// Antes:
.in('semestre', uniqueValues)

// Depois (encadeando ilike via .or):
.or(uniqueValues.map(v => `semestre.ilike.${v}`).join(','))
```

Isso garante que qualquer variante futura (`"4º SEMESTRE"`, `"4º semestre"`, `"4º Semestre"`) seja capturada sem quebrar o `listSemestresOnly` (esse usa RPC `get_distinct_semestres` e segue idêntico).

Re-deploy automático da função pela Lovable.

### 3. (Opcional, não bloqueante) Normalização na importação

Em `supabase/functions/admin-upload-study-guide/index.ts`, normalizar `semestre` ao inserir/atualizar:
- `trim()` + se casar com `^(\d+)º\s+SEMESTRE$` (qualquer case), gravar como `"<N>º Semestre"`.

Isso impede a reincidência. Pode ser feito agora junto, ou postergado.

## Verificação final

1. SQL acima mostra apenas variantes canônicas.
2. Recarregar `/guia-estudos` como usuário INTEGRADO no 2º / 3º / 4º semestre → conteúdos visíveis.
3. Limpar `localStorage` `perf_study_contents_*` caso o cache antigo (vazio) ainda esteja ativo (TTL = 15min) — ou aguardar expirar.

## Notas

- Migração 100% aditiva (somente `UPDATE`), respeitando a regra de preservação de dados.
- Nada altera UI/frontend além da edge function (backend de leitura).
- Outros IES não são afetados (filtro pela regex limita a linhas em CAIXA ALTA).
