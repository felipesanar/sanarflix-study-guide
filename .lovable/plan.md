## Diagnóstico

A aluna `008f9aaa-…` (UEA, `semestre=11`) está marcando aulas do Intensivão ENAMED normalmente — verifiquei na tabela `public.study_progress`: existem dezenas de registros com `completed=true`, `semestre=11` e `content_id="Intensivo ENAMED-Semana 0X-…-<aula>"`. Ou seja, o **StudyGuide grava direito**; o problema está em quem lê.

O Intensivão ENAMED foi carregado em `public.conteudos` com **`semestre = 'Intensivo ENAMED'`** (texto), enquanto o restante do currículo usa semestre numérico (`'11'`, `'12'`, …).

A edge function `get-progress-hub` (chamada pela "aba de progresso") aplica dois filtros que descartam o Intensivão:

1. **Denominador (universo de aulas):**
   ```ts
   conteudosQuery.eq('semestre', String(userSemestre)) // "11"
   ```
   → só carrega aulas do 11º semestre. Aulas do Intensivão ENAMED nunca entram no total.

2. **Numerador (aulas concluídas):**  
   `isProgressFromSemester(content_id)` só aceita um `content_id` composto se:
   - o primeiro token antes do `-` parseia para um inteiro 1–12 igual ao `effectiveSemestre`, **ou**
   - o `content_id` bate com `getCompositeId(content, effectiveSemestre)`, que sempre prefixa com `"11-"`.
   
   Como os registros do Intensivão têm prefixo `"Intensivo ENAMED-"`, todos são rejeitados. O mesmo prefixo `"INTERNATO-"` já tem um caminho explícito no código — falta o mesmo tratamento para `"Intensivo ENAMED-"`.

O caminho de impersonação em `admin-user-support` (case `"progress_hub"`) tem o mesmo bug: filtra `conteudos` por `String(userSemestre)` e só lê `user_progress` por UUID, ignorando `study_progress` e o Intensivão.

Colegas da mesma IES relatam o mesmo porque a UEA inteira usa esse cronograma paralelo.

## Correção

**Só backend.** Nada de front-end, nada de migração de dados, nada de RPC.

### 1) `supabase/functions/get-progress-hub/index.ts`

- **Universo de aulas:** além do fetch atual (`semestre = String(userSemestre)`), fazer um segundo fetch com `semestre = 'Intensivo ENAMED'` na mesma IES e concatenar. Manter o fallback INTERNATO como está. Se o combinado ficar vazio, manter o retorno de "empty state".
- **`getCompositeId`:** passar a usar `content.semestre` da própria linha em vez de um `effectiveSemestre` global, para que aulas do Intensivão gerem o prefixo `"Intensivo ENAMED-"` e as do 11º gerem `"11-"`. Aplicar em `isContentCompleted`, `getCompletedAt` e no laço do Method 3 de `isProgressFromSemester`.
- **`extractSemestreFromContentId`:** reconhecer o prefixo `"Intensivo ENAMED-"` (retornar `'Intensivo ENAMED'`), análogo ao `"INTERNATO-"`.
- **`isProgressFromSemester`:** aceitar como válido qualquer `content_id` cujo semestre extraído seja `'Intensivo ENAMED'` **e** cuja composição bata com alguma aula do conjunto Intensivão carregado no passo 1.
- **Filtro por `p.semestre` em `study_progress`:** hoje descarta linhas onde `p.semestre !== numericSemestre`. O front-end sempre grava `semestre = user.semestre` (11 nesta aluna), então essa checagem já não elimina Intensivão — mas confirmar que o `continue` só dispara quando o `content_id` também não é reconhecido como Intensivão.

### 2) `supabase/functions/admin-user-support/index.ts` — case `"progress_hub"`

Espelhar as mesmas mudanças usadas em `get-progress-hub`:
- adicionar segundo fetch de `conteudos` com `semestre = 'Intensivo ENAMED'`;
- ler também `study_progress` (`completed=true`) além do `user_progress`, resolvendo UUID *e* content_id composto (com prefixo por linha).

Assim a visão impersonada de suporte/atendimento passa a mostrar o mesmo número que a aluna vê.

### 3) Deploy + verificação

- Deploy de `get-progress-hub` e `admin-user-support`.
- Invalidar o cache local: os hooks (`useProgressHub`, `useHomeData`) já usam TTL curto e refazem fetch em background, então basta a aluna abrir a página novamente (ou dar refresh). Sem migration, sem toque em dados.
- Verificar via `curl_edge_functions` chamando `get-progress-hub` como a aluna: `overview.total` deve saltar dos ~conteúdos do 11º ano para incluir as ~500 aulas do Intensivão, e `overview.completed` deve refletir os registros de `study_progress` já persistidos.

## Fora de escopo

- Não mexer em `useStudyProgress`, `StudyAulaItem`, `StudyGuide.tsx` — gravação está correta.
- Não normalizar `conteudos.semestre` para inteiro (quebraria a página do StudyGuide, que hoje exibe "Intensivo ENAMED" como filtro).
- Não alterar `get_progress_hub_summary` RPC (não é o caminho usado pela Central de Progresso hoje — o hook chama a edge function).
