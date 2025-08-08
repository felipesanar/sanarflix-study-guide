import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpen, Video, FileText, Clock, Calendar, Target, Heart, Brain, Activity, Stethoscope, Users, CheckCircle2, List, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressAreaCard } from '@/components/ProgressAreaCard';
import { CalendarView } from '@/components/CalendarView';

// Fonte de dados: API oficial do cronograma ENAMED
export const CRONOGRAMA_API = 'https://api-conteudos-enamed.onrender.com/api/cronograma';

export type TemaDia = { nome: string; temas: string[] };
export type Semana = { numero: string; periodo?: string; dias: TemaDia[] };
export type Cronograma = { semanas: Semana[] };

// Normaliza diferentes formatos de resposta para { semanas: [...] }
export const normalizeCronograma = (data: any): Cronograma => {
  if (!data) return { semanas: [] };
  if (Array.isArray(data)) return { semanas: data as Semana[] };
  if (Array.isArray((data as any).semanas)) return { semanas: (data as any).semanas as Semana[] };
  const maybeWeeks = Object.values(data) as any[];
  return { semanas: Array.isArray(maybeWeeks) ? (maybeWeeks as Semana[]) : [] };
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
    const totalItems = cronograma.semanas.reduce((acc, semana) => 
      acc + semana.dias.reduce((dayAcc, dia) => dayAcc + (dia.temas?.length ?? 0), 0), 0
    );
    const completedCount = completedItems.size;
    const percentage = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
    
    return { totalItems, completedItems: completedCount, percentage };
  }, [completedItems]);

  // Calcular progresso por disciplina
  const progressByDiscipline = useMemo(() => {
    const disciplineStats: Record<string, { total: number; completed: number }> = {};
    
    cronograma.semanas.forEach(semana => {
      semana.dias.forEach(dia => {
        const discipline = extractDiscipline(dia.nome);
        if (!disciplineStats[discipline]) {
          disciplineStats[discipline] = { total: 0, completed: 0 };
        }
        
        dia.temas?.forEach(tema => {
          const itemKey = `${semana.numero}-${dia.nome}-${tema}`;
          disciplineStats[discipline].total++;
          if (completedItems.has(itemKey)) {
            disciplineStats[discipline].completed++;
          }
        });
      });
    });
    
    return disciplineStats;
  }, [completedItems]);

  // Calcular semanas concluídas
  const weekProgress = useMemo(() => {
    let completedWeeks = 0;
    
    cronograma.semanas.forEach(semana => {
      let weekTotal = 0;
      let weekCompleted = 0;
      
      semana.dias.forEach(dia => {
        dia.temas?.forEach(tema => {
          const itemKey = `${semana.numero}-${dia.nome}-${tema}`;
          weekTotal++;
          if (completedItems.has(itemKey)) {
            weekCompleted++;
          }
        });
      });
      
      if (weekTotal > 0 && weekCompleted === weekTotal) {
        completedWeeks++;
      }
    });
    
    const totalWeeks = cronograma.semanas.length;
    const percentage = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;
    
    return { completedWeeks, totalWeeks, percentage };
  }, [completedItems]);

  // Lista de disciplinas disponíveis
  const availableDisciplines = useMemo(() => {
    const disciplines = new Set<string>();
    cronograma.semanas.forEach(semana => {
      semana.dias.forEach(dia => {
        disciplines.add(extractDiscipline(dia.nome));
      });
    });
    return Array.from(disciplines).sort();
  }, []);

  // Filtrar dados por semana selecionada
  const availableDays = useMemo(() => {
    if (selectedWeek === 'all') return [];
    const semana = cronograma.semanas.find(s => s.numero === selectedWeek);
    return semana ? semana.dias : [];
  }, [selectedWeek]);

  // Filtrar conteúdo baseado nas seleções
  const filteredContent = useMemo(() => {
    let content: Array<{
      semana: string;
      dia: string;
      tema: string;
      completed: boolean;
      itemKey: string;
      discipline: string;
    }> = [];

  cronograma.semanas.forEach(semana => {
      if (selectedWeek !== 'all' && semana.numero !== selectedWeek) return;

      semana.dias.forEach(dia => {
        if (selectedDay !== 'all' && dia.nome !== selectedDay) return;
        
        const discipline = extractDiscipline(dia.nome);
        if (selectedDiscipline !== 'all' && discipline !== selectedDiscipline) return;

        dia.temas?.forEach(tema => {
          const itemKey = `${semana.numero}-${dia.nome}-${tema}`;
          content.push({
            semana: semana.numero,
            dia: dia.nome,
            tema,
            completed: completedItems.has(itemKey),
            itemKey,
            discipline
          });
        });
      });
    });

    return content;
  }, [selectedWeek, selectedDay, selectedDiscipline, completedItems]);

  // Calcular dias restantes para o ENAMED (mock)
  const diasRestantes = 85;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-lightest to-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com título e contagem regressiva */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Target className="h-8 w-8 text-red-darkest" />
            <h1 className="text-4xl font-bold text-red-darkest">Intensivão ENAMED</h1>
          </div>
          
          {user && (
            <p className="text-lg text-neutral-medium">
              {user.faculty} - {user.semester}º período
            </p>
          )}
          
          <div className="bg-gradient-primary text-black px-6 py-3 rounded-2xl inline-block shadow-lg animate-pulse">
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
            icon={<Target className="h-5 w-5" />}
            variant="general"
          />

          {/* Card de Semanas Concluídas */}
          <ProgressAreaCard
            title="Semanas Concluídas"
            current={weekProgress.completedWeeks}
            total={weekProgress.totalWeeks}
            percentage={weekProgress.percentage}
            icon={<Calendar className="h-5 w-5" />}
            variant="weeks"
          />

          {/* Cards por Disciplina */}
          {Object.entries(progressByDiscipline).map(([discipline, stats]) => {
            const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            
            const getIcon = (disc: string) => {
              switch (disc) {
                case 'Ginecologia e Obstetrícia': return <Heart className="h-4 w-4" />;
                case 'Pediatria': return <Users className="h-4 w-4" />;
                case 'Clínica Médica': return <Stethoscope className="h-4 w-4" />;
                case 'Clínica Cirúrgica': return <Activity className="h-4 w-4" />;
                case 'MFC e Saúde Coletiva': return <Brain className="h-4 w-4" />;
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
                  <SelectTrigger className="w-56 bg-blue-600 text-white border-blue-700 focus:ring-blue-500">
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
                  <SelectTrigger className="w-48 border-red-light focus:ring-red-dark">
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
                    <SelectTrigger className="w-64 border-red-light focus:ring-red-dark">
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
                    className="border-red-light text-red-dark hover:bg-red-lightest"
                  >
                    Limpar Filtros
                  </Button>
                )}
                </div>
              </div>

              {/* Controles de Visualização */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-medium">Visualização:</span>
                <Button
                  onClick={toggleViewMode}
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  {viewMode === 'list' ? (
                    <>
                      <List className="h-4 w-4 mr-2" />
                      Lista
                    </>
                  ) : (
                    <>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Cronograma
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conteúdos */}
        {viewMode === 'list' ? (
          <div className="grid gap-4">
            {filteredContent.map((item, index) => (
              <Card 
                key={index}
                className={`border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] ${
                  item.completed 
                    ? 'border-green-400 bg-green-50' 
                    : 'border-red-dark bg-white'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleItemCompletion(item.itemKey)}
                          className="data-[state=checked]:bg-[#600606] data-[state=checked]:border-[#600606]"
                        />
                        <div className={`p-2 rounded-lg ${
                          item.completed ? 'bg-green-100 text-green-600' : 'bg-[#FDD] text-[#600606]'
                        }`}>
                          {item.completed ? <CheckCircle2 className="h-4 w-4" /> : getContentIcon(item.tema)}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-semibold text-lg ${
                            item.completed ? 'text-green-600 line-through' : 'text-neutral-darkest'
                          }`}>
                            {item.tema}
                          </h3>
                          {getContentTypeBadge(item.tema)}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-neutral-medium">
                          <span className="font-medium">{item.semana}</span>
                          <span>•</span>
                          <span>{item.dia}</span>
                          <span>•</span>
                          <span className="text-blue-600 font-medium">{item.discipline}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.completed ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Concluído
                        </Badge>
                      ) : (
                        <Button
                          variant="default"
                          className="bg-[#600606] hover:bg-[#7D0C0C] text-white transition-smooth"
                        >
                          Acessar
                        </Button>
                      )}
                    </div>
                  </div>
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