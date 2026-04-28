
# Importador de Respostas Externas (Admin) — “Importar Gabaritos de Alunos”

Sub-aba dentro de **Admin → Simulados** que permite, a partir de uma planilha Excel/CSV, registrar oficialmente as respostas de N alunos para um simulado já cadastrado — sem mexer em nada que já está no banco.

## Objetivo

Quando uma prova é aplicada em sala (papel) ou em sistema externo, o gestor recebe uma planilha com:
- Identificação do aluno (e-mail).
- A resposta marcada (A/B/C/D) para cada uma das 100 questões.
- Opcionalmente: tempo gasto, nº saídas de aba, data de aplicação.

O admin associa essa planilha a um simulado existente, valida tudo, vê um preview do que vai entrar, confirma e o sistema grava `simulados_iniciados`, `answer_progress` e `simulados_finalizados` exatamente como se o aluno tivesse feito pela plataforma — sem duplicar nada e sem ambiguidade.

## Fluxo do usuário (admin)

```text
1. Admin → Simulados → aba "Importar Respostas"
2. Selecionar simulado de destino (dropdown com todos os simulados da IES)
   └─ Mostra metadados: nº de questões esperadas, IES vinculadas, datas
3. (Opcional) Baixar template .xlsx pré-preenchido com:
   - Coluna A: email
   - Colunas B..(B+N-1): Q1, Q2, ..., QN com header "1","2",...
   - Colunas extras opcionais: tempo_minutos, saidas_aba, finalizado_em
4. Upload do arquivo (.xlsx ou .csv, até 5 MB)
5. Tela de PREVIEW (cliente faz parse, servidor valida):
   ┌─────────────────────────────────────────────────────┐
   │ ✓ 87 alunos prontos para importar                   │
   │ ⚠ 3 e-mails não encontrados na IES                  │
   │ ⚠ 2 alunos já finalizaram esse simulado             │
   │ ✗ 1 linha com resposta inválida (ver detalhes)      │
   │                                                     │
   │ [Tabela] email | status | linha | mensagem          │
   │ [Toggles] Modo de conflito:                         │
   │   ( ) Pular alunos já finalizados (default seguro)  │
   │   ( ) Substituir (move antigo p/ histórico, +tent.) │
   │ [Botão] Cancelar  [Botão] Confirmar importação      │
   └─────────────────────────────────────────────────────┘
6. Confirmação textual ("DIGITE IMPORTAR para confirmar")
7. Processamento em lotes (50 alunos por chamada) com barra de progresso
8. Relatório final + opção de baixar log .csv
```

## Arquitetura técnica

### 1. Edge Function `admin-import-simulado-responses`

`verify_jwt = false`, valida JWT no código e exige role `admin`. Recebe um lote (array) de respostas para evitar timeouts. Toda a lógica de gravação fica no servidor com `supabaseAdmin` (service role) para passar pelo RLS de forma controlada.

**Payload:**
```ts
{
  simulado_id: string,
  conflict_mode: 'skip' | 'replace',
  source_label: string,          // ex: "FUNEPE - Aplicação 24/03/2026"
  default_finalizado_em?: string, // ISO; usado p/ todos sem data própria
  default_tempo_segundos?: number,
  rows: Array<{
    email: string,
    answers: Record<string, 'A'|'B'|'C'|'D'|'E'|null>, // chave = numero_questao
    tempo_segundos?: number,
    saidas_aba?: number,
    finalizado_em?: string,
  }>
}
```

**Pipeline por linha (transacional por aluno):**

