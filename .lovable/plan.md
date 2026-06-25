## Objetivo

Quando um simulado ainda não tem TRI processado, a tela não pode parecer quebrada. Indicadores de **participação** (Total de Alunos, % de Acertos, Taxa de Adesão) precisam funcionar em todos os modos (Padrão 6º ano / Geral / Por semestre) e responder aos filtros normalmente. Indicadores **dependentes de TRI** (Proficiência Média, Alunos Proficientes, Nota Prevista, Distância, Abaixo do Esperado, % de proficientes no topo) ficam em branco com a mensagem "Aguardando cálculo do TRI". A barra de contexto mostra um aviso informativo (não erro) explicando o estado.

## Mudanças

### 1. Serviço — `src/services/institutional.ts`
Adicionar `fetchSimuladoTemTri(simuladoId, iesId): Promise<boolean>` chamando a RPC `get_simulado_tem_tri` (já existe no banco). Em caso de erro, retornar `false` por segurança e logar warning.

### 2. Hook — `src/hooks/useInstitutionalPerformanceData.ts`
- Chamar `fetchSimuladoTemTri` em paralelo com as RPCs críticas.
- Passar a flag `hasTri` para o mapper.
- Quando `hasTri === false`:
  - Não fazer fallback "6º ano → geral" baseado em `triSnapshot.num_students` (esse fallback hoje dispara porque sem TRI o snapshot vem zerado). A base ativa continua sendo a escolhida pelo usuário (6º ano = 11+12 mesmo sem TRI), pois Total/Acertos/Adesão saem de `bySemester` + `get_ies_student_count`.
  - O `sixthYearFallback` flag só pode ficar `true` quando `hasTri === true` E a base 6º ano tiver `num_students === 0` no TRI.

### 3. Mapper — `src/utils/mapInstitutionalData.ts`
Aceitar novo parâmetro `hasTri: boolean`. Comportamento:
- **Sempre calcular** (independente de TRI), somando `bySemester` apenas dos semestres da base ativa (ou usando `overallStats` no modo Geral):
  - Total de Alunos = soma de `num_students` dos semestres da base (fallback: contagem de alunos do `studentScores.students` filtrados pela base; no Geral usa `overallStats.totalStudents`).
  - % de Acertos = `baseAcertos / baseTotal` (lógica atual já está correta, manter).
  - Taxa de Adesão = Total de Alunos do recorte ÷ `totalIesUsers` (do `get_ies_student_count` com `p_semestres` da base; `null` no Geral).
- **Quando `hasTri === false`**, os seguintes KPIs ficam com `value: '—'` e `description: 'Aguardando cálculo do TRI'`, `status: 'neutral'`:
  - Proficiência Média (TRI)
  - Alunos Proficientes
  - Nota Prevista da IES
  - Distância Próxima Faixa
  - Alunos Abaixo do Esperado
- `headerSummary.basePctProficientes` e `headerSummary.percentProficientes` ficam `null` quando `hasTri === false` (UI já trata `null`/`undefined`).
- `headerSummary.sancao` fica `null` quando `hasTri === false` (banner não aparece).
- `headerSummary.conceitoScoped` / `notaScoped` ficam `null`.
- Nova flag `headerSummary.triPending: boolean` para o UI exibir a mensagem informativa.

Crucial: o Total de Alunos do recorte deve sair de `bySemester` (e não do TRI) sempre que `hasTri === false`, garantindo que o "Por semestre" com seleções válidas não caia em "Sem resultados".

### 4. UI — barra de contexto em `VisaoInstitucionalModule.tsx`
- Quando `triPending === true`:
  - Substituir o trecho "Conceito previsto: …" por um aviso informativo (cinza/âmbar suave, não vermelho): "Os resultados de proficiência (TRI) deste simulado ainda estão em processamento. Os indicadores de participação — total de alunos, percentual de acertos e adesão — já estão disponíveis e respondem aos filtros; os de proficiência serão preenchidos após o processamento."
  - **Não mostrar** o aviso "Sem alunos do 6º ano — exibindo base geral" (essa mensagem só vale quando o simulado tem TRI mas não há 11º/12º). Hoje ela só renderiza se `fallback`, e com a mudança no hook `fallback` só fica `true` quando `hasTri === true`, então isso já se resolve sozinho.
- Manter "Analisando N alunos · Base: …" funcionando — `N` virá do Total de Alunos calculado por participação.

### 5. Empty state em `VisaoInstitucionalModule.tsx`
A guarda `data.headerSummary.totalAlunos === 0` continua válida, mas agora `totalAlunos` virá da participação real — então o "Sem resultados" só aparece quando de fato não há alunos no recorte (independe de TRI).

### 6. Banner de Sanção
Já condicional a `sancao` truthy. Como sancao será `null` quando `hasTri === false`, o banner some automaticamente — comportamento desejado.

## Não-objetivos

- Não alterar nenhuma RPC do banco.
- Não mexer em outras abas (Diagnóstico Curricular etc.) — escopo limitado à Visão Institucional.
- Não tocar nos mocks/demo.
