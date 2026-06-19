import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfidenceCalibration } from '@/hooks/useConfidenceCalibration';
import type { SrsConfidence } from '@/lib/srs';

const LABELS: Record<SrsConfidence, string> = {
  baixa: 'Chutei',
  media: 'Em dúvida',
  alta: 'Tinha certeza',
};

const BAR_TONE: Record<SrsConfidence, string> = {
  baixa: 'bg-red-500',
  media: 'bg-amber-500',
  alta: 'bg-emerald-500',
};

export const CalibrationPanel: React.FC = () => {
  const { result, loading } = useConfidenceCalibration();

  if (loading) return null;
  if (!result || result.total === 0) return null;

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Gauge className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Calibração de confiança</h3>
            <p className="text-xs text-muted-foreground">O quanto sua confiança bate com o acerto real</p>
          </div>
        </div>

        <div className="space-y-3">
          {result.buckets.map((b) => (
            <div key={b.confidence} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium">{LABELS[b.confidence]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {b.total > 0 ? `${Math.round(b.accuracy * 100)}% · ${b.correct}/${b.total}` : '—'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', BAR_TONE[b.confidence])}
                  style={{ width: `${Math.round(b.accuracy * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-medium">
              <TrendingUp className="h-3.5 w-3.5" /> Excesso de confiança
            </div>
            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{result.altaButWrong}</p>
            <p className="text-[11px] text-muted-foreground leading-snug">disse "tinha certeza" e errou</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <TrendingDown className="h-3.5 w-3.5" /> Insegurança
            </div>
            <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{result.baixaButCorrect}</p>
            <p className="text-[11px] text-muted-foreground leading-snug">"chutei" mas acertou</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
