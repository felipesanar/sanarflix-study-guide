import * as React from 'react';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { GestorPanel } from '@/experiences/gestor/ui';
import { cn } from '@/lib/utils';
import type { QuestionStat } from '@/services/gestor/questionStats';

interface QuestaoDetailPanelProps {
  questao: QuestionStat;
}

/**
 * Painel de detalhe da questão selecionada na tela Simulados & questões:
 * enunciado completo, alternativas A-E com barra de % de escolha (a correta
 * destacada em emerald) e o comentário Sanar, quando houver.
 */
export const QuestaoDetailPanel: React.FC<QuestaoDetailPanelProps> = ({ questao }) => {
  const areaTema = [questao.grande_area, questao.especialidade].filter(Boolean).join(' · ');

  return (
    <GestorPanel>
      <div className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Questão Q{questao.numero_questao}
            </p>
            {areaTema && <p className="text-xs text-muted-foreground">{areaTema}</p>}
          </div>
          <Badge className="w-fit bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400">
            {Math.round(questao.pct_acerto)}% de acerto
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
          {questao.enunciado}
        </p>

        <div className="space-y-2">
          {questao.alternativas.map((alt) => {
            const isCorrect = alt.letra === questao.correta;
            return (
              <div
                key={alt.letra}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5',
                  isCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                    isCorrect
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {alt.letra}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-foreground">{alt.texto}</span>
                    {isCorrect && (
                      <Badge className="shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400">
                        correta
                      </Badge>
                    )}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full', isCorrect ? 'bg-emerald-500' : 'bg-primary/60')}
                      style={{ width: `${Math.min(100, Math.max(0, alt.pct_escolha))}%` }}
                    />
                  </div>
                </div>
                <span className="w-12 shrink-0 text-right font-mono tabular-nums text-xs text-muted-foreground">
                  {Math.round(alt.pct_escolha)}%
                </span>
              </div>
            );
          })}
        </div>

        {questao.comentario && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Comentário Sanar
            </p>
            <p className="text-sm leading-relaxed text-foreground">{questao.comentario}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" size="sm" disabled className="gap-2">
                    <Download className="h-3.5 w-3.5" />
                    Exportar PDF
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Em breve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </GestorPanel>
  );
};
