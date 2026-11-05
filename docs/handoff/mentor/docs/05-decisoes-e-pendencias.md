# 05 · Regras, decisões e pendências

## Definições de métricas

| Métrica | Definição | Modalidade | Tipo |
|---|---|---|---|
| Percentual de acerto | Questões certas ÷ respondidas; questão anulada fica fora | Ambas | Observado |
| Acerto médio do recorte | Média ponderada pelos participantes de cada simulado selecionado | Ambas | Observado |
| Possível aprovação / Acima do corte | % de participantes com acerto ≥ corte da **meta mais difícil** do aluno (Metas). Comparativo só com 2+ simulados | B2C | Observado (depende de Metas: V1) |
| vs corte | Acerto do aluno no último simulado − corte da meta (p.p.) | B2C | Observado |
| Conceito ENAMED previsto | Projeção institucional 1 a 5, derivada do % de proficientes no simulado. Com 2+ simulados: comparativo, nunca média | B2B | **Projetado** |
| TRI projetado | Proficiência média dos participantes, escala TRI 0 a 100 (ver D1) | B2B | **Projetado** |
| Proficiente | Proficiência ≥ 60 (`PROFICIENCIA_MINIMA`) | B2B | Observado |
| Nível de acerto (Gestor) | Crítico < 50 · Mediano 50–79 · Excelente ≥ 80 | B2B, drawer de área | — |
| Régua da matriz B2C | ≥ 78 verde · 66–77 âmbar · < 66 vermelho | B2C | — (ver P3) |
| Prevalência | Peso do tema na prova: Alta 62% · Média 28% · Baixa 10% | Ambas | — |
| Tema crítico | 30+ respostas da turma no recorte; B2B: acerto < 50% | Ambas | Observado |
| Impacto do tema | Peso (Alta 3 · Média 2 · Baixa 1) × (100 − acerto) | B2B | Derivado |

**Regras transversais**
- `null` nunca vira zero: mostrar `—` e tirar das médias.
- Delta e régua 1º · anterior · atual só com 2 pontos válidos.
- Projeção sempre com selo/marcador "projetado" e, no bloco principal, o aviso "não é resultado oficial do INEP".
- Um aluno pode estar em mais de um alerta.

## Alertas e perfis

| Nome | Regra | Modalidade |
|---|---|---|
| Sumiram / Sem acesso recente | Sem atividade há 15 dias ou mais | Ambas |
| Esfriando | Sem atividade entre 8 e 14 dias | B2C (V0) |
| Regrediram | Queda ≥ 5 p.p. de acerto entre os 2 últimos simulados | B2C |
| Estagnados | Variação < 2 p.p. nos 3 últimos simulados | B2C |
| Não fizeram o simulado | Sem participação no último simulado fechado | B2C |
| Potencial de virada | Proficiência 52–59 no último simulado (ver P4) | B2B |
| Desempenho muito baixo | Proficiência < 45 ou queda ≥ 5 pontos | B2B |
| Desempenho muito bom | Proficiência ≥ 70 nos 2 últimos simulados | B2B |

## Decisões tomadas no design

| # | Decisão | Motivo |
|---|---|---|
| D1 | "TRI projetado" = proficiência média, escala TRI 0–100 | O Léo pediu "TRI projetado"; o glossário do Gestor eliminou "Nota TRI" como métrica separada. Foi usado o nome que o Léo pediu sobre a métrica que já existe |
| D2 | "Nota ENAMED prevista" = Conceito ENAMED previsto (1–5) | É o indicador que o Gestor já calcula |
| D3 | "Sumiram" = 15 dias em todas as telas | O handoff usava 10 dias na home e 15 na turma; os números precisam bater |
| D4 | ~~B2C não usa "canal"~~ **Revisto (13/10 e 22/10):** B2C e B2B têm 3 canais: Grupo de avisos e Plantão de dúvidas (links gerais, fixos) e Grupo da tribo/turma (único editável pelo mentor) | Reuniões de integração Mentorado × Academy |
| D5 | "Coletiva" no B2C se chama "Encontro da tribo" | O CX promete 1 encontro mensal exclusivo por tribo |
| D6 | Identidade de tribo só em 4 pontos (faixa, sidebar, mural do aluno, drawer) | Ferramenta de trabalho; a identidade complementa e não domina |
| D7 | Projeção e observado separados em blocos distintos na Visão Geral | Evitar que a IES leia projeção como resultado |
| D8 | Mentor B2B tem menu próprio, reaproveitando telas do Gestor recortadas | Segue o handoff de 06/10 (ver P8) |

