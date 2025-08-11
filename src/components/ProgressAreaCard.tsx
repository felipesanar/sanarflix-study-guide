import React from 'react';
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
          card: 'shadow-lg',
          title: 'text-[#600606] font-bold text-lg',
          progress: 'h-4'
        };
      case 'weeks':
        return {
          card: 'shadow-md',
          title: 'text-blue-700 font-semibold',
          progress: 'h-3'
        };
      default:
        return {
          card: 'bg-card shadow-md hover:shadow-lg transition-shadow',
          title: 'text-neutral-darkest font-semibold',
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
              <span className="text-2xl font-bold text-neutral-darkest">{current}</span>
              <span className="text-sm text-neutral-medium">/ {total}</span>
            </div>
            <span className="text-sm font-semibold px-2 py-1 rounded-full bg-[#FDD] text-[#600606]">
              {percentage}%
            </span>
          </div>
          
          <Progress 
            value={percentage} 
            className={`${styles.progress} bg-[#FDD]`}
          />
        </div>
      </CardContent>
    </Card>
  );
};