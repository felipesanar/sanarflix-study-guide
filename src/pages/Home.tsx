import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessRules } from '@/utils/accessRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useStudy } from '@/contexts/StudyContext';
import { useUniversity } from '@/contexts/UniversityContext';
import {
  BookOpen,
  GraduationCap,
  BarChart3,
  Calendar,
  Users,
  TrendingUp,
  Award,
  Bell,
  Megaphone,
  ArrowRight,
  Target,
  Clock,
  PieChart,
  ListChecks,
  Search,
  Settings,
  Moon,
  Sun,
  Trophy,
  FileText,
  Sparkles,
  Repeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, RadialBarChart, RadialBar, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { isB2BUser } from '@/utils/accessRules';
import { intensivoUSCSApi, IntensivoUSCSItem } from '@/services/intensivoUSCSApi';

interface ResourceCard {
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  color: string;
  badge?: string;
}

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const accessRules = getAccessRules(user);
  const { progress, studyContents } = useStudy();
  const { currentPromotion } = useUniversity();

  const allResources: Record<string, ResourceCard> = {
    studyGuide: {
      title: 'Guia de Estudos',
      description: 'Acesse materiais organizados por disciplina e semestre',
      icon: BookOpen,
      route: '/guia-estudos',
      color: 'from-blue-500 to-blue-600',
      badge: 'Novo'
    },
    enamed: {
      title: 'Intensivo ENAMED',
      description: 'Preparação completa para o ENAMED com cronograma semanal',
      icon: GraduationCap,
      route: '/intensivao-enamed',
      color: 'from-purple-500 to-purple-600',
    },
    cronogramaEnamed: {
      title: 'Cronograma ENAMED',
      description: 'Últimos 30 dias de conteúdo do intensivo',
      icon: Calendar,
      route: '/cronograma-enamed',
      color: 'from-indigo-500 to-indigo-600',
    },
    dashboard: {
      title: 'Dashboard de Progresso',
      description: 'Visualize suas métricas e evolução nos estudos',
      icon: BarChart3,
      route: '/dashboard',
      color: 'from-green-500 to-green-600',
    },
    SimuladoDesempenho: {
      title: 'Desempenho em Simulados',
      description: 'Acompanhe seu desempenho e áreas de melhoria',
      icon: Target,
      route: '/simulado-desempenho',
      color: 'from-orange-500 to-orange-600',
    },
    userManagement: {
      title: 'Gerenciar Usuários',
      description: 'Administração de usuários e permissões',
      icon: Users,
      route: '/user-management',
      color: 'from-red-500 to-red-600',
      badge: 'Admin'
    },
    intensivoUSCS: {
      title: 'Intensivo USCS',
      description: 'Conteúdo exclusivo para alunos USCS',
      icon: Award,
      route: '/intensivo-enamed-uscs',
      color: 'from-cyan-500 to-cyan-600',
      badge: 'Exclusivo'
    }
  };


  // Estados adicionais para header e blocos dinâmicos
  const [notifCount, setNotifCount] = React.useState<number>(2);
  const [rankingIES, setRankingIES] = React.useState<{ rank: number; total: number } | null>(null);
  const [intensivoEvents, setIntensivoEvents] = React.useState<IntensivoUSCSItem[]>([]);

  React.useEffect(() => {
    // Carregar últimos eventos do Intensivo USCS (se disponível)
    (async () => {
      try {
        const items = await intensivoUSCSApi.getAllContent();
        setIntensivoEvents(items.slice(0, 5));
      } catch {}
    })();
  }, []);

  React.useEffect(() => {
    // Carregar ranking do último simulado (se existir)
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || !user?.email) return;
        const simuladosRes = await supabase.rpc('get_user_simulados');
        if (simuladosRes.error || !Array.isArray(simuladosRes.data) || simuladosRes.data.length === 0) return;
        const latestSimulado = simuladosRes.data[0];
        const r = await supabase.rpc('get_user_rankings', { p_simulado_id: latestSimulado.id }).single();
        if (!r.error && r.data && r.data.rankingIES) {
          setRankingIES(r.data.rankingIES);
        }
      } catch {}
    })();
  }, [user]);

  const availableResources = Object.entries(accessRules)
    .filter(([_, hasAccess]) => hasAccess)
    .map(([key]) => allResources[key])
    .filter(Boolean);

  const announcements = [
    {
      title: 'Novos conteúdos disponíveis',
      description: 'Adicionamos novos vídeos e materiais sobre Cardiologia',
      date: '2 dias atrás',
      icon: Bell,
      variant: 'info' as const
    },
    {
      title: 'Simulado ao vivo - 25/10',
      description: 'Participe do simulado ao vivo com discussão das questões',
      date: 'Amanhã às 19h',
      icon: TrendingUp,
      variant: 'warning' as const
    }
  ];

  // Insights de progresso
  const totalCompleted = progress.completedItems.length;
  const totalItems = progress.totalItems;
  const totalProgress = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  const disciplineProgress = Object.entries(progress.progressByDiscipline).map(([name, d]) => ({
    name,
    completed: d.completed,
    total: d.total,
    remaining: d.total - d.completed,
    percentage: d.percentage
  }));
  const topRemaining = disciplineProgress.sort((a,b) => b.remaining - a.remaining)[0];

  const typeCounts = studyContents.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nextContents = studyContents.filter(c => !c.completed).slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Inteligente */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border rounded-b-xl px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Bom dia, {user?.nome?.split(' ')[0] || 'Estudante'} 👋
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Pronto para mais um dia de conquistas no ENAMED?
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/guia-estudos')} title="Busca">
                <Search className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" title="Notificações">
                <div className="relative">
                  <Bell className="h-5 w-5" />
                  {notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1">
                      {notifCount}
                    </span>
                  )}
                </div>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="hidden sm:inline-block max-w-[160px] truncate text-sm">{user?.nome || 'Usuário'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Perfil</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    Ver desempenho
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    Modo Light/Dark
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-xs text-muted-foreground">Progresso geral</p>
            <div className="flex-1 flex items-center gap-2">
              <Progress value={totalProgress} className="h-2" />
              <span className="text-sm font-bold">{totalProgress}%</span>
            </div>
          </div>
        </motion.div>

        {/* Minha Jornada (Hero) */}
        <Card className="premium-card hover-lift bg-gradient-to-r from-[#1E40AF]/90 via-[#1E40AF]/70 to-[#8B5CF6]/80 text-white border-0 shadow-xl">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm opacity-80">Sua jornada</p>
                    <h3 className="text-2xl md:text-3xl font-bold">{totalProgress}% concluído</h3>
                  </div>
                </div>
                <p className="text-sm md:text-base opacity-90">Você tem {nextContents.length} missões de hoje no Guia de Estudos</p>
                <div className="flex gap-3">
                  <Button variant="secondary" className="bg-white text-[#1E40AF] hover:bg-white/90" onClick={() => navigate('/guia-estudos')}>
                    Continuar Estudando
                  </Button>
                  <Button variant="ghost" className="text-white" onClick={() => navigate('/dashboard')}>
                    Ver análise completa
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="w-full md:w-64 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="95%" data={[{ name: 'Progresso', value: totalProgress, fill: '#8B5CF6' }]}> 
                    <RadialBar minAngle={15} clockWise dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meu Dia */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Meu Dia
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {/* Missões de hoje */}
            <Card className="min-w-[280px] hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> Missões de hoje
                </CardTitle>
                <CardDescription>Conteúdos do Guia</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {nextContents.length > 0 ? nextContents.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border bg-accent/10">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{c.name}</p>
                      <Badge variant="outline">{c.discipline}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Tipo: {c.type === 'video' ? 'Vídeo' : c.type === 'exercise' ? 'Exercício' : 'Leitura'}</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate('/guia-estudos')}>
                      Abrir
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhuma missão recomendada.</p>}
              </CardContent>
            </Card>

            {/* Próximos eventos */}
            <Card className="min-w-[280px] hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Próximos eventos
                </CardTitle>
                <CardDescription>Simulados, lives, webinars</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {intensivoEvents.length > 0 ? intensivoEvents.slice(0,3).map((e) => (
                  <div key={e.id} className="p-3 rounded-lg border bg-accent/10">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{e.tema_do_dia}</p>
                      <Badge variant="secondary">USCS</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Semana {e.semana} · Dia {e.dia}</p>
                    {e.link_aula && (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => window.open(e.link_aula!, '_blank')}>
                        Assistir
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )) : <p className="text-sm text-muted-foreground">Sem eventos recentes.</p>}
              </CardContent>
            </Card>

            {/* Revisão programada */}
            <Card className="min-w-[280px] hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Repeat className="h-5 w-5 text-primary" /> Revisão programada
                </CardTitle>
                <CardDescription>Conteúdos para reforçar</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">Configurar quando dados de revisão estiverem disponíveis.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Desempenho e Insights */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Desempenho e Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Progresso Total</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={[{ name: 'Progresso', value: totalProgress, fill: '#3B82F6' }]}> 
                      <RadialBar minAngle={15} clockWise dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Áreas mais estudadas</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={disciplineProgress.slice(0,5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ReTooltip />
                      <Bar dataKey="completed" fill="#8B5CF6" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Ranking na sua IES</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {rankingIES ? (
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-sm font-medium mb-2">
                      <Trophy className="h-4 w-4 text-amber-500" /> Ranking na IES
                    </div>
                    <p className="text-xl font-bold text-primary">{rankingIES.rank}º</p>
                    <p className="text-xs text-muted-foreground">de {rankingIES.total} alunos</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de simulado recente.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recomendações Inteligentes */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Recomendações Inteligentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {disciplineProgress.length > 0 ? studyContents.filter(c => !c.completed && c.discipline === (disciplineProgress.sort((a,b) => b.remaining - a.remaining)[0]?.name)).slice(0,3).map((c) => (
              <Card key={c.id} className="group hover:shadow-lg transition-all cursor-pointer overflow-hidden border backdrop-blur bg-white/60 dark:bg-black/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" /> {c.name}
                  </CardTitle>
                  <CardDescription>{c.discipline}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full group-hover:bg-primary group-hover:text-primary-foreground" onClick={() => navigate('/guia-estudos')}>
                    Assistir agora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )) : <Card><CardContent className="py-6 text-center text-muted-foreground">Sem recomendações no momento.</CardContent></Card>}
          </div>
        </div>

        {/* Conquistas e Engajamento */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> Conquistas e Engajamento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Badges desbloqueadas</CardTitle></CardHeader>
              <CardContent className="pt-0 flex items-center gap-2">
                <Badge className="bg-amber-100 text-amber-700">100 aulas concluídas</Badge>
                <Badge className="bg-blue-100 text-blue-700">Maratona de Revisão</Badge>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Barra de XP</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <Progress value={Math.min(100, totalCompleted)} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">Rumo ao próximo nível</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2"><CardTitle className="text-lg">Confete de metas</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">Ativaremos confete discreto ao atingir metas.</CardContent>
            </Card>
          </div>
        </div>

        {/* Feed Institucional (B2B) */}
        {isB2BUser(user) && (
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" /> Feed Institucional
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((announcement, index) => {
                const Icon = announcement.icon;
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          announcement.variant === 'info' 
                            ? 'bg-blue-500/10 text-blue-500' 
                            : 'bg-warning/10 text-warning'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{announcement.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {announcement.description}
                          </CardDescription>
                          <p className="text-xs text-muted-foreground mt-2">
                            {announcement.date}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Meus Documentos e Materiais */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Meus Documentos e Materiais
          </h2>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-lg">Arquivos Recentes</CardTitle><CardDescription>Em breve: PDFs, resumos e simulados</CardDescription></CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">Nenhum arquivo recente encontrado.</CardContent>
          </Card>
        </div>

        {/* Suporte e Ajuda Rápida */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Suporte e Ajuda Rápida
          </h2>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.open('https://sanarflix.com', '_blank')}>Falar com suporte</Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>Ver tutoriais da plataforma</Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png" alt="Sanarflix" className="w-6 h-6 rounded" />
            <span>SanarFlix • Guia de Estudos</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">Termos</a>
            <a href="#" className="hover:underline">Política</a>
            <a href="#" className="hover:underline">Ajuda</a>
          </div>
        </div>

        {/* Sanar Promo Section (mantida) */}
        <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">
                  {currentPromotion.title}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {currentPromotion.description}
                </p>
                <Button className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90" onClick={() => window.open(currentPromotion.ctaLink, '_blank')}>
                  {currentPromotion.ctaText}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="hidden md:block">
                <GraduationCap className="h-32 w-32 text-primary/20" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