```text
┌─ resolve user_id pelo email + ies_id do simulado
│   └─ se não pertence à IES → reject "user_not_in_ies"
├─ busca questoes_simulado WHERE simulado_id = X
│   └─ monta map: numero_questao → { id, correta, anulada }
├─ busca finalizacao mais recente (user, simulado)
│   ├─ existe & conflict_mode='skip'   → skip
│   └─ existe & conflict_mode='replace':
│       1. INSERT respostas atuais em answer_progress_historico
│          (com finalizacao_original_id, source='admin_import')
│       2. DELETE FROM answer_progress WHERE user_id, simulado
│       3. UPDATE simulados_finalizados SET liberado_novamente=false
│       4. proxima_tentativa = max(tentativa)+1
├─ valida respostas:
│   ├─ toda chave existe no map? (senão reject "invalid_question_number")
│   ├─ valor ∈ {A,B,C,D,E,null}?
│   └─ se questão tem só A-D, rejeita "E"
├─ INSERT em simulados_iniciados (started_at calculado a partir de
│    finalizado_em - tempo_segundos)
├─ INSERT em answer_progress (1 linha por questão, mesmo se null/branco)
│    correct = anulada ? true : (resposta == correta)
├─ INSERT em simulados_finalizados (tentativa_numero, tempo, saidas_aba,
│    finalizado_em)
└─ retorna { email, status: 'imported'|'skipped'|'replaced'|'failed', reason? }
```

**Transação Postgres:** envolver os 4 INSERTs/DELETE de cada aluno em uma RPC `admin_import_one_response(...)` com `SECURITY DEFINER` que faz tudo dentro de um único bloco — se um passo falhar, nada é gravado para aquele aluno; outros alunos do lote continuam.

### 2. Migration: índice único + RPC

Criar índice único **APENAS após confirmar que a limpeza dos casos FUNEPE será feita depois com aprovação** — por enquanto não criar (respeitando a restrição do usuário). A RPC trata a unicidade na lógica, garantindo que dentro de uma importação nunca duplique.

- `CREATE FUNCTION admin_import_one_response(...) RETURNS jsonb` — encapsula passos 4–8 acima.
- `CREATE FUNCTION admin_lookup_users_by_email_in_ies(p_ies_id uuid, p_emails text[]) RETURNS TABLE(email, user_id)` — resolve N e-mails de uma vez.
- `CREATE FUNCTION admin_simulado_import_summary(p_simulado_id uuid) RETURNS TABLE(numero_questao int, total_questoes int)` — usada no preview.

Tudo `SECURITY DEFINER` checando `has_role(auth.uid(), 'admin')`.

### 3. Frontend: `SimuladosImportRespostasTab.tsx`

Componente novo dentro de `SimuladosTab` (sub-aba). Reusa estilo das outras abas admin.

- Parser de planilha no cliente com a lib `xlsx` já presente no projeto.
- Normalização robusta:
  - Headers: aceita `Q1`, `1`, `01`, `questao_1`, `questão 1` → numero_questao = 1.
  - E-mails: trim + lowercase + dedup (linhas duplicadas para mesmo email = erro "duplicate_email_in_file").
  - Respostas: aceita `A`/`a`/`a)`/`alternativa A` → `A`. Aceita `-`, `?`, vazio, `branco`, `0` → `null`.
- Pré-validação no cliente:
  - Faz uma chamada de **dry-run** ao edge function (`?dry_run=true`) que devolve o veredito por linha sem gravar.
  - Renderiza tabela com filtros (status: ok / warning / error).
- Envio em lotes de 50 com `Promise.all` controlado e barra de progresso (`X/Y alunos processados`).
- Log final exportável em CSV.

### 4. Template oficial

Botão "Baixar template" gera xlsx dinamicamente:
- Header gerado a partir do simulado selecionado (sabe quantas questões tem).
- Linha de exemplo com 1 aluno fake.
- Aba "Instruções" explicando regras (formato e-mail, A-D ou A-E, em branco, conflitos).

## Gargalos e como cada um é tratado

