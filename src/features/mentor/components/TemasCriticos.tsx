import { useId, useState } from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import type { TemaTurma } from '../api/types';
import { PASSO_TEMAS, filtrarTemasCriticos, ordenarTemas, type OrdemTemas } from '../lib/regrasMentor';

const COR_BARRA = { critico: 'var(--gp-danger)', mediano: 'var(--gp-warning)', excelente: 'var(--gp-success)' };
const ROTULO_PREV = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const COLUNAS = '36px minmax(200px,1.6fr) minmax(140px,1fr) 90px 150px 92px 100px 28px';
const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-brand)]';
const BOTAO = `inline-flex min-h-11 min-[600px]:min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-3 text-xs font-semibold text-[var(--gp-text-2)] disabled:cursor-not-allowed ${FOCO}`;

export interface TemasCriticosProps {
  modalidade: 'b2c' | 'b2b';
  temas: TemaTurma[] | undefined;
  estado: 'ok' | 'loading' | 'error';
  areas: string[];
  naPauta?: Set<string>;
  proximaOficinaRotulo?: string;
  onLevarParaOficina?: (tema: TemaTurma) => void;
  onCriarIntervencao: (tema: TemaTurma) => void;
  onTentarNovamente?: () => void;
}

export function TemasCriticos(props: TemasCriticosProps) {
  const { modalidade, temas, estado, areas, naPauta, proximaOficinaRotulo, onLevarParaOficina, onCriarIntervencao } = props;
  const id = useId();
  const [area, setArea] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<OrdemTemas>('impacto');
  const [limite, setLimite] = useState(PASSO_TEMAS);
  const [aberto, setAberto] = useState<string | null>(null);
  const lista = ordenarTemas(filtrarTemasCriticos(temas ?? [], modalidade, area), ordem);
  const visiveis = lista.slice(0, limite);
  const faltam = lista.length - visiveis.length;
  const resetar = () => { setLimite(PASSO_TEMAS); setAberto(null); };

  return (
    <section aria-labelledby={`${id}-titulo`} className="min-w-0 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <header className="flex flex-wrap items-end gap-3 px-5 pb-3 pt-4">
        <h2 id={`${id}-titulo`} className="m-0 min-w-0 flex-1 text-[15px] font-semibold">
          Temas críticos da turma <span className="font-medium tabular-nums text-[var(--gp-text-3)]">{temas === undefined ? '—' : lista.length}</span>
        </h2>
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
          Grande área
          <select value={area ?? ''} onChange={e => { setArea(e.target.value || null); resetar(); }} className={`min-h-11 min-[600px]:min-h-8 min-w-0 rounded-lg border border-[var(--gp-border-input)] px-2 text-[13px] ${FOCO}`}>
            <option value="">Todas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
          Ordenar por
          <select value={ordem} onChange={e => { setOrdem(e.target.value as OrdemTemas); resetar(); }} className={`min-h-11 min-[600px]:min-h-8 min-w-0 rounded-lg border border-[var(--gp-border-input)] px-2 text-[13px] ${FOCO}`}>
            <option value="impacto">Impacto na prova</option>
            <option value="acerto">Menor acerto</option>
            <option value="alunos">Mais alunos abaixo de 50%</option>
          </select>
        </label>
      </header>
      <BlocoGestor estado={estado === 'ok' && !lista.length ? 'empty' : estado} alturaSkeleton={160}
        mensagemVazio={modalidade === 'b2b' ? 'Nenhum tema abaixo de 50% de acerto.' : 'Nenhum tema com 30+ respostas no recorte.'}
        aoTentarNovamente={props.onTentarNovamente} bloco="mentor-temas-criticos">
        <div className="overflow-x-auto">
          <div role="table" aria-label="Temas críticos" className="tabular-nums" style={{ minWidth: 1100 }}>
            <div role="row" className="grid gap-2.5 bg-[var(--gp-surface-2)] px-5 py-2 text-xs font-semibold text-[var(--gp-text-2)]" style={{ gridTemplateColumns: COLUNAS }}>
              {['#', 'Tema', 'Grande área', 'Prevalência', 'Acerto da turma', 'Respostas', 'Alunos < 50%', ''].map((col, i) => <span role="columnheader" key={i} className={i === 5 || i === 6 ? 'text-right' : undefined}>{col || <span className="sr-only">Expandir</span>}</span>)}
            </div>
            {visiveis.map((t, i) => {
              const nivel = nivelDesempenho(t.acertoPct);
              const open = aberto === t.id;
              const pautado = naPauta?.has(t.id) ?? false;
              const detalheId = `${id}-detalhe-${i}`;
              return (
                <div key={t.id} role="rowgroup" className="border-t border-[var(--gp-border-subtle)]">
                  <div role="row" className="relative grid items-center gap-2.5 px-5 py-2.5 text-[13px] hover:bg-[var(--gp-surface-2)]" style={{ gridTemplateColumns: COLUNAS, background: open ? 'var(--gp-surface-2)' : undefined }}>
                    <span role="cell" className="text-[var(--gp-text-3)]">{i + 1}</span>
                    <span role="cell" className="min-w-0">
                      <button type="button" aria-expanded={open} aria-controls={open ? detalheId : undefined}
                        aria-label={`${open ? 'Recolher' : 'Expandir'} ${t.tema}`}
                        onClick={() => setAberto(open ? null : t.id)}
                        className={`min-h-11 min-[600px]:min-h-8 text-left before:absolute before:inset-0 ${FOCO}`}>
                        <span className="block text-[13.5px] font-semibold">{t.tema}</span>
                        <span className="block text-xs text-[var(--gp-text-3)]">{t.especialidade}</span>
                      </button>
                    </span>
                    <span role="cell" className="text-[var(--gp-text-2)]">{t.grandeArea}</span>
                    <span role="cell" className="text-[var(--gp-text-2)]">{ROTULO_PREV[t.prevalencia]}</span>
                    <span role="cell" className="flex items-center gap-2">
                      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--gp-border-subtle)]">
                        {t.acertoPct !== null && nivel ? <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, t.acertoPct))}%`, background: COR_BARRA[nivel] }} /> : null}
                      </span>
                      <span className="w-9 text-right font-semibold" style={{ color: nivel === 'critico' ? 'var(--gp-danger-on)' : undefined }}>{formatPct(t.acertoPct)}</span>
                    </span>
                    <span role="cell" className="text-right text-[var(--gp-text-2)]">{t.respostas}</span>
                    <span role="cell" className="text-right text-[var(--gp-text-2)]">{t.alunosAbaixo50}</span>
                    <span role="cell"><Icon name={open ? 'expand_less' : 'expand_more'} size={16} /></span>
                  </div>
                  {open ? <div role="row" id={detalheId}>
                    <div role="cell" aria-colspan={8} className="flex flex-wrap gap-x-8 gap-y-4 bg-[var(--gp-surface-2)] pb-4 pl-[66px] pr-5 pt-1">
                      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                        <span className="text-xs text-[var(--gp-text-3)]">Evolução no tema</span>
                        <span className="text-[13.5px]">{t.serie.filter(p => p.valor !== null).length >= 2 ? t.serie.map(p => `${p.rotulo}: ${formatPct(p.valor)}`).join(' → ') : 'Só 1 simulado no recorte.'}</span>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {modalidade === 'b2b' && onLevarParaOficina ? <button type="button" disabled={pautado} onClick={() => onLevarParaOficina(t)} className={BOTAO}>
                          <Icon name={pautado ? 'check' : 'calendar_month'} variant={pautado ? 'outlined' : 'filled'} size={14} />
                          {pautado ? 'Na pauta da oficina' : `Levar para a próxima oficina (${proximaOficinaRotulo ?? '—'})`}
                        </button> : null}
                        <button type="button" onClick={() => onCriarIntervencao(t)} className={BOTAO}><Icon name="add" size={14} />Criar intervenção</button>
                      </div>
                    </div>
                  </div> : null}
                </div>
              );
            })}
          </div>
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--gp-border-subtle)] px-5 py-3">
          <span className="whitespace-nowrap text-[12.5px] text-[var(--gp-text-2)]">Mostrando {visiveis.length} de {lista.length}</span>
          {faltam > 0 ? <button type="button" onClick={() => setLimite(l => l + PASSO_TEMAS)} className={BOTAO}>Mostrar mais {Math.min(PASSO_TEMAS, faltam)}{faltam > PASSO_TEMAS ? ` (faltam ${faltam})` : ''}</button> : null}
          {limite > PASSO_TEMAS && lista.length > PASSO_TEMAS ? <button type="button" onClick={resetar} className={`min-h-11 min-[600px]:min-h-8 text-[13px] font-semibold text-[var(--gp-brand)] ${FOCO}`}>Recolher para os 5 primeiros</button> : null}
        </footer>
      </BlocoGestor>
    </section>
  );
}
