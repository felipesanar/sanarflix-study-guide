import React, { useState, useCallback, useMemo } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, ChevronDown, ChevronUp, CheckCircle2, 
  AlertCircle, ArrowRight, BookOpen, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from '@/components/ui/drawer';
import type { TemaProgress } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface PreProvaModeProps {
  byTema: TemaProgress[];
  onNavigate?: (materia: string, tema: string) => void;
  onActivate?: (active: boolean) => void;
}

interface ChecklistItem {
  tema: TemaProgress;
  priority: 'critical' | 'review' | 'quick';
  label: string;
  checked: boolean;
}

export const PreProvaMode: React.FC<PreProvaModeProps> = ({
  byTema,
  onNavigate,
  onActivate,
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [isActive, setIsActive] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Build checklist
  const checklist = useMemo((): ChecklistItem[] => {
    const items: ChecklistItem[] = [];

    // Critical: < 50%
    const critical = byTema
      .filter(t => t.percentage < 50 && t.percentage > 0)
      .sort((a, b) => a.percentage - b.percentage);
    
    for (const tema of critical) {
      items.push({
        tema,
        priority: 'critical',
        label: 'Dominar',
        checked: checkedItems.has(tema.tema)
      });
    }

    // Review: 50-80%
    const review = byTema
      .filter(t => t.percentage >= 50 && t.percentage < 80)
      .sort((a, b) => a.percentage - b.percentage);
    
    for (const tema of review) {
      items.push({
        tema,
        priority: 'review',
        label: 'Revisar',
        checked: checkedItems.has(tema.tema)
      });
    }

    // Quick review: >= 80%
    const quick = byTema
      .filter(t => t.percentage >= 80 && t.percentage < 100)
      .sort((a, b) => b.percentage - a.percentage);
    
    for (const tema of quick.slice(0, 5)) {
      items.push({
        tema,
        priority: 'quick',
        label: 'Revisão rápida',
        checked: checkedItems.has(tema.tema)
      });
    }

    return items;
  }, [byTema, checkedItems]);

  const handleToggle = useCallback((active: boolean) => {
    setIsActive(active);
    onActivate?.(active);
  }, [onActivate]);

  const handleCheck = useCallback((temaName: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(temaName)) {
        next.delete(temaName);
      } else {
        next.add(temaName);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback((materia: string, tema: string) => {
    onNavigate?.(materia, tema);
    navigate(`/guia-estudos?materia=${encodeURIComponent(materia)}&tema=${encodeURIComponent(tema)}`);
  }, [navigate, onNavigate]);

  const completedCount = checklist.filter(i => i.checked).length;
  const totalCount = checklist.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const getPriorityConfig = (priority: ChecklistItem['priority']) => {
    switch (priority) {
      case 'critical':
        return {
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          icon: AlertCircle,
          borderColor: 'border-l-red-500'
        };
      case 'review':
        return {
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          icon: BookOpen,
          borderColor: 'border-l-amber-500'
        };
      case 'quick':
        return {
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          icon: CheckCircle2,
          borderColor: 'border-l-emerald-500'
        };
    }
  };

  // Collapsed preview
  if (!isActive) {
    return (
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-sm">Modo Pré-Prova</p>
              <p className="text-xs text-muted-foreground">
                Foque nos gaps e organize sua revisão
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ativar</span>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              aria-label="Ativar modo pré-prova"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
            Modo Pré-Prova
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8 p-0"
              aria-label={expanded ? 'Recolher' : 'Expandir'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              aria-label="Desativar modo pré-prova"
            />
          </div>
        </div>
        
        {/* Progress */}
        <div className="space-y-2 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Checklist de revisão</span>
            <span className="font-medium">{completedCount}/{totalCount}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {checklist.map((item) => {
                    const config = getPriorityConfig(item.priority);
                    const Icon = config.icon;

                    return (
                      <motion.div
                        key={`${item.tema.materia}-${item.tema.tema}`}
                        initial={shouldReduceMotion ? {} : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-l-4 bg-muted/30",
                          config.borderColor,
                          item.checked && "opacity-60"
                        )}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => handleCheck(item.tema.tema)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            item.checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30 hover:border-primary"
                          )}
                          aria-checked={item.checked}
                          role="checkbox"
                        >
                          {item.checked && <CheckCircle2 className="h-3 w-3" />}
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            item.checked && "line-through"
                          )}>
                            {item.tema.tema}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {item.tema.materia}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {item.tema.percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Badge + Action */}
                        <Badge variant="secondary" className={cn("text-xs", config.color)}>
                          {item.label}
                        </Badge>
                        
                        {!item.checked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleNavigate(item.tema.materia, item.tema.tema)}
                            aria-label={`Estudar ${item.tema.tema}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}

                  {checklist.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Você está em dia! 🎉</p>
                      <p className="text-xs">Todos os temas estão com bom progresso.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
