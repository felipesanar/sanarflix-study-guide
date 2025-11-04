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
  Megaphone,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ImportantAnnouncementsCard } from '@/components/ImportantAnnouncementsCard';

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
    <div className="bg-background">
      {/* MOBILE VERSION - Simplified */}
      <div className="md:hidden max-w-7xl mx-auto px-3 sm:px-4 pt-2 pb-3 space-y-3 sm:space-y-4">
        {/* Welcome Section - Mobile */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-xl p-4 sm:p-5 text-primary-foreground shadow-lg"
        >
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <p className="text-xs sm:text-sm opacity-90 font-medium">{getGreeting()},</p>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">
              {user?.nome || 'Estudante'}
            </h1>
            <p className="text-xs sm:text-sm opacity-90">
              Continue sua jornada de aprendizado 🎯
            </p>
          </div>
        </motion.div>

        {/* Quick Stats - Mobile Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-1">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 mb-0.5" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Ranking</p>
                <p className="text-base sm:text-lg font-bold">
                  -
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-1">
                <Target className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 mb-0.5" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Semestre</p>
                <p className="text-base sm:text-lg font-bold">
                  {user?.semestre || '-'}º
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-1">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 mb-0.5" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Progresso</p>
                <p className="text-base sm:text-lg font-bold">
                  0%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/50 backdrop-blur">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-1">
                <Award className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500 mb-0.5" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">Concluídas</p>
                <p className="text-base sm:text-lg font-bold">
                  0
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resource Cards - Mobile */}
        <div>
          <h2 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 px-0.5">
            Seus Recursos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {resourceCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.path} whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="group">
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out border-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => navigate(card.path)}
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${card.color}`} />
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${card.color} mb-2`}>
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <h3 className="text-sm sm:text-base font-semibold mb-0.5 group-hover:text-primary transition-colors truncate">
                            {card.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Announcements - Mobile */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
              <CardTitle className="text-sm sm:text-base">Avisos Recentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
            {announcements.map((announcement, index) => (
              <motion.div
                key={index}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="flex gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out"
              >
                <div className={`flex-shrink-0 w-1 rounded-full ${
                  announcement.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <h4 className="text-xs sm:text-sm font-medium truncate">
                      {announcement.title}
                    </h4>
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {announcement.date}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                    {announcement.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Sanar Promotion - Mobile */}
        <Card className="border-0 bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Megaphone className="h-4 w-4 flex-shrink-0" />
                  <Badge variant="secondary" className="text-[10px]">
                    Novidade
                  </Badge>
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-1.5">
                  Sanarflix Premium
                </h3>
                <p className="text-xs opacity-90 mb-3 line-clamp-2">
                  Acesse todo o conteúdo Sanar e turbine seus estudos
                </p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  className="w-full bg-white text-red-600 hover:bg-white/90 font-semibold text-xs transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out"
                  onClick={() => window.open('https://sanarflix.com.br', '_blank')}
                >
                  Conhecer Planos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DESKTOP VERSION - Complete Layout */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-4 pb-6 space-y-6">
        {/* Welcome Banner & Important Announcements - Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
            <Card className="border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-xl overflow-hidden h-full">
              <CardContent className="p-8">
                <div className="flex items-center justify-between h-full">
                  <div className="flex-1">
                    <p className="text-sm opacity-90 font-medium mb-2">{getGreeting()},</p>
                    <h1 className="text-4xl font-bold mb-3">
                      {user?.nome || 'Estudante'}
                    </h1>
                    <p className="text-base opacity-90 max-w-2xl mb-6">
                      Pronto para estudar no dia de hoje? 🎯
                    </p>
                    <Button 
                      variant="secondary"
                      onClick={() => navigate('/guia-estudos')}
                      className="bg-white/10 hover:bg-white/20 border border-white/30 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out"
                    >
                      Continuar estudos
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="hidden xl:block">
                    <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
                      <Trophy className="h-16 w-16 text-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <ImportantAnnouncementsCard />
        </div>

        {/* Main Grid - Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-stretch">
          {/* Left Column - Progress & Resources */}
          <div className="space-y-6 h-full">
            {/* Progress Section */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Meu Dia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Study Blocks */}
                <div className="space-y-3">
                  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg hover:bg-muted cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm mb-1">Estudante de hoje</h4>
                      <p className="text-xs text-muted-foreground">Medicina • 7ª Série / 13º período</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </motion.div>

                  <div className="grid grid-cols-3 gap-3">
                    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out">
                      <Clock className="h-5 w-5 text-amber-600 mb-2" />
                      <p className="text-xs text-muted-foreground mb-1">Cronologia</p>
                      <p className="text-lg font-bold">Em dia</p>
                    </motion.div>
                    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out">
                      <BarChart3 className="h-5 w-5 text-blue-600 mb-2" />
                      <p className="text-xs text-muted-foreground mb-1">Desempenho</p>
                      <p className="text-lg font-bold">Médio</p>
                    </motion.div>
                    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
                      <p className="text-xs text-muted-foreground mb-1">Aulas</p>
                      <p className="text-lg font-bold">0</p>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats & Progress */}
          <div className="space-y-6 h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  0% concluído
                </CardTitle>
                <CardDescription>
                  Você já teve 0 aulas no seu dia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full" viewBox="0 0 200 200">
                      <circle
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="15"
                      />
                      <circle
                        cx="100"
                        cy="100"
                        r="75"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="15"
                        strokeDasharray={`${0 * 4.71} 471`}
                        strokeLinecap="round"
                        transform="rotate(-90 100 100)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">0%</span>
                      <span className="text-xs text-muted-foreground">concluído</span>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out" 
                  onClick={() => navigate('/guia-estudos')}
                >
                  Ver detalhes completos
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Próximos Eventos & Recomendações */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Próximos Eventos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos eventos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resourceCards.slice(0, 3).map((card) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.path}
                    onClick={() => navigate(card.path)}
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 rounded-lg cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out group"
                  >
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${card.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {card.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {card.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>

          {/* Resultado programado */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-200/50">
            <CardHeader>
              <CardTitle className="text-base">Resultado programado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Continue estudando para ver seus resultados atualizados
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/desempenho-simulado')}>
                Ver desempenho
              </Button>
            </CardContent>
          </Card>

          {/* Desempenho e Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho e Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Progresso Total</span>
                    <span className="text-sm font-semibold">0%</span>
                  </div>
                  <Progress value={0} />
                </div>
                
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Ranking IES</p>
                  <p className="text-2xl font-bold">
                    -
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de - alunos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recomendações Inteligentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <CardTitle>Recomendações Inteligentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {announcements.map((announcement, index) => (
                <motion.div
                  key={index}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out"
                >
                  <div className={`flex-shrink-0 w-2 h-full rounded-full ${
                    announcement.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-semibold">{announcement.title}</h4>
                      <span className="text-xs text-muted-foreground">{announcement.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{announcement.description}</p>
                    <Button variant="link" className="px-0 h-auto mt-2 text-xs transition-colors">
                      Acessar agora
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
