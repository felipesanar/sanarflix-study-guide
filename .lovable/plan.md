## Objetivo
Liberar a aba **Simulados** para gestores (`gestor` e `gestor_grupo`), permitindo que vejam e façam **todos** os simulados já aplicados à(s) sua(s) IES — inclusive os encerrados ou fora da janela de liberação. O fluxo de execução, salvamento de respostas e correção continua o mesmo de um aluno (eles respondem como eles mesmos).

## Mudanças

### 1. Permissão de menu — `src/utils/accessRules.ts`
No bloco `if (isGestor(user))`, adicionar `simulados: true` mantendo `desempenhoInstitucional: true`. Resultado: o item "Simulados" passa a aparecer na sidebar e a rota `/simulados` deixa de bloquear.

### 2. RLS — nova migration
Adicionar políticas de leitura para `gestor` e `gestor_grupo`:

- **`simulados_admin`**: nova policy `SELECT` permitindo gestores verem qualquer simulado cujo `ies_ids` contenha uma IES acessível ao usuário (`get_accessible_ies(auth.uid())`), **sem** filtrar por `status` nem por `data_liberacao`/`data_encerramento`. `gestor_grupo` já tem; criar a equivalente para `gestor` usando a mesma forma.
- **`questoes_simulado`**: nova policy `SELECT` espelhando a anterior — gestor pode ler questões de qualquer simulado pertencente à(s) sua(s) IES.

Inserts em `simulados_iniciados`, `answer_progress` e `simulados_finalizados` já são permitidos para qualquer usuário autenticado pela própria coluna `user_id = auth.uid()`, então o gestor consegue registrar tentativas como ele mesmo sem mudanças adicionais.

### 3. Listagem — `src/services/simuladosApi.ts` (`listarSimulados`)
Hoje o método filtra `neq('status','encerrado')` e descarta simulados fora da janela `data_liberacao`/`data_encerramento`. Para gestores precisamos mostrar tudo da IES.

- Aceitar um parâmetro adicional `opts?: { includeAll?: boolean }`.
- Quando `includeAll` for verdadeiro: remover o `neq('status','encerrado')` e pular o filtro de datas (manter apenas o filtro por `userIesId`).
- Marcar status apresentado: simulados encerrados ou fora da janela aparecem com rótulo "Encerrado" no card (reaproveitar o badge existente do componente, sem novo componente).

### 4. Chamada da listagem — `src/pages/Simulados.tsx`
Detectar gestor via `useAuth` + `isGestor(user)` e passar `includeAll: true` para `listarSimulados`. Para `gestor_grupo` com múltiplas IES, iterar sobre `accessibleIes` (mesma lógica já usada em Desempenho Institucional) ou simplesmente não passar `userIesId` — a RLS já restringe ao conjunto correto.

### 5. Botão "Começar simulado"
Nenhuma mudança: a tela de execução já usa `buscarQuestoesSimulado` (lê `questoes_simulado` via RLS) e `enviarResultado` (edge function `corrigir-simulado` que grava como o próprio usuário). Com as novas policies, gestores conseguem abrir e finalizar.

## Fora do escopo
- Não alterar Desempenho Institucional.
- Não alterar correção, ranking, ou métricas — gestor que fizer o simulado fica fora das agregações institucionais porque elas já excluem usuários com role (visto na função `get_institutional_performance`: `NOT EXISTS (SELECT 1 FROM user_roles ...)`).
- Não tocar em `gestor_grupo` além de garantir paridade (ele já tinha a policy de leitura de simulados; ganha `simulados:true` no menu como subproduto da mudança em `isGestor`).

## Validação
1. Logar como `proensino@fai.com.br`: aba "Simulados" aparece, lista contém os 5 simulados aplicados à FAI (inclusive os encerrados), consegue abrir um, responder e finalizar.
2. Logar como aluno comum da FAI: lista permanece igual à de hoje (só ativos dentro da janela).
3. Desempenho Institucional do gestor segue exibindo apenas alunos (gestor que fez o simulado não polui os agregados).
