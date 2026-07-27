# Handoff — Novo Portal do Gestor · SanarFlix Academy

Pacote completo para implementação em produção. Foi escrito para ser lido por **Claude Code** e pelo **time de devs** sem precisar de contexto da conversa que gerou o design.

> **Comece por `CLAUDE.md`.** Ele é o contrato de trabalho do agente e do time: o que pode, o que não pode, e a ordem de execução.

---

## 1. O que é este produto

Portal do **Gestor acadêmico** de uma IES parceira do SanarFlix Academy. Ele responde, em segundos, "como minha instituição está indo nos simulados" e, em seguida, permite investigar até a questão e o aluno.

Princípio-guia: **uma persona, uma jornada; executivo antes de investigativo.**

Telas de produto:
1. **Início do Gestor** — orienta e direciona. A âncora é o **cronograma de simulados**.
2. **Visão Geral** — panorama executivo (4 indicadores) → Diagnóstico Curricular → Visão de Alunos.
3. **Detalhamento por Simulados** — camada investigativa, sempre por simulado selecionado.

---

## 2. Os arquivos de design são REFERÊNCIA, não código de produção

`design/gestor-sanarflix-LIGHT.html` e `design/gestor-sanarflix-DARK.html` são protótipos **de alta fidelidade**, autocontidos (abra no navegador, funcionam offline). Eles mostram aparência, copy e comportamento pretendidos.

**Não copie o HTML para o app.** A tarefa é **recriar estas telas no codebase real** (React + TypeScript + styled-components, consumindo o **Dendê Design System**), usando os componentes, tokens e padrões que já existem lá.

Os protótipos são um *board* com as telas lado a lado para revisão. Isso é andaime de apresentação — no app real cada tela é uma rota dentro do layout do gestor.

Fidelidade: **hifi**. Cores, tipografia, espaçamento, hierarquia, estados e microinterações são finais.

---

## 3. Índice do pacote

```
design_handoff_gestor_sanarflix/
├── README.md                      ← você está aqui
├── CLAUDE.md                      ← contrato de trabalho (LEIA PRIMEIRO)
├── docs/
│   ├── 01-contexto-e-jornada.md   Persona, jornada, o que cada tela resolve
│   ├── 02-regras-de-negocio.md    Invariantes, métricas, fórmulas, glossário
│   ├── 03-design-tokens.md        Cores, tipografia, espaço, raio, sombra, dark
│   ├── 04-componentes.md          Inventário: props, variantes, TODOS os estados
│   ├── 05-telas.md                Spec tela a tela, seção a seção
│   ├── 06-data-viz.md             Gráficos: eixos, séries, tooltip, vazios
│   ├── 07-motion.md               Durações, curvas, comportamentos, reduced-motion
│   ├── 08-arquitetura-frontend.md Rotas, estado, dados, performance, estrutura
│   ├── 09-contratos-api.md        Endpoints, payloads, flags, erros, paginação
│   ├── 10-seguranca-e-permissoes.md RBAC, multi-tenant, LGPD, export, auditoria
│   ├── 11-acessibilidade.md       AA, teclado, leitor de tela, gráficos
│   ├── 12-qa-e-definicao-de-pronto.md Casos de teste, DoD, matriz de estados
│   └── 13-plano-de-entrega.md     Fases, PRs, flags, rollout, telemetria
├── tokens/
│   ├── tokens.light.css           Custom properties (tema claro)
│   ├── tokens.dark.css            Custom properties (tema escuro)
│   └── tokens.json                Mesmos valores em JSON (Style Dictionary-friendly)
├── contracts/
│   ├── types.ts                   Tipos TypeScript da API (fonte da verdade da UI)
│   ├── openapi.yaml               Contrato dos endpoints
│   └── fixtures/                  Payloads de exemplo (mock/MSW/testes)
├── prompts/                       Prompts prontos por fase para o Claude Code
├── design/
│   ├── gestor-sanarflix-LIGHT.html   Protótipo hifi (tema claro), autocontido
│   ├── gestor-sanarflix-DARK.html    Protótipo hifi (tema escuro), autocontido
│   └── source/                       Fontes .dc.html (opcional, para inspeção)
└── assets/                        Logos SanarFlix Academy (SVG/PNG/motion)
```

---

## 4. Como usar com o Claude Code (caminho recomendado)

1. Copie a pasta inteira para a raiz do repositório alvo (ou para `docs/handoff/gestor/`).
2. Abra o repositório no Claude Code e mande ele **ler `CLAUDE.md` e `docs/02-regras-de-negocio.md` antes de escrever qualquer código**.
3. Rode as fases na ordem de `prompts/` — uma fase por PR. Não pule a fase 0 (fundação: tokens, tipos, mocks).
4. A cada fase, valide contra `docs/12-qa-e-definicao-de-pronto.md`.

Regra de ouro para o agente: **quando o código do repositório e este pacote divergirem em *como fazer*, vence o repositório. Quando divergirem em *o que a tela deve fazer*, vence este pacote.**

---

## 5. Stack alvo

- **React + TypeScript + styled-components**, multi-brand via `ThemeProvider` / `data-brand="flix"`.
- **Dendê Design System** (tokens + componentes). Nada de hex solto: use `var(--*)` / `theme.*`.
- **Ícones**: fonte Fontello do Dendê (`icon-dende-icons-<nome>-<filled|outlined>`). Glyph que faltar entra no Fontello — nunca SVG avulso.
- **Dados**: React Query (cache por filtro), MSW nos testes.
- **Gráficos**: Visx ou Nivo, temados pelos tokens. Os SVGs do protótipo são *spec visual*, não implementação.

---

## 6. Assets

`assets/academy/` traz o lockup oficial **SanarFlix Academy**:

| Arquivo | Uso |
|---|---|
| `lockup.svg` / `lockup.png` | Marca completa sobre fundo claro |
| `lockup-white.svg` / `lockup-white.png` | Marca completa sobre fundo escuro |
| `symbol.svg` / `symbol-white.svg` | Símbolo isolado (favicon, avatar, espaços estreitos) |
| `logo-anim-light.mp4` / `logo-anim-dark.mp4` | Assinatura animada (splash/hero); usar com `prefers-reduced-motion` |

Regras: nunca `filter: invert()`, nunca redesenhar o lockup, nunca aplicar sombra colorida na marca. Altura mínima do lockup na sidebar: **48px**.

Sem fotos e sem imagens de stock — o sistema é flat e institucional.
