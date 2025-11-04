import { Skeleton } from '@/components/ui/skeleton';

export const IntensivaoSkeleton = () => {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com banner */}
        <div className="relative rounded-lg overflow-hidden">
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="absolute inset-0 flex items-end p-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 rounded-lg bg-white/20" />
              <Skeleton className="h-4 w-96 rounded-lg bg-white/20" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-lg" />
          ))}
        </div>

        {/* Lista de questões/temas */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-full max-w-2xl rounded-lg" />
                    <Skeleton className="h-4 w-full max-w-xl rounded-lg" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg ml-4" />
                </div>
                
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-32 rounded-lg" />
                    <Skeleton className="h-4 w-24 rounded-lg" />
                  </div>
                  <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
