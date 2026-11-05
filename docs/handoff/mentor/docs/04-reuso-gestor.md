# 04 · Reuso do Portal do Gestor

Fonte: `felipesanar/sanarflix-study-guide@main`, `src/features/gestor` (41 componentes, 3 rotas: `routes/Inicio.tsx`, `routes/VisaoGeral.tsx`, `routes/Detalhamento.tsx`).

**Limitação:** os protótipos recriam os componentes do Gestor a partir da leitura do código; eles não importam o `.tsx`. Só o `SeletorSimulados` foi conferido linha a linha. Nos demais, **o componente do Gestor é a fonte da verdade** para medidas, espaçamento e estados.

## Mapeamento

| Mentor | Componente do Gestor | Ação | Props/extensões necessárias |
|---|---|---|---|
| Cabeçalho de tela | `CabecalhoTela` | Reusar | — |
| Saudação do Início | `SaudacaoGestor` | Estender | `variant="tribo" \| "ies"`, `tema` (fundo, acento), `selo` (img), `acoes` (slot) |
| Bloco | `BlocoGestor` | Reusar | — |
| Indicador | `KpiCard` | Estender | `projetado?: boolean` (marcador tracejado), `regua?: {primeiro, anterior, atual}`, `delta?` |
| KPIs da Visão Geral | `KpisVisaoGeral` | Reusar no B2B | Separar visualmente "Projeção" × "Observado" |
| KPIs do Detalhamento | `KpisDetalhamento` | Estender | Conjunto por modalidade: B2C (acerto, possível aprovação, participação) · B2B (acerto, conceito, TRI) |
| Seletor de simulados | `SeletorSimulados` | **Reusar sem mudanças** | Fonte: cronograma (status realizado/agendado/previsto) |
| Acerto por prevalência | `AcertoPorAreaESemestre` | Estender | `eixo="prevalencia"`, `regua="b2c" \| "gestor"`, `onDetalhar(area)` |
| Drawer de grande área | `DrawerTemasDetalhamento` | Reusar | Ação "Intervenção" por tema |
| Diagnóstico da IA | `BlocoInsights` | Estender | Ações "Gerar de novo" e "Levar pro mural" |
| Visão de alunos | `TabelaAlunosSimulado` | Estender | Colunas por modalidade (corte da meta × limiar 60); abas de situação |
| Questões | `TabelaQuestoes` | Estender | Bloco "Quem marcou {X}" com ações; botão "Levar para a oficina" (B2B) |
| Drawer do aluno | `DrawerAluno` | Estender | Seções novas: agenda individual (B2C), orientação por perfil (B2B), log de interações, sinalizar à IES (B2B) |
| Etiquetas | `Tag` / `BadgeStatus` / `ChipNivel` | Reusar | Os protótipos usam etiquetas próprias com raio 5: **substituir** |
| Ações de recorte | `AcoesRecorte` | Reusar | Botões a 12px / 600 (os protótipos usam 13px) |
| Vazio / erro / carregando | `EstadoVazio` / `EstadoErro` / `GestorSkeleton` | Reusar | — |
| Glossário | `Glossario` | Reusar | Verbetes novos: Possível aprovação, Prevalência, TRI projetado |
| Regras | `lib/regras.ts` | Reusar | `PROFICIENCIA_MINIMA = 60`, níveis de acerto, grupos de evolução, null ≠ 0 |
| Rótulos | `lib/rotulos.ts` | Estender | Rótulos B2C (corte, meta, segmentos) |

## Componentes novos (sem equivalente no Gestor)

| Componente | Onde | Observação |
|---|---|---|
| `ListaPrioridades` | Início B2C (alertas) e B2B (perfis) | Linha-botão com ícone, título, critério, n, prioridade. Uma única implementação, dados por modalidade |
| `TemasCriticos` | Minha Turma (B2C), Visão Geral (B2B) | Expansão incremental de 5 em 5, filtro, ordenação, linha expansível |
| `Mural` (composer + prévia + histórico) | B2C e Canais B2B | Destinatários por lista de alunos |
| `Sessoes` (lista expansível + pauta + formulário) | B2C e B2B | Tipos por modalidade |
| `RotinaGrupo` | Início e Canais B2B | Checklist semanal com "Marcar como enviado" |
| `BancoPerolas`, `ComiteIES` | Canais B2B | — |
| `KanbanIntervencoes` + `DrawerIntervencao` | B2C e B2B | Cards criados por eventos (ver `06-dados-e-estado.md`) |
| `CartaoContexto` (sidebar) | Shell | Tribo ou IES |
