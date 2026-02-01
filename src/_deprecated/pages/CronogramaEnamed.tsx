import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, List, CalendarDays, BarChart3, HelpCircle, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressAreaCard } from '@/components/ProgressAreaCard';
import { CalendarView } from '@/components/CalendarView';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cronogramaEnamedApi, CronogramaEnamedItem } from '@/services/cronogramaEnamedApi';

// Configurações de links dos botões do topo
const GUIA_CRONOGRAMA_PDF = 'https://s3.sanar.online/images/d/sanarflix--cronograma-reta-final---enamed.pdf';
const SANARFLIX_SUBSCRIPTION = 'https://sanarflix.com.br/enamed?utm_source=cronograma&utm_campaign=plataforma&utm_content=VIP-enamed';

const getContentTypeBadge = (titulo: string) => {
  if (titulo.includes('Prova') || titulo.includes('Simulado')) {
    return <Badge variant="destructive" className="text-xs font-medium">Prova</Badge>;
  } else if (titulo.includes('Revisão')) {
    return <Badge variant="secondary" className="text-xs font-medium">Revisão</Badge>;
  }
  return <Badge variant="default" className="text-xs font-medium">Aula</Badge>;
};

export const CronogramaEnamed: React.FC = () => {
  const { user } = useAuth();
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [showDetailedProgress, setShowDetailedProgress] = useState(false);

  // Estado para cronograma carregado da nova API
  const [cronogramaItems, setCronogramaItems] = useState<CronogramaEnamedItem[]>([]);
  const [loadingCronograma, setLoadingCronograma] = useState<boolean>(true);
  const [cronogramaError, setCronogramaError] = useState<string | null>(null);

  // Load view preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('cronograma-enamed-view-mode') as 'list' | 'calendar';
    if (savedViewMode) {
      setViewMode(savedViewMode);
    } else {
      // Set default to calendar if no preference saved
      setViewMode('calendar');
    }
  }, []);

  // Save view preference to localStorage
  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'calendar' : 'list';
    setViewMode(newMode);
    localStorage.setItem('cronograma-enamed-view-mode', newMode);
  };

  // Buscar cronograma da nova API
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingCronograma(true);
        setCronogramaError(null);
        const items = await cronogramaEnamedApi.getAllContent();
        if (active) setCronogramaItems(items);
      } catch (e) {
        if (active) setCronogramaError('Falha ao carregar o cronograma. Tente novamente mais tarde.');
      } finally {
        if (active) setLoadingCronograma(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Carregar progresso do usuário do banco de dados
  const loadEnamedProgress = useCallback(async () => {
    if (!user) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: progressData, error } = await supabase
        .from('user_progress')
        .select('content_id')
        .eq('user_id', authUser.id)
        .like('content_id', 'cronograma_enamed_%');

      if (error) {
        return;
      }

      if (progressData && progressData.length > 0) {
        const completedIds = progressData
          .map(item => item.content_id.replace('cronograma_enamed_', ''))
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
      loadEnamedProgress();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadEnamedProgress();
      }
    });
    return () => subscription.unsubscribe();
  }, [user, loadEnamedProgress]);

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

      const contentId = `cronograma_enamed_${itemId}`;

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
    const totalItems = cronogramaItems.length;
    const completedCount = cronogramaItems.filter(item => completedItems.has(item.id)).length;
    const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    return { totalItems, completedItems: completedCount, percentage };
  }, [completedItems, cronogramaItems]);

  // Calcular progresso por área de conhecimento
  const progressByArea = useMemo(() => {
    const areaStats: Record<string, { total: number; completed: number }> = {};
    cronogramaItems.forEach(item => {
      const area = item.area_conhecimento || 'Outros';
      if (!areaStats[area]) {
        areaStats[area] = { total: 0, completed: 0 };
      }
      areaStats[area].total++;
      if (completedItems.has(item.id)) {
        areaStats[area].completed++;
      }
    });
    return areaStats;
  }, [completedItems, cronogramaItems]);

  // Lista de áreas disponíveis
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    cronogramaItems.forEach(item => areas.add(item.area_conhecimento || 'Outros'));
    return Array.from(areas).sort();
  }, [cronogramaItems]);

  // Filtrar aulas por área selecionada
  const filteredItems = useMemo(() => {
    return cronogramaItems.filter(item => {
      const areaMatch = selectedArea === 'all' || (item.area_conhecimento || 'Outros') === selectedArea;
      return areaMatch;
    });
  }, [cronogramaItems, selectedArea]);

  // Definir ordem específica das matérias para visualização de lista
  const MATERIA_ORDER = [
    'Clínica médica',
    'Cirurgia', 
    'Pediatria',
    'Ginecologia e obstetrícia',
    'Medicina da família e comunidade – saúde coletiva – saúde mental'
  ];

  // Agrupar itens por área de conhecimento para exibição
  const groupedItems = useMemo(() => {
    const groups: Record<string, CronogramaEnamedItem[]> = {};
    filteredItems.forEach(item => {
      const area = item.area_conhecimento || 'Outros';
      if (!groups[area]) groups[area] = [];
      groups[area].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Ordenar grupos seguindo a ordem específica para visualização de lista
  const orderedGroupedItems = useMemo(() => {
    if (viewMode === 'calendar') {
      return groupedItems; // Manter ordem atual para calendário
    }
    
    const orderedEntries: [string, CronogramaEnamedItem[]][] = [];
    
    // Primeiro, adicionar áreas na ordem específica
    MATERIA_ORDER.forEach(materia => {
      if (groupedItems[materia]) {
        orderedEntries.push([materia, groupedItems[materia]]);
      }
    });
    
    // Depois, adicionar outras áreas que não estão na lista ordenada
    Object.entries(groupedItems).forEach(([area, items]) => {
      if (!MATERIA_ORDER.includes(area)) {
        orderedEntries.push([area, items]);
      }
    });
    
    return Object.fromEntries(orderedEntries);
  }, [groupedItems, viewMode]);

  // Se está carregando, mostrar indicador de carregamento
  if (loadingCronograma) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-6 md:py-8 px-3 sm:px-4">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 sm:h-24 sm:w-24 md:h-32 md:w-32 border-b-2 border-primary mx-auto"></div>
            <p className="text-base sm:text-lg text-muted-foreground mt-4">Carregando cronograma...</p>
          </div>
        </div>
      </div>
    );
  }

  // Se houver erro, mostrar mensagem
  if (cronogramaError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-6 md:py-8 px-3 sm:px-4">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center">
            <p className="text-base sm:text-lg text-red-600 dark:text-red-400">{cronogramaError}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-6 md:py-8 px-3 sm:px-4">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative mb-4 sm:mb-6 md:mb-8 overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-primary/90 to-primary shadow-lg sm:shadow-xl">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative p-4 sm:p-6 md:p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="mb-2 sm:mb-4 md:mb-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2">Cronograma ENAMED</h1>
                <p className="text-primary-foreground/90 text-sm sm:text-base md:text-lg">
                  Seu cronograma personalizado de estudos
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botões fixos do topo */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <Button
            onClick={() => window.open(GUIA_CRONOGRAMA_PDF, '_blank')}
            variant="outline"
            className="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg hover:bg-white/90 dark:hover:bg-gray-800/90"
          >
            <HelpCircle className="h-4 w-4" />
            Como usar o cronograma
          </Button>
        </div>

        {/* Cards de progresso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Progresso Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aulas concluídas</span>
                  <span className="font-semibold">{progressData.completedItems}/{progressData.totalItems}</span>
                </div>
                <Progress value={progressData.percentage} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {progressData.percentage}% do cronograma concluído
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Áreas de Conhecimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {Object.keys(progressByArea).length}
                </div>
                <p className="text-sm text-muted-foreground">Áreas disponíveis</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                Progresso por Áreas
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailedProgress(!showDetailedProgress)}
                  className="h-8 px-2"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  {showDetailedProgress ? 'Ocultar' : 'Ver'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Clique para ver detalhes por área
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress by area - only show when toggle is active */}
        {showDetailedProgress && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {Object.entries(progressByArea).map(([area, stats]) => (
              <ProgressAreaCard
                key={area}
                title={area}
                current={stats.completed}
                total={stats.total}
                percentage={Math.round((stats.completed / stats.total) * 100)}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <Card className="mb-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <Select value={selectedArea} onValueChange={setSelectedArea}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as áreas</SelectItem>
                    {availableAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setViewMode('list')}
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  onClick={() => setViewMode('calendar')}
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <CalendarDays className="h-4 w-4" />
                  Calendário
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {viewMode === 'calendar' ? (
          <CalendarView 
            items={filteredItems.map(item => ({ 
              itemKey: item.id,
              semana: item.semana || 'Semana não informada',
              dia: item.data_aula || 'Sem data',
              tema: item.tema,
              subtema: item.subtema,
              aula: item.titulo,
              discipline: item.area_conhecimento || 'Outros',
              completed: completedItems.has(item.id),
              link_aula: item.link_aula,
              link_gratuito: item.link_gratuito
            }))} 
            onToggleCompletion={toggleItemCompletion}
          />
        ) : (
          <div className="space-y-6">
            {Object.keys(orderedGroupedItems).length === 0 ? (
              <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhuma aula encontrada para os filtros selecionados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {Object.entries(orderedGroupedItems).map(([area, items]) => {
                  const completedCount = items.filter(item => completedItems.has(item.id)).length;
                  const totalCount = items.length;
                  const isCompleted = completedCount === totalCount;

                  return (
                    <AccordionItem 
                      key={area} 
                      value={area} 
                      className="border-0"
                    >
                      <Card className={`overflow-hidden transition-all duration-200 hover:shadow-lg ${
                        isCompleted 
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                          : 'bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg'
                      }`}>
                        <AccordionTrigger className="px-6 py-5 hover:no-underline">
                          <div className="flex items-center justify-between w-full mr-4">
                            <div className="text-left">
                              <h3 className="font-semibold text-lg">{area}</h3>
                              <p className="text-sm text-muted-foreground font-medium">
                                Área de Conhecimento
                              </p>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {completedCount}/{totalCount} aulas
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round((completedCount / totalCount) * 100)}% concluído
                                </div>
                              </div>
                              {isCompleted && (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-4">
                          <div className="space-y-3">
                            {items.map((item) => (
                              <div 
                                key={item.id}
                                className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
                                  completedItems.has(item.id)
                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                }`}
                              >
                                <div className="flex items-start space-x-3 flex-1">
                                  <Checkbox
                                    checked={completedItems.has(item.id)}
                                    onCheckedChange={() => toggleItemCompletion(item.id)}
                                    className="h-5 w-5 mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <span className={`font-medium ${
                                        completedItems.has(item.id) 
                                          ? 'line-through text-muted-foreground' 
                                          : ''
                                      }`}>
                                        {item.titulo}
                                      </span>
                                      {getContentTypeBadge(item.titulo)}
                                    </div>
                                    {item.descricao && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {item.descricao}
                                      </p>
                                    )}
                                    {item.data_aula && (
                                      <p className="text-xs text-muted-foreground">
                                        Data: {item.data_aula}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 ml-4">
                                  {/* Botão "Acessar no SanarFlix" - sempre presente */}
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      if (item.link_aula && item.link_aula !== 'nan' && item.link_aula.trim() !== '') {
                                        window.open(item.link_aula, '_blank');
                                      } else {
                                        window.open('https://sanarflix.com.br/enamed', '_blank');
                                      }
                                    }}
                                    className="h-9 px-4 font-medium bg-[#800000] hover:bg-[#800000]/90 text-white"
                                  >
                                    Acessar no SanarFlix
                                  </Button>
                                  
                                  {/* Botão "Assistir aula grátis" - apenas se há link gratuito */}
                                  {item.link_gratuito && 
                                   item.link_gratuito !== 'nan' && 
                                   item.link_gratuito.trim() !== '' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(item.link_gratuito, '_blank')}
                                      className="h-9 px-4 font-medium bg-white border-[#800000] text-[#800000] hover:bg-[#800000]/10"
                                    >
                                      Assistir aula grátis
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        )}
      </div>
    </div>
  );
};