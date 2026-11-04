# Handoff: Portal do Mentor · B2C (Tribos) e B2B (Instituições)

> **Para o Claude Code:** comece por `CLAUDE.md` e siga `docs/08-plano-de-execucao.md` fase a fase.

SanarFlix Academy · Mentoria PRO ENAMED · versão de 04/11/2026

## Visão geral

Duas experiências do Portal do Mentor dentro da SanarFlix Academy:

- **Mentor B2C**: o mentor de uma tribo (Carcará, Camaleão, A Colmeia, Octopus) acompanha alunos individuais. O que importa é a distância de cada aluno até o corte da vaga que ele quer, o engajamento, as reuniões e os encontros mensais da tribo.
- **Mentor B2B**: o mentor de uma IES (exemplo: UniAtenas Paracatu) acompanha a turma com foco institucional: conceito ENAMED previsto, TRI projetado (proficiência média), alunos proficientes, temas críticos, sessões quinzenais (pós-simulado e oficina) e os canais da IES.

As duas usam o mesmo shell, o mesmo sistema visual e os mesmos componentes base. O que muda são os indicadores, as prioridades e as telas específicas de cada modalidade.

## Sobre os arquivos de design

Os arquivos em `prototipos/` são **referências de design feitas em HTML**: protótipos navegáveis que mostram aparência e comportamento. **Não são código de produção para copiar.** A tarefa é recriar essas telas na aplicação real (`felipesanar/sanarflix-study-guide`, React + Tailwind + tokens do Portal do Gestor), seguindo os padrões e componentes que já existem lá.

Regra principal: **onde houver componente equivalente no Portal do Gestor (`src/features/gestor`), use o componente do Gestor e estenda por props.** Os protótipos recriaram esses componentes a partir da leitura do código, mas só o `SeletorSimulados` foi conferido linha a linha. Na dúvida entre o protótipo e o componente do Gestor, vale o componente do Gestor; a lista do que foi conferido está em `docs/04-reuso-gestor.md`.

Para abrir os protótipos: sirva a pasta `prototipos/` em um servidor local (ex.: `npx serve prototipos`) e abra `Mentor B2C.dc.html` ou `Mentor B2B.dc.html`. Os arquivos dependem de `support.js`, `icons.js`, `brand/` e `public/` na mesma pasta.

## Fidelidade

**Alta fidelidade.** Cores, tipografia, espaçamentos, estados e interações são finais, salvo os itens marcados "a validar" em `docs/05-decisoes-e-pendencias.md`. Os dados são fictícios mas coerentes entre telas; nenhum número dos protótipos deve ir para produção.

## Índice

| Documento | Conteúdo |
|---|---|
| `docs/01-fundamentos.md` | Tokens, tipografia, espaçamento, shell (sidebar, header mobile), padrões de componentes, estados globais, responsividade, acessibilidade |
| `docs/02-mentor-b2c.md` | Telas do B2C: Início, Minha Turma, Detalhamento, Mural, Sessões, Intervenções, drawers |
| `docs/03-mentor-b2b.md` | Telas do B2B: Início, Visão Geral, Detalhamento, Sessões, Canais, Intervenções, drawer |
| `docs/04-reuso-gestor.md` | Mapeamento componente do Mentor → componente do Gestor (reaproveitar, estender ou criar) |
| `docs/05-decisoes-e-pendencias.md` | Regras de negócio, definições de métricas, divergências entre fontes e decisões que dependem de validação |
| `docs/06-dados-e-estado.md` | Modelos de dados sugeridos, estado de cada tela, eventos que geram intervenções, endpoints necessários |
| `prototipos/Evolução do Produto.dc.html` | 18 propostas de evolução (fora do escopo deste handoff, para priorização) |
| `docs/07-integracao-flix.md` | O que vem do Flix, o que fica no Academy, mapeamento tela → endpoint, erros e estados que dependem da API |
| `docs/08-plano-de-execucao.md` | Plano 1:1 em 8 fases, com critério de aceite e captura de referência por tarefa |
| `CLAUDE.md` | Regras inegociáveis e ordem de leitura para o Claude Code |
| `capturas/INDICE.md` | 40 capturas reais (B2C e B2B): telas completas, drawers, validações, estados vazio/erro/carregando/V0 e mobile 390px |
| `codigo/README.md` | Código TS/React de referência que importa os componentes reais do Gestor: tipos, regras com testes, eventos do kanban, componentes-chave, rotas, queries e esboço SQL. Inclui um prompt sugerido para o Claude Code |

## Ordem de implementação

Ver `docs/08-plano-de-execucao.md`: Base → Shell → Detalhamento → Turma → Início → Intervenções → Mural/Sessões/Canais → Fechamento.


## Assets

| Arquivo | Uso | Origem |
|---|---|---|
| `prototipos/public/sanarflix-academy-lockup.svg` | Logo da sidebar (30px) e do header mobile (24px) | Repositório `public/` |
| `prototipos/brand/brasao-{tribo}.png` | Brasão completo (reserva; a faixa atual usa o ícone) | Pacote "A Seleção", `assets/b2c/png/*-4x.png` |
| `prototipos/brand/icone-{tribo}.png` | Cartão da sidebar (36px), faixa do Início (40px), mural (24px), drawer (20px) | Pacote "A Seleção", `*-256.png` |
| `prototipos/brand/mentor-{nome}.png` | Avatar do mentor B2C (34px, `object-position: 50% 20%`) | Pacote "A Seleção", `prototipos/assets` |
| `prototipos/brand/icone-uniatenas.png`, `selo-paracatu.png`, `uniatenas-tocha.png`, `uniatenas-logo-preto.png` | Identidade da IES no B2B | Pacote "A Seleção", `assets/b2b-uniatenas` |
| Ícones | Lucide (`lucide-react`, já no repo) | `prototipos/icons.js` só reproduz os traçados para o protótipo; não usar |

Em produção, brasões, ícones e selos devem vir do cadastro da tribo/IES, não de caminhos fixos.

## Arquivos

- `prototipos/Mentor B2C.dc.html`: todas as telas B2C, com interações e estados
- `prototipos/Mentor B2B.dc.html`: todas as telas B2B, com interações e estados
- `prototipos/Evolução do Produto.dc.html`: backlog de propostas
- `prototipos/support.js`: runtime dos protótipos (não faz parte do produto)
- A tela "Notas de handoff" dentro de cada protótipo resume as decisões; a versão completa está em `docs/05`.

## Fontes usadas no design

- Repositório `felipesanar/sanarflix-study-guide@main`: `docs/handoff/gestor/tokens/tokens.light.css`, `src/index.css`, `tailwind.config.ts`, `src/features/gestor/lib/regras.ts`, `src/features/gestor/lib/rotulos.ts`, `src/features/gestor/components/*` (KpiCard, KpisVisaoGeral, KpisDetalhamento, SeletorSimulados).
- Handoff "Página do Mentor" (06/10), telas 00 a 07b, com as decisões em aberto 1 a 8.
- Slack, DM Léo Peixoto × Felipe Souza: síntese de 30/09 e o pedido de adaptações do B2B de 14/10.
- Notion: "Novo planejamento pedagógico B2B SanarFlixPRO ENAMED" (11/10), "Criar o glossário Entenda as métricas" (Task 30b), "Operação CX · Mentoria SanarFlix PRO: ENAMED 2027".
- Pacote de marca "A Seleção" (brasões e ícones das tribos, identidade UniAtenas).
- **Não acessados**: Guia do Mentor (Notion). Validar regras do B2C contra ele antes de fechar.
