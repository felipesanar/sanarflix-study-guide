import React from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RiskAlert {
  id: string;
  materia: string;
  tema: string;
  days_inactive: number;
  percentage: number;
}

interface RiskAlertBannerProps {
  alerts: RiskAlert[];
  onDismiss?: (alertId: string) => void;
  onNavigate?: (materia: string, tema: string) => void;
}

export const RiskAlertBanner: React.FC<RiskAlertBannerProps> = ({
  alerts,
  onDismiss,
  onNavigate,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  const handleDismiss = (alertId: string) => {
    setDismissedIds(prev => new Set(prev).add(alertId));
    onDismiss?.(alertId);
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  // Show only the most critical alert (longest inactive)
  const topAlert = visibleAlerts.sort((a, b) => b.days_inactive - a.days_inactive)[0];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={topAlert.id}
        initial={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
        className={cn(
          "relative flex items-center gap-3 p-3 sm:p-4 rounded-xl border",
          "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50"
        )}
        role="alert"
        aria-live="polite"
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Atenção com <span className="font-semibold">{topAlert.tema}</span>
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Você não estudou este tema há {topAlert.days_inactive} dias • {topAlert.percentage}% concluído
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-900/50 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onNavigate?.(topAlert.materia, topAlert.tema)}
          >
            <span className="hidden sm:inline mr-1">Estudar</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleDismiss(topAlert.id)}
            aria-label="Dispensar alerta"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Badge for more alerts */}
        {visibleAlerts.length > 1 && (
          <div className="absolute -top-2 -right-2">
            <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
              +{visibleAlerts.length - 1}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
