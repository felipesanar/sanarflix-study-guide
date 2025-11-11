import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useHomeData } from '@/hooks/useHomeData';
import { WelcomeCard } from '@/components/home/WelcomeCard';
import { AnnouncementsCard } from '@/components/home/AnnouncementsCard';
import { MeuDiaCard } from '@/components/home/MeuDiaCard';
import { RankingCard } from '@/components/home/RankingCard';
import { SimuladoPerformanceCard } from '@/components/home/SimuladoPerformanceCard';
import { MeuSemestreCard } from '@/components/home/MeuSemestreCard';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickActionsDock } from '@/components/home/QuickActionsDock';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
            <Skeleton className="h-[22rem] rounded-2xl" />
            <Skeleton className="h-[22rem] rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Variants para entrada suave das linhas (tipado e com easing compatível)
  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      // Cubic-bezier equivalente ao easeOut para compatibilidade de tipos
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 },
    }),
  };
  
  return (
    <div className="min-h-screen bg-background relative">
      {/* Fundo premium com glows e grid sutil */}
      <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary/20 blur-3xl rounded-full" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 blur-[80px] rounded-full" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#9aa1b2_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>
  
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-20 space-y-6">
          {/* Row 1: Welcome + Announcements */}
          <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-100px' }}
              variants={rowVariants}
              custom={0}
              className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6"
          >
              <WelcomeCard hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
              <AnnouncementsCard />
          </motion.div>
  
          {/* Row 2: Meu Dia + Ranking */}
          <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-100px' }}
              variants={rowVariants}
              custom={1}
              className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6"
          >
              <MeuDiaCard 
                items={meuDiaItems} 
                hasStudyGuide={hasStudyGuide}
                loading={loading}
                error={error}
                onRetry={refetch}
              />
              <RankingCard data={rankings} />
          </motion.div>
  
          {/* Row 3: Simulado Performance + Meu Semestre */}
          <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-100px' }}
              variants={rowVariants}
              custom={2}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
              <SimuladoPerformanceCard data={simuladoData} />
              <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
          </motion.div>
      </div>
  
      {/* Dock de ações rápidas premium */}
      <QuickActionsDock hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
  </div>
  );
};
