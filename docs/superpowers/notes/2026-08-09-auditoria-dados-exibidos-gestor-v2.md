# Auditoria de dado exibido — Portal do Gestor 2.0

**Data de execução:** 2026-08-09
**Projeto:** gvqv (gvqvrmkizemwsasmupmo) — confirmado via `get_project_url`
**Gatilho:** usuário reportou inconsistências de dado em quase todas as IES na amostragem; pediu verificação de tudo que é exibido, elemento a elemento, IES a IES, com plano de correção.
**Método:** leitura do corpo vigente de cada RPC (`pg_get_functiondef` contra produção) + leitura dos componentes React que consomem cada campo + reconstrução manual via SQL para confirmar ou refutar cada risco com dado real de pelo menos 3 IES. Achados marcados CONFIRMADO têm evidência numérica; TEÓRICO significa risco real no código mas sem ocorrência confirmada na base atual.

Nota de processo: durante esta auditoria também sincronizamos 4 migrations que existiam em produção (aplicadas via Lovable) sem arquivo correspondente no repositório — ver commits/arquivos `20260804185759_*`, `20260807194927_*`, `20260808205250_*`, `20260808205400_*`. Sem isso, a leitura de código estaria desatualizada em relação ao banco real.

---

## Achados CONFIRMADOS (ordenados por impacto)

### 1. Duas fórmulas de "Conceito ENAMED" coexistindo — a tela padrão ("6º ano") não mostra a mesma nota que "Geral"

**Onde:** RPC `get_gestor_visao_geral`, CTE `metricas` (campo `concept`). Consumido por `KpisVisaoGeral.tsx` (card "Conceito ENAMED").

Quando o filtro é "Geral" (`v_geral = true`), o conceito vem de `resultados_ies_tri.concept` — a nota institucional oficial que a Sanar publica. Em qualquer outro recorte, **incluindo "6º ano", que é o filtro padrão ao abrir o portal**, o conceito é recalculado a partir do % de alunos proficientes daquele recorte, pelas faixas `≥90:5, ≥75:4, ≥60:3, ≥40:2, senão 1`. São duas grandezas diferentes por design, nunca reconciliadas.

**Amostragem em 13 IES** (simulado mais recente elegível de cada uma), comparando o conceito oficial ("Geral") contra o derivado que o recorte "6º ano" mostraria:

| IES | Conceito oficial ("Geral") | Conceito "6º ano" (padrão) | Situação |
|---|---|---|---|
| Paracatu | 3 | 4 | diverge |
| USCS - São Caetano | 4 | 5 | diverge |
| Funepe | 1 | 2 | diverge |
| UEA | 2 | 3 | diverge |
| Porto Seguro | 3 | sem dado | card fica vazio no padrão |
| Sorriso | 2 | sem dado | card fica vazio no padrão |
| USCS - Itapetininga | 3 | sem dado | card fica vazio no padrão |
| FAI, Univille, Sete Lagoas, Valença, USCS-Bela Vista, Passos | — | — | batem |

**7 de 13 IES (54%) mostram algo diferente do oficial na tela padrão** — 4 com número diferente (sempre o derivado mais alto que o oficial), 3 com o card vazio apesar de "Geral" ter valor real.

**Correção sugerida:** decisão de produto, não só de código. Duas opções: (a) todo recorte prioriza `resultados_ies_tri.concept` quando existir uma linha para aquele simulado, independente do filtro de semestre — a nota oficial não deveria variar com o filtro; cai no derivado só quando não há linha oficial, com indicador visual de "estimado"; ou (b) manter as duas fórmulas mas deixar explícito na UI que o número no recorte por semestre é uma estimativa, não a nota oficial.

---

### 2. Rótulo "respostas" no Diagnóstico e nos Temas mostra na verdade alunos distintos — subestima o volume real em até 29x

**Onde:** `CascataDiagnostico.tsx:183` (`{no.amostra} respostas`, grande área e especialidade) e `DrawerTemas.tsx:238` (`{tema.amostra} respostas`, nível tema). `amostra` nas RPCs `get_gestor_diagnostico`/`get_gestor_diagnostico_temas` é `count(DISTINCT student_id)` — alunos que responderam pelo menos uma questão daquele nó — nunca `count(*)` de respostas.

Foi esse campo, mal rotulado, que gerou a impressão de "só está puxando 100 respostas de cada área": o número fica perto do tamanho da população da IES (todo aluno tende a responder pelo menos 1 questão de cada grande área ao longo de vários simulados), não porque há um `LIMIT` — não há nenhum `LIMIT`/paginação em toda a cadeia das duas RPCs (confirmado lendo o corpo completo).

