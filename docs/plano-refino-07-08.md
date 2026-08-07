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

**A SIMULAÇÃO JÁ FOI RODADA (07/08).** Regra candidata testada, por aluno com
2+ notas, em ordem cronológica: `amplitude = max−min`, `liquido = última−primeira`;
`estavel` se `amplitude ≤ T`; `subindo` se `liquido > T` e nenhum delta `< −T`;
`descendo` se `liquido < −T` e nenhum delta `> +T`; `instavel` no resto.

FAI (100 alunos com 2+ notas):

| tag | hoje | T=3 | T=4 | T=5 |
|---|---|---|---|---|
| alternando | 89 | — | — | — |
| instavel | — | 78 | 71 | 68 |
| descendo | 11 | 19 | 23 | 24 |
| subindo | 0 | 2 | 2 | 2 |
| estavel | 0 | **1** | **4** | **6** |

PARACATU (294 alunos):

| tag | hoje | T=3 | T=4 | T=5 |
|---|---|---|---|---|
| alternando | 70 | — | — | — |
| instavel | — | 47 | 42 | 38 |
| descendo | 127 | 114 | 106 | 94 |
| subindo | 97 | 75 | 65 | 56 |
| estavel | 0 | **58** | **81** | **106** |

**O que os números dizem:** o efeito da faixa depende muito da IES. Na FAI as
séries têm amplitude grande e a tolerância quase não resgata — T=5 tira só 21
dos 89 "alternando". Na PARACATU o efeito é forte: T=3 já reclassifica 58
alunos como estáveis e T=5 chega a 106, ou seja 36% da base.

Séries reais que mudam de classificação entre T=3 e T=5 (sem identificador):

```
[75.6, 72.7, 72.1, 74.6]  → T3: instavel | T5: estavel
[57.7, 53.0, 56.1, 56.4]  → T3: instavel | T5: estavel
[60.7, 59.2, 56.9, 58.4]  → T3: instavel | T5: estavel
[81.8, 82.7, 79.3]        → T3: instavel | T5: estavel
[58.7, 62.9, 61.1, 51.4]  → T3: instavel | T5: descendo
[74.4, 72.7, 77.5, 56.4]  → T3: instavel | T5: descendo
[57.4, 61.8, 61.5]        → T3: subindo  | T5: estavel
[60.7, 54.5, 56.4]        → T3: descendo | T5: instavel
```

Nota: o caso `[75, 72, 72, 74]` citado na reunião tem amplitude 3 — já vira
estável com T=3. As séries de amplitude 4–5 (muito comuns) só são resgatadas
com T=4 ou T=5.

**Confirmado:** a regra atual em produção é `bool_or(diff>0)`/`bool_or(diff<0)`
sobre a série, sem banda morta nenhuma — o próprio `criterio` da função admite.

**Falta só a sua escolha:** valor de T, janela (série inteira × últimos N) e se
`instavel` e `descendo` são tags separadas. Com isso a migration vira mecânica.

**Impacto:** alto (é a leitura principal da tabela de alunos). **Não deveria ir
para gestores como está.**

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

## 3. Backend / dado — DIAGNOSTICADO em 07/08

Rodado via agente do Lovable, somente leitura (o MCP do Supabase aponta para
`lljn`; o app usa `gvqv`, então não há como consultar produção por aqui).
Resultados abaixo — vários derrubam a hipótese original.

### 3.0 Correção de nomes: FNEP e UNIATENAS não existem como IES

São 24 IES cadastradas, e **nenhuma se chama FNEP nem UNIATENAS**:

- O candidato a "FNEP" é **Funepe**.
- Os simulados da "UNIATENAS" estão sob a IES **PARACATU** — "UNIATENAS"
  aparece só no NOME dos simulados.

Todo o resto deste documento usa os nomes reais. Se FNEP for outra coisa,
o item 3.1 volta à estaca zero.

### 3.1 Funepe "sem dados" — nenhuma camada está vazia

| IES | `gestao.enabled` | simulados | c/ TRI | alunos | linhas TRI | respostas | contratos |
|---|---|---|---|---|---|---|---|
| Funepe | true | 6 | 3 | 451 | 250 | 49.700 | **0** |
| FAI | true | 6 | 4 | 116 | 393 | 40.100 | **0** |
| PARACATU | true | 5 | 4 | 590 | 894 | 106.800 | **0** |
| UEA | true | 1 | 1 | 360 | 79 | 9.200 | **0** |

Feature ligada, 6 simulados encerrados, 250 linhas de TRI que casam com
aluno+simulado da própria IES. **Não é falta de dado.**

**Hipótese que sobra:** escopo do gestor. A RPC estoura `Permission denied`
em `gestor_pode_acessar_ies` quando o gestor que testa não tem
`users.id_ies` apontando para a Funepe — e a tela fica vazia exatamente
assim. A Funepe tem 3 gestores cadastrados.

