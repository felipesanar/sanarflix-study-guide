

## Diagnostico: 3 Bugs no Guia de Estudos (Claretiano)

### Bug 1: Dropdown de semestres so mostra ate o 3o
**Causa raiz**: A coluna `users.semestre` e INTEGER, mas `conteudos.semestre` e TEXT. Claretiano tem 9 semestres no banco (1-8 + INTERNATO) e 3853 registros. O endpoint `listSemestresOnly` retorna todos, mas o Select do Radix pode estar cortando visualmente. Alem disso, se o usuario de teste esta numa IES diferente de Claretiano, so vera os semestres dessa IES.

**Correcao**: Adicionar `max-h-[300px] overflow-y-auto` ao `SelectContent` no `GuideToolbar` para garantir scroll. Tambem adicionar logs no console para debug.

---

### Bug 2: Sheet lateral vazia ao clicar em "O Que Estudar Hoje"
**Causa raiz**: `selectedMateriaContents` busca em `groupedData`, que so contem conteudos do semestre selecionado. Se a materia do calendario nao existir naquele semestre especifico, o `find()` retorna `undefined` e a sheet fica vazia.

**Correcao**: Buscar a materia em TODOS os `conteudos` carregados (nao apenas os filtrados por semestre). Se encontrar em outro semestre, trocar automaticamente para ele.

---

### Bug 3: Tela piscando para usuarios do INTERNATO
**Causa raiz**: Usuarios do INTERNATO no Claretiano tem `semestre = 9` (ou 0, 12) na tabela `users` (INTEGER). Porem, na tabela `conteudos`, o semestre e `"INTERNATO"` (TEXT). Quando o frontend faz `user.semestre.toString()` = `"9"`, a Edge Function busca conteudos com `semestre IN ('9', '9o Semestre')` -- nenhum resultado. A pagina recebe dados vazios, entra em estado vazio, re-renderiza, tenta novamente, e fica em loop de flicker.

Alem disso, `loadAllProgress(parseInt("INTERNATO"))` resulta em `NaN`, causando queries invalidas na tabela `study_progress`.

**Correcao**:
1. Na Edge Function `get-study-contents`: adicionar mapeamento `semestre >= 9 OR semestre = 0` -> buscar tambem "INTERNATO"
2. No frontend `StudyGuide.tsx`: tratar `selectedSemestre = "INTERNATO"` sem `parseInt` para progresso
3. No frontend: se o semestre do usuario nao retorna resultados, verificar se existe "INTERNATO" disponivel e usar como fallback

---

### Arquivos afetados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/get-study-contents/index.ts` | Mapeamento semestre numerico alto -> INTERNATO |
| `src/pages/StudyGuide.tsx` | Fix sheet lateral, fix progresso para INTERNATO, fallback de semestre |
| `src/components/guia-estudos/GuideToolbar.tsx` | Garantir scroll no SelectContent |

### Detalhes tecnicos

**Edge Function -- mapeamento INTERNATO:**
```text
se semestreFilter e numerico E >= 9 (ou == 0):
  adicionar "INTERNATO" aos possibleValues
```

**Frontend -- sheet lateral:**
```text
selectedMateriaContents:
  1. buscar em groupedData (semestre atual)
  2. se nao encontrar, buscar em TODOS os conteudos carregados
  3. se encontrar em outro semestre, trocar selectedSemestre
```

**Frontend -- progresso INTERNATO:**
```text
loadAllProgress:
  se selectedSemestre nao e numerico (ex: "INTERNATO"):
    usar 0 como semestre para query de progresso
    OU usar string matching no content_id
```