**Evidência numérica (respostas reais vs. o que o rótulo mostra):**

| IES | Nível | Nó | Respostas reais | Rótulo exibido ("N respostas") | Subestimativa |
|---|---|---|---|---|---|
| Paracatu | especialidade | Cirurgia Geral | 7.432 | 500 | 15x |
| Passos | grande área | Cirurgia | 11.162 | 379 | 29x |
| Paracatu | tema | Hérnias (em Cirurgia Geral) | 1.172 | 496 | 2,3x |
| Sete Lagoas | especialidade | Cirurgia Plástica | 177 | 177 | sem distorção (coincidência: ~1 questão/aluno no tema) |

Afeta **todas as IES, em toda tela de Diagnóstico e todo drawer de Temas** — é rótulo fixo no componente, não algo específico de uma instituição.

**Correção sugerida:** troca de texto, baixo risco — `CascataDiagnostico.tsx:183` e `DrawerTemas.tsx:238` para algo como "N alunos" ou "N alunos com resposta" (o mesmo padrão que `TagCoberturaParcial` já usa corretamente: "alunos participaram"). Não precisa mudar a RPC.

---

### 3. Cartões de "Visão de Alunos" (grupo de evolução) excluem quem nunca fez simulado com TRI — o card mostra menos alunos do que a IES tem

**Onde:** RPC `get_gestor_visao_geral`, campo `distribuicaoAlunos` (CTE `aluno_grupo`, só existe para quem tem ≥1 linha em `resultados_alunos_tri`). Consumido por `VisaoDeAlunos.tsx` (barra + 3 cartões no topo da Visão Geral). A tabela nominal (`get_gestor_alunos`) usa um denominador diferente: todo aluno matriculado na IES, com `grupo = NULL` para quem nunca fez TRI.

**Evidência numérica (alunos matriculados vs. total que aparece no card):**

| IES | Alunos matriculados | Total no card `distribuicaoAlunos` | Excluídos silenciosamente | % excluído |
|---|---|---|---|---|
| Funepe | 448 | 129 | 319 | **71,2%** |
| Sete Lagoas | 317 | 249 | 68 | 21,5% |
| Passos | 446 | 379 | 67 | 15,0% |
| Paracatu | 530 | 489 | 41 | 7,7% |
| FAI (controle) | 101 | 101 | 0 | 0% |

Para Funepe, o card diz "129 alunos" quando a instituição tem 448 matriculados — quase 3x menos do que a base real. A classificação dentro de cada grupo está correta; o problema é só o denominador do card não contar quem nunca teve resultado de TRI.

**Correção sugerida:** ou `distribuicaoAlunos` ganha um 4º bucket explícito ("sem resultado ainda"), ou a legenda de `VisaoDeAlunos.tsx` troca "N alunos" por "N alunos com resultado" — mesmo padrão que o rodapé de "Alunos proficientes" já usa.

---

### 4. `KpisVisaoGeral.tsx` trata "6º ano" como se fosse a IES inteira — regra desatualizada desde a correção de 07/08

**Onde:** `KpisVisaoGeral.tsx:27-40`, regex `SEMESTRE_UNICO`, usado para decidir `recorteEhIesInteira` (linha 80). O comentário do componente descreve a regra **antiga** ("'6ano' só marca 11º/12º em evidência, não filtra"). Desde a migration de 07/08, o servidor filtra de fato `'6ano'` para `ARRAY[11,12]` — mas o componente nunca foi atualizado, então continua tratando `'6ano'` como IES inteira (mesmo caminho de `'geral'`).

**Evidência real:** Paracatu tem 530 alunos matriculados no total vs. 188 no recorte 11º/12º — o KPI "Simulados realizados" mistura um numerador calculado só sobre 11º/12º com um hint/denominador de contrato pensado para a IES inteira.

**Correção sugerida:** `recorteEhIesInteira` deve ser verdadeiro só para `''`/`'geral'` (refletindo exatamente `v_geral` do servidor), nunca para `'6ano'`. Um arquivo, baixo esforço.

---

### 5. Ordenar a Tabela de Alunos por "Tendência" ordena alfabeticamente, não por severidade de negócio

**Onde:** RPC `get_gestor_alunos`, `ORDER BY ... l.tendencia` quando `v_sort='tendencia'`. Os valores possíveis são `alternando`/`descendo`/`estavel`/`subindo` — em ordem alfabética, não em ordem de "pior para melhor".

