import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useHomeData } from '@/hooks/useHomeData';
import { useAnnouncements } from '@/hooks/home/useAnnouncements';
import { useUserExams, calculateExamInsight } from '@/hooks/useUserExams';
import { useProgressHub } from '@/hooks/useProgressHub';
import { WelcomeCard } from '@/components/home/WelcomeCard';
import { AnnouncementsCard } from '@/components/home/AnnouncementsCard';
import { MeuDiaCard } from '@/components/home/MeuDiaCard';
import { RankingCard } from '@/components/home/RankingCard';
import { SimuladoPerformanceCard } from '@/components/home/SimuladoPerformanceCard';
import { MeuSemestreCard } from '@/components/home/MeuSemestreCard';
import { QuickActionsDock } from '@/components/home/QuickActionsDock';
import { HomePageSkeleton } from '@/components/skeletons/HomePageSkeleton';
import { AddExamWizard } from '@/components/progress-hub/AddExamWizard';
import { AddExamWizardMobile } from '@/components/progress-hub/AddExamWizardMobile';
import { useIsMobile } from '@/hooks/use-mobile';

export const Home: React.FC = () => {
  const isMobile = useIsMobile();
  const [showAddExamWizard, setShowAddExamWizard] = useState(false);

  const {
    loading,
    error,
    meuDiaItems,
    hasStudyGuide,
    hasCronograma,
    rankings,
    topAulas,
    conteudosRelacionados,
    simuladoData,
    refetch,
  } = useHomeData();

  // Exam data
  const { exams, loading: examsLoading, addExam, removeExam, updateExam } = useUserExams();
  const { data: progressData } = useProgressHub();

  // Calculate next exam insight
  const nextExamInsight = useMemo(() => {
    if (!exams.length) return null;
    const exam = exams[0]; // Already sorted by date
    const materiaProgress = progressData?.by_materia?.find(
      m => m.materia.toLowerCase() === exam.materia.toLowerCase()
    ) ?? null;
    return calculateExamInsight(exam, materiaProgress);
  }, [exams, progressData]);

  // Extract materia names from progress data
  const materiaNames = useMemo(() => 
    progressData?.by_materia?.map(m => m.materia) || [], 
    [progressData]
  );

  // Announcement data for mobile badge integration
  const {
    mainAnnouncement,
    IconComponent,
    gradient,
    handleAnnouncementClick,
  } = useAnnouncements();

  // Mostrar skeleton apenas se loading E não há dados em cache
  const hasData = meuDiaItems.length > 0 || simuladoData || Object.keys(rankings).length > 0;
  if (loading && !hasData) {
    return <HomePageSkeleton />;
  }

  const handleAddExam = async (materia: string, examName: string, examDate: string) => {
    const result = await addExam(materia, examName, examDate);
    if (!result.error) {
      setShowAddExamWizard(false);
    }
    return { error: result.error };
  };

  const handleRemoveExam = async (examId: string) => {
    await removeExam(examId);
  };

  // For now, editing opens the wizard with the exam pre-selected (not implemented yet)
  // Future: could open a specific edit modal
  const handleEditExam = (examId: string) => {
    // TODO: Implement exam editing - for now just show a toast
    console.log('[Home] Edit exam:', examId);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.35, 
        ease: 'easeOut' as const
      },
    },
  };
  
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Premium background mesh gradient */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />
      
      {/* Subtle pattern overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>
      
      {/* Main content - Fluid responsive container with overflow protection */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10 overflow-hidden"
      >
        {/* === DESKTOP LAYOUT (lg+) === */}
        <div className="hidden lg:block space-y-5 lg:space-y-6">
          {/* Row 1: Hero Welcome + Announcements */}
          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-5 lg:gap-6">
            <motion.div variants={itemVariants} className="min-w-0">
              <WelcomeCard hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <AnnouncementsCard />
            </motion.div>
          </div>

          {/* Row 2: Meu Dia (full width) */}
          <motion.div variants={itemVariants} className="min-w-0">
            <MeuDiaCard 
              items={meuDiaItems} 
              hasStudyGuide={hasStudyGuide}
              loading={loading}
              error={error}
              onRetry={refetch}
              nextExam={nextExamInsight}
              examLoading={examsLoading}
              onAddExamClick={() => setShowAddExamWizard(true)}
              onEditExam={handleEditExam}
              onRemoveExam={handleRemoveExam}
            />

          </motion.div>

          {/* Row 3: Desempenho + Meu Semestre */}
          <div className="grid grid-cols-2 gap-5 lg:gap-6">
            <motion.div variants={itemVariants} className="min-w-0">
              <SimuladoPerformanceCard data={simuladoData} />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
            </motion.div>
          </div>
        </div>

        {/* === TABLET LAYOUT (md to lg) === */}
        <div className="hidden md:block lg:hidden space-y-4 md:space-y-5">
          {/* Row 1: Hero + Announcements */}
          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-4 md:gap-5">
            <motion.div variants={itemVariants} className="min-w-0">
              <WelcomeCard hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <AnnouncementsCard />
            </motion.div>
          </div>
          
          {/* Row 2: Meu Dia (full width) */}
          <motion.div variants={itemVariants} className="min-w-0">
            <MeuDiaCard 
              items={meuDiaItems} 
              hasStudyGuide={hasStudyGuide}
              loading={loading}
              error={error}
              onRetry={refetch}
              nextExam={nextExamInsight}
              examLoading={examsLoading}
              onAddExamClick={() => setShowAddExamWizard(true)}
              onEditExam={handleEditExam}
              onRemoveExam={handleRemoveExam}
            />
          </motion.div>

          {/* Row 3: Performance + Semester */}
          <div className="grid grid-cols-2 gap-4 md:gap-5">
            <motion.div variants={itemVariants} className="min-w-0">
              <SimuladoPerformanceCard data={simuladoData} />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
            </motion.div>
          </div>
        </div>

        {/* === MOBILE LAYOUT (< md) === */}
        <div className="md:hidden space-y-3 sm:space-y-4 pb-[env(safe-area-inset-bottom)]">
          {/* Compact hero with integrated announcement badge */}
          <motion.div variants={itemVariants}>
            <WelcomeCard 
              hasStudyGuide={hasStudyGuide} 
              hasCronograma={hasCronograma}
              mobileAnnouncement={mainAnnouncement ? {
                announcement: mainAnnouncement,
                gradient,
                IconComponent,
                onAnnouncementClick: handleAnnouncementClick,
              } : undefined}
            />
          </motion.div>

          {/* What to study today - priority on mobile */}
          <motion.div variants={itemVariants}>
            <MeuDiaCard 
              items={meuDiaItems} 
              hasStudyGuide={hasStudyGuide}
              loading={loading}
              error={error}
              onRetry={refetch}
              nextExam={nextExamInsight}
              examLoading={examsLoading}
              onAddExamClick={() => setShowAddExamWizard(true)}
              onEditExam={handleEditExam}
              onRemoveExam={handleRemoveExam}
            />
          </motion.div>

          {/* Performance summary */}
          <motion.div variants={itemVariants}>
            <SimuladoPerformanceCard data={simuladoData} />
          </motion.div>


          {/* Semester content */}
          <motion.div variants={itemVariants}>
            <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
          </motion.div>
        </div>
      </motion.div>

      {/* Quick actions dock */}
      <QuickActionsDock hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />

      {/* Add Exam Wizard Modal */}
      {isMobile ? (
        <AddExamWizardMobile
          open={showAddExamWizard}
          onOpenChange={setShowAddExamWizard}
          onAdd={handleAddExam}
          materias={materiaNames}
          materiasProgress={progressData?.by_materia || []}
        />
      ) : (
        <AddExamWizard
          open={showAddExamWizard}
          onOpenChange={setShowAddExamWizard}
          onAdd={handleAddExam}
          materias={materiaNames}
          materiasProgress={progressData?.by_materia || []}
        />
      )}
    </div>
  );
};
