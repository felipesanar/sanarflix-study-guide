import React, { useState, useMemo, useCallback, useEffect } from 'react';
import guiaEstudosBanner from '@/assets/guia-estudos-banner.png';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, List, CalendarDays, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressAreaCard } from '@/components/ProgressAreaCard';
import { CalendarView } from '@/components/CalendarView';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


// Fonte de dados: API oficial do cronograma ENAMED - filtrando apenas últimos 30 dias
export const CRONOGRAMA_API = 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/enamed-proxy';

export type DiaRaw = { nome: string; area_conhecimento?: string; temas?: any[]; subtemas?: any[]; aulas?: any[] };
export type Semana = { numero: string; periodo?: string; dias: DiaRaw[] };
export type Cronograma = { semanas: Semana[] };

// Normaliza diferentes formatos de resposta para { semanas: [...] } e filtra últimos 30 dias
export const normalizeCronogramaDerradeiros = (data: any): Cronograma => {
  try {
    if (!data) return { semanas: [] };

    // Pode vir como { cronograma: { semana_X: {...} } } ou variações
    const root: any = (data as any).cronograma ?? data;

    // Caso 1: Objeto com chaves semana_X
    if (root && typeof root === 'object' && !Array.isArray(root) && !Array.isArray(root?.semanas)) {
      const semanas: Semana[] = Object.entries(root as Record<string, any>).map(([key, w], idx) => {
        const numero: string = (w?.nome_exibicao as string)
          ?? (w?.numero as string)
          ?? key.replace(/_/g, ' ').replace(/semana\s*/i, 'Semana ')
          ?? `Semana ${idx + 1}`;
        const periodo: string | undefined = (w as any)?.periodo;
        const dias: DiaRaw[] = Array.isArray(w?.dias) ? (w.dias as DiaRaw[]) : [];
        return { numero, periodo, dias };
      });
      
      // Filtrar apenas as últimas 4-5 semanas (aproximadamente 30 dias)
      return { semanas: semanas.slice(-5) };
    }

    // Caso 2: Array em root.semanas ou root
    const rawWeeks: any[] = Array.isArray(root?.semanas)
      ? root.semanas
      : Array.isArray(root)
      ? root
      : [];

    const semanas: Semana[] = rawWeeks.map((w: any, idx: number) => {
      const numero: string =
        (w?.nome_exibicao as string)
        ?? (w?.numero as string)
        ?? (w?.nome as string)
        ?? (w?.titulo as string)
        ?? `Semana ${idx + 1}`;
      const periodo: string | undefined = (w as any)?.periodo;
      const dias: DiaRaw[] = Array.isArray(w?.dias) ? (w.dias as DiaRaw[]) : [];
      return { numero, periodo, dias };
    });

    // Filtrar apenas as últimas 4-5 semanas (aproximadamente 30 dias)
    return { semanas: semanas.slice(-5) };
  } catch (e) {
    return { semanas: [] };
  }
};

const getContentTypeBadge = (tema: string) => {
  if (tema.includes('Prova') || tema.includes('Simulado')) {
    return <Badge variant="destructive" className="text-xs font-medium">Prova</Badge>;
  } else if (tema.includes('Revisão')) {
    return <Badge variant="secondary" className="text-xs font-medium">Revisão</Badge>;
  }
  return <Badge variant="default" className="text-xs font-medium">Aula</Badge>;
};

