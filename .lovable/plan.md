

## Correção do Parser CSV do Importador de Guia de Estudos

### Problemas Identificados

A partir dos screenshots e análise do código, o parser CSV tem múltiplas fragilidades que causam os sintomas observados:

**Sintoma 1**: 190 linhas com "matéria vazia" → A coluna `materia` não está sendo mapeada corretamente
**Sintoma 2**: 171 "semestres novos" contendo URLs → Dados de URL estão caindo na coluna `semestre`
**Sintoma 3**: Valores de "semestre" começam com `,` (vírgula) → Indica desalinhamento de colunas

### Causa Raiz Provável

O desalinhamento de colunas acontece quando:
1. O `detectDelimiter` escolhe o delimitador errado (só testa `,` e `;`, ignora TAB)
2. OU o CSV tem encoding/BOM que corrompe a primeira linha
3. OU o CSV tem mais campos de dados que cabeçalhos (URLs com vírgulas sem aspas)

Independente da causa específica, o parser não tem **nenhuma defesa** contra esses cenários — nenhum log de headers detectados, nenhuma validação pós-parse, nenhuma detecção de dados anômalos em campos obrigatórios.

### Plano de Correção

Todas as mudanças são no arquivo `src/components/admin/study-guide-import/utils/parseFile.ts`.

#### 1. Remover BOM e normalizar texto antes de parsear

Adicionar `text = text.replace(/^\uFEFF/, '')` no início do parse CSV para remover UTF-8 BOM que pode corromper a primeira coluna.

#### 2. Melhorar detecção de delimitador

Expandir `detectDelimiter` para:
- Suportar TAB como delimitador
- Analisar MÚLTIPLAS linhas (header + primeiras linhas de dados), não só a primeira
- Usar votação por maioria: o delimitador que produz o mesmo número de campos consistentemente vence

```text
Linha 1 (header): semestre;materia;tema → 2 semicolons → 3 campos
Linha 2 (dados):  10;Anatomia;Tema1   → 2 semicolons → 3 campos
→ Semicolon consistente = delimitador correto
```

#### 3. Adicionar matching flexível de colunas (aliases)

Após normalizar os headers, usar um sistema de aliases para mapear nomes de coluna:
- `semestre` ← `semestre`, `semester`, `periodo`, `período`, `sem`
- `materia` ← `materia`, `matéria`, `disciplina`, `discipline`, `subject`
- `tema` ← `tema`, `theme`, `topic`, `modulo`, `módulo`
- `link_aula` ← `link_aula`, `linkaula`, `link_video`, `video`, `url_aula`
- etc.

Se os headers parseados não contêm nenhum dos aliases esperados, mostrar erro claro com os headers detectados.

#### 4. Validar headers após o parse

Depois de parsear o CSV, verificar se as colunas obrigatórias (`semestre`, `materia`) foram encontradas:
- Se não: lançar erro descritivo listando os headers detectados: "Colunas detectadas: [x, y, z]. Colunas obrigatórias não encontradas: materia"
- Isso dá ao admin visibilidade imediata sobre o problema

#### 5. Validar conteúdo do campo semestre

Em `validateAndNormalize`, adicionar detecção de URL no campo semestre:
- Se `semestreStr` contém `http://` ou `https://` → erro com código `URL_IN_SEMESTRE` e mensagem clara: "O campo semestre contém uma URL. Verifique se as colunas do arquivo estão corretas."
- Isso impede que dados malformados sejam aceitos silenciosamente

#### 6. Adicionar logs diagnósticos

Após parse do CSV, logar:
- Delimitador detectado
- Headers encontrados (antes e depois da normalização)
- Número de campos no header vs número de campos na primeira linha de dados
- Alertar se houver mismatch de contagem de campos

### Resumo de Mudanças

| Arquivo | Mudança |
|---------|---------|
| `parseFile.ts` | BOM removal, delimiter detection multi-linha com TAB, aliases de colunas, validação de headers pós-parse, detecção de URL em semestre, logs diagnósticos |

### Resultado Esperado

- CSVs com qualquer delimitador (vírgula, ponto-e-vírgula, tab) são parseados corretamente
- Se colunas obrigatórias não são encontradas, o admin recebe erro claro com os headers detectados
- URLs no campo semestre são rejeitadas com mensagem explicativa
- Logs no console permitem diagnóstico rápido de problemas de formato

