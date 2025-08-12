import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, CheckCircle2 } from 'lucide-react';

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
  link_questoes?: string;
}

interface CalendarViewProps {
  items: CalendarItem[];
  onToggleCompletion: (itemKey: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ items, onToggleCompletion }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ subtema: string; items: CalendarItem[] } | null>(null);

  // Group items by week and day
  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      const weekKey = item.semana;
      if (!acc[weekKey]) acc[weekKey] = {};
      const dayKey = item.dia;
      if (!acc[weekKey][dayKey]) acc[weekKey][dayKey] = [];
      acc[weekKey][dayKey].push(item);
      return acc;
    }, {} as Record<string, Record<string, CalendarItem[]>>);
  }, [items]);
  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([week, days]) => (
        <Card key={week} className="ui-card shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-[hsl(var(--primary-light))]" />
              <h3 className="text-xl font-semibold text-foreground">{week}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(days).map(([day, dayItems]) => (
                <Card key={day} className="ui-card bg-card">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-foreground mb-3 text-sm">
                      {day}
                    </h4>
                    
                    <div className="space-y-2">
                      {(() => {
                        const subMap = dayItems.reduce((acc, it) => {
                          const key = it.subtema || 'Geral';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(it);
                          return acc;
                        }, {} as Record<string, CalendarItem[]>);
                        return Object.entries(subMap).map(([subtema, subItems]) => {
                          const allDone = subItems.every(s => s.completed);
                          return (
                            <button
                              key={subtema}
                              onClick={() => { setSelected({ subtema, items: subItems }); setOpen(true); }}
                              className={`w-full text-left p-3 rounded-lg border transition-all bg-card border-border hover:border-[hsl(var(--active-selection))] focus:outline-none focus:ring-2 focus:ring-ring`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {allDone && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                  <span className="font-medium text-sm text-foreground">{subtema}</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">{subItems.length} aulas</Badge>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{selected?.subtema}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {selected?.items.map((it) => (
              <div key={it.itemKey} className="p-3 rounded-lg border bg-card border-border">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={it.completed}
                    onCheckedChange={() => onToggleCompletion(it.itemKey)}
                    className="mt-0.5 data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:border-[hsl(var(--primary))]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium ${it.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{it.aula ?? it.tema}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!!it.link_aula && (
                        <Button variant="default" onClick={() => window.open(String(it.link_aula), '_blank')}>Ver Aula</Button>
                      )}
                      {!!it.link_questoes && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(String(it.link_questoes), '_blank')}
                          className="bg-[hsl(var(--active-selection))] text-black dark:text-white border-[hsl(var(--active-selection))] hover:opacity-90 transition-colors-smooth"
                        >
                          Questões
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