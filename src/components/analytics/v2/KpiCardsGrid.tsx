import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Users, Target, School, BarChart3, TrendingUp, AlertTriangle, ArrowUpRight, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { KpiData } from '@/mocks/desempenhoInstitucionalV2';

const iconMap: Record<string, React.ElementType> = {
  Users, Target, School, BarChart3, TrendingUp, AlertTriangle, ArrowUpRight, CheckCircle,
};

const statusColors: Record<string, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
  neutral: 'text-muted-foreground',
};

const statusBg: Record<string, string> = {
  good: 'bg-emerald-50 dark:bg-emerald-950/30',
  warning: 'bg-amber-50 dark:bg-amber-950/30',
  critical: 'bg-red-50 dark:bg-red-950/30',
  neutral: 'bg-muted/50',
};

interface Props {
  kpis: KpiData[];
}

export const KpiCardsGrid: React.FC<Props> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = iconMap[kpi.icon] || BarChart3;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card className="hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', statusBg[kpi.status])}>
                  <Icon className={cn('h-5 w-5', statusColors[kpi.status])} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className={cn('text-xl font-bold mt-0.5', statusColors[kpi.status])}>
                    {kpi.value}
                  </p>
                  {kpi.description && (
                    <p className="text-[10px] text-muted-foreground mt-1">{kpi.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
