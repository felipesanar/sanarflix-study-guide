## Problema

No painel `/gestor/visao-institucional`, o dropdown de "Por semestre" só mostra os semestres presentes em `data.allStudents`. Quando o modo base é "Padrão (6º ano)", a RPC `get_institutional_tri` devolve apenas alunos dos semestres 11 e 12 — então, ao alternar direto de "Padrão (6º ano)" para "Por semestre", o dropdown só oferece 11 e 12. Se o usuário passar antes por "Geral", o fetch traz todos os alunos e o cache local (`lastSemestresOptions`) preserva a lista completa, escondendo o bug.

Ou seja: a lista de semestres disponíveis está acoplada ao recorte da RPC ativa, quando deveria refletir todos os semestres que aplicaram o simulado na IES.

## Correção proposta

Desacoplar a fonte da lista de semestres do fetch principal:

1. Em `useInstitutionalPerformanceData`, adicionar um novo estado `availableSemestres: number[]` e um efeito que, sempre que `filters.simuladoId` + IES alvo estiverem definidos, chame `fetchStudentScores(simuladoId, iesId)` (RPC `get_institutional_student_scores`, que já retorna todos os alunos independente de baseMode) e extraia os semestres distintos ordenados. Guardar em cache por chave `simuladoId+iesId` para evitar refetch a cada troca de modo.
   - Fallback: se essa chamada falhar ou vier vazia, manter comportamento atual (derivar de `data.allStudents`).
2. Expor `availableSemestres` no retorno do hook.
3. Em `src/pages/DesempenhoInstitucionalV2.tsx`:
   - Consumir `availableSemestres` do hook em vez de derivar de `data`/`lastSemestresOptions`.
   - Manter `FALLBACK_SEMESTRES` (1–12) apenas para o caso de a nova fonte ainda não ter respondido, para não regressar o estado atual.
   - Remover `extractSemestresFromData` e o `useState/useEffect` de `lastSemestresOptions` (deixaram de ser necessários).

Nenhuma mudança em RPC/DB nem no `applyDesempenhoV2Filters` — o filtro em si continua funcionando; muda só a fonte da lista de opções.

## Detalhes técnicos

- `fetchStudentScores` já existe e é usada em outros lugares do hook — reutilizamos sem custo extra de RPC nova.
- O efeito novo depende de: `filters.simuladoId`, `targetIesId` resolvido (mesma lógica de precedência já usada no fetch de simulados). Para evitar duplicar essa resolução, armazenamos o `targetIesId` já calculado (ou reusamos o requestedIesId) em um `useMemo`/estado auxiliar.
- Cache simples via `useRef<Map<string, number[]>>` chaveado por `${simuladoId}:${iesId}` para não repetir a chamada ao alternar entre abas/base modes.
- Ordenação numérica ascendente; conversão para o shape `{ id: string; label: '${n}º Semestre' }` no page (mesma forma atual).

## Arquivos afetados

- `src/hooks/useInstitutionalPerformanceData.ts` — novo estado + efeito + retorno.
- `src/pages/DesempenhoInstitucionalV2.tsx` — passar a consumir `availableSemestres` do hook; remover derivação local.

## Validação

- Recarregar página no modo "Padrão (6º ano)" e ir direto para "Por semestre": dropdown deve listar todos os semestres com alunos no simulado.
- Fluxo antigo Padrão → Geral → Por semestre: mesma lista, sem regressão.
- Trocar de simulado ou IES: lista se atualiza para o novo escopo.
