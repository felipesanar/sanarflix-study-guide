# 01 · Fundamentos

## Tokens

Todos vêm de `docs/handoff/gestor/tokens/tokens.light.css` e `src/index.css`. Use as variáveis/classes Tailwind existentes; os hex abaixo servem só de conferência.

### Cores

| Papel | Token Gestor | Hex |
|---|---|---|
| Marca | `--gp-brand` | `#B81414` |
| Marca forte (hover de link) | `--gp-brand-strong` | `#660000` |
| Superfície de marca | `--gp-brand-surface` | `#FCE3E3` |
| Superfície de marca suave (item ativo, linha selecionada) | `--gp-brand-surface-soft` | `#FFF7F7` |
| Borda de marca | `--gp-brand-border` | `#F3C9C9` |
| Botão primário (`--primary`, `hsl(0 65% 35%)`) | `bg-primary` | `#941F1F` · hover `#7A1818` |
| Fundo do app | `--gp-bg-app` | `#EDEEF0` (protótipo usa `#F4F5F6` no `main`; seguir o Gestor) |
| Superfície 1 / 2 / 3 | `--gp-surface-*` | `#FFFFFF` / `#F9FAFB` / `#F4F5F6` |
| Borda forte / sutil / input | `--gp-border-*` | `#E9EBED` / `#F1F2F4` / `#C3C6C6` |
| Texto 1 / 2 / 3 | `--gp-text-*` | `#111212` / `#414141` / `#899090` |
| Sucesso: base / texto / superfície | `--gp-success*` | `#149142` / `#0C5728` / `#E7F4EC` |
| Atenção | `--gp-warning*` | `#D38808` / `#7F5205` / `#FBF3E6` |
| Perigo | `--gp-danger*` | `#C61D1D` / `#771111` / `#F9E8E8` |
| Informação | `--gp-info*` | `#0374AE` / `#024668` / `#E6F1F7` |
| Scrim de drawer/modal | — | `rgba(8,9,10,0.42)` |

**Regra de cor semântica (vale para as duas modalidades):** verde, âmbar e vermelho só aparecem para desempenho, engajamento e erro. Tipos de sessão e intervenção são ícone + texto neutro, nunca selo colorido. Vermelho de marca é reservado a ações primárias, item de menu ativo e seleção.

### Identidade das tribos (só B2C)

Só aparece na faixa do Início, no cartão da sidebar, no mural visto pelo aluno e na ficha do aluno. Nenhuma outra tela recebe cor de tribo.

| Tribo | Lema | Mentor | `sig` | `shadow` | `glow` |
|---|---|---|---|---|---|
| Carcará | Nota 90+ | Thiago Taniguchi | `#D9771F` | `#3A1405` | `#FFB547` |
| Camaleão | Faculdade e ENAMED em sincronia | Pedro Teixeira | `#1F9D6B` | `#0B3B2C` | `#5CF2B5` |
| A Colmeia | Constância e hábito | Letícia Lima | `#E0A526` | `#3B2A05` | `#FFE08A` |
| Octopus | Pouco tempo, muito foco | Júlia Mendonça | `#3B3FB8` | `#0D0F33` | `#8FA8FF` |

`sigA` = `sig` + alpha `0x73` (ex.: `#D9771F73`). Dourado de ação sobre fundo escuro: `#E8CD8F` (hover `#F2DCA6`), texto sobre ele `#1A0509`. Texto claro sobre a faixa: `#F4EDE4`, secundário `rgba(244,237,228,0.75)`.

### Identidade UniAtenas (só B2B)

Faixa do Início: `linear-gradient(100deg, #1A0A05 0%, #24100A 40%, #3A1203 100%)` + `radial-gradient(circle at calc(100% - 44px) 50%, rgba(248,148,28,0.30), transparent 130px)`, borda interna `inset 0 0 0 1px rgba(248,148,28,0.14)`. Ação primária `#F8941C` (hover `#FFA83D`, texto `#140803`); secundária texto `#FFD6A6`. Selo Paracatu 48×48 com a tocha (18px de altura) centralizada por cima. **Para outras IES:** parametrizar `iesTheme { fundo, acento, acentoHover, selo, logo }`, com os tokens do Academy como fallback quando a IES não tiver identidade cadastrada.

### Tipografia

Inter (400/500/600/700/800) e Roboto Mono (500/600, só em números de régua e códigos de questão). `-webkit-font-smoothing: antialiased`. Números em tabelas e indicadores: `font-variant-numeric: tabular-nums`.

