# Central de acesso por IES — redesign de `/admin/ies` (spec)

**Data:** 2026-07-09 · **Autor:** Felipe Souza + Claude · **Status:** aprovada (design validado em sessão)

## Problema

1. **Toggles não refletem.** `useAccessRules` (src/hooks/useAccessRules.ts:27-30) dá bypass hardcoded a `admin`, `professor`, `gestor`, `gestor_grupo` e `atendimento` — essas contas nunca consultam `ies_features`. Só o aluno sem role respeita os flags, e mesmo ele só lê o flag uma vez por sessão (`useIesFeatures` sem realtime/refetch).
2. **Controle incompleto.** O portal do gestor (5 telas + drawers Exportar/IA) não tem nenhum gate por feature — só role. Flags `analytics` e `desempenhoInstitucional` existem na tela mas nenhum código os consome. `/simulados/:id/prova` e `/meus-feedbacks` não têm gate.
3. **Fonte da verdade difusa.** Regras hardcoded por role (`src/utils/accessRules.ts`) + merge parcial com `ies_features` no cliente. RPCs `get_ies_features`/`ies_has_feature` existem no banco e estão mortas.

## Decisões de arquitetura (aprovadas)

- **Enforcement fase 1:** fonte única no banco + front 100% coerente. Bloqueio real de tela/rota/menu; hardening de RPCs de dados e RLS por feature ficam para fase 2.
- **Semântica de roles:** só `admin` e `atendimento` ignoram os toggles (bypass calculado no servidor). `gestor`, `gestor_grupo` e `professor` respeitam o contrato da IES.
- **Catálogo:** chaves namespaced por experiência, definidas na tabela `feature_catalog` (banco), não mais constante no front.
- **Alvo do gestor:** a experiência em prod na main (5 telas antigas). As chaves `gestao.*` já nascem compatíveis com o console parked.

## Modelo de dados (projeto Supabase `gvqv`, DDL via agente Lovable)

### Tabela nova `feature_catalog`

```sql
create table public.feature_catalog (
  key         text primary key,
  experience  text not null check (experience in ('aluno','gestao')),
  label       text not null,
  description text not null default '',
  sort_order  int  not null default 0,
  is_master   boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
-- RLS: SELECT para authenticated; escrita só via migration/admin.
```

### Catálogo (seed)

| key | experience | label | is_master |
|---|---|---|---|
| `aluno.home` | aluno | Home | |
| `aluno.guia_estudos` | aluno | Guia de Estudos | |
| `aluno.dashboard` | aluno | Dashboard | |
| `aluno.simulados` | aluno | Simulados | |
| `aluno.desempenho_simulados` | aluno | Desempenho Simulados | |
| `aluno.sanarclass` | aluno | SanarClass | |
| `aluno.caderno_erros` | aluno | Caderno de Erros | |
| `gestao.enabled` | gestao | Portal do Gestor (master) | ✔ |
| `gestao.visao_institucional` | gestao | Visão Institucional | |
| `gestao.diagnostico_curricular` | gestao | Diagnóstico Curricular | |
| `gestao.alunos` | gestao | Visão de Alunos | |
| `gestao.insights_pedagogicos` | gestao | Insights Pedagógicos | |
| `gestao.inteligencia_decisoria` | gestao | Inteligência Decisória | |
| `gestao.exportar` | gestao | Exportar Relatórios | |
| `gestao.ia` | gestao | Assistente IA | |

`userManagement` segue FORA do catálogo (controle interno por role, como hoje).

### Migração de dados — POR CÓPIA, nunca renomeação

As linhas antigas de `ies_features` ficam intactas (o front de prod atual lê as chaves antigas direto da tabela). Script insere as equivalentes novas por IES:

| chave antiga | chave nova |
|---|---|
| `home` | `aluno.home` |
| `studyGuide` | `aluno.guia_estudos` |
| `dashboard` | `aluno.dashboard` |
| `simulados` | `aluno.simulados` |
| `SimuladoDesempenho` | `aluno.desempenho_simulados` |
| `sanarclass` | `aluno.sanarclass` |
| `errorNotebook` | `aluno.caderno_erros` |
| `desempenhoInstitucional` | `gestao.enabled` |
| `analytics` | — (morta, não migra) |
| `cronogramaEnamed`, `enamed`, `intensivoUSCS` | — (órfãs, saem só no cleanup) |

**Seed de segurança:** toda IES com pelo menos um usuário `gestor`/`gestor_grupo` ativo recebe `gestao.enabled = true` e todas as `gestao.*` de tela = true (ninguém perde acesso na virada). Sub-chaves `gestao.exportar`/`gestao.ia` também = true nessas IES. **Precedência:** o seed roda DEPOIS da cópia e sobrescreve (`ON CONFLICT DO UPDATE`) — se `desempenhoInstitucional` estava false mas a IES tem gestor ativo, vale true.

### RPC nova `get_effective_features()`

`SECURITY DEFINER`, `GRANT EXECUTE TO authenticated` apenas (REVOKE anon/PUBLIC). Retorna:

```json
{ "bypass": false, "ies_id": "…", "features": { "aluno.home": true, "gestao.enabled": false, … } }
```