**Bloqueado por:** preciso do **e-mail do gestor que viu a tela vazia**. O
agente não consegue simular a RPC (roda como `supabase_read_only_user`,
`auth.uid()` nulo, a função barra antes de qualquer consulta).

### 3.2 Cinco simulados na PARACATU — hipótese descartada

| data | nome | `pai_id` | participantes c/ TRI |
|---|---|---|---|
| 20/05 | Simulado Global PARACATU - UNIATENAS | null | 276 |
| 02/06 | Simulado 4 ano PARACATU - UNIATENAS | null | 0 |
| 23/06 | Simulado 2 2026 - UNIATENAS (4° ano) | null | 158 |
| 30/06 | Simulado 2 2026 - UNIATENAS (5º e 6º ano) | null | 292 |
| 17/07 | Simulado 3 2026 - UNIATENAS | null | 168 |

Não são simulados-irmãos: `simulado_pai_id` é `NULL` nos cinco. O par que
DEVERIA ser irmão — "Simulado 2 2026" nas versões (4º ano) e (5º e 6º ano) —
foi cadastrado como **dois simulados-pai independentes**. É daí que sai o 5.

**Correção é de DADO, não de código:** vincular um ao outro por
`simulado_pai_id`. As RPCs já agrupam por `COALESCE(simulado_pai_id, id)`.

### 3.3 Imagens das questões — o upload não rodou

- Bucket: `imagensSimulado` (público). Coluna: `questoes_simulado.imagem`
  (URL pública completa), mais `imagem_2` e `imagem_comentario`.
- Preenchimento global: 811 de 4.502 questões com imagem.
- FAI: 18 questões com imagem em 5 simulados — mas o mais recente
  ("4º Simulado FAI") tem **zero**.
- PARACATU: só "Simulado 4 ano PARACATU" tem imagem; os quatro demais,
  inclusive os recentes, **zero**. E esse não tem pasta no bucket.

**Não é o front deixando de ler:** onde a coluna está preenchida, a URL é
pública e válida. Faltou rodar o upload nos simulados recentes.

### 3.4 Achado NOVO: nenhuma IES tem contrato cadastrado

`ies_contrato_simulados` e `ies_simulado_previsto` estão **vazias para as
quatro IES**. É por isso que o KPI "Simulados realizados" sai como `N / —` e
o cronograma não tem vigência: não há contrato de onde tirar o denominador.
O front está certo ao mostrar traço em vez de zero (§4.10) — o que falta é
o dado.

### 3.5 Achado NOVO e mais sério: `get_gestor_visao_geral` não tem o guard de `gestao.enabled`

A definição em produção tem os dois guards de PAPEL (`admin`/`gestor`/
`gestor_grupo` → `Access denied`) e de ESCOPO (`gestor_pode_acessar_ies` →
`Permission denied`), mas **nenhuma checagem de `gestao.enabled`**.

Isso contradiz o que se acreditava desde 06/08 (o guard teria voltado às
RPCs). Duas leituras possíveis, e não dá para decidir daqui: ou esta função
nunca esteve na lista das que receberam o guard, ou ele foi perdido de novo
numa recriação posterior. **Vale auditar as outras RPCs de gestor antes de
segunda** — o efeito prático é que uma IES com a feature desligada ainda
responde dado se o gestor tiver escopo nela.

### 3.6 Segue com dono fora do time técnico

| Item | Dono |
|---|---|
| Títulos dos simulados (`Quarto Simulado — [data completa]`) | Admin/CX |
| Padronização de nomes de temas, padrão SanarFlix | Cadu → pedagogia |

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

Reordenada depois do diagnóstico de 07/08:

1. **3.5 — auditar o guard de `gestao.enabled`** nas demais RPCs de gestor. É o
   único item com cara de segurança, e descobri por acaso. Se o guard sumiu de
   mais funções, é melhor saber antes de abrir para gestores.
2. **3.1 — Funepe.** Preciso do e-mail do gestor que viu a tela vazia. Se a
   hipótese de escopo se confirmar, o conserto é uma linha em `users.id_ies`, e
   sem ele há IES que não carrega na demo.
3. **3.2 — vincular os dois "Simulado 2 2026"** por `simulado_pai_id`. Correção
   de dado, some o 5º simulado fantasma.
4. **2.1 — escolher T.** Os números já estão na mesa; falta a decisão. Sugiro
   olhar as séries de exemplo e escolher entre T=4 e T=5.
5. **3.4 — cadastrar contratos.** Sem eles o KPI de simulados fica `N / —` para
   todas as IES.
6. **3.3 — rodar o upload de imagens** nos simulados recentes.
7. Itens de **5**, mecânicos.
8. **2.3** e **2.4** podem esperar: refinamento de leitura, não erro.
