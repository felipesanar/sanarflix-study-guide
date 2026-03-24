import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { DistanciaFaixa } from '@/mocks/desempenhoInstitucionalV2';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  good: { icon: ArrowUpRight, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  critical: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/30' },
  neutral: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

interface Props {
  items: DistanciaFaixa[];
}

export const DistanciaFaixaCards: React.FC<Props> = ({ items }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((item, i) => {
        const cfg = statusConfig[item.status];
        const Icon = cfg.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05, duration: 0.3 }}
          >
            <Card className="hover:shadow-md transition-shadow duration-200 h-full">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', cfg.bg)}>
                  <Icon className={cn('h-5 w-5', cfg.color)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={cn('text-2xl font-bold mt-0.5', cfg.color)}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
