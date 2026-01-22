import { Skeleton } from '@/components/ui/skeleton';

export const HomePageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background mesh */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none opacity-50" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 lg:py-10 space-y-6">
        {/* Hero Section Skeleton */}
        <div className="rounded-2xl card-premium p-6 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-12 w-64 rounded-lg" />
              <Skeleton className="h-5 w-80 rounded-lg" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-14 w-48 rounded-xl" />
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr] gap-6">
          {/* Welcome was above - now announcements */}
          <div className="rounded-2xl card-premium p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/10">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
          
          {/* Ranking skeleton */}
          <div className="rounded-2xl card-premium p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/10 space-y-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="p-4 rounded-xl bg-muted/10 space-y-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>

        {/* Row 3: Performance + Semester */}
        <div className="hidden lg:grid grid-cols-2 gap-6">
          {/* Performance skeleton */}
          <div className="rounded-2xl card-premium p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex justify-center py-4">
              <Skeleton className="h-36 w-36 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
          
          {/* Semester skeleton */}
          <div className="rounded-2xl card-premium p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/10 space-y-2">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Layout Skeleton */}
        <div className="lg:hidden space-y-4">
          {/* Announcements */}
          <Skeleton className="h-40 rounded-2xl" />
          
          {/* Meu Dia */}
          <div className="rounded-2xl card-premium p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-20" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Performance */}
          <div className="rounded-2xl card-premium p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="flex justify-center py-2">
              <Skeleton className="h-28 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
