import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, List, CalendarDays, BarChart3, BookOpen, Users, PlayCircle, ExternalLink, GraduationCap, Clock, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressAreaCard } from '@/components/ProgressAreaCard';
import { CalendarView } from '@/components/CalendarView';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { intensivoUSCSApi, IntensivoUSCSItem } from '@/services/intensivoUSCSApi';
import uscsLogo from '@/assets/uscs-logo-full-novo.png';

const IntensivoEnamedUSCS: React.FC = () => {
  const { user } = useAuth();
  const [userIes, setUserIes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showDetailedProgress, setShowDetailedProgress] = useState(false);

  // Estado para conteúdo do intensivo
  const [intensivoItems, setIntensivoItems] = useState<IntensivoUSCSItem[]>([]);
  const [loadingIntensivo, setLoadingIntensivo] = useState<boolean>(true);
  const [intensivoError, setIntensivoError] = useState<string | null>(null);

  // Load view preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('intensivo-uscs-view-mode') as 'list' | 'calendar';
    if (savedViewMode) {
      setViewMode(savedViewMode);
    } else {
      setViewMode('list');
    }
  }, []);

  // Save view preference to localStorage
  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'calendar' : 'list';
    setViewMode(newMode);
    localStorage.setItem('intensivo-uscs-view-mode', newMode);
  };

  // Buscar conteúdo do intensivo
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingIntensivo(true);
        setIntensivoError(null);
        const items = await intensivoUSCSApi.getAllContent();
        if (active) setIntensivoItems(items);
      } catch (e) {
        if (active) setIntensivoError('Falha ao carregar o conteúdo. Tente novamente mais tarde.');
      } finally {
        if (active) setLoadingIntensivo(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;

      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select(`
            id_ies,
            ies:id_ies (
              nome
            )
          `)
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const iesNome = userData?.ies?.nome || '';
        setUserIes(iesNome);
        
        // Verificar se o usuário é da USCS
        const isUSCS = iesNome.toLowerCase().includes('uscs') || 
                      iesNome.toLowerCase().includes('universidade municipal de são caetano do sul');
        
        setHasAccess(isUSCS);
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user]);

  // Carregar progresso do usuário do banco de dados
  const loadIntensivoProgress = useCallback(async () => {
    if (!user) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: progressData, error } = await supabase
        .from('user_progress')
        .select('content_id')
        .eq('user_id', authUser.id)
        .like('content_id', 'intensivo_uscs_%');

      if (error) {
        return;
      }

      if (progressData && progressData.length > 0) {
        const completedIds = progressData
          .map(item => item.content_id.replace('intensivo_uscs_', ''))
          .filter(id => id);
        setCompletedItems(new Set(completedIds));
      }
    } catch (error) {
      // Error loading progress
    }
  }, [user]);

  // Carregar progresso quando o usuário estiver disponível
  useEffect(() => {
    if (user) {
      loadIntensivoProgress();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadIntensivoProgress();
      }
    });
    return () => subscription.unsubscribe();
  }, [user, loadIntensivoProgress]);

  // Marcar/desmarcar item como concluído
  const toggleItemCompletion = useCallback(async (itemId: string) => {
    const isCompleting = !completedItems.has(itemId);

    // Atualização otimista da UI
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });

    // Sincronizar com o banco de dados
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return;
      }

      const contentId = `intensivo_uscs_${itemId}`;

      if (isCompleting) {
        const { data: existing, error: checkError } = await supabase
          .from('user_progress')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('content_id', contentId)
          .maybeSingle();

        if (checkError) {
          toast.error('Erro ao salvar progresso. Tente novamente.');
          setCompletedItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
          });
          return;
        }

        if (!existing) {
          const { error: insertError } = await supabase
            .from('user_progress')
            .insert({ 
              user_id: authUser.id, 
              content_id: contentId 
            });
          
          if (insertError) {
            toast.error('Erro ao salvar progresso. Tente novamente.');
            setCompletedItems(prev => {
              const newSet = new Set(prev);
              newSet.delete(itemId);
              return newSet;
            });
            return;
          }
        }
      } else {
        const { error } = await supabase
          .from('user_progress')
          .delete()
          .eq('user_id', authUser.id)
          .eq('content_id', contentId);
        
        if (error) {
          toast.error('Erro ao remover progresso. Tente novamente.');
          setCompletedItems(prev => {
            const newSet = new Set(prev);
            newSet.add(itemId);
            return newSet;
          });
          return;
        }
      }

      toast.success(isCompleting ? 'Aula marcada como concluída! 🎉' : 'Aula desmarcada');
    } catch (error) {
      toast.error('Erro ao sincronizar progresso. Verifique sua conexão.');
    }
  }, [completedItems]);

  // Calcular dados de progresso
  const progressData = useMemo(() => {
    const totalItems = intensivoItems.length;
    const completedCount = intensivoItems.filter(item => completedItems.has(item.id)).length;
    const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    return { totalItems, completedItems: completedCount, percentage };
  }, [completedItems, intensivoItems]);

  // Calcular progresso por semana
  const progressByWeek = useMemo(() => {
    const weekStats: Record<string, { total: number; completed: number }> = {};
    intensivoItems.forEach(item => {
      const week = item.semana || 'Outros';
      if (!weekStats[week]) {
        weekStats[week] = { total: 0, completed: 0 };
      }
      weekStats[week].total++;
      if (completedItems.has(item.id)) {
        weekStats[week].completed++;
      }
    });
    return weekStats;
  }, [completedItems, intensivoItems]);

  // Lista de semanas disponíveis
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    intensivoItems.forEach(item => weeks.add(item.semana || 'Outros'));
    return Array.from(weeks).sort();
  }, [intensivoItems]);

  // Filtrar aulas por semana selecionada
  const filteredItems = useMemo(() => {
    return intensivoItems.filter(item => {
      const weekMatch = selectedWeek === 'all' || (item.semana || 'Outros') === selectedWeek;
      return weekMatch;
    });
  }, [intensivoItems, selectedWeek]);

  // Agrupar itens por semana para exibição
  const groupedItems = useMemo(() => {
    const groups: Record<string, IntensivoUSCSItem[]> = {};
    filteredItems.forEach(item => {
      const week = item.semana || 'Outros';
      if (!groups[week]) groups[week] = [];
      groups[week].push(item);
    });
    return groups;
  }, [filteredItems]);

  if (loading || loadingIntensivo) {
    return (
      <div className="min-h-screen bg-background dark:bg-background py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="text-lg text-muted-foreground mt-4">Carregando conteúdo...</p>
          </div>
        </div>
      </div>
    );
  }

  // Se houver erro, mostrar mensagem
  if (intensivoError) {
    return (
      <div className="min-h-screen bg-background dark:bg-background py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-lg text-red-600 dark:text-red-400">{intensivoError}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Esta página é exclusiva para alunos da <strong>USCS</strong> (Universidade Municipal de São Caetano do Sul).
            </p>
            <p className="text-sm text-muted-foreground">
              Sua instituição atual: <Badge variant="outline">{userIes || 'Não identificada'}</Badge>
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Se você é aluno da USCS e está vendo esta mensagem, entre em contato com o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Premium Header with USCS Branding */}
        <div className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-premium shadow-2xl">
          <div className="absolute inset-0 bg-black/10 dark:bg-black/30"></div>
          <div className="absolute inset-0 backdrop-blur-[2px]"></div>
          
          <div className="relative p-8 lg:p-12 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* USCS Logo */}
                <div className="flex-shrink-0">
                  <img 
                    src={uscsLogo} 
                    alt="USCS - Universidade de São Caetano do Sul" 
                    className="h-16 lg:h-20 w-auto filter brightness-0 invert"
                  />
                </div>
                
                {/* Title and Description */}
                <div>
                  <h1 className="text-4xl lg:text-5xl font-display font-bold mb-3 text-center lg:text-left">
                    Intensivo Enamed
                  </h1>
                  <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                    <GraduationCap className="h-6 w-6 text-uscs-orange" />
                    <span className="text-xl font-semibold text-white/90">USCS</span>
                  </div>
                  <p className="text-white/80 text-lg max-w-2xl text-center lg:text-left leading-relaxed">
                    Cronograma de estudos exclusivo para alunos da Universidade Municipal de São Caetano do Sul
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Overall Progress Card */}
          <Card className="premium-card hover-lift bg-gradient-card-light dark:bg-gradient-card-dark border-0 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                Progresso Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aulas concluídas</span>
                  <span className="font-bold text-lg">{progressData.completedItems}/{progressData.totalItems}</span>
                </div>
                <Progress value={progressData.percentage} className="h-3 rounded-full" />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {progressData.percentage}% concluído
                  </p>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {progressData.percentage}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Weeks Card */}
          <Card className="premium-card hover-lift bg-gradient-card-light dark:bg-gradient-card-dark border-0 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-3">
                <div className="p-2 rounded-xl bg-uscs-blue/10 dark:bg-uscs-blue/20">
                  <Clock className="h-5 w-5 text-uscs-blue" />
                </div>
                Semanas Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-uscs-blue mb-2">
                  {Object.keys(progressByWeek).length}
                </div>
                <p className="text-sm text-muted-foreground">Semanas de estudo intensivo</p>
                <div className="mt-4 flex justify-center">
                  <Badge variant="outline" className="border-uscs-blue/30 text-uscs-blue">
                    Cronograma Completo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress by Week Card */}
          <Card className="premium-card hover-lift bg-gradient-card-light dark:bg-gradient-card-dark border-0 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-uscs-orange/10 dark:bg-uscs-orange/20">
                    <BarChart3 className="h-5 w-5 text-uscs-orange" />
                  </div>
                  Progresso Detalhado
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailedProgress(!showDetailedProgress)}
                  className="h-8 px-3 hover:bg-uscs-orange/10 transition-colors-smooth"
                >
                  {showDetailedProgress ? 'Ocultar' : 'Ver'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Acompanhe seu progresso por semana
                </p>
                <div className="flex justify-center">
                  <Badge 
                    variant={showDetailedProgress ? "default" : "outline"} 
                    className={showDetailedProgress ? "bg-uscs-orange text-white" : "border-uscs-orange/30 text-uscs-orange"}
                  >
                    {showDetailedProgress ? 'Exibindo detalhes' : 'Clique para expandir'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress by week - only show when toggle is active */}
        {showDetailedProgress && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {Object.entries(progressByWeek).map(([week, stats]) => (
              <ProgressAreaCard
                key={week}
                title={week}
                current={stats.completed}
                total={stats.total}
                percentage={Math.round((stats.completed / stats.total) * 100)}
              />
            ))}
          </div>
        )}

        {/* Premium Controls */}
        <Card className="mb-10 premium-card bg-gradient-card-light dark:bg-gradient-card-dark border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-full sm:w-80 h-12 rounded-xl border-2 transition-colors-smooth focus:border-primary">
                    <SelectValue placeholder="Selecione a semana" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📚 Todas as semanas</SelectItem>
                    {availableWeeks.map((week) => (
                      <SelectItem key={week} value={week}>
                        📅 {week}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  className="flex items-center gap-2 h-12 px-6 rounded-xl transition-smooth hover-lift"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  onClick={() => setViewMode('calendar')}
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  className="flex items-center gap-2 h-12 px-6 rounded-xl transition-smooth hover-lift"
                >
                  <CalendarDays className="h-4 w-4" />
                  Calendário
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Display */}
        {viewMode === 'calendar' ? (
          <div className="animate-fade-in">
            <CalendarView 
              items={filteredItems.map(item => ({
                semana: item.semana,
                dia: item.dia,
                tema: item.tema_do_dia,
                aula: item.tema_do_dia,
                completed: completedItems.has(item.id),
                itemKey: item.id,
                discipline: 'Medicina',
                link_aula: item.link_aula
              }))}
              onToggleCompletion={toggleItemCompletion}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedItems).length === 0 ? (
              <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg">
                <CardContent className="text-center py-12">
                  <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Nenhum conteúdo encontrado</h3>
                  <p className="text-muted-foreground">
                    Não há aulas disponíveis para os filtros selecionados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedItems).map(([week, items]) => (
                <Card key={week} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      {week}
                      <Badge variant="outline" className="ml-auto">
                        {items.filter(item => completedItems.has(item.id)).length}/{items.length} concluídas
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-6">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value={week} className="border-0">
                        <AccordionTrigger className="px-6 py-2 hover:no-underline">
                          <span className="text-sm text-muted-foreground">
                            Ver {items.length} aula{items.length !== 1 ? 's' : ''}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-0">
                          <div className="space-y-3">
                            {items.map((item) => {
                              const isCompleted = completedItems.has(item.id);
                              return (
                                <div 
                                  key={item.id}
                                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 ${
                                    isCompleted 
                                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                                      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 hover:border-primary/30'
                                  }`}
                                >
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => toggleItemCompletion(item.id)}
                                    className="flex-shrink-0"
                                  />
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <h4 className={`font-medium text-sm leading-relaxed ${
                                          isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                                        }`}>
                                          {item.tema_do_dia}
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {item.dia}
                                        </p>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {isCompleted && (
                                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        )}
                                        
                                        {item.link_aula && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.open(item.link_aula!, '_blank')}
                                            className="h-8 px-3 text-xs"
                                          >
                                            <PlayCircle className="h-3 w-3 mr-1" />
                                            Assistir
                                            <ExternalLink className="h-3 w-3 ml-1" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntensivoEnamedUSCS;