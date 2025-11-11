import { useEffect, useState } from 'react';
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

export default function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <HomePageSkeleton />;
  }

  // Mock data - Em produção, buscar do backend
  const meuDiaItems = [
    {
      id: '1',
      title: 'Anatomia - Aula 5',
      type: 'guia' as const,
      progress: '2/3 concluídas',
      link: '/study-guide',
    },
    {
      id: '2',
      title: 'Intensivo ENAMED',
      type: 'intensivo' as const,
      progress: 'Disponível',
      link: '/intensivao-enamed',
    },
  ];

  const rankings = [
    { position: 15, total: 120, variation: 1, type: 'geral' as const },
    { position: 8, total: 45, variation: 0, type: 'semestre' as const },
  ];

  const topAulas = [
    {
      id: '1',
      titulo: 'Sistema Nervoso Central',
      materia: 'Anatomia',
      acessos: 245,
      link: 'https://www.sanarflix.com.br',
    },
    {
      id: '2',
      titulo: 'Ciclo de Krebs',
      materia: 'Bioquímica',
      acessos: 198,
      link: 'https://www.sanarflix.com.br',
    },
    {
      id: '3',
      titulo: 'Farmacodinâmica',
      materia: 'Farmacologia',
      acessos: 176,
      link: 'https://www.sanarflix.com.br',
    },
  ];

  const conteudosRelacionados = [
    {
      id: '1',
      titulo: 'Prova P1 - Anatomia 2024/1',
      tipo: 'prova' as const,
      link: '#',
    },
    {
      id: '2',
      titulo: 'Revisão: Sistema Cardiovascular',
      tipo: 'reforco' as const,
      link: '#',
    },
  ];

  const simuladoData = {
    nome: 'Simulado ENAMED 2025 - Prova 1',
    nota: 75,
    posicao: 23,
    totalParticipantes: 156,
    tempoGasto: '2h 15min',
    dataRealizacao: '2025-01-10',
  };

  return (
    <>
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
                hasStudyGuide={true} 
                hasCronograma={true} 
              />
            </div>
          </div>

          {/* Meu Dia e Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MeuDiaCard items={meuDiaItems} />
            </div>
            <div>
              <RankingCard rankings={rankings} />
            </div>
          </div>

          {/* Meu Semestre */}
          <MeuSemestreCard 
            topAulas={topAulas} 
            conteudosRelacionados={conteudosRelacionados} 
          />

          {/* Desempenho no Simulado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimuladoPerformanceCard simulado={simuladoData} />
          </div>
        </motion.div>
      </div>
    </>
  );
}