| Gargalo | Solução |
|---|---|
| **Email não cadastrado** | Reject linha; sugere admin criar usuário antes via "Cadastrar usuários B2B". Lista todos os e-mails ausentes em uma seção destacada do preview. |
| **Aluno em IES diferente** | Reject "user_not_in_ies"; admin pode forçar com checkbox "Permitir cross-IES" (audit log). |
| **Aluno já finalizou** | Toggle `skip` (default) ou `replace` (move para `answer_progress_historico` + nova tentativa, idêntico ao fluxo natural via Edge Function existente). Nunca apaga sem arquivar. |
| **Planilha com colunas faltando** | Validação de schema antes de processar. Mostra "esperava 100 colunas de questão, encontrou 87". |
| **Respostas inválidas / typos** | Validação por célula com linha+coluna no log de erro. |
| **Numero de questão diverge da `ordem`** | RPC busca por `numero_questao` com fallback para `ordem` se `numero_questao` for NULL. Loga qual chave foi usada. |
| **Questões anuladas** | Mantém o comportamento atual da Edge Function `corrigir-simulado`: se `anulada=true`, `correct=true` independente da resposta. |
| **Lote grande (500+ alunos)** | Cliente quebra em chunks de 50, envia em série. Edge function tem timeout 60s — 50 alunos × ~150ms cada cabe folgado. |
| **Falha no meio do lote** | Cada aluno é uma transação independente (RPC `admin_import_one_response`). Falha de 1 não derruba os outros 49 do chunk. Relatório mostra exatamente quem entrou e quem falhou. |
| **Idempotência se admin reenvia o arquivo** | Cada importação gera um `import_batch_id` (uuid). Salvo em `admin_import_batches` (nova tabela aditiva). Antes de inserir, edge function checa se aquele (batch_id, email, simulado) já foi processado e pula. Reenviar a mesma planilha = no-op seguro. |
| **Rastreabilidade / desfazer** | Cada `simulados_finalizados` criado por importação recebe `metadata`/source via tabela auxiliar `admin_import_records` (batch_id, simulado_id, user_id, finalizacao_id, created_at). Permite no futuro um botão "Reverter importação X" que move tudo para histórico. |
| **Audit log** | Cada execução grava 1 linha em `admin_audit_log` (`action='import_simulado_responses'`, metadata com batch_id, totais, conflict_mode, source_label). |
| **Race contra inserção real do aluno** | Lock por (user_id, simulado_id) usando `pg_advisory_xact_lock(hashtext(user_id||simulado_id))` dentro da RPC. Garante que aluno não está finalizando pela plataforma ao mesmo tempo. |
| **CORS / auth** | Padrão Lovable: `verify_jwt=false` no `config.toml`, valida token manualmente, exige `admin` via `has_role`. |

## Tabelas novas (todas aditivas — nada destrutivo)

```sql
-- Lote de importação (1 linha por upload)
CREATE TABLE admin_import_batches (
  id uuid PK default gen_random_uuid(),
  simulado_id uuid not null,
  source_label text not null,
  conflict_mode text not null check (conflict_mode in ('skip','replace')),
  total_rows int not null,
  imported_count int not null default 0,
  skipped_count int not null default 0,
  failed_count int not null default 0,
  created_by uuid not null,
  created_at timestamptz default now()
);

-- Registro por aluno importado (rastreabilidade)
CREATE TABLE admin_import_records (
  id uuid PK default gen_random_uuid(),
  batch_id uuid references admin_import_batches(id) on delete cascade,
  user_id uuid not null,
  simulado_id uuid not null,
  finalizacao_id uuid,        -- FK lógica para simulados_finalizados.id
  status text not null,       -- imported|skipped|replaced|failed
  reason text,
  created_at timestamptz default now(),
  UNIQUE(batch_id, user_id, simulado_id)  -- idempotência
);
```

RLS: ambas só admin pode ler/inserir (`has_role(auth.uid(),'admin')`).

## Critérios de pronto

- [ ] Admin consegue baixar template, subir planilha, ver preview, confirmar e ver relatório final.
- [ ] Reenviar a mesma planilha não cria duplicata (batch idempotente).
- [ ] Aluno importado vê o desempenho na sua tela exatamente como se tivesse feito normalmente (Felipe é a referência).
- [ ] Aluno que já tinha finalizado: comportamento controlado pelo toggle (skip ou replace com histórico).
- [ ] Erros nunca corrompem dados parciais — cada aluno é atômico.
- [ ] Audit log registra cada importação.
- [ ] Funciona com 500+ alunos sem timeout.
- [ ] Nada do que já está em `answer_progress` hoje é tocado por essa feature.

## Fora do escopo (intencionalmente)

- Limpeza dos dados FUNEPE duplicados existentes — fica para outra etapa, com sua aprovação explícita e com plano dedicado de quarentena/rollback.
- Criação de usuários novos a partir do CSV — admin deve usar a feature B2B existente primeiro.
- Importação de questões (já existe na aba Simulados).
