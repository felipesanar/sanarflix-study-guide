
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ProgressCardProps {
  title: string;
  current: number;
  total: number;
  percentage: number;
  color?: 'primary' | 'success' | 'warning';
  icon?: React.ReactNode;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  current,
  total,
  percentage,
  color = 'primary',
  icon,
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return {
          bg: 'bg-success-50',
          text: 'text-success-700',
          progress: 'bg-success-600',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          progress: 'bg-yellow-500',
        };
      default:
        return {
          bg: 'bg-primary-50',
          text: 'text-primary-700',
          progress: 'bg-primary-600',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <Card className="hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">{current}</span>
              <span className="text-sm text-gray-500">/ {total}</span>
            </div>
            <span className={`text-sm font-semibold px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
              {percentage}%
            </span>
          </div>
          
          <Progress 
            value={percentage} 
            className="h-2"
            // Note: Custom styling for progress bar color would need to be handled via CSS
          />
        </div>
      </CardContent>
    </Card>
  );
};
