# Checklist de segurança e LGPD — Portal do Gestor v2 (spec §7.7)

Colar no corpo do PR. **Automatizado** = coberto por
`src/features/gestor/__tests__/seguranca-lgpd.test.tsx` (13 testes, todos
verdes — `npx vitest run src/features/gestor/__tests__/seguranca-lgpd.test.tsx`).
**Manual** = precisa de um humano conferindo produção, banco ou o PR em si;
nenhum teste unitário alcança.

## Automatizado (não marcar à mão — a suíte é a evidência)

`describe('§7.7 — nenhum payload de aluno em storage')`
- [x] Renderizar a Visão Geral com um aluno nominal na tabela não escreve nome, id nem proficiência do aluno em `localStorage` nem `sessionStorage`
- [x] O código de `src/features/gestor` não usa `localStorage`, `sessionStorage` nem IndexedDB — cache só em memória (React Query)
- [x] React Query do portal não é persistido em disco (`persistQueryClient`/`createSyncStoragePersister`)

`describe('§7.7 — nenhum HTML injetado')`
- [x] Nenhum arquivo de `src/features/gestor` usa `dangerouslySetInnerHTML`
- [x] Nem `innerHTML` de escrita, `insertAdjacentHTML` ou `document.write`

`describe('§7.7 — nenhum dado pessoal de aluno na URL/query string')`
- [x] Abrir o `DrawerAluno` não expõe nome nem id do aluno na URL
- [x] Nenhum código do portal monta URL/query param com email, cpf ou matrícula
- [x] `useFiltrosGestor` só expõe chaves de recorte (`semestre`, `simulados`, `ies`) na URL — nenhuma chave de identidade de aluno

`describe('§7.7 — export e cópia de resumo')`
- [x] Nenhum caminho de export (Xlsx/Csv/Pdf/Planilha) é chamado sem escopo explícito
- [x] "Copiar resumo" (`AcoesRecorte`) nunca escreve `.nome` de um item de lista dentro da chamada ao clipboard
- [x] A assinatura de `AcoesRecorte` é a barreira: recebe texto agregado (`resumoTexto: string`), nunca uma lista de alunos

`describe('§7.7 — telemetria (se existir) não carrega PII')`
- [x] Nenhuma chamada a `Logger.*` loga nome, e-mail, cpf ou matrícula de aluno
- [x] Nenhuma chamada a tracker de analytics carrega nome, e-mail ou matrícula de aluno como propriedade

## Observações (não são falhas do §7.7 — registradas para contexto)

- **`alunoAberto` é `useState` local, não estado de URL.** `TabelaAlunos.tsx`
  guarda o aluno aberto no drawer em estado de componente, não via
  `useFiltrosGestor`/query string. Isso é **mais estrito** que o piso do §7.7
  (que aceitaria um UUID opaco na URL) — hoje nenhum dado de aluno chega lá.
  Mas diverge do que a §8.2 da spec descreve ("aluno aberto" como parte do
  estado de URL, para o link ser colável). Não é bloqueio desta task; é nota
  para quem for fechar a §8.2.
- **Telemetria do portal ainda não existe.** `src/features/gestor` não chama
  `useAnalyticsTracker`, `posthog` nem qualquer tracker hoje — os eventos da
  §10 da spec (`gestor_tela_vista`, `gestor_drawer_aberto` etc.) não estão
  instrumentados ainda (isso é trabalho de outra fase/task, ex. Task 63 cita
  `trackEdgeLatency`). Os dois testes de telemetria desta suíte são **guarda
  de regressão preventiva**: hoje passam porque não há nenhuma chamada para
  verificar; quando a instrumentação entrar, re-rodar esta suíte é o
  suficiente para pegar uma propriedade com PII — mas vale uma segunda
  revisão manual no PR que instrumentar, porque um nome de propriedade
  inesperado (ex. `alunoIdentificado`) pode escapar do regex.

## Revisão manual obrigatória no PR

- [ ] **RLS/permissão no servidor.** Cada uma das 10 RPCs `get_gestor_*` valida
      a IES do chamador no corpo e responde erro genérico para IES alheia —
      sem revelar existência (§12.17). Evidência via MCP do Supabase (project
      ref `gvqvrmkizemwsasmupmo`, confirmar com `get_project_url` antes —
      **não usar o project ref que o MCP resolver por padrão sem checar**):
      `select proname, prosecdef from pg_proc where proname like 'get_gestor_%'`
      → 10 linhas, `prosecdef = true` nas 10.
- [ ] **Guard de feature no corpo.** As 10 RPCs têm o guard `gestao.portal_v2`
      **escrito no corpo** (não injetado dinamicamente como as 19 legadas —
      §7.1). Evidência: `pg_get_functiondef` de uma delas mostra o guard, e o
      `.sql` versionado no repo tem o mesmo texto.
- [ ] **Trilha de auditoria de dado nominal.** Abrir o `DrawerAluno` gera
      registro de auditoria (`quem · quando · aluno_id`). **Verificado nesta
      task: não existe hoje** — `DrawerAluno.tsx` não chama nenhuma RPC de
      auditoria nem grava evento algum ao montar; é view-only sobre
      `useAluno`. Se a Fase 2 não implementou isto em paralelo, **registrar
      como pendência explícita no PR** — não fechar como pronto.
- [ ] **Export com auditoria e confidencialidade.** Todo export grava
      `quem · quando · escopo · formato` e o arquivo traz cabeçalho de
      confidencialidade. **Verificado nesta task: export real ainda não
      existe** — `VisaoGeral.tsx` (`aoExportarRecorte`) só mostra um toast
      "Exportação ainda não está disponível." Quando o export real entrar,
      confirmar auditoria e cabeçalho abrindo um export de verdade.
- [ ] **Export é sempre de recorte.** Nenhum botão exporta a base inteira da
      IES (reconfirmar quando o export real existir — hoje não há export
      funcional para testar).
- [ ] **Sem PII em log de produção.** Rodar
      `grep -rn "Logger\.\(info\|warn\|error\)" src/features/gestor` e
      revisar manualmente cada ocorrência — o teste automatizado cobre um
      regex (janela de 400 caracteres após a chamada); confirmar à mão que
      nenhuma delas loga nome, e-mail ou enunciado de aluno. Hoje só existem
      duas chamadas (`useMarcarAvisoLido.ts`, `BlocoErrorBoundary.tsx`),
      nenhuma com dado de aluno.
- [ ] **Impersonação.** Com `isImpersonating`, confirmar que nenhum export é
      possível impersonando (depende do export real existir — hoje é N/A).
- [ ] **Screenshots do PR** não contêm nome real de aluno (usar IES de teste
      ou desfocar).
- [ ] **Contrato com a IES / retenção de dado.** Cláusulas de retenção e uso
      de dado educacional identificável no contrato com a IES piloto (FAI) —
      fora do alcance de qualquer teste de código; conferir com jurídico/CS
      antes do piloto (Task 62).
- [ ] **`ies_features`/`feature_catalog` fora de produção.** Esta branch não
      tem acesso a produção; confirmar antes do piloto que `gestao.portal_v2`
      está com `active = true`, `is_master = false` e **nenhuma IES com
      `enabled = true`** ainda (query do Step 1 da Task 62) — não coberto por
      teste porque é estado de banco em produção, não de código.
