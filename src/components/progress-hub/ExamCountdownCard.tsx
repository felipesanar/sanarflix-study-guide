import React, { useState, useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Edit2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ExamCountdownCardProps {
  examDate: string | null;
  onDateChange?: (date: string | null) => void;
  className?: string;
}

const STORAGE_KEY = 'progress_hub_exam_date';

export const ExamCountdownCard: React.FC<ExamCountdownCardProps> = ({
  examDate: initialExamDate,
  onDateChange,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [examDate, setExamDate] = useState<string | null>(() => {
    // Try to load from localStorage first
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    }
    return initialExamDate;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempDate, setTempDate] = useState('');

  // Sync with localStorage
  useEffect(() => {
    if (examDate) {
      localStorage.setItem(STORAGE_KEY, examDate);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [examDate]);

  // Calculate days remaining
  const countdown = useMemo(() => {
    if (!examDate) return null;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exam = new Date(examDate);
    exam.setHours(0, 0, 0, 0);
    
    const diffTime = exam.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }, [examDate]);

  const handleSave = () => {
    if (tempDate) {
      setExamDate(tempDate);
      onDateChange?.(tempDate);
    }
    setIsEditing(false);
    setTempDate('');
  };

  const handleClear = () => {
    setExamDate(null);
    onDateChange?.(null);
    setIsEditing(false);
    setTempDate('');
  };

  const handleEdit = () => {
    setTempDate(examDate || '');
    setIsEditing(true);
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  // Determine urgency level
  const getUrgencyLevel = (days: number) => {
    if (days <= 0) return 'passed';
    if (days <= 7) return 'critical';
    if (days <= 14) return 'warning';
    if (days <= 30) return 'attention';
    return 'calm';
  };

  const urgencyConfig = {
    passed: {
      color: 'bg-muted text-muted-foreground',
      icon: CheckCircle2,
      message: 'Prova realizada!'
    },
    critical: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      icon: AlertTriangle,
      message: 'Reta final!'
    },
    warning: {
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      icon: Clock,
      message: 'Atenção aos estudos'
    },
    attention: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      icon: Calendar,
      message: 'Mantenha o ritmo'
    },
    calm: {
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      icon: Calendar,
      message: 'Tempo suficiente'
    }
  };

  // No exam date set - show CTA to add
  if (!examDate && !isEditing) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Defina a data da sua prova para acompanhar o countdown
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Definir data da prova
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            Data da Prova
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="date"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full"
            aria-label="Data da prova"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!tempDate} className="flex-1">
              Salvar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setIsEditing(false); setTempDate(''); }}
            >
              Cancelar
            </Button>
          </div>
          {examDate && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClear}
              className="w-full text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" aria-hidden="true" />
              Remover data
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Display mode with countdown
  const urgency = getUrgencyLevel(countdown!);
  const config = urgencyConfig[urgency];
  const UrgencyIcon = config.icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            Sua Prova
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-8 w-8 p-0"
            aria-label="Editar data da prova"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Countdown number */}
        <motion.div
          initial={shouldReduceMotion ? {} : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          {countdown !== null && countdown > 0 ? (
            <>
              <div className="text-4xl sm:text-5xl font-bold text-primary">
                {countdown}
              </div>
              <div className="text-sm text-muted-foreground">
                {countdown === 1 ? 'dia restante' : 'dias restantes'}
              </div>
            </>
          ) : countdown === 0 ? (
            <div className="text-2xl font-bold text-primary">Hoje!</div>
          ) : (
            <div className="text-lg text-muted-foreground">Prova realizada</div>
          )}
        </motion.div>

        {/* Date display */}
        <div className="text-center text-sm text-muted-foreground capitalize">
          {formatDisplayDate(examDate!)}
        </div>

        {/* Status badge */}
        <Badge className={cn("w-full justify-center gap-1.5 py-1.5", config.color)}>
          <UrgencyIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {config.message}
        </Badge>
      </CardContent>
    </Card>
  );
};
