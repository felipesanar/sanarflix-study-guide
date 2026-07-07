import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataBadge, StatCard } from '@/experiences/admin/ui';
import type { AdminCommandCenterPayload } from '@/services/admin/useAdminAttention';

export interface PlatformHealthPanelProps {
  kpis: AdminCommandCenterPayload['kpis'];
}

const numberFormatter = new Intl.NumberFormat('pt-BR');

/**
 * Painel "Saúde da plataforma" (contrato §A) — DataBadge "DADOS REAIS" + 5
 * KPIs de `admin_command_center().kpis` + aviso fixo sobre métricas que ainda
 * não são reais (tempo médio de prova, taxa de abandono), com link para o
 * Monitoramento.
 */
export const PlatformHealthPanel: React.FC<PlatformHealthPanelProps> = ({ kpis }) => {
  const stats: Array<{ label: string; value: number }> = [
    { label: 'Alunos', value: kpis.alunos_total },
    { label: 'Ativos 30d', value: kpis.alunos_ativos_30d },
    { label: 'IES parceiras', value: kpis.ies_parceiras },
    { label: 'Simulados publicados', value: kpis.simulados_publicados },
    { label: 'Finalizações 7d', value: kpis.finalizacoes_7d },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-xl border bg-card p-4 lg:col-span-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Saúde da plataforma</h2>
        <DataBadge kind="real" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={numberFormatter.format(stat.value)} />
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-2 border-t border-dashed pt-3 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="flex-1">
          Tempo médio de prova e taxa de abandono não são métricas reais hoje.{' '}
          <Link to="/admin/monitoramento" className="font-medium text-primary hover:underline">
            Ver monitoramento →
          </Link>
        </p>
      </div>
    </motion.section>
  );
};