export const CronogramaEnamed: React.FC = () => {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [showDetailedProgress, setShowDetailedProgress] = useState(false);

// Estado para cronograma carregado da API
const [cronograma, setCronograma] = useState<Cronograma>({ semanas: [] });
const [loadingCronograma, setLoadingCronograma] = useState<boolean>(true);
const [cronogramaError, setCronogramaError] = useState<string | null>(null);

// Itens (aulas) extraídos do cronograma com links e metadados
type AulaItem = {
  semana: string;
  dia: string;
  tema?: string;
  subtema?: string;
  aula: string;
  link_aula?: string;
  link_questoes?: string;
  discipline: string;
  itemKey: string;
};

const allAulas: AulaItem[] = useMemo(() => {
  const items: AulaItem[] = [];
  cronograma.semanas.forEach((semana, sIdx) => {
    const semanaLabel = semana.numero || `Semana ${sIdx + 1}`;
    (semana.dias || []).forEach((dia: any) => {
      const diaNome: string = (dia?.nome as string) ?? 'Dia';
      const discipline: string =
        (dia?.area_conhecimento as string) ??
        extractDiscipline(diaNome);

      const temas = Array.isArray(dia?.temas) ? dia.temas : [];
      if (temas.length > 0) {
        temas.forEach((t: any) => {
          const temaNome: string | undefined = typeof t?.nome === 'string' ? t.nome : undefined;
          const subtemas = Array.isArray(t?.subtemas) ? t.subtemas : [];
          if (subtemas.length > 0) {
            subtemas.forEach((st: any) => {
              const subtemaNome: string | undefined = typeof st?.nome === 'string' ? st.nome : undefined;
              const aulas = Array.isArray(st?.aulas) ? st.aulas : [];
              aulas.forEach((a: any, aIdx: number) => {
                if (typeof a?.nome === 'string') {
                  const aulaNome = a.nome as string;
                  const link_aula = a?.link_aula as string | undefined;
                  const link_questoes = a?.link_questoes as string | undefined;
                  const itemKey = `${semanaLabel}-${diaNome}-${temaNome ?? ''}-${subtemaNome ?? ''}-${aulaNome}-${aIdx}`;
                  items.push({
                    semana: semanaLabel,
                    dia: diaNome,
                    tema: temaNome,
                    subtema: subtemaNome,
                    aula: aulaNome,
                    link_aula,
                    link_questoes,
                    discipline,
                    itemKey,
                  });
                }
              });
            });
          } else {
            // Aulas diretamente em tema (fallback)
            const aulasTema = Array.isArray((t as any)?.aulas) ? (t as any).aulas : [];
            aulasTema.forEach((a: any, aIdx: number) => {
              if (typeof a?.nome === 'string') {
                const aulaNome = a.nome as string;
                const link_aula = a?.link_aula as string | undefined;
                const link_questoes = a?.link_questoes as string | undefined;
                const itemKey = `${semanaLabel}-${diaNome}-${temaNome ?? ''}-${aulaNome}-${aIdx}`;
                items.push({
                  semana: semanaLabel,
                  dia: diaNome,
                  tema: temaNome,
                  subtema: undefined,
                  aula: aulaNome,
                  link_aula,
                  link_questoes,
                  discipline,
                  itemKey,
                });
              }
            });
          }
        });
      }

      // Fallback: aulas diretamente no dia
      const aulasDia = Array.isArray(dia?.aulas) ? dia.aulas : [];
      aulasDia.forEach((a: any, aIdx: number) => {
        if (typeof a?.nome === 'string') {
          const aulaNome = a.nome as string;
          const link_aula = a?.link_aula as string | undefined;
          const link_questoes = a?.link_questoes as string | undefined;
          const itemKey = `${semanaLabel}-${diaNome}-${aulaNome}-${aIdx}`;
          items.push({
            semana: semanaLabel,
            dia: diaNome,
            tema: undefined,
            subtema: undefined,
            aula: aulaNome,
            link_aula,
            link_questoes,
            discipline,
            itemKey,
          });
        }
      });
    });
  });
  return items;
}, [cronograma]);

  // Load view preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('cronograma-enamed-view-mode') as 'list' | 'calendar';
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view preference to localStorage
  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'calendar' : 'list';
    setViewMode(newMode);
    localStorage.setItem('cronograma-enamed-view-mode', newMode);
  };

  // Buscar cronograma completo da API oficial
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingCronograma(true);
        setCronogramaError(null);
        const res = await fetch(CRONOGRAMA_API, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const normalized = normalizeCronogramaDerradeiros(data);
        if (active) setCronograma(normalized);
      } catch (e) {
        if (active) setCronogramaError('Falha ao carregar o cronograma. Tente novamente mais tarde.');
      } finally {
        if (active) setLoadingCronograma(false);
      }
    })();
    return () => { const _ = (active = false); };
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
        console.error('Error loading Cronograma ENAMED progress:', error);
        return;
      }

      if (progressData && progressData.length > 0) {
        const completedIds = progressData
          .map(item => item.content_id.replace('cronograma_enamed_', ''))
          .filter(id => id); // Remove empty strings
        setCompletedItems(new Set(completedIds));
      }
    } catch (error) {
      console.error('Error loading Cronograma ENAMED progress:', error);
    }
  }, [user]);

  // Carregar progresso quando o usuário estiver disponível e quando a sessão autenticar
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

  // Função para extrair disciplina do nome do dia
  const extractDiscipline = (diaName: string): string => {
    if (diaName.includes('Ginecologia')) return 'Ginecologia e Obstetrícia';
    if (diaName.includes('Pediatria')) return 'Pediatria';
    if (diaName.includes('Clínica Médica')) return 'Clínica Médica';
    if (diaName.includes('Clínica Cirúrgica')) return 'Clínica Cirúrgica';
    if (diaName.includes('MFC')) return 'MFC e Saúde Coletiva';
    if (diaName.includes('Revisão')) return 'Revisão';
    if (diaName.includes('Prova')) return 'Avaliação';
    return 'Outros';
  };

  // Marcar/desmarcar item como concluído com persistência no banco
  const toggleItemCompletion = useCallback(async (itemKey: string) => {
    const isCompleting = !completedItems.has(itemKey);

    // Atualização otimista da UI
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });

    // Sincronizar com o banco de dados
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.error('No authenticated user found');
        return;
      }

      const contentId = `cronograma_enamed_${itemKey}`;

      if (isCompleting) {
        // Evitar duplicatas: verifica se já existe
        const { data: existing, error: checkError } = await supabase
          .from('user_progress')
          .select('id')
          .eq('user_id', authUser.id)
          .eq('content_id', contentId)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing Cronograma ENAMED progress:', checkError);
          toast.error('Erro ao salvar progresso. Tente novamente.');
          // Reverter mudança otimista
          setCompletedItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemKey);
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
            console.error('Error saving Cronograma ENAMED progress:', insertError);
            toast.error('Erro ao salvar progresso. Tente novamente.');
            // Reverter mudança otimista
            setCompletedItems(prev => {
              const newSet = new Set(prev);
              newSet.delete(itemKey);
              return newSet;
            });
            return;
          }
        }
      } else {
        // Remover do banco
        const { error } = await supabase
          .from('user_progress')
          .delete()
          .eq('user_id', authUser.id)
          .eq('content_id', contentId);
        
        if (error) {
          console.error('Error removing Cronograma ENAMED progress:', error);
          toast.error('Erro ao remover progresso. Tente novamente.');
          // Reverter mudança otimista
          setCompletedItems(prev => {
            const newSet = new Set(prev);
            newSet.add(itemKey);
            return newSet;
          });
          return;
        }
      }

      // Sucesso - mostrar notificação
      toast.success(isCompleting ? 'Aula marcada como concluída! 🎉' : 'Aula desmarcada');
    } catch (error) {
      console.error('Error syncing Cronograma ENAMED progress:', error);
      toast.error('Erro ao sincronizar progresso. Verifique sua conexão.');
    }
  }, [completedItems]);

  // Calcular dados de progresso
  const progressData = useMemo(() => {
    const isOptional = (name?: string) => !!name && name.includes('(OPCIONAL)');
    const nonOptional = allAulas.filter(i => !isOptional(i.aula));
    const totalItems = nonOptional.length;
    const completedCount = nonOptional.filter(i => completedItems.has(i.itemKey)).length;
    const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    return { totalItems, completedItems: completedCount, percentage };
  }, [completedItems, allAulas]);

  // Calcular progresso por disciplina
  const progressByDiscipline = useMemo(() => {
    const isOptional = (name?: string) => !!name && name.includes('(OPCIONAL)');
    const disciplineStats: Record<string, { total: number; completed: number }> = {};
    allAulas.forEach(item => {
      if (isOptional(item.aula)) return; // ignore opcionais
      const d = item.discipline || 'Outros';
      if (!disciplineStats[d]) {
        disciplineStats[d] = { total: 0, completed: 0 };
      }
      disciplineStats[d].total++;
      if (completedItems.has(item.itemKey)) {
        disciplineStats[d].completed++;
      }
    });
    return disciplineStats;
  }, [completedItems, allAulas]);

  // Calcular semanas concluídas (ignorando opcionais)
  const weekProgress = useMemo(() => {
    const isOptional = (name?: string) => !!name && name.includes('(OPCIONAL)');
    const byWeek: Record<string, { total: number; completed: number }> = {};
    allAulas.forEach(item => {
      if (isOptional(item.aula)) return;
      if (!byWeek[item.semana]) byWeek[item.semana] = { total: 0, completed: 0 };
      byWeek[item.semana].total++;
      if (completedItems.has(item.itemKey)) byWeek[item.semana].completed++;
    });

    const totalWeeks = Object.keys(byWeek).length || cronograma.semanas.length;
    const completedWeeks = Object.values(byWeek).filter(w => w.total > 0 && w.completed === w.total).length;
    const percentage = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;
    
    return { completedWeeks, totalWeeks, percentage };
  }, [completedItems, allAulas, cronograma.semanas.length]);

  // Lista de disciplinas disponíveis
  const availableDisciplines = useMemo(() => {
    const disciplines = new Set<string>();
    allAulas.forEach(i => disciplines.add(i.discipline));
    return Array.from(disciplines).sort();
  }, [allAulas]);

  // Filtrar dados por semana selecionada
  const availableDays = useMemo(() => {
    if (selectedWeek === 'all') return [];
    const days = new Set<string>();
    allAulas.filter(i => i.semana === selectedWeek).forEach(i => days.add(i.dia));
    return Array.from(days).map(nome => ({ nome }));
  }, [selectedWeek, allAulas]);

  // Filtrar aulas por critérios selecionados
  const filteredAulas = useMemo(() => {
    return allAulas.filter(item => {
      const weekMatch = selectedWeek === 'all' || item.semana === selectedWeek;
      const dayMatch = selectedDay === 'all' || item.dia === selectedDay;
      const disciplineMatch = selectedDiscipline === 'all' || item.discipline === selectedDiscipline;
      return weekMatch && dayMatch && disciplineMatch;
    });
  }, [allAulas, selectedWeek, selectedDay, selectedDiscipline]);

  // Obter ícone da disciplina

  // Se está carregando, mostrar indicador de carregamento
  if (loadingCronograma) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="text-lg text-muted-foreground mt-4">Carregando cronograma dos derradeiros 30 dias...</p>
          </div>
        </div>
      </div>
    );
  }

  // Se houver erro, mostrar mensagem
  if (cronogramaError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-lg text-red-600 dark:text-red-400">{cronogramaError}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-primary/90 to-primary shadow-xl">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative p-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="mb-4 md:mb-0">
                <h1 className="text-4xl font-bold mb-2">Cronograma ENAMED</h1>
                <p className="text-primary-foreground/90 text-lg">
                  Conteúdos essenciais dos últimos 30 dias para sua preparação final
                </p>
              </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de progresso */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                Semanas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Semanas concluídas</span>
                  <span className="font-semibold">{weekProgress.completedWeeks}/{weekProgress.totalWeeks}</span>
                </div>
                <Progress value={weekProgress.percentage} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {weekProgress.percentage}% das semanas finalizadas
                </p>
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
                <div className="text-3xl font-bold text-primary mb-1">
                  {Object.keys(progressByDiscipline).length}
                </div>
                <p className="text-sm text-muted-foreground">Áreas disponíveis</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para ver detalhes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress by discipline - only show when toggle is active */}
        {showDetailedProgress && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {Object.entries(progressByDiscipline).map(([discipline, stats]) => (
              <ProgressAreaCard
                key={discipline}
                title={discipline}
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
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Selecione a semana" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as semanas</SelectItem>
                    {cronograma.semanas.map((semana, idx) => (
                      <SelectItem key={idx} value={semana.numero}>
                        {semana.numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedWeek !== 'all' && availableDays.length > 0 && (
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os dias</SelectItem>
                      {availableDays.map((dia, idx) => (
                        <SelectItem key={idx} value={dia.nome}>
                          {dia.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {availableDisciplines.map((discipline) => (
                      <SelectItem key={discipline} value={discipline}>
                        {discipline}
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
            items={filteredAulas.map(item => ({ ...item, completed: completedItems.has(item.itemKey) }))} 
            onToggleCompletion={toggleItemCompletion}
          />
        ) : (
          <div className="space-y-6">
            {filteredAulas.length === 0 ? (
              <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhuma aula encontrada para os filtros selecionados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {Object.entries(
                  filteredAulas.reduce((acc, item) => {
                    const key = `${item.semana}-${item.dia}`;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, typeof filteredAulas>)
                ).map(([key, items]) => {
                  const [semana, dia] = key.split('-');
                  const completedCount = items.filter(item => completedItems.has(item.itemKey)).length;
                  const totalCount = items.length;
                  const isCompleted = completedCount === totalCount;

                  return (
                    <AccordionItem 
                      key={key} 
                      value={key} 
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
                              <h3 className="font-semibold text-lg">
                                {semana} - {dia}
                              </h3>
                              <p className="text-sm text-muted-foreground font-medium">
                                {items[0]?.discipline || 'Outros'}
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
                                key={item.itemKey}
                                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                                  completedItems.has(item.itemKey)
                                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                }`}
                              >
                                <div className="flex items-center space-x-3 flex-1">
                                  <Checkbox
                                    checked={completedItems.has(item.itemKey)}
                                    onCheckedChange={() => toggleItemCompletion(item.itemKey)}
                                    className="h-5 w-5"
                                  />
                                  <div className="flex items-center space-x-3">
                                    <span className={`font-medium ${
                                      completedItems.has(item.itemKey) 
                                        ? 'line-through text-muted-foreground' 
                                        : ''
                                    }`}>
                                      {item.aula}
                                    </span>
                                    {getContentTypeBadge(item.aula)}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {item.link_aula && (
                                    <Button
                                      size="sm"
                                      onClick={() => window.open(item.link_aula, '_blank')}
                                      className="h-9 px-4 font-medium"
                                    >
                                      Assistir Aula
                                    </Button>
                                  )}
                                  {item.link_questoes && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(item.link_questoes, '_blank')}
                                      className="h-9 px-4 font-medium"
                                    >
                                      Questões
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