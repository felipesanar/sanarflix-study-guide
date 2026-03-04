import React, { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, Target, BookOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileSummaryHeader } from './MobileSummaryHeader';
import { MobileTabBar } from './MobileTabBar';
import { MobileStickyCtaBar } from './MobileStickyCtaBar';
import { AgoraTab } from './tabs/AgoraTab';
import type { ProgressHubData, NextAction, MateriaProgress, TemaProgress, SubtemaProgress, ExamInsight } from '@/types/progressHub';
import type { ProgressFilters } from '@/components/progress-hub';

// Lazy load heavy components
const ProgressoTab = lazy(() => import('./tabs/ProgressoTab').then(m => ({ default: m.ProgressoTab })));
const InsightsTab = lazy(() => import('./tabs/InsightsTab').then(m => ({ default: m.InsightsTab })));
const ProvasTab = lazy(() => import('./tabs/ProvasTab').then(m => ({ default: m.ProvasTab })));

export type MobileTab = 'agora' | 'progresso' | 'insights' | 'provas';

interface ProgressHubMobileProps {
  data: ProgressHubData;
  syncing: boolean;
  semestreWarning?: string | null;
  user?: { ies_nome?: string };
  semestreAtivo?: number | null;
  nextExam?: ExamInsight | null;
  // Filtered data
  filteredData: {
    byMateria: MateriaProgress[];
    byTema: TemaProgress[];
    bySubtema: SubtemaProgress[];
  } | null;
  // Filters
  filters: ProgressFilters;
  materiasList: string[];
  temasList: string[];
  activeFiltersCount: number;
  totalCount: number;
  filteredCount: number;
  // Handlers
  onFiltersChange: (filters: ProgressFilters) => void;
  onRemoveFilter: (key: keyof ProgressFilters) => void;
  onClearFilters: () => void;
  onContinueClick: () => void;
  onCalendarClick: () => void;
  onActionClick: (action: NextAction, type: 'view' | 'video' | 'pdf' | 'quiz') => void;
  onGoalChange: (goal: number) => void;
  onRiskNavigate: (materia: string, tema: string) => void;
  onRiskDismiss: (alertId: string) => void;
  onDiagnosticClick: (insightType: string, materia: string, tema?: string) => void;
  onCoverageClick: (materia: string, rank: number, direction: 'low' | 'high') => void;
  onChartInteract: (weekIndex: number, metric: 'aulas' | '%') => void;
  onThemeClick: (materia: string, tema: string) => void;
  onSemesterMapToggle: (materia: string, tema: string, expanded: boolean) => void;
  onExamAdded: (materia: string, daysUntil: number) => void;
  onExamRemoved: (examId: string, daysUntil: number) => void;
  onExamClicked: (examId: string, source: string) => void;
}

// Skeleton for lazy tabs
const TabSkeleton: React.FC = () => (
  <div className="space-y-4 px-4 pt-4">
    <Skeleton className="h-32 w-full rounded-xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-20 w-full rounded-xl" />
  </div>
);

