import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessRules } from '@/utils/accessRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BookOpen, 
  Zap, 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  Trophy,
  Target,
  Award,
  ChevronRight,
  Bell,
  Megaphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const accessRules = getAccessRules(user);
  const [loading, setLoading] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const resourceCards = [
    {
      title: 'Guia de Estudos',
      description: 'Acesse seu plano personalizado',
      icon: BookOpen,
      color: 'from-blue-500 to-cyan-500',
      path: '/guia-estudos',
      show: accessRules.studyGuide,
    },
    {
      title: 'Intensivão ENAMED',
      description: 'Conteúdo focado para o exame',
      icon: Zap,
      color: 'from-purple-500 to-pink-500',
      path: '/intensivao-enamed',
      show: accessRules.enamed,
    },
    {
      title: 'Desempenho',
      description: 'Acompanhe seu progresso',
      icon: BarChart3,
      color: 'from-orange-500 to-red-500',
      path: '/desempenho-simulado',
      show: accessRules.SimuladoDesempenho,
    },
    {
      title: 'Cronograma',
      description: 'Organize seus estudos',
      icon: Calendar,
      color: 'from-green-500 to-emerald-500',
      path: '/cronograma-enamed',
      show: accessRules.cronogramaEnamed,
    },
  ].filter(card => card.show);

  const announcements = [
    {
      title: 'Novo conteúdo disponível',
      description: 'Confira as últimas aulas adicionadas ao seu plano de estudos',
      date: 'Hoje',
      type: 'info'
    },
    {
      title: 'Simulado liberado',
      description: 'Novo simulado disponível para prática',
      date: 'Há 2 dias',
      type: 'success'
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-3 md:space-y-6">
          <Skeleton className="h-20 md:h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 md:h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 md:h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8 space-y-3 sm:space-y-4 md:space-y-6">
        {/* Welcome Section - Mobile First */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-xl md:rounded-2xl lg:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 text-primary-foreground shadow-lg">
          <div className="flex flex-col gap-1.5 sm:gap-2 md:gap-3">
            <p className="text-xs sm:text-sm opacity-90 font-medium">{getGreeting()},</p>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
              {user?.nome || 'Estudante'}
            </h1>
            <p className="text-xs sm:text-sm md:text-base opacity-90 max-w-2xl">
              Continue sua jornada de aprendizado 🎯
            </p>
          </div>
        </div>

        {/* Quick Stats - Mobile Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-amber-500 mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Ranking</p>
                <p className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold">
                  -
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
                <Target className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-blue-500 mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Semestre</p>
                <p className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold">
                  {user?.semestre || '-'}º
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-green-500 mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Progresso</p>
                <p className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold">
                  0%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
                <Award className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-purple-500 mb-0.5 sm:mb-1" />
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Concluídas</p>
                <p className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold">
                  0
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resource Cards - Mobile First */}
        <div>
          <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold mb-2 sm:mb-3 md:mb-4 px-0.5 sm:px-1">
            Seus Recursos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
            {resourceCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.path}
                  className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 overflow-hidden"
                  onClick={() => navigate(card.path)}
                >
                  <div className={`h-1.5 sm:h-2 bg-gradient-to-r ${card.color}`} />
                  <CardContent className="p-3 sm:p-4 md:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`inline-flex p-2 sm:p-2.5 md:p-3 rounded-lg md:rounded-xl bg-gradient-to-br ${card.color} mb-2 sm:mb-3 md:mb-4`}>
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-0.5 sm:mb-1 md:mb-2 group-hover:text-primary transition-colors truncate">
                          {card.title}
                        </h3>
                        <p className="text-xs sm:text-sm md:text-sm text-muted-foreground line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 md:group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Announcements - Compact Mobile */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
              <CardTitle className="text-sm sm:text-base md:text-lg">Avisos Recentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0 space-y-2 sm:space-y-3 md:space-y-4">
            {announcements.map((announcement, index) => (
              <div
                key={index}
                className="flex gap-2 sm:gap-3 md:gap-4 p-2.5 sm:p-3 md:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className={`flex-shrink-0 w-1 sm:w-1.5 rounded-full ${
                  announcement.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5 sm:mb-1">
                    <h4 className="text-xs sm:text-sm md:text-base font-medium truncate">
                      {announcement.title}
                    </h4>
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {announcement.date}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground line-clamp-2">
                    {announcement.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Sanar Promotion - Mobile Optimized */}
        <Card className="border-0 bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white overflow-hidden">
          <CardContent className="p-3 sm:p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 md:mb-3">
                  <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex-shrink-0" />
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">
                    Novidade
                  </Badge>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-1.5 sm:mb-2">
                  Sanarflix Premium
                </h3>
                <p className="text-xs sm:text-sm md:text-base opacity-90 mb-3 sm:mb-4 line-clamp-2">
                  Acesse todo o conteúdo Sanar e turbine seus estudos
                </p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="w-full sm:w-auto bg-white text-red-600 hover:bg-white/90 font-semibold text-xs sm:text-sm"
                  onClick={() => window.open('https://sanarflix.com.br', '_blank')}
                >
                  Conhecer Planos
                </Button>
              </div>
              <div className="hidden lg:flex items-center justify-center w-24 h-24 xl:w-32 xl:h-32 bg-white/10 rounded-full flex-shrink-0">
                <Award className="h-12 w-12 xl:h-16 xl:w-16 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
