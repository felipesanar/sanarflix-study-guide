import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GuideSkeletonsProps {
  className?: string;
}

export const GuidePageSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-12 w-72 rounded-xl" />
      </div>

      {/* Hero card skeleton */}
      <HeroCardSkeleton />

      {/* Toolbar skeleton */}
      <ToolbarSkeleton />

      {/* Chips skeleton */}
      <ChipsSkeleton />

      {/* Subject cards skeleton */}
      <div className="space-y-6">
        <SubjectCardSkeleton />
        <SubjectCardSkeleton />
      </div>

      {/* Loading message */}
      <div className="flex items-center justify-center py-4">
        <p className="text-sm text-muted-foreground animate-pulse">
          Carregando seu guia de estudos...
        </p>
      </div>
    </div>
  );
};

export const HeroCardSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <Card className={cn("p-6 sm:p-8", className)}>
      <div className="animate-pulse space-y-4">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-8 w-3/4" />
        <div className="p-3 rounded-xl bg-muted/30">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-12 w-32 rounded-xl" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </Card>
  );
};

export const ToolbarSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-52 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-52 rounded-xl" />
    </div>
  );
};

export const ChipsSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <div className={cn("flex gap-2 overflow-hidden", className)}>
      <Skeleton className="h-10 w-40 rounded-xl shrink-0" />
      <Skeleton className="h-10 w-36 rounded-xl shrink-0" />
      <Skeleton className="h-10 w-44 rounded-xl shrink-0" />
      <Skeleton className="h-10 w-32 rounded-xl shrink-0" />
      <Skeleton className="h-10 w-40 rounded-xl shrink-0" />
    </div>
  );
};

export const SubjectCardSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="animate-pulse space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-40 ml-auto" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-6">
        <div className="animate-pulse space-y-3">
          <AccordionItemSkeleton />
          <AccordionItemSkeleton />
          <AccordionItemSkeleton />
        </div>
      </CardContent>
    </Card>
  );
};

export const AccordionItemSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <div className={cn("p-4 rounded-xl border border-border/30", className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-4 w-4 rounded" />
      </div>
    </div>
  );
};

export const LessonRowSkeleton: React.FC<GuideSkeletonsProps> = ({ className }) => {
  return (
    <div className={cn("p-4 rounded-xl border border-border/30", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-5 w-5 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export individual skeletons
export const GuideSkeletons = {
  Page: GuidePageSkeleton,
  HeroCard: HeroCardSkeleton,
  Toolbar: ToolbarSkeleton,
  Chips: ChipsSkeleton,
  SubjectCard: SubjectCardSkeleton,
  AccordionItem: AccordionItemSkeleton,
  LessonRow: LessonRowSkeleton,
};
