import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Play, FileText, HelpCircle, ChevronRight, Zap, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConsistencyCard } from '@/components/progress-hub/ConsistencyCard';
import { AiTutorCard } from '../AiTutorCard';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import type { NextAction, RiskAlert, ProgressStreak, ProgressOverview, MateriaProgress, ExamInsight } from '@/types/progressHub';

interface AgoraTabProps {
  nextActions: NextAction[];
  riskAlerts: RiskAlert[];
  streak: ProgressStreak;
  syncing: boolean;
  overview: ProgressOverview;
  byMateria: MateriaProgress[];
  nextExam?: ExamInsight | null;
  onActionClick: (action: NextAction, type: 'view' | 'video' | 'pdf' | 'quiz') => void;
  onRiskNavigate: (materia: string, tema: string) => void;
  onRiskDismiss: (alertId: string) => void;
  onGoalChange: (goal: number) => void;
}

// Swipeable carousel for actions
const ActionsCarousel: React.FC<{
  actions: NextAction[];
  onActionClick: (action: NextAction, type: 'view' | 'video' | 'pdf' | 'quiz') => void;
}> = ({ actions, onActionClick }) => {
  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-center">
        <div className="space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-muted/50 flex items-center justify-center">
            <Zap className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma ação sugerida</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-hidden">
      <div 
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 touch-pan-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {actions.slice(0, 5).map((action) => (
          <div key={action.id} className="flex-shrink-0 w-[280px] snap-start">
            <div className="bg-card border border-border/50 rounded-xl p-4 h-full">
              <div className="flex items-start gap-3 mb-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  action.type === 'today_focus' ? 'bg-primary/10 text-primary' :
                  action.type === 'quick_win' ? 'bg-emerald-500/10 text-emerald-600' :
                  'bg-amber-500/10 text-amber-600'
                )}>
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-foreground truncate">
                    {action.aula || action.tema || action.materia}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {action.materia} {action.tema ? `• ${action.tema}` : ''}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] mb-3 h-5">
                {action.reason}
              </Badge>
              <div className="flex gap-2">
                {action.link_aula && (
                  <Button size="sm" className="flex-1 h-9 text-xs gap-1.5" onClick={() => onActionClick(action, 'video')}>
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                    Assistir
                  </Button>
                )}
                {action.link_pdf && (
                  <Button size="sm" variant="outline" className="h-9 px-3 text-xs gap-1" onClick={() => onActionClick(action, 'pdf')}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                )}
                {action.link_quiz && (
                  <Button size="sm" variant="outline" className="h-9 px-3 text-xs gap-1" onClick={() => onActionClick(action, 'quiz')}>
                    <HelpCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {actions.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {actions.slice(0, 5).map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                index === 0 ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Compact risk alerts
const RiskAlertsSection: React.FC<{
  alerts: RiskAlert[];
  onNavigate: (materia: string, tema: string) => void;
  onDismiss: (alertId: string) => void;
}> = ({ alerts, onNavigate }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-foreground">Atenção</span>
      </div>
      <div className="space-y-2">
        {alerts.slice(0, 2).map((alert) => (
          <button
            key={alert.id}
            onClick={() => onNavigate(alert.materia, alert.tema)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-left hover:bg-amber-500/10 transition-colors min-h-[44px]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{alert.tema}</p>
              <p className="text-xs text-muted-foreground">
                {alert.days_inactive} dias sem estudar • {Math.round(alert.percentage)}%
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export const AgoraTab: React.FC<AgoraTabProps> = ({
  nextActions,
  riskAlerts,
  streak,
  syncing,
  overview,
  byMateria,
  nextExam,
  onActionClick,
  onRiskNavigate,
  onRiskDismiss,
  onGoalChange,
}) => {
  return (
    <div className="px-4 py-4 space-y-6">
      {/* Section: O que fazer agora */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          O que fazer agora
        </h2>
        <ActionsCarousel actions={nextActions} onActionClick={onActionClick} />
      </div>

      {/* AI Coach */}
      <AiTutorCard />

      {/* Consistency */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Sua Consistência
        </h3>
        <ConsistencyCard
          streak={streak}
          onGoalChange={onGoalChange}
          syncing={syncing}
        />
      </div>

      {/* Risk alerts */}
      <RiskAlertsSection 
        alerts={riskAlerts} 
        onNavigate={onRiskNavigate} 
        onDismiss={onRiskDismiss} 
      />
    </div>
  );
};
