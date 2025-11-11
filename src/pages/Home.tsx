import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { HomePageSkeleton } from '@/components/skeletons/HomePageSkeleton';
import { WelcomeBanner } from '@/components/home/WelcomeBanner';
import { ContinueStudyButton } from '@/components/home/ContinueStudyButton';
import { MeuDiaCard } from '@/components/home/MeuDiaCard';
import { RankingCard } from '@/components/home/RankingCard';
import { MeuSemestreCard } from '@/components/home/MeuSemestreCard';
import { SimuladoPerformanceCard } from '@/components/home/SimuladoPerformanceCard';
import { AnnouncementPopup } from '@/components/home/AnnouncementPopup';
import { ImportantAnnouncementsCard } from '@/components/ImportantAnnouncementsCard';
import { useHomeData } from '@/hooks/useHomeData';
import { StatsRefresher } from '@/components/home/StatsRefresher';

export default function Home() {
  const { user } = useAuth();
  const { data, loading, refetch } = useHomeData();

  useEffect(() => {
    // Atualizar dados quando o componente montar
    refetch();
  }, []);

  if (loading) {
    return <HomePageSkeleton />;
  }

  return (
    <>
      <StatsRefresher onRefresh={refetch} />
      <AnnouncementPopup userSemester={user?.semestre} />
      
      <div className="container-fluid py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Welcome Banner */}
          <WelcomeBanner userName={user?.nome || 'Estudante'} />

          {/* Avisos Importantes e Botão de Continuar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ImportantAnnouncementsCard />
            </div>
            <div>
              <ContinueStudyButton 
                hasStudyGuide={data.hasStudyGuide} 
                hasCronograma={data.hasCronograma} 
              />
            </div>
          </div>

          {/* Meu Dia e Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MeuDiaCard items={data.meuDiaItems} />
            </div>
            <div>
              <RankingCard rankings={data.rankings} />
            </div>
          </div>

          {/* Meu Semestre */}
          <MeuSemestreCard 
            topAulas={data.topAulas} 
            conteudosRelacionados={data.conteudosRelacionados} 
          />

          {/* Desempenho no Simulado */}
          {data.simuladoData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SimuladoPerformanceCard simulado={data.simuladoData} />
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
