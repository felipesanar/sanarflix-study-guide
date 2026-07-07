import * as React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { GestorPanel } from '@/experiences/gestor/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import type { DiagnosticoDrillState } from './types';

interface ThemeEvolutionEntry {
  simulado_nome: string;
  created_at: string;
  percentual: number;
}

interface AccuracyEvolutionCardProps {
  drill: DiagnosticoDrillState;
  /** Nome do tema selecionado — só existe quando o usuário abriu uma linha de tema. */
  temaName?: string;
  iesId?: string;
}

/** Recorte textual exibido no subtítulo do card, conforme o nível do drill-down. */
function recorteLabel(drill: DiagnosticoDrillState, temaName?: string): string {
  if (temaName) return temaName;
  if (drill.especialidade) return drill.especialidade.name;
  if (drill.area) return drill.area.name;
  return 'Exame completo';
}

/**
 * Card lateral "Evolução de acurácia" — sparkline com a série histórica do
 * recorte atual. Fonte real: RPC `get_theme_evolution`, que só existe no
 * grão de TEMA (folha da árvore curricular). Para os níveis Área e
 * Especialidade não há série histórica no backend hoje — divergência
 * documentada no contrato (`PLANO-IMPLEMENTACAO.md`, seção B): mostramos um
 * estado vazio curto em vez de inventar dado.
 *
 * O comparativo IES/grupo/rede citado no contrato também não existe no
 * backend atual — só a série da própria IES está disponível.
 */
export const AccuracyEvolutionCard: React.FC<AccuracyEvolutionCardProps> = ({
  drill,
  temaName,
  iesId,
}) => {
  const [entries, setEntries] = React.useState<ThemeEvolutionEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [errored, setErrored] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    if (!temaName) {
      setEntries([]);
      setErrored(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setErrored(false);
    supabase
      .rpc('get_theme_evolution', { p_tema: temaName, p_ies_id: iesId ?? null })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          Logger.warn('[AccuracyEvolutionCard] get_theme_evolution error:', error.message);
          setErrored(true);
          setEntries([]);
          return;
        }
        setEntries((data ?? []) as unknown as ThemeEvolutionEntry[]);
      })
      .catch((err) => {
        if (cancelled) return;
        Logger.warn('[AccuracyEvolutionCard] get_theme_evolution exception:', err);
        setErrored(true);
        setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [temaName, iesId]);

  const subtitle = `${recorteLabel(drill, temaName)} · últimos simulados`;

  return (
    <GestorPanel title="Evolução de acurácia" subtitle={subtitle} icon={TrendingUp}>
      {!temaName ? (
        <EmptySeries
          reason={
            drill.level !== 'temas'
              ? 'Evolução disponível apenas por tema — entre em um tema para ver a série.'
              : 'Selecione um tema na lista.'
          }
        />
      ) : loading ? (
        <Skeleton className="h-[160px] w-full rounded-lg" />
      ) : errored || entries.length <= 1 ? (
        <EmptySeries reason="Sem série suficiente para este tema — a evolução aparece após múltiplos simulados." />
      ) : (
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={entries} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Acurácia']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.simulado_nome ?? ''}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="percentual"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Comparativo com IES do grupo e rede ainda não disponível — exibindo apenas a IES ativa.
      </p>
    </GestorPanel>
  );
};

const EmptySeries: React.FC<{ reason: string }> = ({ reason }) => (
  <div className="flex h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
    <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    <p className="max-w-[220px] text-xs text-muted-foreground">{reason}</p>
  </div>
);