Lógica no servidor:
1. `admin` ou `atendimento` → `bypass: true`, todas as chaves `active` do catálogo = true.
2. Demais: resolve `id_ies` do usuário; para cada chave do catálogo, `enabled` de `ies_features` (ausente = **false** — default fechado, comportamento atual preservado).
3. **Semântica de master no servidor:** se `gestao.enabled = false`, todas as `gestao.*` retornam false independente das linhas.

### Realtime

Adicionar `ies_features` à publication `supabase_realtime` (RLS de SELECT já é aberta, `USING (true)`), para o front invalidar cache ao vivo.

## Front

### Fonte única: `useEffectiveFeatures`

- Novo hook em `src/hooks/useEffectiveFeatures.ts`: React Query (`['effective-features', userId]`) chamando a RPC; `staleTime` curto; subscription Supabase Realtime em `ies_features` filtrada por `ies_id=eq.<id do usuário>` → `invalidateQueries`. Toggle do admin reflete na sessão aberta em segundos, sem relogar.
- `useIesFeatures` e o merge manual de `useAccessRules` são removidos. `useAccessRules` vira um adaptador fino: mantém a interface `AccessRules` (consumida por rotas/sidebar/bottom-nav) mapeada das chaves novas + `userManagement` derivado de role. O bypass por role sai do front — quem decide é a RPC (`bypass`).
- Regra do repo (reafirmada): componente/página nunca decide acesso por role literal; só consome `AccessRules`/`can()`/`hasExperience()`.

### Gates novos/corrigidos

- **Gestor:** `ExperienceGuard experience="gestao"` passa a exigir role **e** `gestao.enabled`. Cada uma das 5 rotas do gestor ganha gate pela sua chave; drawers Exportar e IA no `GestorLayout` gateados por `gestao.exportar`/`gestao.ia`. `GestorNav` filtra itens pelos mesmos gates.
- **Aluno:** `/simulados/:id/prova` entra sob `aluno.simulados`. `/meus-feedbacks` permanece SEM gate (canal de suporte/CX — decisão deliberada).
- **Professor:** passa a usar o recorte da IES (perde o hardcode).
- Guarda de regressão: teste que varre `alunoRoutes`/`gestorRoutes` e falha se rota nova nascer sem gate declarado (allowlist explícita para as exceções: prova, meus-feedbacks, redirects).

## Tela `/admin/ies` (redesign)

- Catálogo, labels, descrições e ordenação vêm de `feature_catalog` (a constante `AVAILABLE_FEATURES` morre).
- Card por IES com **duas seções**: "Experiência do Aluno" (contador X/7) e "Experiência do Gestor" (contador X/8). Master switch do gestor no topo da seção; desligado → subswitches visualmente desabilitados (mas estado preservado).
- **Busca/filtro de IES** no topo da página.
- Diff pendente visível: badge "N alterações não salvas" no card; confirmação de save mostra o diff.
- **Copiar configuração de outra IES** (aplica como pending changes, não salva direto).
- Histórico inline por IES: últimas alterações `ies_features_update` via `admin_get_audit_log` (filtro por IES no cliente, via `metadata.ies_id`).
- Save continua por IES via `admin_set_ies_features` (RPC inalterada — upsert genérico por chave, já auditada).

## Rollout (ordem obrigatória)

1. **DDL aditivo via Lovable** no gvqv: `feature_catalog` + seeds + cópia de chaves + seed de segurança do gestor + RPC + realtime publication. Prod atual não percebe (só adição). Verificar aplicação real (lição do sync Lovable: conferir estado, não confiar no "ok").
2. **PR do front** nesta repo → review → merge na main (Vercel deploya). Front novo lê exclusivamente chaves novas via RPC.
3. **Cleanup** (dias depois, comportamento confirmado): deletar linhas antigas/órfãs de `ies_features`, dropar `get_ies_features`/`ies_has_feature` mortas.

**Atenção operacional:** o MCP do Supabase desta máquina enxerga o projeto errado (`lljn`); todo DDL/verificação de prod vai via agente Lovable ou pelo próprio app (projeto real: `gvqv`, hardcoded no client).

## Fora de escopo (fase 2 anotada)

- Planos/contratos como entidade (presets Essencial/Pro/Enterprise) — `feature_catalog` deixa o terreno pronto.
- Hardening server-side: RPCs de dados checando `ies_features` e/ou RLS por feature em tabelas de conteúdo.
- Console novo do gestor (branch `gestor-console-parked`) — quando voltar, consome as mesmas chaves `gestao.*`.
- Contagem de alunos/plano contratado no card da IES (requer backend novo).

## Critérios de sucesso

1. Admin desliga `aluno.simulados` de uma IES → aluno daquela IES com sessão aberta perde a tela em segundos, sem relogar; menu some; rota redireciona.
2. Admin desliga `gestao.enabled` → gestor daquela IES perde o portal inteiro (redirect ao entrypoint).
3. Professor e gestor deixam de ver telas que a IES não contratou.
4. Admin/atendimento continuam vendo tudo (bypass).
5. Nenhuma IES existente perde acesso na virada (seed de segurança verificado).
6. Teste de regressão de gates passa; suíte existente permanece verde.
