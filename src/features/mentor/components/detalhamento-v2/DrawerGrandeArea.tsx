import * as React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { TagNivel } from '@/features/gestor/components/Tag';
import { formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import type { AcertoArea, AcertoTema } from '@/features/mentor/api/types';
import { botaoSecundario, estiloKicker } from './estilos';

const COR_BARRA = { critico: 'var(--gp-danger)', mediano: 'var(--gp-warning)', excelente: 'var(--gp-success)' } as const;

export interface DrawerGrandeAreaProps {
  /** Nome da grande área aberta (`?ga=`); null = fechado. */
  nome: string | null;
  area: AcertoArea | undefined;
  carregando: boolean;
  /** "4º e 5º". */
  recorte: string;
  onFechar: () => void;
  onIntervencao: (tema: AcertoTema, especialidade: string) => void;
}

/**
 * Drawer de grande área (docs/02 § Tela 3 · Drawer): acerto por especialidade com a régua do Gestor
 * (crítico < 50, mediano 50–79, excelente ≥ 80) e os temas de cada uma com "Intervenção".
 * Radix Dialog: foco preso, Esc e scrim fecham, foco volta ao "Detalhar".
 */
export function DrawerGrandeArea({ nome, area, carregando, recorte, onFechar, onIntervencao }: DrawerGrandeAreaProps) {
  const container = useGestorPortalContainer();
  const [abertas, setAbertas] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => setAbertas({}), [nome]);
  if (nome === null) return null;

  return (
    <Sheet open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
      <SheetContent
        container={container}
        side="right"
        data-testid="drawer-grande-area"
        className="flex w-full flex-col gap-3.5 overflow-y-auto sm:max-w-[540px]"
        style={{ padding: '20px 24px 32px', boxShadow: '-28px 0 64px -30px rgba(0,0,0,0.42)' }}
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        closeClassName="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-2)] opacity-100"
        overlayClassName="bg-[rgba(8,9,10,0.42)]"
      >
        <SheetHeader className="space-y-0.5 pr-10 text-left">
          <SheetTitle className="flex flex-col gap-0.5">
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gp-text-3)' }}>Grande área</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{nome}</span>
          </SheetTitle>
          <SheetDescription style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>
            Percentual de acerto por especialidade, nos simulados do recorte ({recorte}). Acerto puro, sem nota de corte.
          </SheetDescription>
        </SheetHeader>
        <span style={{ ...estiloKicker, letterSpacing: '0.08em' }}>Especialidades · índice de acerto</span>

        {carregando ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => <GestorSkeleton key={i} forma="cartao" altura={96} rotulo="Carregando especialidades" />)}
          </div>
        ) : !area || area.especialidades.length === 0 ? (
          <EstadoVazio titulo="Sem especialidade com resultado neste recorte" compacto />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {area.especialidades.map((e) => {
              const esp = e.especialidade ?? 'Sem especialidade';
              const nivel = nivelDesempenho(e.acertoPct);
              const aberta = !!abertas[esp] && e.temas.length > 0;
              const idTemas = `temas-${esp.replace(/\W+/g, '-')}`;
              return (
                <li key={esp} data-testid={`especialidade-${esp}`} className="flex flex-col gap-2.5" style={{ border: '1px solid var(--gp-border-strong)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1" style={{ fontSize: 15, fontWeight: 650 }}>{esp}</span>
                    {nivel ? <TagNivel nivel={nivel} /> : null}
                    <span style={{ fontSize: 17, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{formatPct(e.acertoPct)}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Percentual de acerto em ${esp}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={e.acertoPct === null ? undefined : Math.round(e.acertoPct)}
                    className="w-full overflow-hidden"
                    style={{ height: 8, borderRadius: 999, background: 'var(--gp-border-subtle)' }}
                  >
                    {nivel && e.acertoPct !== null ? (
                      <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, e.acertoPct))}%`, background: COR_BARRA[nivel] }} />
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end gap-2.5" style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{e.respostas} respostas</span>
                    {e.temas.length > 0 ? (
                      <button
                        type="button"
                        aria-expanded={aberta}
                        aria-controls={idTemas}
                        onClick={() => setAbertas((a) => ({ ...a, [esp]: !a[esp] }))}
                        className="inline-flex items-center gap-0.5 whitespace-nowrap"
                        style={{ color: '#941F1F', fontWeight: 600, fontSize: 12.5 }}
                      >
                        {aberta ? 'Ocultar temas' : 'Ver temas'}
                        <Icon name={aberta ? 'expand_less' : 'chevron_right'} size={13} />
                      </button>
                    ) : null}
                  </div>
                  {aberta ? (
                    <ul id={idTemas} className="flex flex-col" style={{ borderTop: '1px solid var(--gp-border-subtle)' }}>
                      {e.temas.map((t) => (
                        <li key={t.tema} className="grid items-center gap-3" style={{ gridTemplateColumns: 'minmax(0,1fr) auto 44px auto', padding: '8px 0', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          <span className="min-w-0">{t.tema}</span>
                          <span className="whitespace-nowrap" style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>{t.respostas} respostas</span>
                          <b className="text-right">{formatPct(t.acertoPct)}</b>
                          <button
                            type="button"
                            onClick={() => onIntervencao(t, esp)}
                            aria-label={`Criar intervenção para ${t.tema}`}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap hover:border-[color:var(--gp-border-input)]"
                            style={botaoSecundario}
                          >
                            <Icon name="add" size={13} />
                            Intervenção
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
