import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct } from '../lib/formatters';
import type { Alternativa } from '../api/types';

/**
 * Derivação exata (não estimativa): a incorreta mais marcada. Usada só quando o
 * servidor não manda `distratorDominante`.
 */
export function derivarDistratorDominante(alternativas: Alternativa[]): Alternativa['letra'] | undefined {
  const incorretas = alternativas.filter((a) => !a.correta && (a.marcadaPct ?? 0) > 0);
  if (incorretas.length === 0) return undefined;
  return incorretas.reduce((maior, a) => ((a.marcadaPct ?? 0) > (maior.marcadaPct ?? 0) ? a : maior)).letra;
}

export interface DistribuicaoAlternativasProps {
  alternativas: Alternativa[];
  distratorDominante?: Alternativa['letra'];
}

export function DistribuicaoAlternativas({ alternativas, distratorDominante }: DistribuicaoAlternativasProps) {
  const dominante = distratorDominante ?? derivarDistratorDominante(alternativas);

  return (
    <ul className="space-y-2" aria-label="Distribuição das marcações por alternativa">
      {alternativas.map((alt) => {
        const ehDominante = !alt.correta && alt.letra === dominante;
        return (
          <li
            key={alt.letra}
            data-testid={`alternativa-${alt.letra}`}
            data-correta={String(alt.correta)}
            className={cn(
              'grid grid-cols-[1.5rem_1fr_3.5rem] items-start gap-2 rounded p-1.5 text-sm',
              alt.correta && 'bg-primary/5 ring-1 ring-primary/30',
            )}
          >
            <span className="flex items-center gap-1 font-semibold text-foreground">
              {alt.letra}
              {alt.correta && <Check className="h-3 w-3 text-primary" aria-hidden="true" />}
            </span>
            <span className="space-y-1">
              <span className="block text-foreground">{alt.texto}</span>
              {alt.correta && <span className="sr-only">resposta correta</span>}
              {ehDominante && (
                /* Task: contraste AA de "distrator dominante" (texto, text-xs — mínimo 4,5:1).
                   Este chip é o caso "texto sobre --gp-*-surface" citado em gestor-theme.css: o
                   fundo real não é o card puro, é bg-destructive/10 (destructive a 10% composto
                   sobre o card, valor exato em contrasteDestructive.test.tsx). Contra esse fundo
                   tintado, text-destructive dava 3,31:1 no claro e 3,26:1 no escuro (reprova AA).
                   Mantendo o mesmo bg-destructive/10 (não é o que falha — só o texto), trocar para
                   gp-text-danger (--gp-danger-on) dá 9,71:1 no claro e 6,70:1 no escuro. */
                <span className="inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-xs gp-text-danger">
                  distrator dominante
                </span>
              )}
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-200',
                    alt.correta ? 'bg-primary' : ehDominante ? 'bg-destructive' : 'bg-muted-foreground/40',
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, alt.marcadaPct ?? 0))}%` }}
                />
              </span>
            </span>
            <span className="text-right tabular-nums text-foreground">{formatPct(alt.marcadaPct)}</span>
          </li>
        );
      })}
    </ul>
  );
}
