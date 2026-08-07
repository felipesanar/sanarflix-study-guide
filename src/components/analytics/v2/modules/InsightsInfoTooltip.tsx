import React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

const TooltipBody: React.FC = () => (
  <div className="space-y-2.5 text-xs leading-relaxed">
    <p className="text-sm font-semibold text-foreground">Como classificamos os insights</p>
    <p className="text-muted-foreground">
      Cada especialidade é avaliada com base em dois critérios:
    </p>
    <ul className="space-y-1 text-muted-foreground">
      <li>• <strong className="text-foreground">Percentual de acerto</strong> — desempenho médio dos alunos</li>
      <li>• <strong className="text-foreground">Prevalência</strong> — relevância no simulado (quantidade de questões)</li>
    </ul>
    <div className="pt-1 space-y-1 text-muted-foreground">
      <p className="text-foreground font-medium">Classificação:</p>
      <p>🔴 <strong className="text-foreground">Crítico</strong> — desempenho &lt;50% e prevalência ≥10%</p>
      <p>🟡 <strong className="text-foreground">Ganho Rápido</strong> — desempenho 50–65% e prevalência ≥8%</p>
      <p>🟢 <strong className="text-foreground">Ponto Forte</strong> — desempenho ≥70%</p>
    </div>
    <p className="pt-1 text-muted-foreground">
      Os insights são ordenados priorizando maior impacto pedagógico.
    </p>
  </div>
);

export const InsightsInfoTooltip: React.FC = () => {
  const isMobile = useIsMobile();

  const trigger = (
    <button
      type="button"
      aria-label="Como classificamos os insights"
      className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Info className="h-4 w-4" />
    </button>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-80 rounded-lg border border-border/60 bg-popover p-4 shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <TooltipBody />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="w-80 rounded-lg border border-border/60 bg-popover p-4 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <TooltipBody />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
