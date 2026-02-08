import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { RiskAlert } from './types';

interface RiskAlertBannerProps {
  alerts: RiskAlert[];
  isLoading: boolean;
}

const ALERT_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: AlertCircle,
    iconColor: 'text-red-500',
    textColor: 'text-red-700 dark:text-red-400',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  positive: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
};

const TrendIcon: React.FC<{ trend?: 'up' | 'down' | 'stable'; level: 'critical' | 'warning' | 'positive' }> = ({ trend, level }) => {
  if (!trend) return null;
  
  const isGoodTrend = (level === 'positive' && trend === 'up') || (level !== 'positive' && trend === 'down');
  const color = isGoodTrend ? 'text-emerald-500' : level === 'positive' ? 'text-amber-500' : 'text-red-500';
  
  if (trend === 'up') return <TrendingUp className={`h-4 w-4 ${color}`} />;
  if (trend === 'down') return <TrendingDown className={`h-4 w-4 ${color}`} />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export const RiskAlertBanner: React.FC<RiskAlertBannerProps> = ({
  alerts,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  // Sort: critical first, then warning, then positive
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order = ['critical', 'warning', 'positive'];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {sortedAlerts.map((alert, i) => {
        const styles = ALERT_STYLES[alert.level];
        const Icon = styles.icon;
        
        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`
              flex items-center gap-3 p-3 rounded-lg border
              ${styles.bg} ${styles.border}
            `}
          >
            <Icon className={`h-5 w-5 ${styles.iconColor} flex-shrink-0`} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium text-sm ${styles.textColor}`}>
                  {alert.title}
                </span>
                <TrendIcon trend={alert.trend} level={alert.level} />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {alert.description}
              </p>
            </div>
            
            {(alert.count !== undefined || alert.percentage !== undefined) && (
              <div className="text-right flex-shrink-0">
                <div className={`font-bold ${styles.textColor}`}>
                  {alert.count !== undefined ? alert.count : `${alert.percentage}%`}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