**Evidência real (Paracatu):** `p_order='asc'` traz só `'alternando'` no topo; `p_order='desc'` traz só `'subindo'` no topo — pura ordem de dicionário, sem relação com severidade.

**Correção sugerida:** mapear tendência para um rank de negócio (a decidir com produto — provavelmente `descendo < alternando < estavel < subindo` ou o inverso) antes do `ORDER BY`, em vez de ordenar a string diretamente.

---

### 6. Cronograma e Tabela de Alunos usam fontes diferentes de "participação" — simulado aparece com dado num lugar e traço no outro

**Onde:** `get_gestor_cronograma` conta participação via `simulados_finalizados` **com fallback** para `answer_progress` quando não há linha em `simulados_finalizados`. Nas 3 IES testadas (15 simulados-pai), **`simulados_finalizados` tem 0 linhas em todos os casos** — o fallback não é exceção, é a única fonte hoje. `get_gestor_alunos`, por outro lado, só preenche a coluna de proficiência de um simulado quando existe `resultados_alunos_tri` (TRI) para ele — que é calculado por um pipeline separado e pode não ter processado ainda.

**Evidência real (Funepe):** os simulados "24/03/2026" (85 participantes) e "26/05/2026" (54 participantes) aparecem com participação real no Cronograma e na Evolução da Visão Geral, mas com **traço em todas as 448 linhas** da Tabela de Alunos, porque ainda não têm TRI processado. Sem crash — o componente já trata a ausência — mas o gestor lê "ninguém fez" numa tela e "85/54 pessoas" na outra, para o mesmo simulado. Agravante: a Tabela de Alunos é renderizada fora de qualquer `BlocoGestor`, então o aviso `meta.partial=true` que a própria RPC calcula nunca aparece perto dela.

**Correção sugerida:** exibir o aviso de "resultado parcial / TRI pendente" perto da Tabela de Alunos (a RPC já calcula `meta.partial`, só falta o componente usar), e considerar diferenciar visualmente "sem TRI ainda" de "não participou" nas células vazias.

---

### 7. Detalhamento de Questões ignora o filtro de semestre — único bloco da tela que não reage

**Onde:** RPC `get_gestor_questoes` — assinatura `(p_ies_id, p_simulado_id, p_page, p_page_size, p_sort, p_area)`, sem `p_semestre`. Hook `useQuestoes` (`src/features/gestor/api/queries.ts:539-560`) também não envia nenhum.

Todo o resto da tela de Detalhamento (KPIs, comparativo, matriz área×semestre, dispersão, tabela de alunos do simulado) reage corretamente ao filtro de semestre — confirmado com dado real (Paracatu: participantes/acerto/proficiência mudam de 276/68%/64,0 em "Geral" para 146/68%/65,3 em "6º ano" para 125/66%/62,3 no 9º semestre). Só a tabela de questões, no rodapé da mesma tela, mostra sempre o mesmo número, porque a RPC nem recebe o parâmetro.

**Evidência numérica (Simulado Global Paracatu, 125 alunos do 9º + 147 do 6º ano):** Questão 1 = 70% de acerto (população inteira, o que a tela sempre mostra) vs. 73% recalculado só para o 6º ano; Questão 3 = 59% vs. 63%. Trocar o filtro de semestre na mesma tela não move esse número — é a peça que faz a auditoria descrever "o filtro não está sendo aplicado corretamente".

**Correção sugerida:** adicionar `p_semestre` à RPC `get_gestor_questoes` (mesma lógica de recorte das outras 4 RPCs já corrigidas em 07/08) e ao hook `useQuestoes`.

---

### 8. Gráfico "Evolução institucional" perde o rótulo do primeiro ponto no eixo X

**Onde:** `src/features/gestor/charts/EvolucaoChart.tsx:307-313` — o `<XAxis>` não declara `interval`, então o Recharts usa o default `'preserveEnd'`: percorre os ticks de trás para frente garantindo que o ÚLTIMO sempre apareça, e vai encolhendo o espaço disponível a cada tick aceito. O primeiro tick (primeiro simulado da série) é avaliado por último, com o espaço mais apertado, e é o primeiro a ser cortado quando o texto não cabe — agravado pela margem esquerda zerada (`margin={{ left: 0, ... }}`, linha 286). Não é problema de dado: a RPC sempre popula `nome` para todo ponto da série.

