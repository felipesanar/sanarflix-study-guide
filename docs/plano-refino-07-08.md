# Refino do Portal do Gestor — reunião de 07/08 (11h27)

Fonte: transcrição **"Revisão e Refinamento da Plataforma de Simulados"** (Notion,
07/08/2026). Este documento separa o que já foi aplicado do que **não é melhoria
clara** — ou porque depende de decisão de negócio, ou de dado que a API não
devolve, ou de trabalho fora do frontend.

Contexto que emoldura tudo: a apresentação ao restante do time é **segunda-feira**,
e a leitura do time é que o estado atual "já poderia ir para gestores, idealmente
com mais um dia de ajuste". Ou seja — o corte abaixo é entre *o que dá para fazer
antes de segunda* e *o que não deveria ser decidido às pressas*.

---

## 1. Aplicado (frontend, sem decisão pendente)

| Item da reunião | Onde |
|---|---|
| Bolinhas "acima de 100%" na visão de Grande Área / "esse ponto não existe" | `charts/AreasChart.tsx`, `charts/EvolucaoChart.tsx` — ponto nulo virava `<circle>` sem `cy`, que em SVG é 0 (topo do plot). Era falha de RENDER, não de dado |
| Inverter cores de mediana e meta de proficiência | `charts/DispersaoChart.tsx` — meta agora é a linha sólida de marca; mediana é o traço neutro |
| Bolinhas sobrepostas na dispersão (eixo X discreto) | `charts/DispersaoChart.tsx` — jitter determinístico agora vale para todo recorte, não só para o de um semestre |
| Componente redundante "aluno por semestre" | `components/VisaoDeAlunos.tsx` — a dispersão duplicada saiu; fica a do modo "Aluno" do gráfico protagonista |
| Detalhe micro só ao clicar em "Ver visão detalhada" | `routes/VisaoGeral.tsx` — monta sob demanda, com entrada em `motion-4` e scroll suave |
| Evolução do recorte só com 2+ simulados | `routes/Detalhamento.tsx` |
| Destaque para "Ver comparativo completo" e para a seção de comparativo | `components/ComparativoSimulados.tsx` |
| Fundo cinza da área de conteúdo | `gestor-theme.css` — `--gp-bg-app` virou literal do handoff (#EDEEF0 / #0B0C0D) |
| Card duplicado por simulado na visão de aluno | `components/DrawerAluno.tsx` — virou lista de notas + evolução + comparativo de áreas + insight |
| Botão de WhatsApp na visão de aluno | `components/DrawerAluno.tsx` |
| Detalhamento das questões abre clicando em qualquer lugar da linha | `components/TabelaQuestoes.tsx` |
| Afordância de interação em "Acerto por grande área" e "por semestre" | `components/AcertoPorAreaESemestre.tsx` — dica em texto, cursor e hover |
| Gráfico de semestre "horrível" (bolota) | `components/AcertoPorAreaESemestre.tsx` — raio de pílula sob `scaleY` virava elipse; agora é barra |

---

## 2. Precisa de decisão de negócio

### 2.1 Classificação de alunos com faixa de tolerância — **o maior item**

**Problema (consenso na reunião):** qualquer variação, mesmo de décimos, cai em
"alternando". Ana Clara com 75 · 72 · 72 · 74 aparece como alternando, o que é
injusto e confunde o gestor. Hoje o critério de estável é determinístico: a pessoa
teria que tirar exatamente a mesma nota, o que é impossível.

**O que ficou combinado:** criar uma faixa (±3 a 4 pontos) dentro da qual o aluno é
*estável*; fora dela, *subindo* ou *descendo*.

**O que NÃO ficou fechado — e é por isso que não implementei:**

1. **O valor da faixa.** ±3, ±4, ±5? Na tela apareceu gente que só se classifica
   direito com ±5 ou ±6. É calibragem sobre dado real, não escolha de código.
2. **A janela.** Todos os simulados, os dois últimos, os três últimos? Levantado o
   risco de simulado ONLINE inflar a nota (93 e 100 que "não são reais") e
   contaminar qualquer média móvel que inclua o histórico inteiro.
3. **Quantas tags existem.** Discutiu-se separar *instável* (alterna ao longo da
   série) de *em queda* (caiu do simulado anterior para o atual) — são regras
   diferentes que podem coexistir no mesmo aluno. O caso "100 · 90 · 26 · 44"
   ficou sem resposta: matematicamente não está em queda (subiu no último), mas
   todo mundo na sala leu como queda.
4. **Onde a regra mora.** Hoje `aluno_grupo` é calculado dentro de
   `get_gestor_visao_geral`/`get_gestor_alunos`. Mudar a classificação é
   **migration**, não CSS — e as duas RPCs precisam concordar, senão a Visão Geral
   e a tabela discordam sobre o mesmo aluno.

**Proposta de encaminhamento:** antes de codar, rodar a regra candidata em cima de
2–3 IES reais (UEA, FAI, UNIATENAS) e olhar quantos alunos mudam de tag em cada
valor de faixa. É uma consulta, não um deploy. Com o número na mão, a decisão sai
em minutos e a migration vira mecânica.

**Bloqueado por:** definição de Felipe + João. **Impacto:** alto (é a leitura
principal da tabela de alunos). **Não deveria ir para gestores como está.**

### 2.2 Média no card do aluno com 3+ simulados

"Isso sai em variação e vira só média. Quando for dois, permite; quando for mais de
dois, não."

O drawer já deixou de repetir um card por simulado. Falta decidir **qual média**: a
média aritmética das proficiências mistura simulado online com presencial, que é
exatamente a distorção levantada em 2.1. Enquanto a regra da faixa não fechar, uma
"média" no card herda o mesmo problema silenciosamente.

**Sugestão:** resolver junto de 2.1, com a mesma janela.

### 2.3 Eixo X da dispersão: discreto → contínuo

Diagnóstico da reunião: "o comportamento ideal para esse gráfico ficar perfeitinho é
o eixo X ser um valor contínuo, e não discreto". O jitter que apliquei é paliativo —
resolve a sobreposição, não a leitura.

**O que falta:** decidir QUAL grandeza contínua. Candidatos citados: nada concreto
("eu só não sei o que deveria ser o eixo X"). Opções que o dado permite hoje: data
do simulado, percentil do aluno, número de acertos. Cada uma conta uma história
diferente, e uma delas (percentil) duplicaria o eixo Y.

**Bloqueado por:** decisão de design/produto. **Tarefa nominal do João** na reunião.

### 2.4 "Selecionar todos" no seletor de simulados

Na reunião: "pode selecionar todos? Não deveria. Tá podendo. Vou ter que tirar."

**Não há controle "todos"** no componente — inclusive há uma nota explícita na tela
("Não existe 'todos' — o agregado do período é a Visão Geral"). O que existe é
poder marcar todos os checkboxes um a um, que é o comportamento normal de um
multi-select.

**Pergunta em aberto:** existe um **teto** (ex.: máximo 6, que é o que a §4.7.2
menciona)? Se sim, implemento o limite. Se a intenção era só remover um botão de
"marcar todos", não há o que remover.

---

## 3. Precisa de backend / dado (não é frontend)

| Item | Natureza | Dono provável |
|---|---|---|
| **FNEP não carrega dados** | Investigação de dado/RPC — travou a análise na própria reunião | João |
| **Plataforma exibe 5 simulados quando deveria exibir 4** | Inconformidade de dado (UNIATENAS); pode ser simulado-irmão contado em dobro | João |
| **Imagens das questões no detalhamento** | Pipeline existe (biblioteca extratora → bucket S3/Supabase, pasta por `simulado_id`); falta verificar se o upload rodou para estes simulados. Não é render | João |
| **Títulos dos simulados ambíguos** ("4º ano" lido como "4º de Paracatumbo") | Dado cadastral. Padrão acordado: `Quarto Simulado — [data completa]`. O front só exibe `simulados_admin.nome` | Admin/CX |
| **Padronização de nomes de temas** | Maiúscula/acento/singular-plural fazem o mesmo tema virar dois. O sistema já normaliza (tira acento, espaço e caixa) — o que sobra (plural × singular) é impossível de resolver deterministicamente | Cadu → pedagogia, padrão SanarFlix |
| **Adicionar simulados futuros para ver o estado** | Carga de dado para validação | Admin |

---

## 4. Adiado por decisão explícita

**Curva de tendência / previsão da próxima nota.** Discutido, modelado
(consideraria o espaçamento entre provas como variável) e **adiado na hora**:
"vamos entregar o básico agora; tenho medo de ficar igual à inteligência decisória,
que a gente fez uma puta coisa e ninguém usou".

Fica registrado com o requisito que já apareceu: se voltar, o modelo precisa tratar
o intervalo entre simulados, e a saída não pode dar falsa sensação de precisão ao
gestor.

---

## 5. Sem decisão pendente, mas fora do que fiz nesta rodada

Coisas claras que não entraram por escopo/tempo — pego na próxima se você quiser:

- **Estado de loading na troca de semestre.** A Visão Geral já tem a faixa
  "Atualizando para o recorte selecionado"; o Detalhamento não tem equivalente.
- **Ícone de ajuda ("interrogaçãozinha") nos demais pontos de interação
  não óbvia.** O componente existe (`components/Dica.tsx`, usado no Panorama).
  Falta aplicar nos modos do gráfico protagonista e na cascata do Diagnóstico —
  a reunião pediu "em todas que tiverem algo parecido".
- **Ocultar a variação e mostrar só a média com 3+ simulados** na tabela de alunos
  do Detalhamento (depende de 2.2 para saber qual média).
- **Comparativo por tema começando pela subespecialidade**, com o tema um nível
  abaixo ("começa mais clean e ele entra se quiser"). Precisa de suporte da RPC
  de comparativo, que hoje devolve tema direto.

---

## Sugestão de ordem até segunda

1. Fechar **2.1** (faixa de tolerância) — é o único item que muda o que o gestor
   *conclui*, e o resto de aluno depende dele.
2. **3** em paralelo (FNEP, contagem de simulados, imagens) — sem isso, a demo de
   segunda tem IES que não carrega.
3. Itens de **5**, que são mecânicos.
4. **2.3** e **2.4** podem esperar: são refinamento de leitura, não erro.
