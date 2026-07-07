import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';
import { Logger } from '@/utils/logger';

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
 * Payload da RPC `admin_monitor_summary()` (contrato de implementação do
 * Admin, §Backend·7). `em_prova_agora` é `null` DE PROPÓSITO — requer
 * heartbeat de sessão de prova (instrumentação ainda não existe); a tela
 * mostra "—" + badge REQUER INSTRUMENTAÇÃO, nunca um número inventado.
 */
export interface AdminMonitorSummary {
  finalizacoes_hoje: number;
  finalizacoes_ontem: number;
  integridade_24h: { finalizacoes_com_3mais_saidas: number };
  em_prova_agora: null;
}

/** Linha da RPC `admin_question_error_rates(p_simulado_id)` (§Backend·8), ordenada por pct_erro desc. */
export interface AdminQuestionErrorRate {
  question_id: string;
  numero_questao: number;
  grande_area: string;
  tema: string;
  anulada: boolean;
  total_respostas: number;
  erros: number;
  pct_erro: number;
}

/** Opção de simulado para o seletor do bloco de taxa de erro — deriva o mesmo status client-side do SimuladosTab. */
export interface SimuladoOption {
  id: string;
  nome: string;
  status: 'aguardando' | 'ativo' | 'encerrado';
  created_at: string;
}

// Mesma lógica de `calcularStatusSimulado` em SimuladosTab.tsx — mantida em
// sincronia deliberadamente (duplicação pequena e local; ambas as fatias leem
// a mesma tabela `simulados_admin`, sem RPC compartilhada para status).
function calcularStatusSimulado(
  dataLiberacao: string | null,
  dataEncerramento: string | null,
  statusBanco: string,
): 'aguardando' | 'ativo' | 'encerrado' {
  const agora = new Date();
  if (statusBanco === 'encerrado') return 'encerrado';
  if (dataEncerramento && new Date(dataEncerramento) < agora) return 'encerrado';
  if (dataLiberacao && new Date(dataLiberacao) > agora) return 'aguardando';
  return 'ativo';
}

async function fetchAdminMonitorSummary(): Promise<AdminMonitorSummary> {
  return withRetry(async () => {
    // `admin_monitor_summary` ainda não está nos tipos gerados do Supabase —
    // cast local e documentado (mesmo padrão de useAdminAttention.ts/logAction.ts).
    const rpcPromise = Promise.resolve(
      (supabase.rpc as (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
        'admin_monitor_summary',
      ),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'admin_monitor_summary');
    if (result.error) throw new Error(`admin_monitor_summary: ${result.error.message}`);
    return result.data as unknown as AdminMonitorSummary;
  });
}

async function fetchAdminQuestionErrorRates(simuladoId: string): Promise<AdminQuestionErrorRate[]> {
  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      (supabase.rpc as (fn: string, params: { p_simulado_id: string }) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
        'admin_question_error_rates',
        { p_simulado_id: simuladoId },
      ),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'admin_question_error_rates');
    if (result.error) throw new Error(`admin_question_error_rates: ${result.error.message}`);
    return (result.data ?? []) as unknown as AdminQuestionErrorRate[];
  });
}

async function fetchSimuladosParaSelecao(): Promise<SimuladoOption[]> {
  const { data, error } = await supabase
    .from('simulados_admin')
    .select('id, nome, status, data_liberacao, data_encerramento, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`simulados_admin: ${error.message}`);

  const options = (data ?? []).map((s) => ({
    id: String(s.id),
    nome: s.nome as string,
    status: calcularStatusSimulado(s.data_liberacao as string | null, s.data_encerramento as string | null, s.status as string),
    created_at: s.created_at as string,
  }));

  // Ativos primeiro, depois por created_at desc (já vem ordenado por created_at; só reordenamos por status).
  const rank: Record<SimuladoOption['status'], number> = { ativo: 0, aguardando: 1, encerrado: 2 };
  return options.sort((a, b) => rank[a.status] - rank[b.status]);
}

/** Resumo de monitoramento (`admin_monitor_summary`) — React Query com staleTime 60s. */
export function useAdminMonitorSummary() {
  return useQuery({
    queryKey: ['admin', 'monitor-summary'],
    queryFn: fetchAdminMonitorSummary,
    staleTime: 60_000,
    retry: false, // fetchAdminMonitorSummary já faz retry com backoff.
  });
}

/** Lista de simulados para o seletor do bloco "Questões com maior taxa de erro" — ativos primeiro. */
export function useSimuladosParaSelecao() {
  return useQuery({
    queryKey: ['admin', 'monitor-simulados-selecao'],
    queryFn: fetchSimuladosParaSelecao,
    staleTime: 60_000,
  });
}

/** Taxas de erro por questão de um simulado (`admin_question_error_rates`) — staleTime 60s. */
export function useAdminQuestionErrorRates(simuladoId: string | null) {
  return useQuery({
    queryKey: ['admin', 'monitor-question-error-rates', simuladoId],
    queryFn: () => fetchAdminQuestionErrorRates(simuladoId as string),
    enabled: Boolean(simuladoId),
    staleTime: 60_000,
    retry: false,
    meta: { onError: (err: unknown) => Logger.warn('[Monitor] admin_question_error_rates falhou:', err) },
  });
}
