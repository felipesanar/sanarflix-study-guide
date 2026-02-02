import { Skeleton } from '@/components/ui/skeleton';

export const HomePageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background mesh */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none opacity-50" />
      
      {/* Container matching Home.tsx fluid spacing */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10 space-y-4 sm:space-y-5 md:space-y-6">
        
        {/* === DESKTOP LAYOUT (lg+) === */}
        <div className="hidden lg:block space-y-5 lg:space-y-6">
          {/* Row 1: Hero + Announcements */}
          <div className="grid grid-cols-[1.8fr_1fr] gap-5 lg:gap-6">
            {/* Hero Skeleton */}
            <div className="rounded-2xl card-premium p-6 lg:p-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-12 w-64 rounded-lg" />
                  <Skeleton className="h-5 w-80 rounded-lg" />
                </div>
                <Skeleton className="h-12 w-44 rounded-xl" />
              </div>
            </div>
            
            {/* Announcements Skeleton */}
            <Skeleton className="h-full min-h-[200px] rounded-2xl" />
          </div>

          {/* Row 2: Meu Dia + Ranking */}
          <div className="grid grid-cols-[3fr_2fr] gap-5 lg:gap-6">
            {/* Meu Dia Skeleton */}
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
            
            {/* Ranking Skeleton */}
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
          <div className="grid grid-cols-2 gap-5 lg:gap-6">
            {/* Performance Skeleton */}
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
            
            {/* Semester Skeleton */}
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
        </div>

        {/* === TABLET LAYOUT (md to lg) === */}
        <div className="hidden md:block lg:hidden space-y-4 md:space-y-5">
          {/* Row 1: Hero + Announcements */}
          <div className="grid grid-cols-[1.5fr_1fr] gap-4 md:gap-5">
            <div className="rounded-2xl card-premium p-5 md:p-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-10 w-52 rounded-lg" />
                <Skeleton className="h-4 w-64 rounded-lg" />
                <Skeleton className="h-11 w-40 rounded-xl" />
              </div>
            </div>
            <Skeleton className="h-full min-h-[180px] rounded-2xl" />
          </div>
          
          {/* Row 2: Meu Dia + Ranking */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-4 md:gap-5">
            <div className="rounded-2xl card-premium p-5 space-y-3">
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
            <div className="rounded-2xl card-premium p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>

          {/* Row 3: Performance + Semester */}
          <div className="grid grid-cols-2 gap-4 md:gap-5">
            <div className="rounded-2xl card-premium p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-28" />
              </div>
              <div className="flex justify-center py-2">
                <Skeleton className="h-28 w-28 rounded-full" />
              </div>
            </div>
            <div className="rounded-2xl card-premium p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-28" />
              </div>
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* === MOBILE LAYOUT (< md) === */}
        <div className="md:hidden space-y-3 sm:space-y-4 pb-[env(safe-area-inset-bottom)]">
          {/* Hero Skeleton - Compact */}
          <div className="rounded-xl sm:rounded-2xl card-premium p-4 sm:p-5">
            <div className="space-y-3 sm:space-y-4">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-8 sm:h-10 w-48 sm:w-56 rounded-lg" />
              <Skeleton className="h-4 w-64 rounded-lg" />
              <Skeleton className="h-10 sm:h-11 w-36 sm:w-40 rounded-lg sm:rounded-xl" />
            </div>
          </div>
          
          {/* Meu Dia Skeleton */}
          <div className="rounded-xl sm:rounded-2xl card-premium p-4 sm:p-5 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl" />
              <Skeleton className="h-4 sm:h-5 w-20" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg sm:rounded-xl bg-muted/10">
                <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl" />
                <div className="flex-1 space-y-1.5 sm:space-y-2">
                  <Skeleton className="h-3.5 sm:h-4 w-28 sm:w-32" />
                  <Skeleton className="h-3 w-16 sm:w-20" />
                </div>
              </div>
            ))}
          </div>
          
          {/* Performance Skeleton */}
          <div className="rounded-xl sm:rounded-2xl card-premium p-4 sm:p-5 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl" />
              <Skeleton className="h-4 sm:h-5 w-28" />
            </div>
            <div className="flex justify-center py-2">
              <Skeleton className="h-24 w-24 sm:h-28 sm:w-28 rounded-full" />
            </div>
          </div>

          {/* Ranking Skeleton */}
          <div className="rounded-xl sm:rounded-2xl card-premium p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl" />
              <Skeleton className="h-4 sm:h-5 w-20" />
            </div>
            <Skeleton className="h-20 sm:h-24 rounded-lg sm:rounded-xl" />
            <Skeleton className="h-20 sm:h-24 rounded-lg sm:rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};