| Uso | Tamanho / peso / tracking |
|---|---|
| Saudação do Início (sobre faixa) | 22px / 700 / -0.02em |
| H1 de tela | 24px / 700 / -0.02em (Detalhamento: 22px) |
| H2 de bloco | 15px / 650 (Detalhamento: 16px / 650, igual ao `BlocoGestor`) |
| H3 | 14px / 650 |
| Corpo | 14px / 400, line-height 1.45 |
| Corpo de tabela | 13–13.5px |
| Meta / legenda | 12–12.5px, cor texto 3 |
| Rótulo de coluna (Detalhamento) | 10.5px / 600 / uppercase / 0.06em, cor texto 3 |
| Eyebrow sobre a faixa (B2C) | 11px / 600 / uppercase / 0.16em, cor `glow` |
| Valor de KPI principal | **Produção: `KpiCard` do Gestor = 44px / 800 / -0.035em, line-height 36px; título 14/700; hint 11px; padding 18; gap 14.** Protótipos usam 28–34px; seguir o KpiCard |
| Valor de KPI secundário | 22–24px / 750 |
| Etiqueta (tag) | Protótipo: 11.5px / 600, padding 2px 7px, raio 5. **Produção: anatomias de `Tag.tsx`** (pílula, 11px; `qualificador` 9px/600 uppercase para "projetado"; `TagNivel`; `TagDelta`) |

### Espaçamento, raio e sombra

- Escala usada: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32px. Padding de bloco 16–20px; gap entre blocos 16–24px; `main` 28px 32px 64px.
- Raio: 6 (controle pequeno, célula), 8 (botão, input), 10 (item interno), 12 (bloco), 14 (faixa do Início, blocos do Detalhamento), pill (chips). Gestor: 8/12/16/pill.
- Sombra só em elementos elevados: drawer `-28px 0 64px -30px rgba(0,0,0,0.42)`, popover `0 24px 48px -20px rgba(0,0,0,0.35)`, toast `0 12px 32px -12px rgba(0,0,0,0.4)`. Blocos usam só borda `1px #E9EBED`.
- Movimento: 140ms `cubic-bezier(.2,0,0,1)` para hover/expansão; respeitar `prefers-reduced-motion` (sem transição).

### Ícones

Em produção, use o `Icon` do Gestor (`features/gestor/components/Icon.tsx`, dende-icons, nomes no estilo Material: `home`, `group`, `bar_chart`, `campaign`, `calendar_month`, `view_kanban`, `chat`, `expand_more`, `chevron_right`, `add`, `check`). Confira cada nome em `icon-names.ts`. Os protótipos desenham traçados Lucide (stroke 1.75, 13–18px) só como referência visual de tamanho e posição.

## Shell

```
┌ sidebar 248px fixa (sticky, 100vh) ┬ main (flex:1, max-width 1240px, centralizado) ┐
│ lockup SanarFlix Academy (30px)    │ [faixa de erro global, se houver]             │
│ cartão de contexto (tribo ou IES)  │ conteúdo da tela                              │
│ nav                                │                                               │
│ rodapé: perfil + sino              │                                               │
└────────────────────────────────────┴───────────────────────────────────────────────┘
```

- **Sidebar**: fundo `#FFFFFF`, borda direita `#E9EBED`, padding 22px 20px no topo.
- **Cartão de contexto**: B2C mostra ícone da tribo (36px) + "Tribo {nome}" 14/650 + lema 12px, sobre o fundo `shadow` da tribo, raio 12, padding 10px 12px, texto claro. B2B mostra ícone da IES (36px) + "UniAtenas · Paracatu" + "Sua turma · 186 alunos", com borda `#E9EBED` sobre fundo branco.
- **Item de nav**: padding 9px 10px, raio 8, gap 10, ícone 17px, 14px. Ativo: fundo `#FFF7F7`, texto `#941F1F`, peso 650, `aria-current="page"`. Hover: `#F4F5F6`. Rótulo de grupo "Minha mentoria": 11px / 600 / 0.06em, cor texto 3, padding 14px 10px 6px.
- **Badge de contagem** no item: 11px / 700, `#941F1F` sobre `#FCE3E3`, pill, padding 1px 7px. Só aparece com pendência real: Intervenções = cards em "A fazer"; Canais (B2B) = rotina do dia ainda não enviada.
- **Rodapé**: avatar 34px (foto do mentor no B2C, com anel de 2px na cor `sig`; iniciais no B2B), nome 13.5/600, papel 12px texto 3, botão de notificações. O link "Notas de handoff" dos protótipos **não vai para produção**.
- **Abaixo de 980px**: a sidebar vira drawer à esquerda (`position: fixed`, z-index 50, sombra `0 0 40px rgba(0,0,0,0.2)`) com scrim que fecha ao clicar. Aparece um header fixo no topo, 10px 16px, com botão de menu 36×36, lockup de 24px e contexto à direita ("Tribo X" / "UniAtenas · 186 alunos").

