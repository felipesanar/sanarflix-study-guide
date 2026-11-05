/**
 * "Onde a turma perde ponto" (docs/02 § Tela 2, bloco 2): matriz grande área × prevalência com
 * segmented Turma toda · Acima do corte · Em variação · Abaixo. Régua B2C 78/66 (`tomCelula`, TODO P3).
 * Sem prevalência cadastrada → estado curto, sem números inventados (IMPLEMENTACAO.md § Prevalência).
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct } from '@/features/gestor/lib/formatters';
import { FATIA_PROVA, tomCelula } from '../../lib/regrasMentor';
import type { LinhaMatriz } from './regrasTurma';
import { BLOCO, FOCO, TOM, type Tom } from './ui';

export type SegmentoMatriz = 'turma' | 'acima' | 'variacao' | 'abaixo';
export const SEGMENTOS_MATRIZ: [SegmentoMatriz, string][] = [['turma', 'Turma toda'], ['acima', 'Acima do corte'], ['variacao', 'Em variação'], ['abaixo', 'Abaixo']];

export interface MatrizPrevalenciaProps {
  estado: 'ok' | 'loading' | 'error';
  linhas: LinhaMatriz[];
  temPrevalencia: boolean;
  /** Segmento selecionado não tem aluno. */
  segmentoVazio?: boolean;
  segmento: SegmentoMatriz;
  onSegmento: (s: SegmentoMatriz) => void;
  hrefDetalhar: (area: string) => string;
  onTentarNovamente?: () => void;
}

const COLUNAS = 'minmax(180px,1fr) 92px 92px 92px 80px 90px';
const TOM_CELULA: Record<'bom' | 'medio' | 'ruim', Tom> = { bom: 'sucesso', medio: 'atencao', ruim: 'perigo' };

function Celula({ v }: { v: number | null }) {
  const tom = tomCelula(v, 'b2c');
  const t = TOM[tom ? TOM_CELULA[tom] : 'neutro'];
  return (
    <span role="cell" className="rounded-md py-2 text-center text-[13px] font-semibold"
      style={{ background: t.fundo, color: tom ? t.texto : 'var(--gp-text-3)' }}>
      {formatPct(v)}
    </span>
  );
}

export function MatrizPrevalencia(p: MatrizPrevalenciaProps) {
  const id = useId();
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = SEGMENTOS_MATRIZ.findIndex(([k]) => k === p.segmento);
  const mover = (e: KeyboardEvent, i: number) => {
    const destino = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? SEGMENTOS_MATRIZ.length - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    const j = (destino + SEGMENTOS_MATRIZ.length) % SEGMENTOS_MATRIZ.length;
    p.onSegmento(SEGMENTOS_MATRIZ[j][0]);
    abas.current[j]?.focus();
  };
  const semPrevalencia = p.estado === 'ok' && !p.temPrevalencia && !p.segmentoVazio;

  let corpo: ReactNode;
  if (p.estado === 'loading') corpo = <GestorSkeleton altura={320} forma="cartao" rotulo="Carregando matriz" />;
  else if (p.estado === 'error') corpo = <EstadoErro titulo="Não foi possível carregar a matriz." altura={200} onRetry={p.onTentarNovamente ?? (() => undefined)} />;
  else if (p.segmentoVazio) corpo = <EstadoVazio titulo="Nenhum aluno neste segmento." compacto />;
  else if (!p.temPrevalencia) corpo = <EstadoVazio titulo="Prevalência ainda não cadastrada" glifo="insights" compacto />;
  else corpo = (
    <>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Acerto por grande área e prevalência" className="flex min-w-[620px] flex-col gap-[3px] tabular-nums">
          <div role="row" className="grid gap-[3px] text-center text-xs font-semibold text-[var(--gp-text-2)]" style={{ gridTemplateColumns: COLUNAS }}>
            <span role="columnheader" className="px-2 py-1 text-left">Grande área</span>
            <span role="columnheader">Alta<br /><span className="font-normal text-[var(--gp-text-3)]">{FATIA_PROVA.alta}% da prova</span></span>
            <span role="columnheader">Média<br /><span className="font-normal text-[var(--gp-text-3)]">{FATIA_PROVA.media}%</span></span>
            <span role="columnheader">Baixa<br /><span className="font-normal text-[var(--gp-text-3)]">{FATIA_PROVA.baixa}%</span></span>
            <span role="columnheader">Geral</span>
            <span role="columnheader"><span className="sr-only">Detalhar</span></span>
          </div>
          {p.linhas.map((l) => (
            <div role="row" key={l.area} className="grid items-center gap-[3px]" style={{ gridTemplateColumns: COLUNAS }}>
              <span role="rowheader" className="min-w-0 px-2 py-1.5 text-[13.5px]">{l.area}</span>
              <Celula v={l.alta} /><Celula v={l.media} /><Celula v={l.baixa} />
              <span role="cell" className="text-center text-[13px] font-[650]">{formatPct(l.geral)}</span>
              <span role="cell" className="text-right">
                <Link to={p.hrefDetalhar(l.area)} aria-label={`Detalhar ${l.area}`}
                  className={`inline-flex items-center gap-0.5 rounded text-[12.5px] font-semibold text-[var(--gp-brand)] hover:text-[var(--gp-brand-strong)] ${FOCO}`}>
                  Detalhar<Icon name="chevron_right" size={14} />
                </Link>
              </span>
            </div>
          ))}
        </div>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-xs text-[var(--gp-text-2)]" aria-label="Legenda da matriz">
        {([['sucesso', '78% ou mais'], ['atencao', '66% a 77%'], ['perigo', 'abaixo de 66%']] as const).map(([t, rotulo]) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TOM[t].fundo, border: `1px solid ${TOM[t].ponto}` }} />{rotulo}
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <section aria-labelledby={`${id}-titulo`} className={`${BLOCO} flex flex-col gap-3.5 px-5 py-[18px]`}>
      <div className="flex flex-wrap items-end gap-3">
        <h2 id={`${id}-titulo`} className="m-0 min-w-[200px] flex-1 text-[15px] font-[650]">Onde a turma perde ponto</h2>
        {semPrevalencia ? null : (
          <div role="tablist" aria-label="Recorte da matriz" className="flex max-w-full flex-wrap gap-0.5 rounded-lg bg-[var(--gp-surface-3)] p-[3px]">
            {SEGMENTOS_MATRIZ.map(([k, rotulo], i) => {
              const on = i === atual;
              return (
                <button key={k} ref={(el) => { abas.current[i] = el; }} type="button" role="tab" id={`${id}-aba-${k}`}
                  aria-selected={on} aria-controls={`${id}-painel`} tabIndex={on ? 0 : -1}
                  onClick={() => p.onSegmento(k)} onKeyDown={(e) => mover(e, i)}
                  className={`h-7 whitespace-nowrap rounded-md px-2.5 text-[12.5px] text-[var(--gp-text-1)] ${FOCO}`}
                  style={{ background: on ? 'var(--gp-surface-1)' : 'transparent', fontWeight: on ? 650 : 500 }}>
                  {rotulo}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div id={`${id}-painel`} className="flex min-w-0 flex-col gap-3.5"
        {...(semPrevalencia ? {} : { role: 'tabpanel', 'aria-labelledby': `${id}-aba-${p.segmento}` })}>
        {corpo}
      </div>
    </section>
  );
}
