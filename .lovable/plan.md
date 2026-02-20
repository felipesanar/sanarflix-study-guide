
# Dois Problemas Independentes: Navegação Multi-Semestre + Nova Opção de Duplicatas

## Problema 1: Aluno não consegue mais navegar entre semestres

### Causa Raiz

A otimização de performance recente introduziu um efeito colateral crítico. A Edge Function `get-study-contents` agora recebe o parâmetro `semestre: user.semestre` no corpo da requisição, fazendo com que **apenas os registros do semestre atual do aluno** sejam retornados (~200–400 linhas ao invés de ~3.800).

Isso quebrou a navegação multi-semestre porque:
- O array `conteudos` passa a conter dados de **somente 1 semestre**
- O `useMemo` que computa os semestres disponíveis (`semestres`) só encontra esse 1 semestre no array
- O dropdown mostra apenas 1 opção — o semestre do aluno
- Trocar de semestre não tem efeito pois não há dados dos outros no estado local

### Solução: Estratégia Híbrida com Cache por Semestre

A solução deve manter o carregamento rápido do semestre inicial E permitir navegação entre semestres, sem precisar buscar todos os ~3.800 registros de uma vez.

**Fluxo novo:**

```text
1ª carga (semestre do aluno):
  → Edge Function com filtro de semestre (rápido, ~300 linhas)
  → Exibe conteúdo imediatamente
  → Salva em cache: "ies_X_sem_5"

Aluno troca para outro semestre (ex: Semestre 3):
  → Verifica cache "ies_X_sem_3": não encontrado
  → Chama Edge Function com { semestre: "3" }
  → Mostra skeleton de troca de semestre (não o skeleton de página inteira)
  → Mescla os dados no estado (conteudos contém todos os semestres já visitados)
  → Salva em cache "ies_X_sem_3"
```

**Para o dropdown de semestres exibir todas as opções disponíveis**, uma segunda chamada leve precisa buscar apenas a lista distinta de semestres (não os conteúdos). Existem duas abordagens:

**Opção A (preferida — mais simples):** Chamar a Edge Function **sem filtro de semestre** mas solicitando apenas os campos `semestre` distintos — ou chamar com o modo de paginação completo apenas para montar a lista. Na prática, a melhor abordagem é chamar a Edge Function uma vez sem filtro para buscar todos os dados (como era antes), mas **em background com baixa prioridade**, usando o cache por semestre para a exibição rápida inicial.

**Opção B:** Adicionar um novo endpoint/parâmetro à Edge Function que retorna apenas a lista de semestres distintos (query leve: `SELECT DISTINCT semestre FROM conteudos WHERE id_ies = X`).

**Opção escolhida: B** — É a mais eficiente. Um único select com `DISTINCT` no banco retorna apenas uma lista de strings (ex: `["1", "2", "3", "INTERNATO"]`) em milissegundos.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/get-study-contents/index.ts` | Adicionar suporte ao parâmetro `listSemestresOnly=true` que retorna `SELECT DISTINCT semestre` |
| `src/pages/StudyGuide.tsx` | (1) Buscar lista de semestres separadamente no mount; (2) Ao trocar semestre, buscar/cachear dados daquele semestre; (3) Mesclar dados no estado `conteudos` |

---

## Problema 2: Nova opção "Manter todas" para duplicatas

### Causa Raiz

A lógica de duplicatas usa a `DuplicateStrategy` que hoje só tem: `keep_first`, `keep_last`, `remove_all`. A opção `keep_all` (não filtrar nada, importar todas as linhas inclusive duplicatas) não existe.

O cenário descrito é válido: uma disciplina como "Anatomia" pode aparecer em múltiplos semestres na planilha com aulas **diferentes** — são duplicatas pelo critério de chave composta `(IES, Semestre, Matéria, Tema, Subtema, Aula)` apenas se todos os campos forem idênticos. Porém, se o admin quer importar o mesmo conteúdo em semestres diferentes, as entradas diferem no campo `semestre`, então **não seriam detectadas como duplicatas** pelo critério atual.

**O caso real que justifica a opção:** O admin quer incluir uma disciplina (com as mesmas aulas) em mais de um semestre, e a planilha tem linhas com `semestre` diferente para a mesma disciplina — isso **não é duplicata** pelo critério atual. A detecção atual de duplicatas considera a chave `(id_ies, semestre, materia, tema, subtema, aula)` — portanto duas linhas idênticas precisam ter o **mesmo semestre** para ser duplicata.

A opção `keep_all` simplesmente **ignora o filtro de duplicatas** e envia todas as linhas validadas, inclusive aquelas marcadas como `DUPLICATE_ROW`. Isso dá controle total ao admin.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/components/admin/study-guide-import/types.ts` | Adicionar `'keep_all'` ao tipo `DuplicateStrategy` |
| `src/components/admin/study-guide-import/components/ValidationSummary.tsx` | Adicionar 4ª opção de rádio "Manter todas" |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Adicionar `case 'keep_all'` no `runImport` (nenhuma filtragem aplicada) |

---

## Resumo de Impacto

### Problema 1 — Navegação multi-semestre

```text
Estado atual (quebrado):
  Carrega → conteudos = [dados do sem. 5 apenas]
  Dropdown mostra: ["5"]
  Trocar semestre: impossível

Estado novo (corrigido):
  Carrega → conteudos = [dados do sem. 5 + lista de sems]
  Dropdown mostra: ["1", "2", "3", "4", "5", "INTERNATO"]
  Troca para sem. 3 → busca/cache sem. 3 → mescla → exibe
```

### Problema 2 — Nova opção de duplicatas

```text
Antes: keep_first | keep_last | remove_all
Depois: keep_first | keep_last | remove_all | keep_all (nova)
```

A opção `keep_all` envia todas as linhas para o banco sem filtrar duplicatas, deixando o banco decidir o comportamento (útil quando o admin quer forçar a importação independentemente de duplicatas na planilha).
