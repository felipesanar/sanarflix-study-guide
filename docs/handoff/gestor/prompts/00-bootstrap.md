# Fase 0 — Bootstrap (sem escrever código de feature)

Você vai implementar o novo Portal do Gestor do SanarFlix Academy. Antes de programar, faça o reconhecimento.

**1. Leia, nesta ordem:**
- `design_handoff_gestor_sanarflix/CLAUDE.md`
- `docs/02-regras-de-negocio.md`
- `docs/09-contratos-api.md` + `contracts/types.ts`
- `docs/05-telas.md` e `docs/04-componentes.md`
- Abra `design/gestor-sanarflix-LIGHT.html` no navegador para ver o alvo visual.

**2. Mapeie o repositório e me diga:**
- Como o app organiza features, rotas e data fetching hoje (com caminhos de arquivo reais).
- Quais componentes do handoff **já existem** (tabela, drawer, tooltip, skeleton, paginação, segmented, chart) e onde.
- Como o Dendê é consumido aqui: tokens, `ThemeProvider`, ícones Fontello, tipografia.
- Se existe layout do gestor (sidebar) e o que falta nele.
- Comandos reais de lint, typecheck, test, build e storybook.
- Se existe suporte a tema escuro; se não, onde a camada de tema deveria entrar.

**3. Entregue um plano de implementação** em 8 fases (as de `prompts/`), com:
- o que reaproveita vs. o que cria (arquivo por arquivo),
- riscos e dependências de backend,
- o que precisa ser decidido com o time antes de codar.

**Não escreva código de feature nesta fase.** Saída esperada: relatório + plano.
