import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Clock, 
  Trophy, 
  Zap, 
  ChevronRight,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import type { MateriaProgress, TemaProgress } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface DiagnosticsCardProps {
  byMateria: MateriaProgress[];
  byTema: TemaProgress[];
}

interface DiagnosticInsight {
  id: string;
  type: 'backlog' | 'neglected' | 'advanced' | 'quick_win';
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  materia: string;
  tema?: string;
  value: number;
  unit: string;
  cta: string;
}

export const DiagnosticsCard: React.FC<DiagnosticsCardProps> = ({ 
  byMateria, 
  byTema 
}) => {
  const navigate = useNavigate();

  const insights = useMemo(() => {
    const results: DiagnosticInsight[] = [];

    // 1. Maior backlog (matéria com mais pendências)
    const materiaWithBacklog = byMateria
      .map(m => ({ ...m, pending: m.total - m.completed }))
      .filter(m => m.pending > 0)
      .sort((a, b) => b.pending - a.pending)[0];

    if (materiaWithBacklog && materiaWithBacklog.pending > 3) {
      results.push({
        id: 'backlog',
        type: 'backlog',
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        title: 'Maior backlog',
        description: materiaWithBacklog.materia,
        materia: materiaWithBacklog.materia,
        value: materiaWithBacklog.pending,
        unit: 'aulas pendentes',
        cta: 'Ver pendências',
      });
    }

    // 2. Tema mais negligenciado (maior days_inactive com < 80%)
    const neglectedTema = byTema
      .filter(t => t.days_inactive && t.days_inactive > 7 && t.percentage < 80)
      .sort((a, b) => (b.days_inactive || 0) - (a.days_inactive || 0))[0];

    if (neglectedTema) {
      results.push({
        id: 'neglected',
        type: 'neglected',
        icon: Clock,
        iconColor: 'text-red-500',
        title: 'Precisa de atenção',
        description: neglectedTema.tema,
        materia: neglectedTema.materia,
        tema: neglectedTema.tema,
        value: neglectedTema.days_inactive || 0,
        unit: 'dias sem atividade',
        cta: 'Retomar',
      });
    }

    // 3. Matéria mais avançada (para incentivar finalizar)
    const advancedMateria = byMateria
      .filter(m => m.percentage >= 70 && m.percentage < 100)
      .sort((a, b) => b.percentage - a.percentage)[0];

    if (advancedMateria) {
      results.push({
        id: 'advanced',
        type: 'advanced',
        icon: Trophy,
        iconColor: 'text-emerald-500',
        title: 'Quase lá!',
        description: advancedMateria.materia,
        materia: advancedMateria.materia,
        value: advancedMateria.percentage,
        unit: '% concluído',
        cta: 'Finalizar',
      });
    }

    // 4. Quick win (tema com poucas aulas restantes)
    const quickWinTema = byTema
      .filter(t => {
        const pending = t.total - t.completed;
        return pending > 0 && pending <= 3 && t.percentage > 50;
      })
      .sort((a, b) => (a.total - a.completed) - (b.total - b.completed))[0];

    if (quickWinTema && results.length < 3) {
      results.push({
        id: 'quick_win',
        type: 'quick_win',
        icon: Zap,
        iconColor: 'text-blue-500',
        title: 'Vitória rápida',
        description: quickWinTema.tema,
        materia: quickWinTema.materia,
        tema: quickWinTema.tema,
        value: quickWinTema.total - quickWinTema.completed,
        unit: 'aulas restantes',
        cta: 'Concluir',
      });
    }

    return results.slice(0, 3);
  }, [byMateria, byTema]);

  const handleNavigate = (insight: DiagnosticInsight) => {
    const params = new URLSearchParams();
    params.set('materia', insight.materia);
    if (insight.tema) {
      params.set('tema', insight.tema);
    }
    navigate(`/guia-estudos?${params.toString()}`);
  };

  if (insights.length === 0) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          Diagnóstico
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
            <Trophy className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="font-medium text-sm text-foreground">Tudo em dia!</p>
          <p className="text-xs text-muted-foreground">
            Continue no ritmo
          </p>
        </div>
      </CardContent>
    </Card>
  );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          Diagnóstico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, index) => {
          const Icon = insight.icon;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "group flex items-center gap-2 p-2 rounded-lg",
                "bg-muted/50 hover:bg-muted transition-colors cursor-pointer",
                "border border-transparent hover:border-border"
              )}
              onClick={() => handleNavigate(insight)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate(insight)}
              aria-label={`${insight.title}: ${insight.description}. ${insight.value} ${insight.unit}. ${insight.cta}`}
            >
              <div className={cn(
                "p-1.5 rounded-md shrink-0",
                insight.type === 'backlog' && "bg-amber-100 dark:bg-amber-900/30",
                insight.type === 'neglected' && "bg-red-100 dark:bg-red-900/30",
                insight.type === 'advanced' && "bg-emerald-100 dark:bg-emerald-900/30",
                insight.type === 'quick_win' && "bg-blue-100 dark:bg-blue-900/30"
              )}>
                <Icon className={cn("h-3.5 w-3.5", insight.iconColor)} />
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                  {insight.title}
                </p>
                <p className="font-medium text-xs truncate flex-1">
                  {insight.description}
                </p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {insight.value} {insight.unit}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};
