import React from 'react';
import { motion } from 'framer-motion';
import { useHomeData } from '@/hooks/useHomeData';
import { useAnnouncements } from '@/hooks/home/useAnnouncements';
import { WelcomeCard } from '@/components/home/WelcomeCard';
import { AnnouncementsCard } from '@/components/home/AnnouncementsCard';
import { MeuDiaCard } from '@/components/home/MeuDiaCard';
import { RankingCard } from '@/components/home/RankingCard';
import { SimuladoPerformanceCard } from '@/components/home/SimuladoPerformanceCard';
import { MeuSemestreCard } from '@/components/home/MeuSemestreCard';
import { QuickActionsDock } from '@/components/home/QuickActionsDock';
import { HomePageSkeleton } from '@/components/skeletons/HomePageSkeleton';
import { ProgressSummaryCard } from '@/components/home/ProgressSummaryCard';

export const Home: React.FC = () => {
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
          {/* Row 1: Hero Welcome + Announcements - Using percentages for better overflow control */}
          <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-5 lg:gap-6">
            <motion.div variants={itemVariants} className="min-w-0">
              <WelcomeCard hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <AnnouncementsCard />
            </motion.div>
          </div>

          {/* Row 1.5: Progress Summary Card */}
          <motion.div variants={itemVariants}>
            <ProgressSummaryCard />
          </motion.div>

          {/* Row 2: Meu Dia + Ranking */}
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 lg:gap-6">
            <motion.div variants={itemVariants} className="min-w-0">
              <MeuDiaCard 
                items={meuDiaItems} 
                hasStudyGuide={hasStudyGuide}
                loading={loading}
                error={error}
                onRetry={refetch}
              />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <RankingCard data={rankings} />
            </motion.div>
          </div>

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

          {/* Row 1.5: Progress Summary Card */}
          <motion.div variants={itemVariants}>
            <ProgressSummaryCard />
          </motion.div>
          
          {/* Row 2: Meu Dia + Ranking */}
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 md:gap-5">
            <motion.div variants={itemVariants} className="min-w-0">
              <MeuDiaCard 
                items={meuDiaItems} 
                hasStudyGuide={hasStudyGuide}
                loading={loading}
                error={error}
                onRetry={refetch}
              />
            </motion.div>
            <motion.div variants={itemVariants} className="min-w-0">
              <RankingCard data={rankings} />
            </motion.div>
          </div>

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

          {/* Announcement card removed on mobile - now integrated as badge in WelcomeCard */}

          {/* Progress Summary Card - Priority on mobile */}
          <motion.div variants={itemVariants}>
            <ProgressSummaryCard />
          </motion.div>

          {/* What to study today - priority on mobile */}
          <motion.div variants={itemVariants}>
            <MeuDiaCard 
              items={meuDiaItems} 
              hasStudyGuide={hasStudyGuide}
              loading={loading}
              error={error}
              onRetry={refetch}
            />
          </motion.div>

          {/* Performance summary */}
          <motion.div variants={itemVariants}>
            <SimuladoPerformanceCard data={simuladoData} />
          </motion.div>

          {/* Ranking - more compact on mobile */}
          <motion.div variants={itemVariants}>
            <RankingCard data={rankings} />
          </motion.div>

          {/* Semester content */}
          <motion.div variants={itemVariants}>
            <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
          </motion.div>
        </div>
      </motion.div>

      {/* Quick actions dock */}
      <QuickActionsDock hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
    </div>
  );
};
