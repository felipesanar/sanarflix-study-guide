import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataBadge, MonoValue, StatusPill, AdminLoading, AdminError, AdminEmpty } from '@/experiences/admin/ui';
import { useAdminQuestionErrorRates, useSimuladosParaSelecao } from '@/services/admin/monitor';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<'aguardando' | 'ativo' | 'encerrado', string> = {
  ativo: 'Em andamento',
  aguardando: 'Agendado',
  encerrado: 'Encerrado',
};

function severityClass(pct: number): string {
  if (pct >= 70) return 'bg-red-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-muted-foreground/50';
}

/**
 * Bloco "Questões com maior taxa de erro" — dado real via
 * `admin_question_error_rates(p_simulado_id)`, com seletor de simulado
 * (ativos primeiro) e link por linha para a tela de questões em Simulados.
 */
export function ErrorRatesBlock() {
  const { data: simulados, isLoading: loadingSimulados } = useSimuladosParaSelecao();
  const [simuladoId, setSimuladoId] = useState<string | null>(null);

  useEffect(() => {
    if (!simuladoId && simulados && simulados.length > 0) {
      setSimuladoId(simulados[0].id);
    }
  }, [simulados, simuladoId]);

  const { data: rates, isLoading: loadingRates, isError, refetch } = useAdminQuestionErrorRates(simuladoId);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Questões com maior taxa de erro
        </span>
        <DataBadge kind="real" />
      </div>

      {loadingSimulados && <AdminLoading rows={1} rowHeight="h-10" />}
      {!loadingSimulados && (!simulados || simulados.length === 0) && (
        <AdminEmpty title="Nenhum simulado cadastrado" description="Crie um simulado em Simulados para ver a taxa de erro por questão." />
      )}
      {!loadingSimulados && simulados && simulados.length > 0 && (
        <Select value={simuladoId ?? undefined} onValueChange={setSimuladoId}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Selecione um simulado" />
          </SelectTrigger>
          <SelectContent>
            {simulados.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome} · {STATUS_LABEL[s.status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {simuladoId && loadingRates && <AdminLoading rows={4} />}
      {simuladoId && !loadingRates && isError && (
        <AdminError message="Não foi possível carregar admin_question_error_rates." onRetry={() => refetch()} />
      )}
      {simuladoId && !loadingRates && !isError && rates && rates.length === 0 && (
        <AdminEmpty title="Sem respostas registradas" description="Este simulado ainda não tem respostas suficientes para calcular taxa de erro." />
      )}
      {simuladoId && !loadingRates && !isError && rates && rates.length > 0 && (
        <div className="space-y-2">
          {rates.map((q) => (
            <div key={q.question_id} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <MonoValue>Q{q.numero_questao}</MonoValue>
                  <span className="text-muted-foreground">
                    {q.grande_area} · {q.tema}
                  </span>
                  {q.anulada && <StatusPill variant="amber">ANULADA</StatusPill>}
                </div>
                <MonoValue className="text-sm font-semibold">{q.pct_erro}%</MonoValue>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', severityClass(q.pct_erro))}
                  style={{ width: `${Math.min(100, Math.max(0, q.pct_erro))}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {q.erros}/{q.total_respostas} erros · candidatas a revisão pedagógica ou anulação
                </p>
                <Link to="/admin/simulados" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Ver questões <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
