import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { AreaDesempenho, EspecialidadeDesempenho } from '@/services/mentor/desempenho';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import {
  CLASSE_PILULA_NIVEL,
  ROTULO_NIVEL,
  classeAcerto,
  formatPct,
  formatRespostas,
  urlIntervencaoTema,
} from './util';

const Barra: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true">
    <div className={cn('h-2 rounded-full', classeAcerto(pct))} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
);

/** Rótulo Crítico / Mediano / Bom da régua única do Gestor (o corte vem de `nivelDesempenho`). */
export const PilulaNivel: React.FC<{ pct: number }> = ({ pct }) => {
  const nivel = nivelDesempenho(pct);
  if (!nivel) return null;
  return (
    <span
      data-testid="nivel"
      className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', CLASSE_PILULA_NIVEL[nivel])}
    >
      {ROTULO_NIVEL[nivel]}
    </span>
  );
};

/** Especialidade sem classificação (null) aparece como "Geral". */
export function rotuloEspecialidade(e: EspecialidadeDesempenho): string {
  const nome = e.especialidade?.trim();
  return nome ? nome : 'Geral';
}

const LinhaEspecialidade: React.FC<{ e: EspecialidadeDesempenho; grandeArea: string }> = ({ e, grandeArea }) => {
  const [aberta, setAberta] = React.useState(false);
  const rotulo = rotuloEspecialidade(e);
  const temas = [...(e.temas ?? [])].sort((a, b) => a.acerto_pct - b.acerto_pct);
  const idTemas = `temas-${grandeArea}-${rotulo}`.replace(/\s+/g, '-');

  return (
    <li data-testid={`especialidade-${rotulo}`} className="space-y-1.5 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{rotulo}</span>
          <PilulaNivel pct={e.acerto_pct} />
        </span>
        <span className="shrink-0 text-sm font-semibold">{formatPct(e.acerto_pct)}</span>
      </div>
      <Barra pct={e.acerto_pct} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{formatRespostas(e.respostas)}</p>
        {temas.length > 0 && (
          <button
            type="button"
            aria-expanded={aberta}
            aria-controls={idTemas}
            aria-label={`Ver temas de ${rotulo}`}
            onClick={() => setAberta((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {aberta ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Ver temas
          </button>
        )}
      </div>
      {aberta && (
        <ul id={idTemas} className="mt-2 space-y-2 border-l pl-3">
          {temas.map((t) => (
            <li key={t.tema} data-testid={`tema-${t.tema}`} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{t.tema}</span>
                <span className="text-sm font-semibold">{formatPct(t.acerto_pct)}</span>
              </div>
              <Barra pct={t.acerto_pct} />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{formatRespostas(t.respostas)}</p>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Link to={urlIntervencaoTema(t.tema, grandeArea)} aria-label={`Intervenção — ${t.tema}`}>
                    Intervenção
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

interface Props {
  area: AreaDesempenho | null;
  onFechar: () => void;
}

/**
 * Painel lateral da grande área (tela 04b): especialidades com nível (régua única do Gestor), % e nº de
 * respostas, e os temas de cada uma com atalho para criar intervenção da turma. Sem `especialidades`
 * (backend anterior), cai na lista plana de temas de antes. Sem nota de corte.
 */
export const PainelGrandeArea: React.FC<Props> = ({ area, onFechar }) => {
  const especialidades = area?.especialidades ?? [];
  const ordenadas = [...especialidades].sort((a, b) => a.acerto_pct - b.acerto_pct);
  const temas = area ? [...area.temas].sort((a, b) => a.acerto_pct - b.acerto_pct) : [];

  return (
    <Sheet open={!!area} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {area && (
          <>
            <SheetHeader>
              <SheetTitle>{area.grande_area}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span>
                  {formatPct(area.acerto_pct)} de acerto · {formatRespostas(area.respostas)}
                </span>
                {ordenadas.length > 0 && <PilulaNivel pct={area.acerto_pct} />}
              </SheetDescription>
            </SheetHeader>
            {ordenadas.length > 0 ? (
              <ul className="mt-4 space-y-3" aria-label="Especialidades">
                {ordenadas.map((e) => (
                  <LinhaEspecialidade key={e.especialidade ?? '__geral'} e={e} grandeArea={area.grande_area} />
                ))}
              </ul>
            ) : (
              <ul className="mt-4 space-y-3">
                {temas.length === 0 && <li className="text-sm text-muted-foreground">Sem temas neste recorte.</li>}
                {temas.map((t) => (
                  <li key={t.tema} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{t.tema}</span>
                      <span className="text-sm font-semibold">{formatPct(t.acerto_pct)}</span>
                    </div>
                    <Barra pct={t.acerto_pct} />
                    <p className="text-xs text-muted-foreground">{formatRespostas(t.respostas)}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
