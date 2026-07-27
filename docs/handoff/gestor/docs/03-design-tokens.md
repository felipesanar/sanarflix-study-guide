# 03 · Design tokens

Os valores abaixo são os que o protótipo usa. **No app, use o token equivalente do Dendê** (`var(--*)` / `theme.*`). Os hex servem para conferência e para preencher lacunas do tema escuro (o Dendê ainda não define dark).

Arquivos prontos: `tokens/tokens.light.css`, `tokens/tokens.dark.css`, `tokens/tokens.json`.

---

## 1. Marca

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--brand` | `#B81414` | `#B81414` | Ação primária, seleção, destaque |
| `--brand-strong` | `#660000` | `#8F1414` | Hover de botão primário |
| `--brand-on-dark` | — | `#F0817D` | Texto/eyebrow de marca sobre fundo escuro (AA) |
| `--brand-surface` | `#FCE3E3` | `#2C1517` | Chip/avatar/realce de marca |
| `--brand-surface-soft` | `#FFF7F7` | `#221417` | Linha selecionada, card em foco |
| `--brand-border` | `#F3C9C9` | `#5A2426` | Borda de card em destaque |

Sobre fundo escuro **nunca** use `#B81414` como cor de texto — use `--brand-on-dark`.

## 2. Superfícies e texto

| Papel | Claro | Escuro |
|---|---|---|
| Fundo da aplicação | `#EDEEF0` | `#0B0C0D` |
| Superfície 1 (card) | `#FFFFFF` | `#17191A` |
| Superfície 2 (bloco interno) | `#F9FAFB` | `#1E2223` |
| Superfície 3 (chip/segmented) | `#F4F5F6` | `#23282A` |
| Divisor forte | `#E9EBED` | `#282C2D` |
| Divisor sutil | `#F1F2F4` | `#1F2323` |
| Borda de input | `#C3C6C6` | `#535959` |
| Texto primário | `#111212` | `#ECEFEF` |
| Texto secundário | `#414141` | `#B4B9B9` |
| Texto terciário | `#899090` | `#929999` |
| Texto sobre marca | `#FFFFFF` | `#FFFFFF` |

No escuro a elevação vem **da cor da superfície**, não de sombra. Nunca use preto puro (`#000`) como fundo de card.

## 3. Semânticos

| Papel | Claro (main / on / surface) | Escuro (main / on / surface) |
|---|---|---|
| Sucesso | `#149142` / `#0C5728` / `#E7F4EC` | `#33BB6A` / `#63D08D` / `#123326` |
| Alerta | `#D38808` / `#7F5205` / `#FBF3E6` | `#E7A63F` / `#E6A94F` / `#332811` |
| Erro | `#C61D1D` / `#771111` / `#F9E8E8` | `#EE4E4A` / `#F2857F` / `#331719` |
| Informação | `#0374AE` / `#024668` / `#E6F1F7` | `#40A9E0` / `#6FBBE3` / `#0F2A3A` |

## 4. Séries de gráfico (grande área)

| Série | Claro | Escuro |
|---|---|---|
| Clínica Médica | `#111212` | `#E6E9E9` |
| Cirurgia | `#0374AE` | `#40A9E0` |
| Gineco. e Obstetrícia | `#11A694` | `#2ED4BC` |
| Medicina Preventiva | `#6632DC` | `#AC8FF6` |
| Pediatria (crítica) | `#D38808` | `#E7A63F` |

Ordem fixa. A série crítica é a única que pode receber peso maior / halo.

## 5. Tipografia

- Família: **Inter** (400/500/600/700/800). Números em tabela: **Roboto Mono**.
- `font-variant-numeric: tabular-nums` em **todo** número.

| Papel | Tamanho / linha / peso |
|---|---|
| Título de tela | 28 / 32 / 700, `letter-spacing:-0.01em` |
| Título de seção | 15–16 / 22 / 700 |
| Corpo | 13 / 20 / 400 |
| Corpo secundário | 12 / 18 / 400 |
| Rótulo / caption | 11 / 16 / 500 |
| Overline (uppercase) | 10–11 / 14 / 700, `letter-spacing:0.05–0.08em` |
| Número protagonista | 40–44 / 34–38 / 800, `letter-spacing:-0.03em` |
| Número em card | 20 / 26 / 700 |

## 6. Espaço, forma e elevação

- Grade de **4px**. Padding de card **24px** (blocos internos 14–18px). Gap padrão entre cards **16px**; entre seções **24px**.
- Raio: **8–9px** (input, chip, botão), **12px** (bloco interno), **16px** (card), `10em` (pill).
- Borda: 1px (padrão), 1.5px (item selecionado). Nunca 3px.
- Sombra (claro): card `0 1px 2px rgba(17,18,18,.03), 0 14px 34px -22px rgba(17,18,18,.16)`; painel lateral `-12px 0 28px -20px rgba(17,18,18,.25)`; drawer `-28px 0 64px -30px rgba(0,0,0,.42)`.
- Sombra (escuro): mesma geometria com `rgba(0,0,0,…)`; a separação real vem do degrau de superfície.

## 7. Foco, hover e seleção

- **Foco**: anel de 3px da marca a 16% + borda de 1.5px. Sempre visível, inclusive no clique.
- **Hover**: card sobe 1px e ganha sombra + borda de marca; item de lista recebe tint da superfície 2. No escuro, hover **clareia** (nunca escurece).
- **Selecionado**: fundo `--brand-surface-soft` + barra de 3px da marca à esquerda (tabelas) ou pílula preenchida (segmented).
- **Desabilitado**: opacidade 0.5 + `cursor:not-allowed`, mantendo legibilidade mínima.

## 8. Motion (resumo — detalhe em `07-motion.md`)

`motion-1` 80ms · `motion-2` 140ms · `motion-3` 200ms · `motion-4` 320ms · `motion-5` 560ms.
Curva padrão `cubic-bezier(0.2,0,0,1)`; entrada `cubic-bezier(0,0,0,1)`; saída `cubic-bezier(0.4,0,1,1)`.
