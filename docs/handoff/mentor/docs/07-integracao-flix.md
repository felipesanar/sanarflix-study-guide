# 07 · Integração com o Flix (contrato de API)

**Fonte da verdade:** página do Notion [Contrato de API · Academy (Página do Mentor) × Flix (Página do Mentorado)](https://app.notion.com/p/408b3b75c7e181cd9d75cb8f9098dbca), v2.1, de 29/10. Este documento resume o que o Academy precisa saber para implementar. Se houver divergência, vale a página do Notion.

## Quem guarda o quê

| Dado | Dono | Como o Academy acessa |
|---|---|---|
| Mentores, tribos/turmas, aluno ↔ tribo | **Flix** (API de Mentoria) | `GET /me`, `GET /tribos/{id}/alunos` |
| Canais (avisos, plantão, grupo da tribo) | **Flix** | `GET/PUT /tribos/{id}/canais` |
| Mural (publicações, destinatários) | **Flix** | CRUD `/tribos/{id}/publicacoes`, `/publicacoes/{id}` |
| Sessões, gravação, acervo | **Flix** | CRUD `/tribos/{id}/sessoes`, `/sessoes/{id}` |
| Convites de agendamento | **Flix** | `/tribos/{id}/convites`, `/convites/{id}` |
| Desempenho e consumo (simulados, questões, aulas, PDFs, temas) | **DAGs** (Therlyson), réplica | Supabase do Academy, mesmas funções do Gestor recortadas pela turma |
| Intervenções (kanban), histórico, log do aluno, rotina do grupo (B2B), sinalizações à IES (B2B) | **Academy** | Supabase do Academy (`supabase/migrations/…_mentor_portal.sql`) |

**Consequência:** o kanban vive no Academy e os eventos que o alimentam (`eventosIntervencao.ts`) acontecem no Academy. Toda ação que grava no Flix e também gera um card segue esta ordem:
1. Chama a API do Flix.
2. Se a chamada der certo, registra o evento no Supabase do Academy (`registrar_evento_mentor`).
3. Se a API falhar, não cria o card e mostra o erro.

## Conexão

- **Base:** `https://<proxy-cloud>/mentoria/v1`. A URL do proxy ainda depende do Cássio; use `VITE_FLIX_MENTORIA_URL`.
- **Headers:** `Authorization: Bearer <token de serviço>` + `X-Mentor-Id: <mentorId>`.
- **Onde fica o token:** nunca no browser. As chamadas passam por uma Edge Function do Supabase (`flix-mentoria-proxy`), que injeta o token guardado em secret e repassa o `X-Mentor-Id` do usuário autenticado.
- **Erros:** `{ error: { code, message, field } }`. Mapeie o `code` para a mensagem da UI (tabela abaixo).
- **Listas:** `?limit=&cursor=`, resposta `{ data, nextCursor }`.

| `code` | Mensagem na UI |
|---|---|
| `validacao` | Erro inline no campo `field`, usando o `message` da API |
| `sem_acesso_tribo` | Faixa de erro: "Você não tem acesso a esta turma." |
| `canal_nao_editavel` | Não deve acontecer (a UI só edita `grupo_tribo`) |
| `mentor_sem_agenda` | No drawer: "Cadastre seu link do Google Agenda no perfil para liberar agendamentos." |
| `convite_ativo` | Recarregar o drawer (outro mentor já liberou) |
| `aluno_fora_da_tribo` | Toast: "Um dos alunos não está mais na turma. Atualize a lista." |
| 5xx / rede | `EstadoErro` no bloco + "Tentar novamente"; nada é gravado no Academy |

## Mapeamento tela → endpoint

| Tela / ação | Endpoint Flix | Evento no Academy |
|---|---|---|
| Shell: mentor, tribo, modalidade | `GET /me` | — |
| Minha Turma / Visão Geral: lista | `GET /tribos/{id}/alunos` (cruzar `alunoId` com DAGs) | — |
| Drawer: dados de contato, acesso, meta | `GET /tribos/{id}/alunos/{alunoId}` | — |
| Drawer: liberar agenda | `POST /tribos/{id}/convites` `{ alunoId, mensagem }` | `agenda_liberada` |
| Drawer: desligar agenda | `DELETE /convites/{id}` | — |
| Sessões: lista de liberados | `GET /tribos/{id}/convites` | — |
| Mural: publicar / rascunho | `POST /tribos/{id}/publicacoes` | `mural_publicado` (se "Registrar como intervenção") |
| Mural: editar / excluir | `PATCH` / `DELETE /publicacoes/{id}` | — |
| Mural: anexo | `POST /uploads` → PUT no `uploadUrl` | — |
| Mural: histórico "Publicadas" | `GET /tribos/{id}/publicacoes` | — |
| Canais: grupo da tribo | `GET /tribos/{id}/canais`, `PUT …/canais/grupo_tribo` | — |
| Sessões: criar | `POST /tribos/{id}/sessoes` | `sessao_criada` |
| Sessões: editar link, pauta, tema | `PATCH /sessoes/{id}` | — |
| Sessões: marcar realizada | `PATCH /sessoes/{id}` `{ status: 'realizada' }` | `sessao_realizada` |
| Sessões: excluir futura | `DELETE /sessoes/{id}` | — |
| Sessões: gravação manual (fallback) | `POST /sessoes/{id}/gravacao` `{ origem: 'manual' }` | — |

## Estados que dependem da API

| Estado | Regra |
|---|---|
| "Falta link" | sessão coletiva `agendada` com `meetUrl: null` |
| "Pauta pendente" | oficina sem tema e sem pauta (B2B) |
| "Aguardando gravação" | coletiva `realizada` com `gravacao: null` |
| "No acervo de mentorias" | coletiva com `gravacao` |
| "Feita · não vai para o acervo" | individual `realizada` |
| "editada" no histórico | `editadaEm != null` |
| Botão "Liberar agendamento" desabilitado | `GET /me` sem `agendaUrl` |

## Pendências de contrato que afetam o front

1. `ultimaAtividadeEm`: login ou atividade de estudo. Ela muda os alertas Sumiram/Esfriando.
2. URL do proxy e emissão do token (Cássio).
3. Tag `novidade` no mural.
4. Ligação da gravação pelo `calendarEventId`.
