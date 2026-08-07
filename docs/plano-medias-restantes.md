# Plano — divergências Média restantes do Portal do Gestor v2

Continuação do passe de conformidade. **Não aplique a lista original de 123 itens**: ela é
anterior ao passe que corrigiu os 8 Bloqueia e as 136 Alta, e boa parte já foi resolvida no
caminho. Uma triagem leu cada item contra o código de hoje.

| Classificação | Nº |
|---|---|
| Triados | 113 |
| **Procede — implementar** | 16 |
| Já resolvido pelo passe | 80 |
| Não procedia | 9 |
| Conflita com decisão ratificada | 8 |

## O que implementar — 3 lotes de arquivos disjuntos

`gestor-theme.css` fica **sozinho num lote**: é a camada de token que todo o resto consome, e
mexer nele em paralelo com componentes produziria conflito de leitura.

### Lote 1 · tokens — 5 itens

**gestor-theme.css** · esforço trivial  
--gp-border-input e --gp-border-strong ainda resolvem para o mesmo cinza, e o input é consumido em pontos visíveis (linha de proficiência, barras apagadas, contorno terciário)

- **Hoje:** gestor-theme.css:14 `--gp-border-strong: hsl(var(--border))` e :16 `--gp-border-input: hsl(var(--input))`; src/index.css:49 e :51 declaram os dois como `220 13% 91%` (e :110/:112 como `220 13% 14%` no escuro) — mesmo valor. O token é lido de verdade: EvolucaoChart.tsx:280 e AreasChart.tsx:296 (stroke da ReferenceLine de proficiência), DispersaoChart.tsx:151/263, MolduraVazia.tsx:87, AcertoPorAreaESemestre.tsx:274 (fundo da barra sem evidência), AcoesRecorte.tsx:48 (borda da ação terciária), CascataDiagnostico.tsx:428. Hoje tudo isso sai em #E5E7EB, contra os #C3C6C6 do handoff — a linha de proficiência praticamente some sobre o card branco.
- **Fazer:** Dar valor próprio a --gp-border-input: literal equivalente a #C3C6C6 em `.gestor-portal` e a #535959 em `.dark .gestor-portal` (tema.test.tsx:52 exige par escuro para todo literal declarado no claro).

**gestor-theme.css** · esforço trivial  
A escada de superfícies inteira está um degrau abaixo da referência: surface-2 96% e surface-3 93% contra os 98%/96% do handoff

