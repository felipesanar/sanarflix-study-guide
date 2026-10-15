import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AreaDesempenho } from '@/services/mentor/desempenho';
import { PainelGrandeArea } from './PainelGrandeArea';
import { classeAcerto, formatPct, formatRespostas } from './util';

const Barra: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true">
    <div className={cn('h-2 rounded-full', classeAcerto(pct))} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
);

interface Props {
  areas: AreaDesempenho[];
}

/** Acerto por grande área (tela 04); "Detalhar" abre o painel de especialidades e temas (tela 04b). */
export const AcertoPorArea: React.FC<Props> = ({ areas }) => {
  const [aberta, setAberta] = React.useState<string | null>(null);
  const area = areas.find((a) => a.grande_area === aberta) ?? null;

  return (
    <section aria-label="Acerto por grande área" className="space-y-3">
      <h2 className="text-lg font-semibold">Acerto por grande área</h2>
      {areas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem respostas por grande área neste recorte.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {areas.map((a) => (
            <li
              key={a.grande_area}
              data-testid={`area-${a.grande_area}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-3 sm:grid-cols-[12rem_1fr_5rem_8rem_auto]"
            >
              <span className="font-medium">{a.grande_area}</span>
              <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                <Barra pct={a.acerto_pct} />
              </div>
              <span className="text-right text-sm font-semibold">{formatPct(a.acerto_pct)}</span>
              <span className="hidden text-right text-xs text-muted-foreground sm:block">
                {formatRespostas(a.respostas)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Detalhar ${a.grande_area}`}
                onClick={() => setAberta(a.grande_area)}
              >
                Detalhar
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <PainelGrandeArea area={area} onFechar={() => setAberta(null)} />
    </section>
  );
};
