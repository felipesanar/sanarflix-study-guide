import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpen, Video, FileText, Clock, Calendar, Target, Baby, Syringe, Stethoscope, Users, CheckCircle2, List, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressAreaCard } from '@/components/ProgressAreaCard';
import { CalendarView } from '@/components/CalendarView';

// Ícone customizado para representar mulher grávida
const PregnantWomanIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="9" cy="5" r="2" />
    <path d="M7 22v-5l2-2a4 4 0 1 0 5-6" />
  </svg>
);

// Fonte de dados: API oficial do cronograma ENAMED
export const CRONOGRAMA_API = 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/enamed-proxy';

export type DiaRaw = { nome: string; area_conhecimento?: string; temas?: any[]; subtemas?: any[]; aulas?: any[] };
export type Semana = { numero: string; periodo?: string; dias: DiaRaw[] };
export type Cronograma = { semanas: Semana[] };

// Normaliza diferentes formatos de resposta para { semanas: [...] }
export const normalizeCronograma = (data: any): Cronograma => {
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
      return { semanas };
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

    return { semanas };
  } catch (e) {
    return { semanas: [] };
  }
};

const getContentIcon = (tema: string) => {
  if (tema.includes('Prova') || tema.includes('Simulado')) {
    return <FileText className="h-4 w-4" />;
  } else if (tema.includes('Revisão')) {
    return <BookOpen className="h-4 w-4" />;
  }
  return <Video className="h-4 w-4" />;
};

const getContentTypeBadge = (tema: string) => {
  if (tema.includes('Prova') || tema.includes('Simulado')) {
    return <Badge variant="destructive" className="text-xs">Prova</Badge>;
  } else if (tema.includes('Revisão')) {
    return <Badge variant="secondary" className="text-xs">Revisão</Badge>;
  }
  return <Badge variant="default" className="text-xs">Aula</Badge>;
};

