import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, CheckCircle2 } from 'lucide-react';

interface CalendarItem {
  semana: string;
  dia: string;
  tema: string;
  completed: boolean;
  itemKey: string;
  discipline: string;
}

interface CalendarViewProps {
  items: CalendarItem[];
  onToggleCompletion: (itemKey: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ items, onToggleCompletion }) => {
  // Group items by week and day
  const groupedItems = items.reduce((acc, item) => {
    const weekKey = item.semana;
    if (!acc[weekKey]) {
      acc[weekKey] = {};
    }
    
    const dayKey = item.dia;
    if (!acc[weekKey][dayKey]) {
      acc[weekKey][dayKey] = [];
    }
    
    acc[weekKey][dayKey].push(item);
    return acc;
  }, {} as Record<string, Record<string, CalendarItem[]>>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedItems).map(([week, days]) => (
        <Card key={week} className="border-red-light shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-red-dark" />
              <h3 className="text-xl font-semibold text-red-darkest">{week}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(days).map(([day, dayItems]) => (
                <Card key={day} className="border border-neutral-lighter bg-neutral-lightest">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-neutral-darkest mb-3 text-sm">
                      {day}
                    </h4>
                    
                    <div className="space-y-2">
                      {dayItems.map((item) => (
                        <div 
                          key={item.itemKey}
                          className={`p-2 rounded-lg border transition-all ${
                            item.completed 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-white border-neutral-light hover:border-red-light'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={() => onToggleCompletion(item.itemKey)}
                              className="mt-0.5 data-[state=checked]:bg-red-darkest data-[state=checked]:border-red-darkest"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium ${
                                item.completed ? 'text-green-600 line-through' : 'text-neutral-darkest'
                              }`}>
                                {item.tema}
                              </p>
                              
                              <div className="flex items-center gap-1 mt-1">
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-blue-100 text-blue-700"
                                >
                                  {item.discipline}
                                </Badge>
                                
                                {item.completed && (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};