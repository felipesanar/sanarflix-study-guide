import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

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
}

interface CalendarViewProps {
  items: CalendarItem[];
  onToggleCompletion: (itemKey: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ items, onToggleCompletion }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ subtema: string; items: CalendarItem[] } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

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

  return (
    <div className="space-y-6">
      {sortedWeeks.map(([week, days]) => (
        <Card key={week} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="h-6 w-6 text-primary" />
              <h3 className="text-2xl font-bold text-foreground">{week}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(days).map(([day, dayItems]) => (
                <Card key={day} className="bg-white dark:bg-gray-700 border shadow-sm">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-foreground mb-3 text-lg border-b pb-2">
                      {day}
                    </h4>
                    
                    <div className="space-y-3">
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
                          return (
                            <button
                              key={subtema}
                              onClick={() => { setSelected({ subtema, items: subItems }); setCurrentPage(0); setOpen(true); }}
                              className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                                allDone 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                              } hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  {allDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                  <span className="font-medium text-sm text-foreground">{subtema}</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {completedCount}/{subItems.length}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {subItems.length} aula{subItems.length > 1 ? 's' : ''}
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

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
                        {!!it.link_aula && String(it.link_aula).toLowerCase() !== 'nan' && (
                          <Button variant="default" size="sm" onClick={() => window.open(String(it.link_aula), '_blank')}>Acessar Conteúdo</Button>
                        )}
                        {!!it.link_gratuito && 
                         String(it.link_gratuito).toLowerCase() !== 'nan' && 
                         String(it.link_gratuito).trim() !== '' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(String(it.link_gratuito), '_blank')}
                            className="bg-white border-[#800000] text-[#800000] hover:bg-[#800000]/10"
                          >
                            Não tenho SanarFlix
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
    </div>
  );
};