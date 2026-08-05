import { cn } from '@/lib/utils';
import { formatPct } from '../lib/formatters';
import type { AcertoPorAreaESemestre as AcertoPorAreaESemestreDados, FiltroSemestre } from '../api/types';

/**
 * Evidência derivada do filtro global (§4.5). O campo `emEvidencia` que vem no
 * envelope é o eco do servidor e não é usado para estilo — derivar no cliente
 * garante que a evidência nunca desincronize da URL.
 */
export function semestresEmEvidencia(semestre: FiltroSemestre, disponiveis: number[]): number[] {
  if (semestre === 'geral') return [...disponiveis];
  if (semestre === '6ano') return disponiveis.filter((s) => s === 11 || s === 12);
  const alvo = Number(semestre);
  return disponiveis.filter((s) => s === alvo);
}

export interface AcertoPorAreaESemestreProps {
  dados: AcertoPorAreaESemestreDados;
  semestre: FiltroSemestre;
}

export function AcertoPorAreaESemestre({ dados, semestre }: AcertoPorAreaESemestreProps) {
  const evidentes = semestresEmEvidencia(
    semestre,
    dados.semestres.map((s) => s.semestre),
  );

  return (
    <section
      role="region"
      aria-label="Acerto por grande área e por semestre"
      className="space-y-6 rounded-lg border border-border bg-card p-4"
    >
      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por grande área</h3>
        <ul className="space-y-2">
          {dados.areas.map((area) => (
            <li
              key={area.id}
              data-testid={`area-${area.id}`}
              data-critica={String(area.critica)}
              className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3"
            >
              <span className={cn('truncate text-sm', area.critica ? 'text-destructive' : 'text-foreground')}>
                {area.nome}
              </span>
              <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-200',
                    area.critica ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, area.acertoPct))}%` }}
                />
              </span>
              <span
                data-testid="area-valor"
                className="text-right text-sm tabular-nums text-foreground transition-opacity duration-200"
              >
                {formatPct(area.acertoPct)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por semestre</h3>
        <ul className="flex items-end gap-3">
          {dados.semestres.map((s) => {
            const emEvidencia = evidentes.includes(s.semestre);
            return (
              <li
                key={s.semestre}
                data-testid={`semestre-${s.semestre}`}
                data-evidencia={String(emEvidencia)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 transition-opacity duration-200',
                  emEvidencia ? 'opacity-100' : 'opacity-40',
                )}
              >
                <span className="text-xs tabular-nums text-foreground">{formatPct(s.acertoPct)}</span>
                <span className="flex h-32 w-full items-end rounded-t bg-muted">
                  <span
                    aria-hidden="true"
                    className="block w-full rounded-t bg-primary transition-[height] duration-200"
                    style={{ height: `${Math.max(0, Math.min(100, s.acertoPct))}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">{s.semestre}º</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
