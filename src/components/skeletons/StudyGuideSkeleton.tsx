import { Skeleton } from '@/components/ui/skeleton';

export const StudyGuideSkeleton = () => {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com filtros */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-32 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Seletor de semestre */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-24 rounded-lg flex-shrink-0" />
          ))}
        </div>

        {/* Cards de matérias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border border-border rounded-lg bg-card p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-full rounded-lg" />
                  <Skeleton className="h-4 w-2/3 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg ml-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-20 rounded-lg" />
                  <Skeleton className="h-3 w-12 rounded-lg" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
