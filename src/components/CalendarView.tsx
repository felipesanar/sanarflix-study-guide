import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Pencil, X, Save, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CalendarItem {
  semana: string;
  dia: string;
  tema?: string; // tema geral
  subtema?: string; // subtema para agrupamento
  aula?: string; // nome da aula
  completed: boolean;
  itemKey: string;
  discipline: string;
  link_aula?: string;
  link_gratuito?: string;
  color?: string; // cor do badge
}

interface CalendarViewProps {
  items: CalendarItem[];
  onToggleCompletion: (itemKey: string) => void;
}

const CalendarViewInner: React.FC<CalendarViewProps> = ({ items, onToggleCompletion }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ subtema: string; items: CalendarItem[] } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPremiumEditMode, setIsPremiumEditMode] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<CalendarItem | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [tempCalendarEvents, setTempCalendarEvents] = useState<CalendarItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<CalendarItem | null>(null);
  
  // Ref to scroll to calendar
  const calendarRef = React.useRef<HTMLDivElement>(null);
  
  // Get today's date in DD/MM format (Brasília timezone)
  const today = useMemo(() => {
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const day = brasiliaTime.getDate().toString().padStart(2, '0');
    const month = (brasiliaTime.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }, []);

  // Stable color generator to avoid flickering on re-renders
  const colorForKey = React.useCallback((key: string) => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }, []);

  // Group items by week first, then by day within each week
  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      // Format week name by removing underscores and capitalizing
      const weekKey = item.semana ? 
        item.semana.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
        'Sem Semana';
      
      if (!acc[weekKey]) acc[weekKey] = {};
      const dayKey = item.dia;
      if (!acc[weekKey][dayKey]) acc[weekKey][dayKey] = [];
      acc[weekKey][dayKey].push(item);
      return acc;
    }, {} as Record<string, Record<string, CalendarItem[]>>);
  }, [items]);

  // Sincroniza itens do modal com mudanças externas
  useEffect(() => {
    if (open && selected) {
      const map = new Map(items.map(i => [i.itemKey, i]));
      const updated = selected.items.map(it => map.get(it.itemKey) ?? it);
      setSelected(prev => (prev ? { ...prev, items: updated } : prev));
    }
  }, [items, open]);

  // Reset pagination when modal opens with new content
  useEffect(() => {
    if (open) {
      setCurrentPage(0);
    }
  }, [open, selected?.subtema]);

  // Toggle otimista dentro do modal para feedback imediato
  const handleToggle = (itemKey: string) => {
    onToggleCompletion(itemKey);
    setSelected(prev => (
      prev ? { ...prev, items: prev.items.map(i => i.itemKey === itemKey ? { ...i, completed: !i.completed } : i) } : prev
    ));
  };

  // Sort weeks numerically (Semana 1, Semana 2, etc.)
  const sortedWeeks = Object.entries(groupedItems).sort(([weekA], [weekB]) => {
    const getWeekNumber = (weekStr: string) => {
      const match = weekStr.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return getWeekNumber(weekA) - getWeekNumber(weekB);
  });

  // Carrega arranjos salvos do backend ao inicializar
  useEffect(() => {
    const loadSavedArrangements = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: arrangements, error } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', userData.user.id);

        if (error) {
          console.error('Erro ao carregar arranjos:', error);
          setTempCalendarEvents([...items]);
          return;
        }

        if (arrangements && arrangements.length > 0) {
          // Aplica os arranjos salvos aos items
          const arrangedItems = items.map(item => {
            const savedArrangement = arrangements.find(arr => arr.item_key === item.itemKey);
            if (savedArrangement) {
              return {
                ...item,
                dia: savedArrangement.day,
                semana: savedArrangement.week,
              };
            }
            return item;
          });
          setTempCalendarEvents(arrangedItems);
        } else {
          setTempCalendarEvents([...items]);
        }
      } catch (error) {
        console.error('Erro ao carregar arranjos:', error);
        setTempCalendarEvents([...items]);
      }
    };

    loadSavedArrangements();
  }, [items]);

  // Função para lidar com o clique em um badge
  const handleBadgeClick = (item: CalendarItem) => {
    if (!isEditMode) {
      setSelectedBadge(item);
      setShowSidePanel(true);
    }
  };

  // Função para fechar o painel lateral
  const handleCloseSidePanel = () => {
    setShowSidePanel(false);
    setSelectedBadge(null);
  };

  // Função para lidar com o início do arrasto
  const handleDragStart = (e: React.DragEvent, item: CalendarItem) => {
    if (isEditMode || isPremiumEditMode) {
      e.dataTransfer.setData('text/plain', JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'move';
      setDraggedItem(item);
      
      // Premium mode: adiciona classe de lift effect
      if (isPremiumEditMode) {
        e.currentTarget.classList.add('scale-110', 'shadow-2xl', 'z-50');
      } else {
        e.currentTarget.classList.add('opacity-50');
      }
    }
  };

  // Função para lidar com o fim do arrasto
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null);
    
    if (isPremiumEditMode) {
      e.currentTarget.classList.remove('scale-110', 'shadow-2xl', 'z-50');
    } else {
      e.currentTarget.classList.remove('opacity-50');
    }
  };

  // Função para permitir o drop
  const handleDragOver = (e: React.DragEvent, targetDay: string, targetWeek: string) => {
    if (isEditMode || isPremiumEditMode) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (isPremiumEditMode) {
        e.currentTarget.classList.add('bg-green-500/20', 'border-2', 'border-green-500', 'border-dashed', 'animate-pulse');
      } else {
        e.currentTarget.classList.add('bg-primary/10', 'border-dashed', 'border-primary');
      }
    }
  };

  // Função para lidar com a saída do elemento arrastável da área de drop
  const handleDragLeave = (e: React.DragEvent) => {
    if (isPremiumEditMode) {
      e.currentTarget.classList.remove('bg-green-500/20', 'border-2', 'border-green-500', 'border-dashed', 'animate-pulse');
    } else {
      e.currentTarget.classList.remove('bg-primary/10', 'border-dashed', 'border-primary');
    }
  };

  // Função para lidar com o drop
  const handleDrop = (e: React.DragEvent, targetDay: string, targetWeek: string) => {
    e.preventDefault();
    
    // Remove classes de feedback visual
    if (isPremiumEditMode) {
      e.currentTarget.classList.remove('bg-green-500/20', 'border-2', 'border-green-500', 'border-dashed', 'animate-pulse');
    } else {
      e.currentTarget.classList.remove('bg-primary/10', 'border-dashed', 'border-primary');
    }
    
    if (isEditMode || isPremiumEditMode) {
      try {
        const itemData = JSON.parse(e.dataTransfer.getData('text/plain')) as CalendarItem;
        
        // Atualiza o dia do item
        const updatedEvents = tempCalendarEvents.map(event => {
          if (event.itemKey === itemData.itemKey) {
            return { ...event, dia: targetDay, semana: targetWeek };
          }
          return event;
        });
        
        setTempCalendarEvents(updatedEvents);
        setDraggedItem(null);
        toast.success(`Item movido para ${targetDay} em ${targetWeek}`, {
          icon: '✅',
          duration: 2000
        });
      } catch (error) {
        console.error('Erro ao processar o item arrastado:', error);
        toast.error('Erro ao mover o item');
      }
    }
  };

  // Função para salvar alterações no modo de edição
  const handleSaveChanges = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar autenticado para salvar alterações');
        return;
      }

      // Prepara os dados para salvar
      const arrangements = tempCalendarEvents.map((item, index) => ({
        item_key: item.itemKey,
        week: item.semana,
        day: item.dia,
        position: index,
      }));

      // Chama a edge function para salvar
      const { data, error } = await supabase.functions.invoke('save-calendar-arrangement', {
        body: { arrangements },
      });

      if (error) {
        console.error('Erro ao salvar arranjos:', error);
        toast.error('Erro ao salvar alterações do calendário');
        return;
      }

      console.log('Alterações salvas:', data);
      
      setIsEditMode(false);
      setIsPremiumEditMode(false);
      
      toast.success('Alterações salvas com sucesso!', {
        icon: '🎉',
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      toast.error('Erro ao salvar alterações do calendário');
    }
  };

  // Função para cancelar alterações
  const handleCancelChanges = () => {
    setTempCalendarEvents([...items]);
    setIsEditMode(false);
    setIsPremiumEditMode(false);
    toast.info('Alterações descartadas');
  };

  // Função para ativar modo premium
  const handleActivatePremiumMode = () => {
    console.log('Ativando modo premium...');
    setTempCalendarEvents([...items]);
    setIsPremiumEditMode(true);
    setIsEditMode(false);
    setShowSidePanel(false);
    toast.success('Modo de Edição Premium ativado!', {
      description: 'Arraste e solte matérias para reorganizar sua semana',
      icon: '✨',
      duration: 3000
    });
  };

  // Renderizar modo premium em tela cheia
  if (isPremiumEditMode) {
    console.log('Renderizando modo premium, eventos:', tempCalendarEvents.length);
    return (
      <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-background overflow-hidden">
        {/* Header flutuante minimalista */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between px-2 py-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelChanges}
                  className="gap-2 h-8 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <div className="h-5 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h1 className="text-base font-semibold">Calendário de Estudos</h1>
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Modo Premium
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelChanges}
                  className="gap-1.5 h-8 px-3"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveChanges}
                  className="gap-1.5 h-8 px-3 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Grid expandido do calendário */}
        <div className="container mx-auto px-6 py-8 h-[calc(100vh-80px)] overflow-auto">
          <div className="grid grid-cols-7 gap-4 h-full">
            {sortedWeeks.map(([weekName, weekDays]) => {
              return Object.entries(weekDays).map(([dayName, dayItems]) => {
                const allItemsForDay = tempCalendarEvents.filter(item => 
                  item.dia === dayName && item.semana === weekName
                );

                return (
                  <div
                    key={`${weekName}-${dayName}`}
                    className="flex flex-col min-h-[500px] bg-card rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-all duration-300"
                    onDragOver={(e) => handleDragOver(e, dayName, weekName)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dayName, weekName)}
                  >
                    <div className="p-4 border-b bg-primary/5 rounded-t-xl">
                      <h3 className="text-lg font-bold text-center">{dayName}</h3>
                      <p className="text-xs text-center text-muted-foreground mt-1">{weekName}</p>
                    </div>
                    
                    <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                      {allItemsForDay.map(item => {
                      const subMap = tempCalendarEvents.filter(it => 
                        (it.subtema === item.subtema || it.tema === item.tema) &&
                        it.dia === item.dia
                      );
                      
                      const allDone = subMap.every(s => s.completed);
                      const badgeColor = item.color || colorForKey(item.subtema || item.tema || item.itemKey);
                      
                      return (
                        <div
                          key={item.itemKey}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item)}
                          onDragEnd={handleDragEnd}
                          className={`
                            p-4 rounded-lg border-2 cursor-move
                            transition-all duration-200 hover:shadow-lg hover:scale-105
                            ${allDone ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-background border-border'}
                            ${draggedItem?.itemKey === item.itemKey ? 'opacity-50' : 'opacity-100'}
                          `}
                          style={{
                            minHeight: '100px',
                            background: allDone 
                              ? undefined 
                              : `linear-gradient(135deg, ${badgeColor}10, ${badgeColor}05)`
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {allDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              <span className="font-medium text-sm">
                                {item.subtema || item.tema}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedEvents = tempCalendarEvents.filter(
                                  event => event.itemKey !== item.itemKey
                                );
                                setTempCalendarEvents(updatedEvents);
                                toast.success('Item removido');
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                              style={{ 
                                backgroundColor: `${badgeColor}30`, 
                                borderColor: badgeColor, 
                                color: badgeColor 
                              }}
                            >
                              {item.discipline}
                            </Badge>
                          </div>
                        </div>
                        );
                      })}
                      
                      {allItemsForDay.length === 0 && (
                        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-lg">
                          Arraste matérias aqui
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            }).flat()}
          </div>
        </div>

        {/* Dica flutuante */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="text-sm font-medium">💡 Dica: Arraste as matérias para reorganizar sua semana de estudos</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 relative" data-calendar-view ref={calendarRef}>
      <div className="space-y-6 flex-1">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Semana Acadêmica</h2>
          <div className="flex gap-2">
            <Button 
              variant="default"
              size="sm" 
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              onClick={handleActivatePremiumMode}
            >
              <Pencil className="h-4 w-4" />
              ✨ Editar Calendário
            </Button>
            {isEditMode && (
              <Button 
                variant="default" 
                size="sm" 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                onClick={handleSaveChanges}
              >
                <Save className="h-4 w-4" />
                Confirmar
              </Button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-4">
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Dom</div>
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Seg</div>
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Ter</div>
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Qua</div>
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Qui</div>
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Sex</div>
          <div className="text-center font-medium text-sm p-2 bg-primary/10 rounded-md">Sab</div>
        </div>
        
        {sortedWeeks.map(([week, days]) => (
          <Card key={week} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold text-foreground">{week}</h3>
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                {Object.entries(days).map(([day, dayItems]) => {
                  const isToday = day === today;
                  return (
                    <Card 
                      key={day} 
                      className={`bg-white dark:bg-gray-700 border shadow-sm overflow-hidden min-h-[180px] max-h-[280px] ${isToday ? 'ring-2 ring-primary border-primary shadow-lg' : ''} ${isEditMode ? 'transition-all duration-200 hover:bg-primary/5' : ''}`}
                      onDragOver={(e) => handleDragOver(e, day, week)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, week)}
                    >
                       <CardContent className="p-3 overflow-hidden h-full flex flex-col">
                        <h4 className={`font-semibold mb-2 text-base border-b pb-1.5 flex items-center gap-2 flex-shrink-0 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {day}
                          {isToday && (
                            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-medium">
                              Hoje
                            </span>
                          )}
                        </h4>
                      
                      <div className="space-y-2 relative overflow-y-auto flex-1">
                        {(() => {
                          const subMap = dayItems.reduce((acc, it) => {
                            const key = it.subtema || it.tema || 'Geral';
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(it);
                            return acc;
                          }, {} as Record<string, CalendarItem[]>);
                          return Object.entries(subMap).map(([subtema, subItems]) => {
                            const allDone = subItems.every(s => s.completed);
                            const completedCount = subItems.filter(s => s.completed).length;
                            
                            // Gerar uma cor aleatória para o badge se não existir
                            const badgeColor = subItems[0]?.color || colorForKey(subtema);
                            
                            return (
                              <div
                                key={subtema}
                                className={`relative w-full max-w-full text-left p-2 rounded-md border transition-all duration-200 ${
                                  allDone 
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                                } hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 ${isEditMode ? 'cursor-move' : 'cursor-pointer'}`}
                                onClick={() => !isEditMode && handleBadgeClick({
                                  ...subItems[0],
                                  subtema: subtema,
                                  color: badgeColor
                                })}
                                draggable={isEditMode}
                                onDragStart={(e) => handleDragStart(e, subItems[0])}
                                onDragEnd={handleDragEnd}
                              >
                                <div className="flex items-center justify-between gap-1.5 mb-1 overflow-hidden">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {allDone && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                                    <span className="font-medium text-xs text-foreground truncate">{subtema}</span>
                                  </div>
                                  <Badge 
                                    variant="secondary" 
                                    className="text-[10px] px-1.5 py-0 flex-shrink-0"
                                    style={{ backgroundColor: `${badgeColor}30`, borderColor: badgeColor, color: badgeColor }}
                                  >
                                    {completedCount}/{subItems.length}
                                  </Badge>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {subItems.length} conteúdo{subItems.length > 1 ? 's' : ''}
                                </div>
                                {isEditMode && (
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-xs text-primary italic">
                                      Arraste para mover
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 rounded-full hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedEvents = tempCalendarEvents.filter(
                                          event => event.itemKey !== subItems[0].itemKey
                                        );
                                        setTempCalendarEvents(updatedEvents);
                                        toast.success('Item removido');
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de Aulas por Subtema */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg">{selected?.subtema}</DialogTitle>
            {selected && selected.items.length > 6 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {Math.min(currentPage * 6 + 1, selected.items.length)} - {Math.min((currentPage + 1) * 6, selected.items.length)} de {selected.items.length} aulas
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-xs">
                    {currentPage + 1} / {Math.ceil(selected.items.length / 6)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(selected.items.length / 6) - 1, prev + 1))}
                    disabled={currentPage >= Math.ceil(selected.items.length / 6) - 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {selected?.items
              .slice(currentPage * 6, (currentPage + 1) * 6)
              .map((it) => (
                <div key={it.itemKey} className={`p-3 rounded-lg border ${it.completed ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700' : 'bg-card border-border'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={it.completed}
                      onCheckedChange={() => handleToggle(it.itemKey)}
                      className="mt-0.5 data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:border-[hsl(var(--primary))]"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium ${it.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{it.aula ?? it.tema}</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* Botão "Acessar no SanarFlix" - apenas se há link_aula válido */}
                        {!!it.link_aula && 
                         String(it.link_aula).toLowerCase() !== 'nan' && 
                         String(it.link_aula).trim() !== '' && (
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => window.open(String(it.link_aula), '_blank')}
                            className="bg-[#800000] hover:bg-[#800000]/90 text-white"
                          >
                            Acessar no SanarFlix
                          </Button>
                        )}
                        
                        {/* Botão "Assistir aula grátis" - apenas se há link gratuito */}
                        {!!it.link_gratuito && 
                         String(it.link_gratuito).toLowerCase() !== 'nan' && 
                         String(it.link_gratuito).trim() !== '' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => window.open(String(it.link_gratuito), '_blank')}
                            className="bg-[#800000] hover:bg-[#800000]/90 text-white"
                          >
                            Assistir aula grátis
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Painel lateral para exibir conteúdos da matéria */}
      {showSidePanel && selectedBadge && (
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-border shadow-lg h-full fixed right-0 top-0 bottom-0 z-50 overflow-y-auto animate-slide-in-right">
          <div className="p-4 border-b sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between items-center">
            <h3 className="text-lg font-bold">{selectedBadge.subtema}</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full h-8 w-8 p-0"
              onClick={handleCloseSidePanel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="bg-accent/20 p-3 rounded-lg border border-accent">
              <h4 className="font-medium mb-2">Conteúdos da Matéria</h4>
              <div className="space-y-2">
                {items
                  .filter(item => (item.subtema === selectedBadge.subtema || item.tema === selectedBadge.subtema))
                  .map(item => (
                    <div key={item.itemKey} className="p-2 border rounded-md bg-background">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => onToggleCompletion(item.itemKey)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.aula || item.tema}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.dia}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Acesso Rápido</h4>
              {selectedBadge.link_aula && String(selectedBadge.link_aula).toLowerCase() !== 'nan' && (
                <Button 
                  variant="default" 
                  className="w-full bg-[#800000] hover:bg-[#800000]/90 text-white"
                  onClick={() => window.open(String(selectedBadge.link_aula), '_blank')}
                >
                  Acessar no SanarFlix
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSelected({ 
                    subtema: selectedBadge.subtema || '', 
                    items: items.filter(item => (
                      item.subtema === selectedBadge.subtema || item.tema === selectedBadge.subtema
                    ))
                  });
                  setOpen(true);
                  setShowSidePanel(false);
                }}
              >
                Ver todos os detalhes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CalendarView = React.memo(CalendarViewInner);