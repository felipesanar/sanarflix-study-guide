# Implementação do handoff · decisões do orquestrador (04/11/2026)

Vale junto com `CLAUDE.md` deste handoff. Onde este arquivo e o handoff divergirem, vale este arquivo (são decisões
tomadas depois de ler o código e o banco de produção).

## Fontes de dados

Toda tela consome **só** os hooks de `src/features/mentor/api/queries.ts`. Os hooks chamam uma `FonteMentoria`
(`src/features/mentor/api/fonte.ts`) com três implementações:

| Fonte | Quando | O que faz |
|---|---|---|
| `fonteAcademy` (padrão) | sempre, enquanto o Flix não existir | mural, sessões, convites, canais, alunos e kanban pelas RPCs `mentor_*` do Supabase do Academy (já em produção) |
| `fonteFlix` | `VITE_FLIX_MENTORIA=on` | alunos, mural, sessões, convites e canais pela Edge `flix-mentoria-proxy` (contrato v2.1); desempenho e kanban continuam nas RPCs do Academy; ações compostas: Flix primeiro, depois `registrar_evento_mentor` |
| `fonteMock` | `VITE_MENTOR_FONTE=mock` (dev e testes; nunca o padrão) | tudo com os dados dos protótipos (`<script data-dc-script>` de `prototipos/Mentor B2C.dc.html` e `Mentor B2B.dc.html`), com latência simulada; serve para inspeção visual do B2B, que não tem mentor real em produção |

Na `fonteAcademy` o aluno é identificado pelo **e-mail normalizado** (`alunoId = email`), e as RPCs de ação já criam os
cards do kanban no servidor: a fonte declara `eventosNoServidor = true` e as mutations compostas não chamam
`registrar_evento_mentor`.

O recorte é **sempre** a turma do mentor logado, resolvida no servidor (`mentor_ativo_id()` + `mentoria_vinculos`).
Nenhuma chamada manda lista de alunos para ampliar o recorte.

`chamarRpcGestor` devolve `{ data, meta }`: os hooks repassam os dois (o `KpiCard` exige `meta`).

## RPCs (contrato com o banco)

- Operacionais (migration `20261104181315_mentor_portal_v2.sql`): `get_mentor_contexto` (com `portal_mentor`,
  `tribo_slug`, `modalidade`), `mentor_canais_listar`, `mentor_canal_grupo_salvar`, `mentor_mural_listar|salvar|excluir`,
  `mentor_sessoes_listar`, `mentor_sessao_salvar|marcar_feita|excluir`, `mentor_agenda_liberar|desligar`,
  `mentor_convites_listar`, `mentor_intervencoes_listar`, `mentor_intervencao_criar|atualizar|comentar`,
  `registrar_evento_mentor`, `mentor_rotina_listar|marcar_enviado`, `mentor_sinalizar_ies`, `mentor_perolas_listar|salvar`.
- B2C (migration `20261104181551_mentor_b2c_v2.sql`): `mentor_turma`, `mentor_desempenho_turma`, `mentor_serie_turma`,
  `mentor_engajamento_turma`, `mentor_temas_turma`, `mentor_detalhamento(p_simulados, p_emails)`, `mentor_questao`,
  `mentor_aluno`, `mentor_aluno_notas`, `mentor_aluno_conteudos`, `mentor_aluno_questoes`.
- B2B (migration `20261104140000_mentor_b2b_v2.sql`): `mentor_visao_geral_b2b`, `mentor_alunos_b2b`,
  `mentor_temas_turma_b2b`, `mentor_detalhamento_b2b`, `mentor_questoes_b2b`, `mentor_questao_respondentes_b2b`,
  `mentor_cronograma_b2b`, `mentor_aluno_b2b`.

Formato exato de retorno: ler a migration correspondente em `supabase/migrations/`.

## Reuso do Gestor