## Padrões de componentes

| Componente | Especificação |
|---|---|
| Botão primário | 36–38px de altura, padding 0 14–16px, raio 8, `#941F1F`/branco, 13–13.5px / 600, ícone 15–16px, gap 6–8. Hover `#7A1818` |
| Botão secundário | Mesma altura, fundo branco, borda `#E9EBED` (hover `#C3C6C6`), texto `#111212` |
| Botão de linha / ação de recorte | **Usar `AcoesRecorte` do Gestor**: raio 8, padding 8px 14px, 12px / 600, `#414141`, gap 6. Os protótipos usam 13px; seguir o Gestor |
| Link de ação | Sem fundo, `#941F1F`, 13px / 600, chevron à direita |
| Chip de filtro | 30–32px, pill, borda `#E9EBED`. Ativo: borda `#111212`, peso 650. Contagem em texto 3. Dot de 7px quando o filtro tem cor semântica |
| Segmented / tabs | Contêiner `#F4F5F6` com padding 3px e raio 8; item 28px com raio 6; ativo fundo branco (ou `#111212`/branco na variante escura usada em Intervenções e no Detalhamento). `role="tablist"` / `role="tab"` / `aria-selected` |
| Chip de filtro removível (vindo do Início) | 32px, pill, `#111212`/branco, botão × de 22px com `rgba(255,255,255,0.16)` |
| Tabela | Grid CSS (não `<table>`), cabeçalho `#F9FAFB` 12px / 600 `#414141`, linhas com borda superior `#F1F2F4`, hover `#F9FAFB`, linha selecionada `#FFF7F7`. Linha clicável inteira = `<button>`. `overflow-x: auto` no contêiner com `min-width` na tabela |
| Régua 1º · anterior · atual | 3 células iguais, borda `#F1F2F4`, raio 8; rótulo 10px texto 3, valor Roboto Mono 12.5px / 600; célula "Atual" com fundo `#FFF7F7`. **Só aparece com 2 ou mais pontos** |
| Selo "projetado" | 11px / 600, borda tracejada 1px `#C3C6C6`, raio 5, padding 1px 6px. Nos indicadores do Detalhamento, versão compacta: quadrado tracejado de 9px com `title="Projetado"` |
| Drawer | À direita, `min(520–560px, 100%)`, scrim `rgba(8,9,10,0.42)`, `role="dialog"` `aria-modal`, fecha por scrim, botão × (34–36px) e Esc |
| Toast | Embaixo no centro, `#111212`/branco, raio 10, 13.5px, ícone check, some em 3,2s, `role="status"` |

## Estados globais

| Estado | Comportamento |
|---|---|
| Carregando | Skeletons na anatomia dos blocos (`#E9EBED`, raio 12). Título da tela e ações continuam visíveis. **Usar `GestorSkeleton`** |
| Erro | Faixa no topo do `main`: `#F9E8E8`/`#771111`, raio 12, ícone de alerta, texto curto ("Não foi possível carregar os dados da turma.") e "Tentar novamente". Mural, Sessões e Intervenções continuam utilizáveis. **Usar `EstadoErro`** |
| Vazio | Texto curto centralizado + ação para limpar filtro quando houver. **Usar `EstadoVazio`** |
| Dado ausente | `null` nunca vira zero: mostrar `—` e tirar da média. Variação (delta) só com 2 pontos válidos |
| Sem simulado (B2C V0) | Ver `02-mentor-b2c.md` § Estados |

## Responsividade

- Grades de blocos usam `flex-wrap` com `flex: 2 1 520px` (principal) + `flex: 1 1 300px` (lateral). Abaixo de ~860px viram uma coluna.
- Faixas de KPI: `grid-template-columns: repeat(auto-fit, minmax(200–240px, 1fr))`, com divisória à esquerda.
- Tabelas largas rolam horizontalmente dentro do bloco; a página nunca rola na horizontal.
- Botões e chips: `white-space: nowrap`; grupos de ação com `flex-wrap`.
- Alvos de toque de pelo menos 32px no desktop e 44px no mobile.

## Acessibilidade

- Contraste mínimo 4.5:1 no texto. Na faixa escura do Início, o texto secundário usa no mínimo 75% de opacidade.
- Foco visível em todos os controles: anel de 2px `#941F1F` com offset 2px (o protótipo não desenha o foco; implementar).
- Expansíveis com `aria-expanded`; filtros com `aria-pressed`; switches com `role="switch"` + `aria-checked`; drawers com foco preso e retorno ao gatilho.
- Brasões e selos: `alt` descritivo onde identificam contexto, `alt=""` onde só decoram junto de texto equivalente.