**Correção sugerida:** `interval="preserveStartEnd"` no `<XAxis>` (linha 307) — garante primeiro e último tick sempre visíveis, sacrificando só os do meio se precisar.

---

### 9. Gráfico "Evolução institucional", modo "Aluno" — falta de clareza confirmada (não é bug de dado)

**Onde:** `src/features/gestor/charts/DispersaoChart.tsx`. O texto que explica o gráfico ("Dispersão de proficiência por semestre, um ponto por aluno") só existe em `aria-label` (linhas 284/288) — invisível para quem usa visão normal. O que aparece na tela é só o título genérico "Alunos por semestre" (`GraficoProtagonista.tsx:30`). Pior: o jitter horizontal dentro de cada coluna de semestre é artificial (só para não sobrepor pontos, documentado em comentário nas linhas 48-63 do próprio componente) e nada no que é visível explica isso — um gestor pode ler a posição horizontal como um dado real, quando não é.

**Correção sugerida (sem redesenhar o gráfico):** promover o texto de `TITULO` para um subtítulo visível acima do `ScatterChart`, e acrescentar uma frase curta do tipo "a posição dentro da coluna é só para separar os pontos, não representa nada".

---

### 10. Detalhamento — espaço em branco quando há só um semestre no recorte

**Onde:** `src/features/gestor/routes/Detalhamento.tsx:487` — o grid pai usa `items-stretch`, que estica a altura de cada célula até a do card mais alto do par. `AcertoPorAreaESemestre.tsx:315` já esconde corretamente a seção "Acerto por semestre" quando há só 1 semestre (comportamento certo), mas o card vizinho de Dispersão tem altura fixa (~300px + legenda) — então o container do card de área/semestre, mesmo mais curto, é estirado até a altura do vizinho, sobrando espaço em branco visível abaixo.

**Correção sugerida:** trocar `items-stretch` por `items-start` em `Detalhamento.tsx:487`.

---

### 11. "Diagnóstico Curricular não puxa todas as respostas" — confirmado que é o mesmo bug do item 2, sem segundo problema

Verificação dedicada: nem `CascataDiagnostico.tsx` nem `DrawerTemas.tsx` têm `.slice`/limite sobre a lista de nós (grandes áreas/especialidades/temas) — renderizam tudo que a RPC devolve. O único filtro client-side é o de "nível de desempenho" (intencional, escolhido pelo usuário). Não há paginação nem `LIMIT` em nenhuma RPC dessa cadeia. A percepção de "não está puxando tudo" é 100% explicada pelo item 2 (rótulo "respostas" mostrando `amostra` de alunos, não a contagem real de respostas) — não é um segundo bug.

---

## Filtros globais (6º ano / Geral / por semestre) — auditoria dedicada

Testado com dado real (Paracatu: 166 alunos no 7º sem., 170 no 9º, 188 no 6º ano/11º+12º, 530 no total), trocando o filtro em cada tela e confirmando se o número exibido muda de forma coerente com a população filtrada:

| Tela / RPC | Resultado |
|---|---|
| Visão Geral (`get_gestor_visao_geral`) | Funciona — KPIs e dispersão mudam corretamente entre geral/6ano/7/9 |
| Diagnóstico (`get_gestor_diagnostico`/`_temas`) | Funciona — cascata e drawer de temas mudam numericamente entre recortes |
| Detalhamento — KPIs/matriz/dispersão/tabela de alunos (`get_gestor_detalhamento`) | Funciona — participantes/%acerto/proficiência mudam corretamente |
| Detalhamento — tabela de questões (`get_gestor_questoes`) | **Não funciona — ver item 7 acima** |
| Tabela de Alunos + filtro de grupo (`get_gestor_alunos`, `p_grupo`) | Funciona ponta a ponta — testado com os 3 valores em Paracatu/6ano, bateu exatamente com `distribuicaoAlunos` |
| Cronograma / Avisos | Não recebem `p_semestre` **por design** (cronograma é calendário IES-wide, avisos são por papel) — não é lacuna |
| Filtro "Por semestre" numérico (1-12) | Funciona, grava o valor certo na URL |

Conclusão: a alegação "filtros globais não aplicados corretamente" tem uma causa real e localizada (item 7, tabela de questões), não é um problema geral do mecanismo de filtro — o resto da cadeia já propaga o recorte corretamente.

---

## Critérios de classificação vigentes hoje (para revisão de produto, não é bug)

Nenhum destes teve inconsistência encontrada nesta auditoria — estão documentados aqui só para facilitar a decisão de mudar ou não:

