# 08 · Plano de execução 1:1

Roteiro em ordem para o Claude Code implementar no Academy. Cada etapa tem entrega, referência e **critério de aceite**. Uma etapa só está pronta quando a tela renderizada bate com a captura indicada, conferida lado a lado em 1380px e em 390px.

**"1:1" aqui significa:** mesma estrutura, hierarquia, ordem, textos, estados e comportamentos dos protótipos. Nos componentes que já existem no Gestor (KpiCard, Tag, BlocoGestor, tabelas, drawers), vale a medida do Gestor (docs/04). Isso é intencional e não conta como divergência.

## Como conferir

1. Abra o protótipo correspondente (`npx serve prototipos` → `Mentor B2C.dc.html` / `Mentor B2B.dc.html`) e a captura em `capturas/`.
2. Rode a tela real com dados de demonstração. Use o seed de `codigo/` ou faça mocks a partir das constantes dos protótipos, que estão no `<script data-dc-script>` de cada arquivo.
3. Compare em 1380px (desktop) e 390px (mobile): ordem dos blocos, textos, contagens, cores semânticas, estados vazios e ações disponíveis.
4. Percorra o fluxo descrito em "Interações" e confira cada toast e cada erro de validação.

## Fase 0 · Base (1 PR)

| # | Tarefa | Aceite |
|---|---|---|
| 0.1 | Copiar `codigo/src/features/mentor` para `src/features/mentor` | `tsc --noEmit` sem erro; nomes de ícone conferidos em `icon-names.ts` |
| 0.2 | Rodar `regrasMentor.test.ts` | `vitest` verde |
| 0.3 | Feature toggle `mentor_portal` (padrão desligado) | Sem o toggle, `/mentor` redireciona para a home |
| 0.4 | Edge Function `flix-mentoria-proxy` + secrets | Chamada a `/me` com um mentor de teste devolve 200 (ou mock local enquanto o proxy do Cloud não existir) |
| 0.5 | Migração do Academy (`2026xxxx_mentor_portal.sql`) + `registrar_evento_mentor` | Os testes de SQL criam e movem um card por `referencia_id` |
| 0.6 | Mock do Flix (MSW ou Edge Function em modo mock) com os dados dos protótipos | Todas as telas abrem sem o Flix real |

## Fase 1 · Shell

| # | Tarefa | Referência | Aceite |
|---|---|---|---|
| 1.1 | `MentorShell`: sidebar 248px, lockup, cartão de contexto, nav com grupo "Minha mentoria", rodapé com avatar e notificações | `capturas/b2c/01-inicio.png`, `b2b/01-inicio.png` · docs/01 § Shell | Item ativo `#FFF7F7`/`#941F1F`; badges só com pendência; B2C mostra o ícone da tribo sobre `shadow`; B2B mostra o ícone da IES |
| 1.2 | Header mobile < 980px + sidebar em drawer | `b2c/25-mobile-390-inicio.png`, `26-mobile-390-menu-aberto.png` | Scrim fecha o drawer; Esc fecha; foco preso |
| 1.3 | `mentorRoutes` + `SoModalidade` | `codigo/…/mentorRoutes.tsx` | Rota de outra modalidade redireciona para `/mentor` |
| 1.4 | Estados globais (erro, carregando) | `b2c/23`, `b2c/24`, `b2b/22`, `b2b/23` | Erro não bloqueia Mural, Sessões nem Intervenções |

## Fase 2 · Detalhamento por Simulados (B2C e B2B)

| # | Tarefa | Referência | Aceite |
|---|---|---|---|
| 2.1 | Página com `SeletorSimulados` (sem mudanças) | `b2c/09-detalhamento-seletor-aberto.png` | Padrão 4º+5º (B2C) / 3º+4º (B2B); sem seleção = erro "Escolha ao menos um simulado"; seleção vai para a URL `?s=` |
| 2.2 | `KpisDetalhamentoMentor` | `b2c/08`, `b2b/07` | Delta só com 2+ simulados; B2B com `badge="projetado"` |
| 2.3 | Acerto por prevalência (estender `AcertoPorAreaESemestre`) + drawer de grande área | `b2c/10`, `b2b/08` | Régua B2C 78/66 e B2B 80/50 (`tomCelula`) |
| 2.4 | Diagnóstico da IA (`BlocoInsights` + "Gerar de novo" + "Levar pro mural") | `b2c/08` | Skeleton durante a geração; "Levar pro mural" abre o Mural preenchido |
| 2.5 | Visão de alunos (`TabelaAlunosSimulado`) | `b2c/08`, `b2b/07` | B2C: abas por corte, coluna "Último acesso" (sem semestre). B2B: abas Proficiente, Potencial de virada e Abaixo do limiar |
| 2.6 | Questões (`TabelaQuestoes`) com bloco "Quem marcou X" | `b2c/08` | Q expandida mostra enunciado, alternativas, distribuição, alunos do distrator e as 2 ações; B2B com "Levar para a oficina" |

