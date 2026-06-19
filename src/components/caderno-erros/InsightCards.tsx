import React from 'react';
import { AlertTriangle, AlertCircle, TrendingUp, Info, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCadernoInsights } from '@/hooks/useCadernoInsights';
import type { InsightSeverity } from '@/lib/cadernoInsights';

const SEVERITY_STYLE: Record<InsightSeverity, { border: string; icon: React.ReactNode; tone: string }> = {
  critical: { border: 'border-red-500/30 bg-red-500/5', tone: 'text-red-600 dark:text-red-400', icon: <AlertTriangle className="h-4 w-4" /> },
  attention: { border: 'border-amber-500/30 bg-amber-500/5', tone: 'text-amber-600 dark:text-amber-400', icon: <AlertCircle className="h-4 w-4" /> },
  positive: { border: 'border-emerald-500/30 bg-emerald-500/5', tone: 'text-emerald-600 dark:text-emerald-400', icon: <TrendingUp className="h-4 w-4" /> },
  info: { border: 'border-border bg-muted/30', tone: 'text-muted-foreground', icon: <Info className="h-4 w-4" /> },
};

export const InsightCards: React.FC = () => {
  const { insights, loading } = useCadernoInsights();

  if (loading || insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Diagnóstico do seu caderno</h3>
      </div>
      {insights.map((ins, i) => {
        const s = SEVERITY_STYLE[ins.severity];
        return (
          <motion.div key={`${ins.type}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.2) }}>
            <Card className={cn('border', s.border)}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn('mt-0.5 shrink-0', s.tone)}>{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                    {ins.metric && <span className={cn('text-xs font-mono tabular-nums shrink-0', s.tone)}>{ins.metric}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.body}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