## Pendências que dependem de validação

| # | Questão | Hipótese adotada | Impacto | Com quem |
|---|---|---|---|---|
| P1 | Evento de "último acesso": login ou última atividade de estudo? | Última atividade de estudo | Alertas Sumiram/Esfriando | Dados (Therlyson) |
| P2 | Tags do mural: 3 (handoff) ou 4 (síntese de 30/09, com "Novidade")? | 3 | Composer e filtros | Léo |
| P3 | A matriz B2C usa a régua 78/66 ou a do Gestor (50/80)? | 78/66 no B2C, Gestor no B2B | Cores da matriz | Produto |
| P4 | Corte do perfil "Potencial de virada" | 52–59 | Fila de prioridade B2B | Coordenação pedagógica |
| P5 | Faixas do conceito ENAMED (quantos proficientes para cada conceito) | Não exibido | Impede "faltam X alunos para o conceito 4" | Regra de `get_gestor_visao_geral` |
| P6 | Meta mensal de intervenções (medidor de 15) | 15/mês | Medidor do kanban | Coordenação de mentores |
| P7 | O log de atividades B2B (hoje no Notion) passa a ser o Academy? | Sim: rotina + kanban viram o log | Fluxo da coordenação | Coordenação pedagógica |
| P8 | Mentor B2B dentro do Portal do Gestor (síntese de 30/09) ou com menu próprio (handoff de 06/10)? | Menu próprio | Rotas e permissões | Léo / Felipe |
| P9 | ~~Turma B2B = IES ou recorte?~~ **Resolvido (22/10):** alocação por contrato (campus ou ano); aluno B2B não escolhe nem troca | — | — | — |
| P10 | Sessão cancelada: existe? | Não desenhado | Status de sessão | CX |
| P11 | Presença em sessão | Não exibido (sem dado no Academy) | — | Dados |
| P12 | Regras do Guia do Mentor (Notion) | Não consultado | Validar alertas e fluxos B2C | Produto |
| P13 | Contrato com regra própria (USCS: semanal, 1 pós, 1 oficina, 2 discussões) | Parametrizar `contrato.encontrosPorMes` e os tipos | Faixa de ciclo e aviso de excesso | CS B2B |
| P14 | O Meet preserva nome/ID do encontro no arquivo do Drive? | Gravação ligada por automação na conta organizadora da Sanar; fallback manual | Estado "Aguardando gravação" pode ficar preso | Tech (22/10) |
| P15 | Notificação push para aluno quando houver mural/sessão | Fora do escopo | — | Flix (13/10) |

## Ajustes das reuniões (13/10 e 22/10)

| Tema | Regra | Onde mudou |
|---|---|---|
| Semestre | Só existe para B2B (dado da compra). No B2C, não exibir | Minha Turma, Visão de alunos, drawer B2C |
| Consumo por aluno | Questões, acerto em questões, aulas e PDFs (DAGs de questões e conteúdos; backfill jan/25 →) | Drawer B2C e B2B; coluna "Questões · acesso" na Turma |
| Acervo | Só coletivas gravadas; individuais fora. Gravação ligada automaticamente | Sessões B2C e B2B |
| CRUD | Mural e sessões: criar, editar, excluir | Mural (Editar/Excluir), Sessões (excluir futura) |
| Mentores | Tabela de mentores nova; pode haver mais de um mentor por tribo e troca de mentor | Modelo de dados |
| Alocação B2C | Aluno escolhe a tribo no onboarding; troca só via CX | Fora da página do mentor |
| Feature toggle | Tudo sobe para produção sob toggle | Implementação |
