import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';

const RPC_TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout após ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** Linha de `import_batches_falha_7d` — mesma forma no array legado e no `rows` do shape novo. */
export interface ImportBatchFalhaRow {
  id: string;
  simulado_nome: string;
  source_label: string;
  failed_count: number;
  total_rows: number;
  status: string;
  created_at: string;
}

/**
 * Payload da RPC `admin_command_center()` (contrato de implementação do
 * Admin, §Backend·1). A RPC ainda NÃO está nos tipos gerados do Supabase
 * (`src/integrations/supabase/types.ts`) — está pendente de aplicação via
 * Lovable no projeto `gvqv`. Quando `admin_command_center` entrar em
 * `types.ts`, trocar o cast em {@link fetchAdminCommandCenter} pelo tipo
 * gerado (`Database['public']['Functions']['admin_command_center']['Returns']`)
 * e remover este espelho manual.
 */
export interface AdminCommandCenterPayload {
  kpis: {
    alunos_total: number;
    alunos_ativos_30d: number;
    ies_parceiras: number;
    simulados_publicados: number;
    finalizacoes_7d: number;
  };
  attention: {
    simulados_encerrando_hoje: Array<{ id: string; nome: string; data_encerramento: string }>;
    /**
     * P2 (auditoria §7): shape ANTIGO (pré-migration `20260708122000_admin_command_center_v2`)
     * é um array cru capado em `LIMIT 10` pela RPC — o badge da fila subcontava
     * falhas quando havia mais de 10 na semana. O shape NOVO é
     * `{ total, rows }`, com `total` real (sem cap) e `rows` = as 10 primeiras
     * (para os exemplos da fila). Os dois formatos convivem aqui porque o
     * client pode rodar em prod ANTES da migration ser aplicada — ver
     * {@link normalizeImportBatchesFalha}.
     */
    import_batches_falha_7d: ImportBatchFalhaRow[] | { total: number; rows: ImportBatchFalhaRow[] };
    feedbacks_pendentes: { total: number; by_category: Record<string, number> };
    ies_sem_simulado_ativo: Array<{ id: string; nome: string }>;
  };
  audit_recentes: Array<{
    id: string;
    created_at: string;
    action: string;
    admin_nome: string;
    target_email: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

/**
 * Detalhe de `attention` já normalizado — mesmo shape de
 * `AdminCommandCenterPayload['attention']`, exceto `import_batches_falha_7d`,
 * sempre `{ total, rows }` independente da versão da RPC em prod.
 */
export interface AdminAttentionDetail {
  simulados_encerrando_hoje: AdminCommandCenterPayload['attention']['simulados_encerrando_hoje'];
  import_batches_falha_7d: { total: number; rows: ImportBatchFalhaRow[] };
  feedbacks_pendentes: AdminCommandCenterPayload['attention']['feedbacks_pendentes'];
  ies_sem_simulado_ativo: AdminCommandCenterPayload['attention']['ies_sem_simulado_ativo'];
}

/**
 * Normaliza `import_batches_falha_7d` para `{ total, rows }` — fallback
 * retrocompatível (P2 auditoria §7b): se a RPC ainda devolve o array cru
 * (shape antigo, pré-migration), `total` vira `array.length` (capado em 10,
 * igual ao comportamento atual); se já devolve o objeto novo, usa `total`
 * direto (sem cap) e cai para `rows.length` só se `total` vier ausente.
 */
function normalizeImportBatchesFalha(
  raw: AdminCommandCenterPayload['attention']['import_batches_falha_7d'],
): { total: number; rows: ImportBatchFalhaRow[] } {
  if (Array.isArray(raw)) {
    return { total: raw.length, rows: raw };
  }
  const rows = raw?.rows ?? [];
  return { total: raw?.total ?? rows.length, rows };
}

/**
 * Contagens de atenção derivadas de `attention` — o vocabulário que os badges
 * da sidebar (ver {@link ../../experiences/admin/AdminNav.AdminNavItem.badgeKey})
 * e o Command Center consomem. Nunca inclui número inventado: quando a RPC
 * falha/carrega, o hook devolve `attention: null` e o chamador simplesmente
 * omite o badge/valor.
 */
export interface AdminAttentionCounts {
  simuladosEncerrandoHoje: number;
  importBatchesFalha7d: number;
  feedbacksPendentes: number;
  iesSemSimuladoAtivo: number;
}

async function fetchAdminCommandCenter(): Promise<AdminCommandCenterPayload> {
  return withRetry(async () => {
    // `admin_command_center` ainda não está nos tipos gerados do Supabase (RPC
    // pendente de aplicação — ver JSDoc de AdminCommandCenterPayload). Cast
    // local e documentado, no mesmo padrão já usado no repo para objetos de
    // schema fora dos tipos gerados (ex.: `(supabase as any).from(...)` em
    // `useNotificationPreferences.ts`).
    const rpcPromise = Promise.resolve(
      (supabase.rpc as (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
        'admin_command_center',
      ),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'admin_command_center');
    if (result.error) throw new Error(`admin_command_center: ${result.error.message}`);
    return result.data as unknown as AdminCommandCenterPayload;
  });
}

/**
 * Fila de atenção do admin — dados de `admin_command_center()` (contrato
 * §Backend·1), compartilhados pela sidebar (badges de contagem: Simulados
 * encerrando, IES sem simulado, Feedbacks pendentes) e pelo Command Center
 * (`/admin` index). React Query com `staleTime` de 60s.
 *
 * Em erro ou enquanto carrega, `attention` é `null` — os badges simplesmente
 * não aparecem (nunca um número inventado). Passe `enabled: false` quando o
 * shell não deve chamar a RPC (ex.: portal CX, que não tem `admin.tools`).
 */
export function useAdminAttention(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: ['admin', 'command-center'],
    queryFn: fetchAdminCommandCenter,
    staleTime: 60_000,
    // Este hook roda no AdminLayout inteiro (alimenta o badge da sidebar em
    // TODAS as 11 seções do admin), não só no Command Center — um badge sem
    // SLA de 60s não justifica bater a RPC agregada `admin_command_center` a
    // cada minuto durante a sessão inteira. 5min é fresco o bastante para
    // contadores de atenção; o Command Center em si continua fresco de fato
    // ao navegar via `refetchOnMount: 'always'` abaixo.
    refetchInterval: 300_000,
    refetchOnMount: 'always',
    // fetchAdminCommandCenter usa withRetry, mas withRetry só reage a erros de
    // rede/HTTP reconhecíveis (ver isRecoverableError em networkRetry.ts) —
    // erros de RPC (ex.: permissão) não têm `status` e não são re-tentados. O
    // refetchInterval acima é o gatilho real de atualização periódica.
    retry: false,
    enabled,
  });

  const importBatchesFalha7d = query.data
    ? normalizeImportBatchesFalha(query.data.attention.import_batches_falha_7d)
    : null;

  const attention: AdminAttentionCounts | null = query.data
    ? {
        simuladosEncerrandoHoje: query.data.attention.simulados_encerrando_hoje.length,
        importBatchesFalha7d: importBatchesFalha7d?.total ?? 0,
        feedbacksPendentes: query.data.attention.feedbacks_pendentes.total,
        iesSemSimuladoAtivo: query.data.attention.ies_sem_simulado_ativo.length,
      }
    : null;

  const attentionDetail: AdminAttentionDetail | null = query.data
    ? {
        simulados_encerrando_hoje: query.data.attention.simulados_encerrando_hoje,
        import_batches_falha_7d: importBatchesFalha7d ?? { total: 0, rows: [] },
        feedbacks_pendentes: query.data.attention.feedbacks_pendentes,
        ies_sem_simulado_ativo: query.data.attention.ies_sem_simulado_ativo,
      }
    : null;

  return {
    attention,
    /**
     * Detalhe de `attention` (listas por fila), com `import_batches_falha_7d`
     * já normalizado para `{ total, rows }` — usado pelo Command Center para
     * os exemplos reais dos cards ("UEA, UFRJ e mais 20"). A sidebar só
     * precisa das contagens (`attention`); este campo é aditivo e não afeta
     * quem já consome só `attention`/`kpis`/`auditRecentes`.
     */
    attentionDetail,
    kpis: query.data?.kpis ?? null,
    auditRecentes: query.data?.audit_recentes ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    /** Retry manual (ex.: botão "Tentar novamente" do AdminError). */
    refetch: query.refetch,
  };
}
