import { Progress } from '@/components/ui/progress';
import { destaquesPorArea } from '../lib/questoes';
import type { ProvaOficialAluno } from '../types';

interface DesempenhoPorAreaProps {
  areas: ProvaOficialAluno['areas'];
}

/**
 * Uma linha por área com acertos/total e barra de percentual — nada de
 * TRI/proficiência, só acertos (spec D3).
 */
export const DesempenhoPorArea = ({ areas }: DesempenhoPorAreaProps) => {
  const { melhor, maisFraca } = destaquesPorArea(areas);

  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold tracking-tight">Por área</h2>

      <div className="space-y-3">
        {areas.map((a) => {
          const pct = a.total > 0 ? Math.round((a.acertos / a.total) * 100) : 0;
          return (
            <div key={a.area} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium truncate">{a.area}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {a.acertos}/{a.total}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          );
        })}
      </div>

      {(melhor || maisFraca) && (
        <div className="flex flex-col gap-1 text-sm pt-1">
          {melhor && (
            <p className="text-green-600 dark:text-green-400 font-medium">
              Seu melhor desempenho: {melhor}
            </p>
          )}
          {maisFraca && melhor !== maisFraca && (
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              Para reforçar: {maisFraca}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
