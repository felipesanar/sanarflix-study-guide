import React from 'react';
import { Target, X, Calendar, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TodaySubject {
  id: string;
  title: string;
  materia: string;
  color: string;
  icon: string;
}

interface TodayStudyCardProps {
  subjects: TodaySubject[];
  onSubjectClick?: (materia: string) => void;
  onRemoveSubject?: (id: string) => void;
  onGoToCalendar?: () => void;
  isLoading?: boolean;
  className?: string;
}

export const TodayStudyCard: React.FC<TodayStudyCardProps> = ({
  subjects,
  onSubjectClick,
  onRemoveSubject,
  onGoToCalendar,
  isLoading = false,
  className
}) => {
  if (isLoading) {
    return (
      <Card className={cn("premium-card shadow-lg border-primary/10", className)}>
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-14 bg-muted rounded-lg" />
            <div className="h-14 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = subjects.length === 0;

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      "border-border/50 dark:border-white/5",
      "shadow-lg hover:shadow-xl",
      className
    )}>
      <CardHeader className={cn(
        "pb-3 border-b border-border/30 dark:border-white/5",
        "bg-gradient-to-r from-primary/5 via-transparent to-transparent"
      )}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            O Que Estudar Hoje
          </CardTitle>
          {!isEmpty && (
            <span className="text-xs text-muted-foreground font-medium">
              {subjects.length} {subjects.length === 1 ? 'matéria' : 'matérias'}
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <AnimatePresence mode="wait">
          {isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <div className="relative">
                <div className="p-4 rounded-2xl bg-muted/50 dark:bg-white/5">
                  <Calendar className="h-10 w-10 text-muted-foreground" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1 -right-1 p-1.5 rounded-full bg-primary/10"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                </motion.div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Nenhuma matéria para hoje
                </p>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Organize seu calendário para manter o foco nos estudos
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onGoToCalendar}
                className="gap-2 mt-2 rounded-lg"
              >
                <Calendar className="h-4 w-4" />
                Ir para o calendário
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {subjects.map((subject, idx) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-xl",
                    "bg-muted/30 dark:bg-white/5",
                    "border border-transparent hover:border-border/50 dark:hover:border-white/10",
                    "transition-all duration-200 cursor-pointer",
                    "hover:bg-muted/50 dark:hover:bg-white/10"
                  )}
                  onClick={() => onSubjectClick?.(subject.materia)}
                >
                  <div 
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0"
                    style={{ backgroundColor: `${subject.color}20` }}
                  >
                    <span style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}>
                      {subject.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {subject.title}
                    </h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Estudar hoje
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSubject?.(subject.id);
                      }}
                      aria-label="Remover matéria"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
              
              {/* Tip */}
              <div className="flex items-center gap-2 pt-3 mt-1 border-t border-border/30 dark:border-white/5">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Dica: Estude em blocos de 25min para máxima retenção
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