- Componente do Gestor que busca o próprio dado (`useFiltrosGestor`, `useGestorContexto`) ganha **props opcionais**:
  quando a prop vem preenchida, o componente usa a prop e não chama o hook. Sem a prop, o comportamento do Gestor fica
  idêntico (os testes do Gestor têm de continuar passando). Isso vale para `SeletorSimulados` (dados, valor, onChange,
  nota opcional), `SaudacaoGestor`, `TabelaAlunosSimulado` (colunas e faixas), lista "quem marcou" das questões.
- **Drawer do aluno**: próprio do mentor (`components/aluno/DrawerAlunoMentor.tsx`), montado uma vez no shell e aberto
  pelo parâmetro `?aluno=` da URL; reusa `Tag`, `TagNivel`, `TagDelta`, `KpiCard`, `linkWhatsAppAluno`, formatadores e
  regras do Gestor. Não estender o `DrawerAluno` do Gestor (1.801 linhas, busca o próprio dado).
- **Matriz por prevalência**: componente novo do mentor; `AcertoPorAreaESemestre` não serve.
- Diagnóstico da IA: base `BlocoInsights` (apresentação); dado de uma Edge/RPC do mentor.
- Tokens e ícones: o `MentorShell` aplica a classe `.gestor-portal` e importa os mesmos CSS do `GestorShell`. Os valores de
  produção são os de `gestor-theme.css` (marca `#941F1F`), não os de `docs/handoff/gestor/tokens/tokens.light.css`.
  Ícone sem equivalente em `icon-names.ts`: use o mais próximo e registre no relatório; não adicione fonte.

## Toggle e acesso

`mentor_portal` = `mentores.portal_mentor` (padrão `false`), devolvido por `get_mentor_contexto`. Sem o toggle,
`/mentor/*` redireciona para `/`. Só a experiência `mentor` (papel `mentor`) acessa.

## Prevalência

Não existe em produção. A tabela `enamed_prevalencia_tema` nasce vazia. Sem prevalência, a matriz e o impacto mostram o
estado "Prevalência ainda não cadastrada" (texto curto, sem inventar números) e o resto da tela funciona.

## Dono de cada arquivo (evitar edição concorrente)

| Frente | Arquivos |
|---|---|
| Base (M0) | `api/types.ts`, `lib/regrasMentor*`, `lib/eventosIntervencao*`, `tema/contexto*`, `components/{FaixaContexto,KpisDetalhamentoMentor,ListaPrioridades,TemasCriticos}.tsx` |
| Dados (D) | `api/fonte.ts`, `api/fonteAcademy.ts`, `api/fonteFlix.ts`, `api/fonteMock.ts`, `api/mock/**`, `api/flixClient.ts`, `api/queries.ts`, `api/erros.ts` |
| Shell (S) | `shell/**`, `mentorRoutes.tsx`, `MentorLayout.tsx` (substitui), `routes/` só os placeholders das telas, `components/aluno/DrawerAlunoHost.tsx` (placeholder), integração em `src/experiences/**` se precisar |
| Telas | uma frente por tela, cada uma só em `routes/<Tela>/**` e `components/<tela>/**` próprios; mexer em componente do Gestor só no arquivo listado na tarefa |

A implementação antiga (`routes/*.tsx`, `components/turma|detalhamento|mural|sessoes|intervencoes/**`) é substituída
pela frente dona da tela correspondente; os testes antigos dessas telas saem junto. `lib/linkSeguro.ts`,
`lib/textoSeguro.ts`, `components/sessoes/dataHora.ts` e a regra de `components/turma/consumo.ts` são reaproveitados.

## Decisões do Felipe (04/11/2026)

- **Migrações em produção:** só mudanças aditivas; qualquer migração que altere objeto existente com comportamento
  diferente vai para ele decidir antes (por isso `pendente/mentor_portal_v2_lacunas.sql` não foi aplicada).
- **Manter as regras novas do mentor B2C** ("Manter as novas"): "sumido" = 15+ dias sem atividade (D3 do handoff, antes
  10) e "possível aprovação" = % dos participantes do último simulado fechado com acerto ≥ corte da meta mais difícil.
  Aplicadas em `20261104181551_mentor_b2c_v2`.