export const ProgressHubMobile: React.FC<ProgressHubMobileProps> = ({
  data,
  syncing,
  semestreWarning,
  user,
  semestreAtivo,
  nextExam,
  filteredData,
  filters,
  materiasList,
  temasList,
  activeFiltersCount,
  totalCount,
  filteredCount,
  onFiltersChange,
  onRemoveFilter,
  onClearFilters,
  onContinueClick,
  onCalendarClick,
  onActionClick,
  onGoalChange,
  onRiskNavigate,
  onRiskDismiss,
  onDiagnosticClick,
  onCoverageClick,
  onChartInteract,
  onThemeClick,
  onSemesterMapToggle,
  onExamAdded,
  onExamRemoved,
  onExamClicked,
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<MobileTab>('agora');
  const [showStickyBar, setShowStickyBar] = useState(false);

  const handleExamClick = useCallback(() => {
    if (nextExam?.exam?.id) {
      onExamClicked(nextExam.exam.id, 'mobile_header');
      setActiveTab('provas');
    }
  }, [nextExam, onExamClicked]);

  // Track window scroll for sticky CTA
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleContinue = useCallback(() => {
    onContinueClick();
    navigate('/guia-estudos');
  }, [navigate, onContinueClick]);

  const handleOrganize = useCallback(() => {
    onCalendarClick();
    navigate('/guia-estudos?view=calendar&edit=true');
  }, [navigate, onCalendarClick]);

  // Tab content with AnimatePresence
  const renderTabContent = () => {
    const fadeVariants = shouldReduceMotion ? {} : {
      initial: { opacity: 0, x: 10 },
      animate: { opacity: 1, x: 0, transition: { duration: 0.2 } },
      exit: { opacity: 0, x: -10, transition: { duration: 0.15 } },
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...fadeVariants} className="min-h-[60vh]">
          {activeTab === 'agora' && (
            <AgoraTab
              nextActions={data.next_actions}
              riskAlerts={data.risk_alerts || []}
              streak={data.streak}
              syncing={syncing}
              overview={data.overview}
              byMateria={data.by_materia}
              nextExam={nextExam}
              onActionClick={onActionClick}
              onRiskNavigate={onRiskNavigate}
              onRiskDismiss={onRiskDismiss}
              onGoalChange={onGoalChange}
            />
          )}
          
          {activeTab === 'progresso' && (
            <Suspense fallback={<TabSkeleton />}>
              <ProgressoTab
                weeklyEvolution={data.weekly_evolution}
                totalContent={data.overview.total}
                byMateria={filteredData?.byMateria || data.by_materia}
                byTema={filteredData?.byTema || data.by_tema}
                bySubtema={filteredData?.bySubtema || data.by_subtema || []}
                filters={filters}
                materiasList={materiasList}
                temasList={temasList}
                activeFiltersCount={activeFiltersCount}
                totalCount={totalCount}
                filteredCount={filteredCount}
                onFiltersChange={onFiltersChange}
                onRemoveFilter={onRemoveFilter}
                onClearFilters={onClearFilters}
                onChartInteract={onChartInteract}
                onThemeClick={onThemeClick}
                onCoverageClick={onCoverageClick}
              />
            </Suspense>
          )}
          
          {activeTab === 'insights' && (
            <Suspense fallback={<TabSkeleton />}>
              <InsightsTab
                byMateria={data.by_materia}
                byTema={data.by_tema}
                onDiagnosticClick={onDiagnosticClick}
              />
            </Suspense>
          )}
          
          {activeTab === 'provas' && (
            <Suspense fallback={<TabSkeleton />}>
              <ProvasTab
                byMateria={data.by_materia}
                materiasList={materiasList}
                onExamAdded={onExamAdded}
                onExamRemoved={onExamRemoved}
                onExamClicked={onExamClicked}
              />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="bg-background pb-28">
        {/* Above-the-fold: Summary Header */}
        <MobileSummaryHeader
          overview={data.overview}
          streak={data.streak}
          syncing={syncing}
          userName={user?.ies_nome}
          semestre={semestreAtivo}
          nextExam={nextExam}
          onContinue={handleContinue}
          onOrganize={handleOrganize}
          onExamClick={handleExamClick}
        />

        {/* Semester warning */}
        {(semestreWarning || data.user?.semestre_warning) && (
          <div className="px-4 pt-3">
            <Alert className="border-chart-3/50 bg-chart-3/10">
              <AlertTriangle className="h-4 w-4" style={{ color: 'hsl(var(--chart-3))' }} />
              <AlertDescription className="text-xs text-foreground">
                {semestreWarning || data.user?.semestre_warning}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Tab navigation - sticky below header */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Tab content */}
        {renderTabContent()}

      {/* Sticky CTA bar - appears on scroll */}
      <MobileStickyCtaBar
        visible={showStickyBar}
        onContinue={handleContinue}
        onOrganize={handleOrganize}
      />
    </div>
  );
};
