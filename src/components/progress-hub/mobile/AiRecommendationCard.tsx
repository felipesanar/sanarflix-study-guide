import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { ProgressOverview, MateriaProgress, RiskAlert, ExamInsight } from '@/types/progressHub';

const CACHE_KEY = 'ai-study-rec';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 min

interface AiRecommendationCardProps {
  overview: ProgressOverview;
  byMateria: MateriaProgress[];
  riskAlerts: RiskAlert[];
  nextExam?: ExamInsight | null;
}

export const AiRecommendationCard: React.FC<AiRecommendationCardProps> = ({
  overview,
  byMateria,
  riskAlerts,
  nextExam,
}) => {
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRecommendation = useCallback(async (skipCache = false) => {
    // Check cache
    if (!skipCache) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { text, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION_MS) {
            setRecommendation(text);
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setLoading(true);
    setError(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        setError(true);
        setLoading(false);
        return;
      }

      const payload = {
        progress: {
          percentage: overview.percentage,
          completed: overview.completed,
          total: overview.total,
        },
        top_materias: byMateria.slice(0, 5).map(m => ({
          materia: m.materia,
          percentage: m.percentage,
          completed: m.completed,
          total: m.total,
        })),
        risk_alerts: riskAlerts.slice(0, 3).map(r => ({
          tema: r.tema,
          materia: r.materia,
          days_inactive: r.days_inactive,
          percentage: r.percentage,
        })),
        next_exam: nextExam ? {
          materia: nextExam.exam.materia,
          days_remaining: nextExam.days_remaining,
          progress: nextExam.materia_progress?.percentage ?? null,
        } : null,
      };

      const { data, error: fnError } = await supabase.functions.invoke('ai-study-recommendation', {
        body: payload,
      });

      if (fnError) throw fnError;

      const text = data?.recommendation || '';
      setRecommendation(text);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ text, timestamp: Date.now() }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [overview, byMateria, riskAlerts, nextExam]);

  useEffect(() => {
    fetchRecommendation();
  }, []); // Only on mount

  if (error && !recommendation) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Dica do tutor IA</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => fetchRecommendation(true)}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{recommendation}</p>
        )}
      </div>
    </div>
  );
};
