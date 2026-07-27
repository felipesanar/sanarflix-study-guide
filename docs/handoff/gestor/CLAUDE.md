# CLAUDE.md — Contrato de trabalho: Portal do Gestor (SanarFlix Academy)

Leia este arquivo inteiro antes de escrever a primeira linha de código. Depois leia, nesta ordem:
`docs/02-regras-de-negocio.md` → `docs/09-contratos-api.md` → `docs/05-telas.md` → `docs/04-componentes.md`.

---

## 1. Missão

Implementar o **novo Portal do Gestor** no codebase existente do SanarFlix Academy, com qualidade de produção: sem regressões, sem bugs de estado, sem vazamento de dados entre instituições, acessível (WCAG 2.1 AA) e performático.

Os arquivos em `design/` são **referência visual**, não código. Recrie as telas com os componentes e padrões do repositório + Dendê Design System.

---

## 2. Regras inegociáveis (violar = PR rejeitado)

1. **Multi-tenant é assunto de backend.** Toda query é escopada pela IES do usuário autenticado no servidor. O `iesId` do cliente é *hint de UI*, nunca autorização.
2. **Nunca invente número.** Se o backend não mandou, a UI mostra `—`, "sem dados" ou o estado de carregamento — jamais zero, média improvisada ou valor extrapolado.
3. **Agregação honesta.** Com 2+ simulados selecionados: uma coluna por simulado. Nunca uma média única que dissolva simulados diferentes. "Variação" só para aluno que participou de ambos.
4. **Nunca "todos os simulados"** no Detalhamento. Seleção explícita de 1 ou mais.
5. **Escalas fixas**: proficiência 0–100 · Nota TRI 0–100 · Conceito ENAMED projetado 1–5 (nunca média de conceito). Áreas, especialidades e temas usam **% de acerto**, nunca proficiência.
6. **Sem TRI na Visão Geral.** TRI só existe por simulado, no Detalhamento.
7. **Semestre = período do aluno** (1º…12º), nunca semestre-calendário. O filtro persiste entre telas.
8. **Sem linguagem de aluno** ("estude", "revise seu ponto fraco") e **sem checklist de pendências** em nenhuma tela.
9. **Nenhum hex solto.** Cor, espaço, raio, sombra e duração saem de token (ver `tokens/`).
10. **Nada de `scrollIntoView`**, nada de manipular DOM por fora do React, nada de `dangerouslySetInnerHTML` com conteúdo de API.

---

## 3. Como trabalhar

- **Uma fase por PR**, na ordem de `prompts/`. Cada PR precisa passar em lint + types + testes + a checklist de `docs/12-qa-e-definicao-de-pronto.md`.
- **Fase 0 primeiro** (tokens, tipos, mocks, layout). Não comece por tela.
- **Antes de criar um componente, procure no repositório e no Dendê.** Só crie se não existir. Se existir parecido, estenda — não duplique.
- **Sempre implemente os estados**: `loading` (skeleton que reserva a altura final), `empty`, `error` (com "Tentar novamente"), `partial`, `low_sample`, `no_permission`. Componente sem estados não está pronto.
- **Todo texto em pt-BR**, tom Dendê: direto, segunda pessoa (`você`), sentence case, verbo primeiro no CTA, sem emoji, sem exclamação.
- **Números**: locale `pt-BR`, `font-variant-numeric: tabular-nums`, alinhados à direita em tabela. Datas `dd/MM/yyyy`, horas `HH:mm`.
- Ao terminar cada fase, rode a **auditoria de consistência**: o mesmo componente idêntico onde aparecer, mesmos espaçamentos, mesmos rótulos.

---

## 4. Quando houver dúvida

| Situação | O que fazer |
|---|---|
| Repositório e handoff divergem em **como implementar** | Segue o repositório |
| Repositório e handoff divergem em **o que a tela faz** | Segue o handoff |
| Falta um dado que a tela precisa | Não invente: use `—`/estado vazio e registre a pendência de API no PR |
| Regra ambígua | Escolha a leitura mais conservadora (a que não afirma nada além do dado) e documente no PR |
| Achou um bug fora do escopo | Não conserte junto: abra issue e siga |

---

## 5. Definição de pronto (resumo)

- Tipagem estrita, sem `any`, sem `@ts-ignore`.
- Sem `console.log`, sem código morto, sem `TODO` órfão.
- Testes: unidade dos formatadores e regras (proficiente > 60, variação só com ambos, ENAMED sem média), integração da tela com MSW, e2e do fluxo Início → Visão Geral → Detalhamento.
- A11y: teclado completo (drawer com trap e ESC), foco visível, contraste AA, gráfico com alternativa textual/tabular.
- Performance: tabela longa virtualizada, code-split por rota, sem re-render em cascata ao mexer no filtro.
- Nenhum dado sensível em log, telemetria, URL ou export sem permissão.

---

## 6. Comandos de verificação (rode antes de abrir PR)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Se algum desses comandos não existir no repositório, descubra o equivalente **antes** de programar e registre no PR.