- **Desempenho por área/tema (Diagnóstico):** crítico < 30% de acerto, mediano 30–80%, excelente ≥ 80%.
- **Grupo de evolução do aluno:** proficiência = score TRI ≥ 60 em um simulado. Consistentemente proficiente = proficiente em TODOS os simulados com resultado; consistentemente não proficiente = proficiente em NENHUM; em variação = misto.
- **Conceito ENAMED (1–5), quando derivado (fora do recorte "Geral"):** ≥90% proficientes → 5; ≥75% → 4; ≥60% → 3; ≥40% → 2; abaixo → 1.

---

## Verificado e descartado (código lido, dado real checado, sem bug)

- **Matriz área×semestre do Detalhamento** — reconstrução manual via SQL bateu exatamente com o valor da RPC (Paracatu, Cirurgia, semestre 11: 8.370 respostas, 75% de acerto, idêntico).
- **`proficientesPct`/`acertoPct` da Visão Geral** — recomputados direto da base para 2 IES, sem divergência.
- **Classificação crítico/mediano/excelente** — mesmo bloco de código para grande área e especialidade; fronteiras (30/80) validadas com dado real de 6 IES, corretas nos dois lados do corte.
- **`p_grande_area` obrigatório em `get_gestor_diagnostico_temas`** — confirmado exigido no servidor e sempre enviado pelo front; nenhum caminho quebra.
- **`get_gestor_questoes` com múltiplos simulados selecionados** — a tela já esconde o bloco de questões quando há 2+ simulados no filtro; a RPC nunca é chamada com ambiguidade.
- **Média ponderada por participante no Detalhamento** (`KpisDetalhamento.tsx`) — diverge da média simples em algumas IES reais, mas nunca a ponto de inverter o veredito "acima/abaixo da meta" nos casos encontrados; a salvaguarda do componente é conservadora, não incorreta.
- **`get_gestor_aluno_contato` sem envelope padrão `{data,meta}`** — inconsistência de contrato confirmada, mas sem crash: `DrawerAluno.tsx` já lê o formato correto.
- **Ordenação da Tabela de Alunos por proficiência** — `NULLS LAST` correto nas duas direções.
- **Paginação e filtro por grupo em `get_gestor_alunos`** — contagem total e por grupo bateu exatamente com reconstrução manual em 3 IES; sem duplicata nem perda ao paginar.

## Risco latente, sem evidência de ocorrência hoje

- **KPI "Simulados realizados/contratados"** — `ies_contrato_simulados` e `ies_simulado_previsto` têm **0 linhas em toda a base atual**. O clamp defensivo em `KpiCard.tsx` (`Math.min`/`Math.max` contra `feitos > total`) é código morto hoje; vira risco ativo no dia em que alguém popular contratos sem popular a mesma proporção de slots previstos.
- **Vazamento residual de IES via `get_accessible_ies`** em duas RLS policies (`simulados_admin`, `questoes_simulado`) para o papel `gestor` puro com `user_groups` órfão — identificado por leitura de código em rodada anterior desta auditoria, não reconfirmado com dado real nesta rodada.
- **Cores de grande área por regex de nome** (`AreasChart.coresDasAreas`) — frágil a mudança de grafia no banco; sem evidência de ter ocorrido.
- **Arredondamento do Conceito** (`formatConceito`, `Math.round`) — pode diferir do valor bruto em até 0,5 na escala 1-5; cosmético, sem exemplo real de virar o número exibido para o vizinho da faixa.

---

## Plano de correção — ordem sugerida

| # | Achado | Esforço | Arquivo(s) | Tipo |
|---|---|---|---|---|
| 1 | Rótulo "respostas" → "alunos" (Diagnóstico + Temas) | Baixo | `CascataDiagnostico.tsx:183`, `DrawerTemas.tsx:238` | Front, texto |
| 2 | `SEMESTRE_UNICO` desatualizado | Baixo | `KpisVisaoGeral.tsx:27-40` | Front, lógica |
| 3 | Ordenação de Tendência alfabética | Baixo-médio | RPC `get_gestor_alunos` | Backend, RPC |
| 4 | Aviso de "TRI pendente" perto da Tabela de Alunos | Médio | `TabelaAlunos.tsx`, `VisaoGeral.tsx:422` | Front, UX |
| 5 | Denominador de `distribuicaoAlunos` (bucket ou texto) | Médio | RPC `get_gestor_visao_geral` e/ou `VisaoDeAlunos.tsx` | Backend+Front, decisão de produto |
| 6 | Unificar fonte do Conceito ENAMED entre recortes | Médio-alto | RPC `get_gestor_visao_geral` | Backend, decisão de produto |
| 7 | Eixo X perde rótulo do primeiro ponto (Evolução institucional) | Baixo | `EvolucaoChart.tsx:307` | Front, Recharts |
| 8 | Blank space no Detalhamento com 1 semestre | Baixo | `Detalhamento.tsx:487` | Front, layout |
| 9 | `get_gestor_questoes` ignora filtro de semestre | Médio | RPC `get_gestor_questoes`, `queries.ts:539-560` | Backend+Front |
| 10 | Modo "Aluno" do gráfico sem título/explicação visível | Baixo | `DispersaoChart.tsx`, `GraficoProtagonista.tsx:30` | Front, texto |

