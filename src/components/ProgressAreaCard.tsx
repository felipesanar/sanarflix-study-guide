import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ProgressAreaCardProps {
  title: string;
  current: number;
  total: number;
  percentage: number;
  icon?: React.ReactNode;
  variant?: 'general' | 'area' | 'weeks';
}

export const ProgressAreaCard: React.FC<ProgressAreaCardProps> = ({
  title,
  current,
  total,
  percentage,
  icon,
  variant = 'area'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'general':
        return {
          card: 'ui-card shadow-lg',
          title: 'text-foreground font-bold text-lg',
          progress: 'h-4'
        };
      case 'weeks':
        return {
          card: 'ui-card shadow-md border-[hsl(var(--active-selection))]',
          title: 'text-foreground font-semibold',
          progress: 'h-3'
        };
      default:
        return {
          card: 'ui-card shadow-md hover:shadow-lg transition-shadow',
          title: 'text-foreground font-semibold',
          progress: 'h-3'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={`transition-all duration-300 hover:scale-[1.02] ${styles.card}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-sm flex items-center gap-2 ${styles.title}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{current}</span>
              <span className="text-sm text-muted-foreground">/ {total}</span>
            </div>
            <span className="text-sm font-semibold px-2 py-1 rounded-full bg-[hsl(var(--secondary))] text-foreground">
              {percentage}%
            </span>
          </div>
          
          <Progress 
            value={percentage} 
            className={`${styles.progress}`}
            style={variant === 'weeks' ? ({ ['--progress-indicator' as any]: '207 89% 68%' } as React.CSSProperties) : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
};