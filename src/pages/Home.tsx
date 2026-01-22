import React from 'react';
import { motion } from 'framer-motion';
import { useHomeData } from '@/hooks/useHomeData';
import { WelcomeCard } from '@/components/home/WelcomeCard';
import { AnnouncementsCard } from '@/components/home/AnnouncementsCard';
import { MeuDiaCard } from '@/components/home/MeuDiaCard';
import { RankingCard } from '@/components/home/RankingCard';
import { SimuladoPerformanceCard } from '@/components/home/SimuladoPerformanceCard';
import { MeuSemestreCard } from '@/components/home/MeuSemestreCard';
import { QuickActionsDock } from '@/components/home/QuickActionsDock';
import { HomePageSkeleton } from '@/components/skeletons/HomePageSkeleton';

export const Home: React.FC = () => {
  console.log('[HomeDashboard]', 'render');
  
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

  if (loading) {
    return <HomePageSkeleton />;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.4, 
        ease: 'easeOut' as const
      },
    },
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Container principal com max-width e padding consistente */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8"
      >
        {/* Row 1: Welcome (2fr) + Announcements (1fr) */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6">
          <motion.div variants={itemVariants}>
            <WelcomeCard hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <AnnouncementsCard />
          </motion.div>
        </div>

        {/* Row 2: Meu Dia (3fr) + Ranking (2fr) */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 lg:gap-6">
          <motion.div variants={itemVariants}>
            <MeuDiaCard 
              items={meuDiaItems} 
              hasStudyGuide={hasStudyGuide}
              loading={loading}
              error={error}
              onRetry={refetch}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <RankingCard data={rankings} />
          </motion.div>
        </div>

        {/* Row 3: Desempenho (1fr) + Meu Semestre (1fr) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <motion.div variants={itemVariants}>
            <SimuladoPerformanceCard data={simuladoData} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
          </motion.div>
        </div>
      </motion.div>

      {/* Dock de ações rápidas */}
      <QuickActionsDock hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
    </div>
  );
};
