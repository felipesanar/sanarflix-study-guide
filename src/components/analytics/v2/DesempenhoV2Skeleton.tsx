import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const DesempenhoV2Skeleton: React.FC = () => (
  <div className="space-y-5">
    {/* Header */}
    <div className="space-y-2">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-full max-w-[32rem]" />
    </div>
    {/* KPI grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
    <Skeleton className="h-64 rounded-xl" />
  </div>
);
