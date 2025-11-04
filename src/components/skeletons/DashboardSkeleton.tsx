import { Skeleton } from '@/components/ui/skeleton';

export const DashboardSkeleton = () => {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Métricas principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border rounded-lg bg-card p-6 space-y-3">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de linha */}
          <div className="border border-border rounded-lg bg-card p-6 space-y-4">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>

          {/* Gráfico de pizza */}
          <div className="border border-border rounded-lg bg-card p-6 space-y-4">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <div className="flex items-center justify-center">
              <Skeleton className="h-48 w-48 rounded-full" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32 rounded-lg" />
                  <Skeleton className="h-4 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de atividades */}
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <Skeleton className="h-6 w-48 rounded-lg" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full max-w-md rounded-lg" />
                  <Skeleton className="h-3 w-48 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