## Fase 3 · Turma

| # | Tarefa | Referência | Aceite |
|---|---|---|---|
| 3.1 | B2C Minha Turma: KPIs com régua, matriz com segmented, `TemasCriticos`, tabela de alunos | `b2c/02-minha-turma.png` | Coluna "Questões · acesso" (sem semestre); vindo de um alerta, chip removível e lista filtrada (`b2c/03`) |
| 3.2 | B2C sem simulado (V0) | `b2c/20`, `21`, `22` | Segmentos de engajamento; "Aguardando Metas"/"Sem dado"; Detalhamento vazio |
| 3.3 | B2B Visão Geral: período, projeção × observado, gráfico, `TemasCriticos` (expansão), alunos | `b2b/02`, `03`, `04`, `05`, `20`, `21` | "Mostrar mais 5 (faltam N)"; "Recolher"; trocar filtro volta a 5; lista curta sem expansão; vazio com mensagem |
| 3.4 | Drawer do aluno B2C (estender `DrawerAluno`) | `b2c/04`, `04b`, `05`, `06` | Sem semestre; agenda exige mensagem (erro inline); Consumo no Flix; notas clicáveis abrem o Detalhamento |
| 3.5 | Drawer do aluno B2B | `b2b/06` | Orientação por perfil; "Sinalizar à IES" vira desabilitado depois de usado |

## Fase 4 · Início

| # | Tarefa | Referência | Aceite |
|---|---|---|---|
| 4.1 | `FaixaContexto` (tribo/IES) | `b2c/01`, `b2b/01` | Saudação por horário; marca à direita; empilha no mobile |
| 4.2 | Visão geral resumida (3 indicadores com divisória) | idem | B2B com marcador "projetado" em Conceito e TRI |
| 4.3 | `ListaPrioridades` | idem + `b2c/25` | Grupo vazio não aparece; avatares somem < 600px; clique filtra a turma |
| 4.4 | Próximas sessões + A fazer (B2C) / Grupo da semana (B2B) | idem | "Falta link" com ação; "Marcar enviado" no item do dia |

## Fase 5 · Intervenções

| # | Tarefa | Referência | Aceite |
|---|---|---|---|
| 5.1 | Kanban de 3 colunas + medidor + filtros | `b2c/16`, `b2b/13` | Card mostra tipo, data, título, para quem e origem |
| 5.2 | Drawer do card (status, ações, histórico, comentário) | `b2c/17` | Cada mudança de status entra no histórico |
| 5.3 | Eventos automáticos (`eventosIntervencao.ts`) | docs/06 § Eventos | Publicar, liberar agenda, criar sessão e marcar realizada criam ou movem o card certo |

## Fase 6 · Mural, Sessões, Canais

| # | Tarefa | Referência | Aceite |
|---|---|---|---|
| 6.1 | Mural B2C: composer, prévia ao vivo, Publicadas com Editar/Excluir | `b2c/11`, `11b`, `12`, `13` | Validações: título, mensagem, destinatários, título do link; editado mostra "· editada" |
| 6.2 | Canais da tribo (B2C, no Mural) | `b2c/11` | Avisos e Plantão fixos (cadeado); grupo da tribo editável com validação `chat.whatsapp.com/` |
| 6.3 | Sessões B2C | `b2c/14`, `14b`, `15` | Excluir sessão futura; "Aguardando gravação" / "No acervo"; individual fora do acervo; lista de agendas liberadas |
| 6.4 | Sessões B2B (expansível, pauta, ciclo do contrato) | `b2b/09`, `09b`, `10` | Ordem cronológica; status derivado por `statusSessao`; aviso "acima do contrato" não bloqueia |
| 6.5 | Canais B2B: rotina do WhatsApp, Canais gerais, mural, comitê, banco de pérolas | `b2b/11`, `12` | "Marcar como enviado" grava em `mentor_rotina_envio`; a linha do mentor logado fica destacada no rodízio |

## Fase 7 · Fechamento

| # | Tarefa | Aceite |
|---|---|---|
| 7.1 | Responsividade de todas as telas em 1380, 1024, 768 e 390 | Sem rolagem horizontal da página; tabelas rolam dentro do bloco |
| 7.2 | Acessibilidade | Foco visível em todos os controles; `aria-expanded`, `aria-pressed`, `role="switch"`; drawers com foco preso e retorno ao gatilho |
| 7.3 | Integração real com o Flix (trocar o mock) | Todas as ações de docs/07 § Mapeamento funcionando contra o ambiente de homologação |
| 7.4 | Revisão de copy | Textos idênticos aos protótipos, exceto os marcados como pendência em docs/05 |

## Fora do escopo

- Página do Mentorado (Flix), que é implementada pelo time do Flix a partir do contrato.
- Aba Mentoria no SGI.
- "Evolução do Produto": backlog para priorização.