export const IntensivaoEnamed: React.FC = () => {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

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
    const savedViewMode = localStorage.getItem('enamed-view-mode') as 'list' | 'calendar';
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view preference to localStorage
  const toggleViewMode = () => {
    const newMode = viewMode === 'list' ? 'calendar' : 'list';
    setViewMode(newMode);
    localStorage.setItem('enamed-view-mode', newMode);
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
        const normalized = normalizeCronograma(data);
        if (active) setCronograma(normalized);
      } catch (e) {
        if (active) setCronogramaError('Falha ao carregar o cronograma. Tente novamente mais tarde.');
      } finally {
        if (active) setLoadingCronograma(false);
      }
    })();
    return () => { const _ = (active = false); };
  }, []);

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

  // Marcar/desmarcar item como concluído
  const toggleItemCompletion = useCallback((itemKey: string) => {
    setCompletedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemKey)) {
        newSet.delete(itemKey);
      } else {
        newSet.add(itemKey);
      }
      return newSet;
    });
  }, []);

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

  // Filtrar conteúdo baseado nas seleções
  const filteredContent = useMemo(() => {
    const content: Array<{
      semana: string;
      dia: string;
      tema?: string;
      subtema?: string;
      aula?: string;
      completed: boolean;
      itemKey: string;
      discipline: string;
      link_aula?: string;
      link_questoes?: string;
    }> = [];

    allAulas.forEach(item => {
      if (selectedWeek !== 'all' && item.semana !== selectedWeek) return;
      if (selectedDay !== 'all' && item.dia !== selectedDay) return;
      if (selectedDiscipline !== 'all' && item.discipline !== selectedDiscipline) return;

      content.push({
        semana: item.semana,
        dia: item.dia,
        tema: item.tema,
        subtema: item.subtema,
        aula: item.aula,
        completed: completedItems.has(item.itemKey),
        itemKey: item.itemKey,
        discipline: item.discipline,
        link_aula: item.link_aula,
        link_questoes: item.link_questoes,
      });
    });

    return content;
  }, [allAulas, selectedWeek, selectedDay, selectedDiscipline, completedItems]);

  // Agrupar por Tema > Subtema (para visualização em blocos)
  type TemaGroup = { tema: string; subtemas: { subtema: string; aulas: AulaItem[] }[] };
  const groupedByTema: TemaGroup[] = useMemo(() => {
    const groups = new Map<string, Map<string, AulaItem[]>>();
    allAulas.forEach((item) => {
      if (selectedWeek !== 'all' && item.semana !== selectedWeek) return;
      if (selectedDay !== 'all' && item.dia !== selectedDay) return;
      if (selectedDiscipline !== 'all' && item.discipline !== selectedDiscipline) return;
      const temaName = item.tema ?? 'Sem tema';
      const subtemaName = item.subtema ?? 'Geral';
      if (!groups.has(temaName)) groups.set(temaName, new Map());
      const subMap = groups.get(temaName)!;
      if (!subMap.has(subtemaName)) subMap.set(subtemaName, []);
      subMap.get(subtemaName)!.push(item);
    });
    return Array.from(groups.entries()).map(([tema, subMap]) => ({
      tema,
      subtemas: Array.from(subMap.entries()).map(([subtema, aulas]) => ({ subtema, aulas })),
    }));
  }, [allAulas, selectedWeek, selectedDay, selectedDiscipline]);

  // Calcular dias restantes para o ENAMED (mock)
  const diasRestantes = 85;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-lightest to-white dark:bg-background dark:bg-none p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl font-bold text-red-darkest dark:text-primary-foreground flex items-center gap-3">
              Intensivão
              <img
                src="/lovable-uploads/0a3f361e-72ba-4182-8814-5d3f8a5df2b3.png"
                alt="Logo ENAMED"
                className="h-8 w-auto align-middle"
                loading="lazy"
              />
            </h1>
          </div>
          
          {user && (
            <p className="text-lg text-neutral-medium dark:text-muted-foreground">
              {user.ies_nome} - {user.semestre}º período
            </p>
          )}
          
          <div className="bg-card dark:bg-[hsl(var(--alert-dark))] text-foreground dark:text-white px-6 py-3 rounded-2xl inline-block shadow-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">Faltam {diasRestantes} dias para o ENAMED!</span>
            </div>
          </div>
        </div>

        {/* Cards de Progresso */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Card de Progresso Geral */}
          <ProgressAreaCard
            title="Progresso Geral"
            current={progressData.completedItems}
            total={progressData.totalItems}
            percentage={progressData.percentage}
            icon={<Target className="h-5 w-5 text-primary dark:text-[hsl(var(--primary-light))]" />}
            variant="general"
          />

          {/* Card de Semanas Concluídas */}
          <ProgressAreaCard
            title="Semanas Concluídas"
            current={weekProgress.completedWeeks}
            total={weekProgress.totalWeeks}
            percentage={weekProgress.percentage}
            icon={<Calendar className="h-5 w-5 text-[hsl(var(--active-selection))]" />}
            variant="weeks"
          />

          {/* Card de Conteúdos Opcionais */}
          {(() => {
            const optionalItems = allAulas.filter(i => (i.aula ?? '').includes('(OPCIONAL)'));
            const optionalCompleted = optionalItems.filter(i => completedItems.has(i.itemKey)).length;
            const optionalPercentage = optionalItems.length > 0 ? Math.round((optionalCompleted / optionalItems.length) * 100) : 0;
            return (
              <ProgressAreaCard
                title="Conteúdos Opcionais"
                current={optionalCompleted}
                total={optionalItems.length}
                percentage={optionalPercentage}
                icon={<BookOpen className="h-5 w-5" />}
                variant="general"
              />
            );
          })()}

          {/* Cards por Disciplina */}
          {Object.entries(progressByDiscipline).map(([discipline, stats]) => {
            const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            
            const getIcon = (disc: string) => {
              switch (disc) {
                case 'Ginecologia e Obstetrícia': return <PregnantWomanIcon className="h-4 w-4" />;
                case 'Pediatria': return <Baby className="h-4 w-4" />;
                case 'Clínica Médica': return <Stethoscope className="h-4 w-4" />;
                case 'Clínica Cirúrgica': return <Syringe className="h-4 w-4" />;
                case 'Cirurgia Geral': return <Syringe className="h-4 w-4" />;
                case 'Medicina de Família e Comunidade, Saúde Coletiva e Saúde Mental': return null;
                case 'MFC e Saúde Coletiva': return <Users className="h-4 w-4" />;
                case 'Revisão': return <BookOpen className="h-4 w-4" />;
                case 'Avaliação': return <FileText className="h-4 w-4" />;
                default: return <Video className="h-4 w-4" />;
              }
            };

            return (
              <ProgressAreaCard
                key={discipline}
                title={discipline}
                current={stats.completed}
                total={stats.total}
                percentage={percentage}
                icon={getIcon(discipline)}
                variant="area"
              />
            );
          })}
        </div>

        {/* Filtros e Controles de Visualização */}
        <Card className="border-red-dark shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <span className="font-medium text-red-darkest">Filtros:</span>
              
              <div className="flex gap-3 flex-wrap flex-1">
                <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                  <SelectTrigger className="w-56 bg-card text-foreground border-input focus:ring-ring">
                    <SelectValue placeholder="Filtrar por disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {availableDisciplines.map(discipline => (
                      <SelectItem key={discipline} value={discipline}>
                        {discipline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-48 border-input focus:ring-ring bg-card text-foreground">
                    <SelectValue placeholder="Selecionar semana" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as semanas</SelectItem>
                    {cronograma.semanas.map(semana => (
                      <SelectItem key={semana.numero} value={semana.numero}>
                        {semana.numero} {semana.periodo ? `(${semana.periodo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedWeek !== 'all' && (
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="w-64 border-input focus:ring-ring bg-card text-foreground">
                      <SelectValue placeholder="Selecionar dia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os dias</SelectItem>
                      {availableDays.map(dia => (
                        <SelectItem key={dia.nome} value={dia.nome}>
                          {dia.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(selectedDiscipline !== 'all' || selectedWeek !== 'all' || selectedDay !== 'all') && (
                  <Button
                    onClick={() => {
                      setSelectedDiscipline('all');
                      setSelectedWeek('all');
                      setSelectedDay('all');
                    }}
                    variant="outline"
                    className="border-input text-foreground hover:bg-accent/30"
                  >
                    Limpar Filtros
                  </Button>
                )}
                </div>
              </div>

              {/* Controles de Visualização */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => { setViewMode('list'); localStorage.setItem('enamed-view-mode', 'list'); }}
                  variant="outline"
                  size="sm"
                  className={`${viewMode === 'list' 
                    ? 'bg-[hsl(var(--active-selection))] text-black dark:text-white border-[hsl(var(--active-selection))]' 
                    : 'text-[hsl(var(--toggle-list))] border-[hsl(var(--toggle-list))] hover:bg-[hsl(var(--toggle-list))]/10'} transition-colors-smooth`}
                >
                  <List className="h-4 w-4 mr-2" />
                  Lista
                </Button>
                <Button
                  onClick={() => { setViewMode('calendar'); localStorage.setItem('enamed-view-mode', 'calendar'); }}
                  variant="outline"
                  size="sm"
                  className={`${viewMode === 'calendar' 
                    ? 'bg-[hsl(var(--active-selection))] text-black dark:text-white border-[hsl(var(--active-selection))]' 
                    : 'text-foreground border-input hover:bg-accent/30'} transition-colors-smooth`}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Cronograma
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {viewMode === 'list' ? (
          <div className="space-y-6">
            {groupedByTema.map((grupo) => (
              <Card key={grupo.tema} className="border-red-dark shadow-lg">
                <CardHeader className="p-4">
                  <CardTitle className="text-xl text-foreground dark:text-primary-foreground">{grupo.tema}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="multiple" className="divide-y">
                    {grupo.subtemas.map((st) => (
                      <AccordionItem key={`${grupo.tema}-${st.subtema}`} value={`${grupo.tema}-${st.subtema}`}>
                        <AccordionTrigger className="px-4 py-3 text-left">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{st.subtema}</span>
                            <Badge variant="secondary" className="ml-2">{st.aulas.length} aulas</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="px-4 pb-4 space-y-3">
                            {st.aulas.map((item) => {
                              const isDone = completedItems.has(item.itemKey);
                              const hasQuestoes = Boolean(item.link_questoes) && String(item.link_questoes).toLowerCase() !== 'nan';
                              return (
                                <div key={item.itemKey} className={`p-3 rounded-lg border transition-all ${isDone ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-card border-border hover:border-[hsl(var(--active-selection))]'}`}>
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={isDone}
                                      onCheckedChange={() => toggleItemCompletion(item.itemKey)}
                                      className="mt-0.5 data-[state=checked]:bg-[#600606] data-[state=checked]:border-[#600606]"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-3">
                                        <h4 className={`font-medium ${isDone ? 'text-green-600 line-through' : 'text-foreground'}`}>{item.aula}</h4>
                                        {isDone && (
                                          <Badge className="bg-green-500 hover:bg-green-600 text-white">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Concluído
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {!!item.link_aula && (
                                          <Button
                                            variant="default"
                                            onClick={() => window.open(String(item.link_aula), '_blank')}
                                          >
                                            Ver Aula
                                          </Button>
                                        )}
                                          {hasQuestoes && (
                                            <Button
                                              variant="outline"
                                              onClick={() => window.open(String(item.link_questoes), '_blank')}
                                              className="bg-[hsl(var(--active-selection))] text-black dark:text-white border-[hsl(var(--active-selection))] hover:opacity-90 transition-colors-smooth"
                                            >
                                              Responder Questões
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
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (

          <CalendarView 
            items={filteredContent} 
            onToggleCompletion={toggleItemCompletion} 
          />
        )}

        {filteredContent.length === 0 && (
          <Card className="border-red-light">
            <CardContent className="p-8 text-center">
              <p className="text-neutral-medium text-lg">
                Nenhum conteúdo encontrado para os filtros selecionados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};