# Código de referência

Código TypeScript/React escrito para o repositório `felipesanar/sanarflix-study-guide`. Ele importa os componentes e regras **reais** do Portal do Gestor (`KpiCard`, `BlocoGestor`, `Tag`, `Icon`, `regras.ts`, `formatters.ts`, `chamarRpcGestor`). Copie para os mesmos caminhos no repo.

**Status:** é ponto de partida revisado contra o código do Gestor, mas **não foi compilado nem executado** aqui. Rode `tsc` e `vitest` logo no início.

| Arquivo | O que é | Pronto para |
|---|---|---|
| `src/features/mentor/api/types.ts` | Tipos de domínio (reaproveita os do Gestor) | Usar como está |
| `src/features/mentor/lib/regrasMentor.ts` | Todas as regras: engajamento, alertas B2C, perfis B2B, corte da meta, temas críticos, matriz, status de sessão, saudação | Usar como está; constantes P# a validar |
| `src/features/mentor/lib/regrasMentor.test.ts` | Testes (vitest) das regras, incluindo os casos de borda de `null` | Rodar |
| `src/features/mentor/lib/eventosIntervencao.ts` | Ação do mentor → efeito no kanban. Espelhar no servidor | Usar no cliente (otimista) + portar para SQL |
| `src/features/mentor/tema/contexto.ts` | Tema da faixa/sidebar por tribo e IES | Usar; mover cores para o cadastro |
| `src/features/mentor/components/ListaPrioridades.tsx` | Lista do Início (B2C alertas, B2B perfis) | Usar |
| `src/features/mentor/components/TemasCriticos.tsx` | Temas críticos com expansão de 5 em 5 | Usar |
| `src/features/mentor/components/FaixaContexto.tsx` | Faixa do Início (tribo/IES) | Usar ou fundir em `SaudacaoGestor` como variant |
| `src/features/mentor/components/KpisDetalhamentoMentor.tsx` | Indicadores do Detalhamento por modalidade, com o `KpiCard` real | Usar |
| `src/features/mentor/mentorRoutes.tsx` | Rotas `/mentor/*` e menu por modalidade | Ajustar o nome da experiência no guard |
| `src/features/mentor/api/flixClient.ts` | Cliente da API de Mentoria do Flix (contrato v2.1), via Edge Function | Usar; depende do proxy do Cloud |
| `src/features/mentor/api/queries.ts` | Hooks react-query nas 3 fontes (Flix, DAGs, Academy) e mutations compostas Flix → evento | Usar; RPCs das DAGs são propostas |
| `supabase/functions/flix-mentoria-proxy/index.ts` | Edge Function que guarda o token e repassa ao Flix | Configurar secrets |
| `supabase/migrations/2026xxxx_mentor_portal.sql` | Tabelas do Academy (kanban, histórico, log, rotina, sinalizações). Mural, sessões e alocação ficam no Flix | Revisar com dados |

## Pontos de atenção

- **Ícones:** o Gestor usa `Icon` (dende-icons, nomes no estilo Material: `calendar_month`, `expand_more`…). Os protótipos usam traçados Lucide só para visualizar. Confira cada nome em `features/gestor/components/icon-names.ts`.
- **Tags:** use as anatomias de `Tag.tsx` (`qualificador` para "projetado", `positivo`/`neutro`/`ausencia` para situação do aluno, `TagNivel`, `TagDelta`). As etiquetas de raio 5 dos protótipos não devem ir para produção. Exceção: a etiqueta de prioridade (Alta/Média/Baixa), que não tem anatomia no Gestor. Proponha-a como nova variante de `Tag`, em vez de improvisar.
- **Componentes não incluídos aqui** (seguir `docs/02` e `docs/03` + capturas): `MentorShell`, `SoModalidade`, telas em `routes/`, Mural, Sessões, Canais, Kanban, Drawer do aluno (estender `DrawerAluno`).

## Prompt sugerido para o Claude Code

```
Leia design_handoff_mentor_b2c_b2b/CLAUDE.md e execute docs/08-plano-de-execucao.md começando pela Fase 0.
Ao fim de cada tarefa, confira a captura indicada lado a lado com a tela em 1380px e 390px
e só avance quando o critério de aceite for atendido.
```
