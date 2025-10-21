import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessRules } from '@/utils/accessRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
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
  Clock
} from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Olá, {user?.nome?.split(' ')[0] || 'Estudante'}! 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            Bem-vindo à sua central de estudos. Continue sua jornada de preparação.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Instituição</p>
                  <p className="text-2xl font-bold">{user?.ies_nome || 'Não definida'}</p>
                </div>
                <GraduationCap className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Semestre</p>
                  <p className="text-2xl font-bold">{user?.semestre || '-'}º Período</p>
                </div>
                <Award className="h-8 w-8 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recursos Ativos</p>
                  <p className="text-2xl font-bold">{availableResources.length}</p>
                </div>
                <Target className="h-8 w-8 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Resources Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Seus Recursos
          </h2>
          
          {availableResources.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Nenhum recurso disponível</h3>
                <p className="text-muted-foreground">
                  Entre em contato com o suporte para ativar seus recursos de estudo
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableResources.map((resource, index) => {
                const Icon = resource.icon;
                return (
                  <Card
                    key={index}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden border-2 hover:border-primary/50"
                    onClick={() => navigate(resource.route)}
                  >
                    <div className={`h-2 bg-gradient-to-r ${resource.color}`} />
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${resource.color} text-white`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        {resource.badge && (
                          <Badge variant="secondary" className="ml-2">
                            {resource.badge}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {resource.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {resource.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="ghost" 
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      >
                        Acessar
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Announcements & News */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Avisos e Novidades
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

        {/* Sanar Promo Section */}
        <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">
                  Conheça a Sanar+
                </h3>
                <p className="text-muted-foreground mb-4">
                  Acesse milhares de questões, videoaulas e materiais complementares para sua preparação
                </p>
                <Button className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                  Saiba Mais
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
