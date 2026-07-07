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
    import_batches_falha_7d: Array<{
      id: string;
      simulado_nome: string;
      source_label: string;
      failed_count: number;
      total_rows: number;
      status: string;
      created_at: string;
    }>;
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
    retry: false, // fetchAdminCommandCenter já faz retry com backoff.
    enabled,
  });

  const attention: AdminAttentionCounts | null = query.data
    ? {
        simuladosEncerrandoHoje: query.data.attention.simulados_encerrando_hoje.length,
        importBatchesFalha7d: query.data.attention.import_batches_falha_7d.length,
        feedbacksPendentes: query.data.attention.feedbacks_pendentes.total,
        iesSemSimuladoAtivo: query.data.attention.ies_sem_simulado_ativo.length,
      }
    : null;

  return {
    attention,
    /**
     * Detalhe cru de `attention` (listas por fila) — usado pelo Command
     * Center para os exemplos reais dos cards ("UEA, UFRJ e mais 20"). A
     * sidebar só precisa das contagens (`attention`); este campo é aditivo e
     * não afeta quem já consome só `attention`/`kpis`/`auditRecentes`.
     */
    attentionDetail: query.data?.attention ?? null,
    kpis: query.data?.kpis ?? null,
    auditRecentes: query.data?.audit_recentes ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    /** Retry manual (ex.: botão "Tentar novamente" do AdminError). */
    refetch: query.refetch,
  };
}
