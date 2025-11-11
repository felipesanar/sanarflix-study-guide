import React from 'react';
import { motion } from 'framer-motion';
import { useHomeData } from '@/hooks/useHomeData';
import { WelcomeCard } from '@/components/home/WelcomeCard';
import { AnnouncementsCard } from '@/components/home/AnnouncementsCard';
import { MeuDiaCard } from '@/components/home/MeuDiaCard';
import { RankingCard } from '@/components/home/RankingCard';
import { SimuladoPerformanceCard } from '@/components/home/SimuladoPerformanceCard';
import { MeuSemestreCard } from '@/components/home/MeuSemestreCard';
import { Skeleton } from '@/components/ui/skeleton';

export const Home: React.FC = () => {
  const {
    loading,
    meuDiaItems,
    hasStudyGuide,
    hasCronograma,
    rankings,
    topAulas,
    conteudosRelacionados,
    simuladoData,
  } = useHomeData();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-6 space-y-6">
        {/* Row 1: Welcome + Announcements (3x2 grid starts) */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <WelcomeCard hasStudyGuide={hasStudyGuide} hasCronograma={hasCronograma} />
          <AnnouncementsCard />
        </div>

        {/* Row 2: Meu Dia + Ranking */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <MeuDiaCard items={meuDiaItems} hasStudyGuide={hasStudyGuide} />
          <RankingCard data={rankings} />
        </div>

        {/* Row 3: Simulado Performance + Meu Semestre */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimuladoPerformanceCard data={simuladoData} />
          <MeuSemestreCard topAulas={topAulas} conteudosRelacionados={conteudosRelacionados} />
        </div>
      </div>
    </div>
  );
};