Itens 1-3, 7 e 8 são mudanças pontuais, seguras para entrar juntas. Itens 4-6, 9 e 10 têm componente de decisão de produto (qual texto, qual regra de negócio, ou mudança de contrato de RPC) antes de codar — recomendo alinhar com quem define os critérios antes de implementar.

### Status de implementação (2026-08-09)

Itens 1, 2, 7 e 8 implementados no working tree (código + testes ajustados, todos passando), sem commit ainda:
- **Item 1** — `CascataDiagnostico.tsx:183` e `DrawerTemas.tsx:238` agora mostram "N alunos com resposta". Testes atualizados em `CascataDiagnostico.test.tsx`/`DrawerTemas.test.tsx` (46/46 passando).
- **Item 2** — `KpisVisaoGeral.tsx`: `recorteEhIesInteira` agora só é verdadeiro para `''`/`null`/`'geral'`, nunca para `'6ano'`. Teste dedicado dividido em `KpisVisaoGeral.test.tsx` (28/28 passando).
- **Item 7** — `EvolucaoChart.tsx`: `<XAxis interval="preserveStartEnd">` adicionado (16/16 testes passando). **Achado bônus, não corrigido ainda**: `AreasChart.tsx:283` e `DispersaoChart.tsx:159` têm o mesmo padrão (`<XAxis>` sem `interval`) — candidatos ao mesmo bug, pendente de decisão.
- **Item 8** — `Detalhamento.tsx:487`: `items-stretch` → `items-start` (70/70 testes passando). Risco de regressão visual identificado e não confirmado: com 2+ semestres, os dois cards podem ficar com alturas visivelmente diferentes (antes ficavam com a borda inferior alinhada); vale checagem visual antes de considerar fechado.

**Item 3 — aplicado em produção em 2026-08-09.** Rank de severidade confirmado pelo produto: `descendo(1) < alternando(2) < estavel(3) < subindo(4)`. Aplicado via patch textual (`DO $patch$` lendo a definição viva e trocando as duas linhas exatas do `ORDER BY`, mesmo padrão de `20260807194927_...sql`, não o `CREATE OR REPLACE` de corpo fixo originalmente preparado — trocado antes de aplicar por ser mais seguro contra pushes concorrentes do Lovable). Migration correspondente em `supabase/migrations/20260809220000_get_gestor_alunos_ordenacao_tendencia_por_severidade.sql`, conteúdo idêntico ao que foi de fato executado. Verificado pós-aplicação: `pg_get_functiondef` da função viva contém as 2 ocorrências do novo `CASE`.

---

## Backlog de features/redesign (fora do escopo desta auditoria — não são bugs)

Levantados pelo usuário na mesma rodada, registrados aqui para não se perder, sem plano/spec ainda (decisão explícita: só backlog por agora):

1. Insights do aluno (Visão de Alunos) gerados por IA.
2. Insights pedagógicos gerados por IA.
3. Granularidade por subespecialidade/tema + quantitativo de questões respondidas — Visão de Alunos.
4. Granularidade por subespecialidade/tema + quantitativo de questões respondidas — ao clicar no aluno, no Detalhamento.
5. Ao clicar numa grande área no Detalhamento, abrir detalhamento por subespecialidade e tema.
6. Novo filtro no Detalhamento: proficiente / próximo da proficiência / não proficiente (hoje só existe proficiente/não proficiente).
7. Repensar o gráfico de Dispersão do Detalhamento (redesenho, não conserto).
8. Detalhamento de Questões: fundo branco e bordas (estilo).
9. Detalhamento de Questões: ao clicar numa alternativa, listar os alunos que a marcaram.
10. Detalhamento de Questões: puxar e exibir as imagens das questões.