- **Hoje:** gestor-theme.css:12 `--gp-surface-2: hsl(var(--muted))` = 220 14% 96% = #F3F4F6 (handoff #F9FAFB) e :13 `--gp-surface-3: hsl(220 14% 93%)` = #EBECF0 (handoff #F4F5F6). surface-3 é lido em DistribuicaoAlternativas.tsx:137 (trilho da barra), AcertoPorAreaESemestre.tsx:122, DirecionadoresGestor.tsx:53 e Tag.tsx; surface-2 em ComparativoSimulados.tsx:62, SeletorSimulados.tsx:174 e TabelaAlunos.tsx:211 (cabeçalho de tabela). Já são literais/derivados nesta camada, então trocar o valor não mexe em src/index.css.
- **Fazer:** Declarar --gp-surface-2 e --gp-surface-3 como literais dos dois temas (#F9FAFB/#F4F5F6 no claro, #1E2223/#23282A no escuro) e atualizar as duas expectativas exatas de tema.test.tsx:304-305, que hoje cravam `hsl(220 14% 93%)` e `hsl(220 13% 16%)`.

**gestor-theme.css** · esforço trivial  
--gp-brand-strong é o MESMO valor nos dois temas (--primary-dark não é redeclarado em .dark); vale só o par escuro, o desvio do claro é imperceptível

- **Hoje:** gestor-theme.css:26 `--gp-brand-strong: hsl(var(--primary-dark, var(--primary)))`; src/index.css:30 declara --primary-dark (0 65% 25% = #691616) só em :root e o bloco .dark (:85-113) não o redeclara — logo o token vale #691616 nos dois temas. Consumidores reais: EvolucaoChart.tsx:257 (parada 0% do gradiente da linha) e SidebarNav.tsx:96 (item ativo, só no claro — o escuro já cai em --gp-brand-on-dark). No claro, #691616 × #660000 do handoff é diferença que não se enxerga em rótulo de 13px; no escuro, começar a linha em L 25% sobre card de L 10% é que apaga a ponta esquerda do traço.
- **Fazer:** Acrescentar só o par escuro em `.dark .gestor-portal`: `--gp-brand-strong` no equivalente a #8F1414 (deixar o claro derivando de --primary-dark como está).

**gestor-theme.css** · esforço trivial  
--gp-brand-surface/--gp-brand-border são alfa sobre o vinho e ficam bem menos rosados que os valores opacos da referência, além de mudar de cor conforme o fundo

- **Hoje:** gestor-theme.css:28-29 `hsl(var(--primary) / 0.08)` e `/ 0.24`; :104-105 repetem a fórmula no escuro (0.16 / 0.38). Composto sobre card branco dá ≈#F6EEEE contra o #FCE3E3 do handoff (tokens.light.css:10) — o tinte de marca é o realce mais repetido do portal: avatar/tile da sidebar (GestorShell.tsx:188), linha selecionada (tabela/TabelaGestor.tsx:114, provada em TabelaAlunos.test.tsx:394), aviso não lido (AvisosSanar.tsx:134), tile de direcionador (DirecionadoresGestor.tsx:53), KpiCard.tsx:220, CronogramaSimulados.tsx:346, DrawerAluno.tsx:327, Tag.tsx:70, SeletorSimulados.tsx:196, EstadoVazioDetalhamento.tsx:37.
- **Fazer:** Trocar os quatro por literais opacos — #FCE3E3/#F3C9C9 no claro e #2C1517/#5A2426 no escuro; os testes só comparam a string `var(--gp-brand-surface)`, então nenhum quebra, e o `color-mix` de SidebarNav.tsx:113 continua funcionando (deixar --gp-brand-surface-soft como está, é decisão comentada em :106-108).

**gestor-theme.css** · esforço trivial  
No escuro o divisor forte some: #1F2228 contra card #16181C dá ~1,2:1 e é justamente a linha que substitui a sombra no tema escuro

- **Hoje:** gestor-theme.css:14 `--gp-border-strong: hsl(var(--border))` e o bloco `.dark .gestor-portal` (:98-133) não o sobrescreve — no escuro sai 220 13% 14% = #1F2228, contra os #282C2D de tokens.dark.css:23. É o token que desenha o contorno do trilho segmentado (GraficoProtagonista.tsx:110), a borda dos tooltips dos três gráficos (EvolucaoChart.tsx:101, AreasChart.tsx:310, DispersaoChart.tsx:180), o eixo dos gráficos e os divisores de tabela — e o próprio cabeçalho do arquivo (:4-5) diz que no escuro a separação vem da cor da superfície mais a linha, não de sombra. No claro o desvio (#E5E7EB × #E9EBED) não se enxerga.
- **Fazer:** Acrescentar `--gp-border-strong` no bloco `.dark .gestor-portal` com o equivalente a #282C2D, deixando o claro derivando de --border.

### Lote 2 · componentes — 6 itens

**KpiCard.tsx** · esforço alto  
Count-up de 560ms no número do KPI

- **Hoje:** KpiCard.tsx:165 ainda imprime a string pronta: `{estado === 'empty' ? TRACO : valor}`. Grep por countUp|count-up|requestAnimationFrame em src/features/gestor não retorna nada (os únicos rAF do repo estão em hooks/ScrollManager/PageWrapper, fora do gestor). O handoff é explícito e repetido: docs/07-motion.md:13 e :43, docs/06-data-viz.md:12, docs/11-acessibilidade.md:39, prompts/03-visao-geral.md:17.
- **Fazer:** Criar um hook useCountUp(valorNumerico) com requestAnimationFrame, 560ms em var(--gp-ease), disparando uma vez por mudança e devolvendo o valor final imediato sob prefers-reduced-motion; exige passar ao KpiCard o valor numérico além da string formatada (hoje só chega `valor: string`) e um formatador por quadro.

**TooltipRastreabilidade.tsx** · esforço medio  
Superfície do tooltip continua clara — a referência pede fundo escuro #131414 mesmo no tema claro

- **Hoje:** TooltipRastreabilidade.tsx:104-107 — <TooltipContent className="max-w-xs" style={{borderRadius:'var(--gp-radius-md)', padding:16}}>: raio (12px, --radius=0.75rem em src/index.css:54) e padding já batem, e a linha de título com o nome do indicador foi acrescentada em :108-110 (12px/700). O que falta é só a superfície: o componente herda `bg-popover text-popover-foreground border` de src/components/ui/tooltip.tsx:20, e no claro --popover é branco (src/index.css:15) — tooltip branco sobre card branco. Não há nenhum token de tooltip em gestor-theme.css (grep por popover/tooltip/131414 = 0) nem teste travando a superfície clara. A referência é explícita: LIGHT.html, bloco "Tooltip do 'i' · rastreabilidade" — background:#131414; box-shadow:0 12px 32px -12px rgba(17,18,18,0.5); rótulos #A9AEAE, valores #F9FAFB.
- **Fazer:** Criar tokens de tooltip escuro em gestor-theme.css (superfície, rótulo, valor, sombra — iguais nos dois temas, já que no escuro a superfície também é escura) e aplicá-los por style no TooltipContent deste componente, colorindo os <dt> com o token de rótulo em vez de text-muted-foreground; não mexer em --popover, que é compartilhado com aluno/admin.

**GraficoProtagonista.tsx** · esforço medio  
Troca de modo ainda desmonta/monta o gráfico sem fade cruzado

- **Hoje:** GraficoProtagonista.tsx:163-165 continua a renderização condicional dura (`{modo === 'geral' ? <EvolucaoChart/> : null}` …): ao trocar de modo o gráfico anterior desmonta e o novo aparece no mesmo frame. A metade do achado que falava do indicador já foi resolvida (:118-130) — sobra só o fade entre gráficos, que docs/06-data-viz.md:23 pede explicitamente ("troca o conjunto de séries com fade cruzado").
- **Fazer:** Envolver o CardContent num contêiner com `key={modo}` que entra de opacity 0→1 em `var(--gp-motion-3)`/`var(--gp-ease)` (só opacity, respeitando prefers-reduced-motion), mantendo `isAnimationActive={false}` nas séries.

**BlocoGestor.tsx** · esforço trivial  
Faixa de recorte parcial em tom neutro, sem ícone — indistinguível de uma nota informativa

- **Hoje:** BlocoGestor.tsx:70-78 segue com `className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"` e sem ícone nenhum. Os tokens de alerta já existem e já são usados no portal (SeletorSimulados.tsx:270-282 monta o mesmo callout com `--gp-warning-surface` / `--gp-warning` / `--gp-warning-on` e `<Icon name="error_outline" />`).
- **Fazer:** Vestir a faixa `data-testid="faixa-parcial"` com os tokens de warning e o `<Icon name="error_outline" size={17} />`, copiando a anatomia já pronta do callout de SeletorSimulados.tsx:265-288; manter o texto genérico, já que `meta.partial` é só booleano.

**EstadoErro.tsx** · esforço trivial  
Geometria dos botões: o retry já foi corrigido, mas 3 botões do Cronograma seguem no default do primitivo

- **Hoje:** EstadoErro.tsx:58 já traz `className="mt-1 h-auto rounded-sm px-3 py-1.5 text-[11px] font-semibold"` (= 8px de raio, 6px 12px de padding, 11px/600) — o âncora do achado está resolvido, e `EstadoVazio.tsx:75` repete a mesma receita. O resíduo transversal continua: `CronogramaSimulados.tsx:428` ("Agendar data"), `:480-483` ("Falar com consultor" do vazio) e `:545-547` ("Falar com consultor" do grupo sem data) são `size="sm"` cru, herdando `h-9 rounded-md px-3 text-sm font-medium` do primitivo compartilhado.
- **Fazer:** Aplicar aos três `<Button>` de CronogramaSimulados.tsx (428, 480, 545) a receita de botão de ação em página — `h-auto rounded-sm px-3.5 py-2 text-xs font-semibold` (8px / 8px 14px / 12px 600) — sem tocar em src/components/ui/button.tsx.

**VisaoGeral.tsx** · esforço trivial  
Overline "Panorama da instituição" já existe, mas falta a nota da régua ao lado

- **Hoje:** VisaoGeral.tsx:226-233 — os KPIs já estão sob `<span data-testid="overline-panorama" className="uppercase text-muted-foreground" style={{fontSize:11, fontWeight:600, letterSpacing:'0.1em'}}>Panorama da instituição</span>`. O que não existe em lugar nenhum é a nota explicativa da régua que a referência põe na MESMA linha (LIGHT.html, bloco `<!-- Panorama -->`: `<span style="font-size:12px; color:#B0B4B4;">compara 1º simulado · anterior · atual — com 1 simulado a régua não aparece; com 2, mostra só os dois</span>`); confirmado ausente também em KpisVisaoGeral.tsx e KpiCard (grep por "régua"/"compara 1º" não retorna copy de UI).
- **Fazer:** Ao lado do overline (VisaoGeral.tsx:227), no mesmo flex com `align-items: baseline` e gap 10px, acrescentar um `<span>` de 12px em `--gp-text-4`/`text-muted-foreground` com o texto "compara 1º simulado · anterior · atual — com 1 simulado a régua não aparece; com 2, mostra só os dois".

### Lote 3 · tabelas, distribuição e drawer — 5 itens

**DistribuicaoAlternativas.tsx** · esforço trivial  
Números em tabela em Roboto Mono — resolvido nas tabelas, mas dois pontos ainda usam `font-mono` do Tailwind, que não resolve para Roboto Mono

- **Hoje:** Resolvido onde o item apontava: tabela/TabelaGestor.tsx:32 declara `FONTE_MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, monospace"`, aplicada em toda `Celula numerica` (TabelaGestor.tsx:204) e no gatilho da questão (TabelaQuestoes.tsx:296), com teste travando (`TabelaQuestoes.test.tsx:124` espera `fontFamily` contendo 'Roboto Mono'). Sobram dois pontos que usam a classe `font-mono`: DistribuicaoAlternativas.tsx:152 (o % por alternativa) e ComparativoSimulados.tsx:317 (os três valores grandes do card). `tailwind.config.ts:30-33` estende `fontFamily` só com `sans` e `display` — não há chave `mono`, então `font-mono` cai na pilha padrão do Tailwind (`ui-monospace, SFMono-Regular, Menlo, …`), que nunca tenta Roboto Mono. Nota lateral: o comentário de TabelaGestor.tsx:26-31 está desatualizado, diz que `--gp-font-mono` não existe, mas ele existe em gestor-theme.css:88.
- **Fazer:** Trocar a classe `font-mono` por `style={{ fontFamily: FONTE_MONO }}` em DistribuicaoAlternativas.tsx:152 e ComparativoSimulados.tsx:317 (ou registrar `mono: ['Roboto Mono', ...]` em tailwind.config.ts, o que corrigiria os dois de uma vez).

**DistribuicaoAlternativas.tsx** · esforço trivial  
Marcação da alternativa correta usava ícone Check do lucide na letra; a referência usa o caractere ✓ no percentual

- **Hoje:** A violação de ícone acabou: não há mais import de `lucide-react` no arquivo (:1-3 importam só `cn`, `formatPct` e o tipo `Alternativa`), e a correta é marcada por cor de sucesso (`COR_TEXTO.correta = var(--gp-success-on)`, :34) mais o rótulo por extenso "· alternativa correta" na lista de alternativas (:88). O que falta é o "✓" no percentual da lista de distribuição: :151-156 imprime só `formatPct(alt.marcadaPct)`, então nessa segunda lista a correta se distingue apenas por cor e peso — a referência imprime `24% ✓` (LIGHT.html, bloco "Distribuição por alternativa").
- **Fazer:** Em DistribuicaoAlternativas.tsx:155, anexar `{alt.correta ? ' ✓' : ''}` depois de `formatPct(alt.marcadaPct)` — caractere, não glifo; os testes usam substring (`TabelaQuestoes.test.tsx:223` checa '31%') e continuam passando.

**TabelaAlunos.tsx** · esforço trivial  
Truncamento com tooltip nas células de texto das tabelas (transversal)

- **Hoje:** Resolvido nas duas tabelas de aluno: TabelaAlunos.tsx:307-313 (`title={linha.nome}` + `className="block max-w-[220px] truncate text-left"`) e TabelaAlunosSimulado.tsx:202-219 (mesmo par title+truncate nos dois ramos, botão e span). Residual só em TabelaQuestoes.tsx:313-315 — `<Celula>{q.grandeArea}</Celula>`, `{q.especialidade}`, `{q.tema}` sem truncate e sem title, e o lote de TabelaQuestoes NÃO tem item equivalente (seus 9 itens são filtro, linha expandida, colunas, paginação e FLIP), então se este item morrer aqui o achado se perde.
- **Fazer:** Aplicar `title` + `truncate`/`max-w-*` só nas células Grande área, Especialidade e Tema de TabelaQuestoes.tsx:313-315; as duas tabelas de aluno já estão prontas.

**TabelaAlunosSimulado.tsx** · esforço trivial  
Linha de quem não participou não é atenuada por inteiro

- **Hoje:** TabelaAlunosSimulado.tsx:186-243 — não há nenhuma condicional por `a.participou`. O que melhorou: `Celula ausente` (L222/225/228/235) já joga o `—` em `var(--gp-text-3)` (TabelaGestor.tsx:206), então o traço não lê mais como nota. Continua divergente o nome (L207/215, `var(--gp-text-1)`) e o Semestre preenchido, que permanecem na cor cheia — a referência atenua a linha inteira do não participante.
- **Fazer:** Em TabelaAlunosSimulado.tsx:186-243, quando `!a.participou`, passar `ausente` (ou `color: var(--gp-text-3)`) também nas células de nome e semestre, deixando a linha toda em text-3.

**sheet.tsx** · esforço medio  
Drawer entra em 500ms com translação de 100% da largura e sem fade; handoff pede motion-4 (320ms), translateX(16px) + fade, scrim escurecendo em paralelo.

- **Hoje:** src/components/ui/sheet.tsx:32 — `sheetVariants` ainda é `"... transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500"`, e o side `right` (linha 41) usa `slide-in-from-right`/`slide-out-to-right` sem valor (= 100% no tailwindcss-animate), sem `fade-in-0` no painel. O overlay (sheet.tsx:22) tem `fade-in-0` sem duração, caindo nos 150ms default do plugin. Nenhum dos quatro consumidores do gestor sobrescreve duração ou keyframe: DrawerAluno.tsx:300 (`className="flex w-full flex-col gap-4 overflow-y-auto p-[22px] sm:max-w-[392px]"`), DrawerTemas.tsx:119, Detalhamento.tsx:328, Glossario.tsx. Em gestor-theme.css só existe o bloco `prefers-reduced-motion` (linhas 202-211); `grep` por `keyframes|translateX|animation` fora dele não acha nada. Os tokens existem sem uso: `--gp-motion-4: 320ms` (gestor-theme.css:80).
- **Fazer:** Em gestor-theme.css, dentro do escopo `.gestor-portal`, sobrescrever a animação do painel de Sheet para `320ms` com keyframe próprio (`translateX(16px)` + `opacity 0→1`, curva de entrada `cubic-bezier(0,0,0,1)` e de saída `cubic-bezier(0.4,0,1,1)`) e dar ao scrim a mesma duração, para os dois escurecerem em paralelo — CSS escopado, nunca `duration-[320ms]` (classe arbitrária é proibida pelo guard), e sem tocar no default de aluno/admin, que não montam no container do shell.

## Não mexer — conflita com decisão ratificada

Três destes são **o handoff estando errado**, não o código. Forçar o valor do handoff seria
regressão de acessibilidade:

- **`gestor-theme.css`** — Pôr --gp-text-inverse em #111212 no escuro quebraria as três pastilhas invertidas que, por decisão registrada, viram MARCA no escuro
- **`gestor-theme.css`** — Forçar #899090 em --gp-text-3/--gp-axis derruba o texto terciário de 4,83:1 para 3,25:1 — reprova AA, exatamente o caso que a decisão 3 protege
- **`gestor-theme.css`** — Baixar o anel de foco de 35% para os 16% do handoff torna o foco quase invisível — regressão de acessibilidade, e o 0.35 vem do plano registrado
- **`TabelaQuestoes.tsx`** — Revelação em cascata na montagem e reordenação FLIP com Framer Motion
- **`DistribuicaoAlternativas.tsx`** — Chip "distrator dominante" não existe na referência (o sinal seria cor da barra + legenda) e usava raio 4px
- **`TabelaAlunosSimulado.tsx`** — Células numéricas e Semestre alinhadas à direita, contra as divs à esquerda da referência
- **`EvolucaoChart.tsx`** — Séries com isAnimationActive={false} — nenhum gráfico anima na montagem
- **`AcertoPorAreaESemestre.tsx`** — Barras em bg-primary/bg-destructive em vez da rampa neutra e do #DCA039 da referência

As decisões que os sustentam: gráfico com **3 modos**; proficiente **`>= 60`**; desvios de hex por
**contraste WCAG AA** ficam; sidebar **240px**; gráficos sem animação de entrada; movimento em CSS,
sem Framer Motion no portal.

## Lacuna de cobertura desta triagem

**10 itens Média não foram triados** — erro de particionamento: estes
arquivos ficaram fora dos 8 lotes. Cada um tem 1 item. Triar antes de decidir:

- `src/features/gestor/charts/DispersaoChart.tsx`
- `src/features/gestor/components/AvisosSanar.tsx`
- `src/features/gestor/components/BadgeStatus.tsx`
- `src/features/gestor/components/BlocoInsights.tsx`
- `src/features/gestor/components/ChipNivel.tsx`
- `src/features/gestor/components/GestorSkeleton.tsx`
- `src/features/gestor/components/KpisVisaoGeral.tsx`
- `src/features/gestor/components/SaudacaoGestor.tsx`
- `src/features/gestor/routes/Inicio.tsx`
- `supabase/migrations/20260804174000_get_gestor_visao_geral_multicontrato_dedup_nivel.sql`

## Insumo

Os itens completos, por arquivo, estão em
`.claude/projects/<sessão>/workflows/medias/` (`_indice.json` mapeia arquivo → JSON).
O relatório da auditoria completa é `docs/auditoria-conformidade.md`.

