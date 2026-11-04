# CLAUDE.md · Portal do Mentor (B2C e B2B)

Instruções para o Claude Code implementar este handoff no repositório `felipesanar/sanarflix-study-guide` (SanarFlix Academy).

## Leia antes de escrever código
1. `README.md`: visão geral, índice e ordem.
2. `docs/08-plano-de-execucao.md`: **siga as fases na ordem**. Cada tarefa tem critério de aceite e captura de referência.
3. `docs/01-fundamentos.md` (tokens, shell, padrões) e `docs/04-reuso-gestor.md` (o que reusar).
4. `docs/02` (B2C) ou `docs/03` (B2B), conforme a tela.
5. `docs/05` (regras e pendências), `docs/06` (dados e eventos), `docs/07` (API do Flix).

## Regras inegociáveis
- **Reuse o Gestor.** Se existe componente, regra ou formatador em `src/features/gestor`, importe e estenda por props. Nunca reimplemente corte, rótulo, cor semântica ou formatação.
- **Fonte de dados certa** (docs/07):
  - alunos, mural, sessões, convites e canais vêm do **Flix**, via `flixClient.ts`;
  - desempenho e consumo vêm das **DAGs**, via RPC do Supabase;
  - kanban, log, rotina e sinalizações ficam no **Supabase do Academy**.
- **Ordem das ações compostas:** Flix primeiro e, se der certo, o evento no Academy. Se o Flix falhar, não grave nada no Academy.
- **`null` nunca vira zero.** Mostre `—` e tire o valor das médias. Delta e régua só aparecem com 2 pontos válidos.
- **Projeção sempre marcada.** Conceito ENAMED e TRI projetado levam `badge="projetado"`.
- **Semestre só no B2B.**
- **Cor semântica só para desempenho, engajamento e erro.** Tipos de sessão e de intervenção são ícone + texto neutro.
- **Identidade de tribo/IES só em 4 lugares:** faixa do Início, cartão da sidebar, mural visto pelo aluno e drawer.
- **Tudo atrás do toggle `mentor_portal`.**

## Fidelidade
- Compare cada tela com `capturas/` (índice em `capturas/INDICE.md`) e com o protótipo aberto em `prototipos/` (`npx serve prototipos`).
- Textos são copiados **literalmente** dos protótipos.
- Nos componentes do Gestor, prevalecem as medidas do Gestor: por exemplo, o valor do KpiCard tem 44px, contra 34px nos protótipos.
- Os dados dos protótipos são de demonstração. Não leve números fixos para produção.

## Código de partida
`codigo/` traz tipos, regras com testes, eventos, cliente do Flix, queries, componentes-chave, rotas, migração e Edge Function. Ele **não foi compilado**: comece por `tsc --noEmit` e `vitest` (Fase 0).

## Quando houver dúvida
- Regra de negócio indefinida: consulte docs/05 § Pendências. Se não estiver lá, implemente a hipótese descrita no doc da tela e deixe `// TODO(P#)`.
- Divergência entre protótipo e doc: vale o doc mais recente (docs/05 § Ajustes das reuniões).
- Divergência entre doc e contrato da API: vale a página do Notion do contrato (link em docs/07).
