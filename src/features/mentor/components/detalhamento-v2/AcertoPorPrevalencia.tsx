import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct } from '@/features/gestor/lib/formatters';
import type { Prevalencia } from '@/features/mentor/api/types';
import { FATIA_PROVA, tomCelula, type ReguaMatriz } from '@/features/mentor/lib/regrasMentor';
import { PREVALENCIAS, type MatrizPrevalencia } from './derivar';
import { estiloBloco, estiloKicker, h2Bloco } from './estilos';

const ROTULO_PREV: Record<Prevalencia, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const ROTULO_CAIXA: Record<Prevalencia, string> = {
  alta: `Alta · ${FATIA_PROVA.alta}% da prova`,
  media: `Média · ${FATIA_PROVA.media}%`,
  baixa: `Baixa · ${FATIA_PROVA.baixa}%`,
};
const TOM: Record<'bom' | 'medio' | 'ruim', { bg: string; c: string; nome: string }> = {
  bom: { bg: 'var(--gp-success-surface)', c: 'var(--gp-success-on)', nome: 'bom' },
  medio: { bg: 'var(--gp-warning-surface)', c: 'var(--gp-warning-on)', nome: 'atenção' },
  ruim: { bg: 'var(--gp-danger-surface)', c: 'var(--gp-danger-on)', nome: 'crítico' },
};
const GRADE = 'minmax(120px,1fr) repeat(3,52px) 86px';

export interface AcertoPorPrevalenciaProps {
  estado: 'loading' | 'error' | 'ok';
  matriz: MatrizPrevalencia | undefined;
  /** Régua das células: B2C 78/66, B2B a do Gestor (80/50). */
  regua: ReguaMatriz;
  onDetalhar: (area: string) => void;
  onTentarNovamente: () => void;
}

/** Acerto por prevalência (docs/02 § Tela 3 · 5): 3 caixas + matriz grande área × prevalência + "Detalhar". */
export function AcertoPorPrevalencia({ estado, matriz, regua, onDetalhar, onTentarNovamente }: AcertoPorPrevalenciaProps) {
  const semPrevalencia = matriz !== undefined && !matriz.temPrevalencia;
  return (
    <section aria-labelledby="prev-h" data-testid="bloco-prevalencia" className="flex min-w-0 flex-col gap-3.5" style={{ ...estiloBloco, flex: '1.4 1 460px' }}>
      <div className="flex flex-col gap-0.5">
        <h2 id="prev-h" style={h2Bloco}>Acerto por prevalência</h2>
        <span style={{ fontSize: 12.5, color: 'var(--gp-text-2)' }}>
          % de acerto da turma por grande área, separado pela prevalência dos temas na prova.
        </span>
      </div>

      {estado === 'loading' ? (
        <div className="flex flex-col gap-2" data-testid="prevalencia-carregando">
          <GestorSkeleton altura={64} rotulo="Carregando acerto por prevalência" />
          <GestorSkeleton altura={220} forma="cartao" rotulo="Carregando acerto por prevalência" />
        </div>
      ) : estado === 'error' ? (
        <EstadoErro titulo="Não foi possível carregar o acerto por prevalência." onRetry={onTentarNovamente} />
      ) : !matriz || matriz.linhas.length === 0 ? (
        <EstadoVazio titulo="Sem respostas neste recorte" compacto />
      ) : (
        <>
          {semPrevalencia ? (
            <div data-testid="prevalencia-vazia">
              <EstadoVazio
                titulo="Prevalência ainda não cadastrada"
                descricao="O acerto por grande área continua no Detalhar."
                compacto
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {PREVALENCIAS.map((p) => (
                <div key={p} className="flex min-w-0 flex-col gap-0.5" style={{ border: '1px solid var(--gp-border-strong)', borderRadius: 10, padding: '10px 12px' }}>
                  <span className="truncate" style={estiloKicker}>{ROTULO_CAIXA[p]}</span>
                  <span data-testid={`prevalencia-coluna-${p}`} style={{ fontSize: 22, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                    {formatPct(matriz.colunas[p])}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <div role="table" aria-label="Acerto por grande área e prevalência" className="flex min-w-[380px] flex-col gap-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <div role="row" className="grid items-center gap-1 text-center" style={{ gridTemplateColumns: semPrevalencia ? 'minmax(120px,1fr) 86px' : GRADE, ...estiloKicker }}>
                <span role="columnheader" className="pl-1.5 text-left">Grande área</span>
                {!semPrevalencia && PREVALENCIAS.map((p) => <span key={p} role="columnheader">{ROTULO_PREV[p]}</span>)}
                <span role="columnheader"><span className="sr-only">Ações</span></span>
              </div>
              {matriz.linhas.map((l) => (
                <div key={l.area} role="row" data-testid={`linha-area-${l.area}`} className="grid items-center gap-1" style={{ gridTemplateColumns: semPrevalencia ? 'minmax(120px,1fr) 86px' : GRADE }}>
                  <span role="rowheader" style={{ fontSize: 13, padding: '0 6px', lineHeight: 1.3 }}>{l.area}</span>
                  {!semPrevalencia && PREVALENCIAS.map((p) => {
                    const v = l.celulas[p];
                    const tom = tomCelula(v, regua);
                    const cor = tom ? TOM[tom] : { bg: 'var(--gp-surface-3)', c: 'var(--gp-text-3)', nome: 'sem dado' };
                    return (
                      <span
                        key={p}
                        role="cell"
                        title={`${l.area}, prevalência ${ROTULO_PREV[p].toLowerCase()}: ${formatPct(v)} (${cor.nome})`}
                        data-tom={tom ?? 'vazio'}
                        className="text-center"
                        style={{ padding: '9px 0', borderRadius: 6, background: cor.bg, color: cor.c, fontWeight: 650, fontSize: 12.5 }}
                      >
                        {formatPct(v)}
                      </span>
                    );
                  })}
                  <span role="cell" className="justify-self-end">
                    <button
                      type="button"
                      onClick={() => onDetalhar(l.area)}
                      aria-label={`Detalhar ${l.area}`}
                      className="inline-flex items-center gap-0.5 whitespace-nowrap transition-colors hover:bg-[var(--gp-brand-surface-soft,#FFF7F7)]"
                      style={{ height: 28, padding: '0 8px 0 10px', borderRadius: 6, border: '1px solid var(--gp-brand-border, #F3C9C9)', background: 'var(--gp-surface-1)', color: '#941F1F', fontSize: 12.5, fontWeight: 600 }}
                    >
                      Detalhar
                      <Icon name="chevron_right" size={13} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
