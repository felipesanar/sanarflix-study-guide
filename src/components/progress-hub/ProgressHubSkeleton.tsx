import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const ProgressHubSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <CardContent className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-center gap-4 lg:gap-6">
              <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 lg:items-end xl:items-center lg:justify-end">
              <Skeleton className="h-12 w-32 rounded-xl" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next actions */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl border">
                <Skeleton className="h-5 w-24 mb-2 rounded-full" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-3/4 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Consistency */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Evolution */}
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  <Skeleton className="h-3 w-16 mx-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Semester map skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
