/**
 * Temas críticos com expansão incremental (pedido do Léo, 14/10: "além dos 5").
 *
 * Referência: capturas/b2b/02-visao-geral.png (recolhido), 04-…-temas-expandidos.png
 * (linha aberta + "Mostrar mais"), 20-estado-temas-sem-temas.png,
 * 21-estado-temas-lista-curta.png. B2C usa o mesmo componente em Minha Turma
 * (capturas/b2c/02-minha-turma.png) com `modalidade="b2c"` (sem filtro < 50).
 *
 * Comportamento:
 *  - mostra PASSO_TEMAS (5); "Mostrar mais 5 (faltam N)" soma de 5 em 5;
 *  - "Recolher para os 5 primeiros" volta e fecha a linha aberta;
 *  - trocar área ou ordenação volta para 5;
 *  - linha expansível com evolução no tema e ações.
 */
import * as React from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import type { TemaTurma } from '../api/types';
import { PASSO_TEMAS, filtrarTemasCriticos, ordenarTemas, type OrdemTemas } from '../lib/regrasMentor';

const COR_BARRA = { critico: 'var(--gp-danger)', mediano: 'var(--gp-warning)', excelente: 'var(--gp-success)' } as const;
const ROTULO_PREV = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const;
const COLUNAS = '36px minmax(200px,1.6fr) minmax(140px,1fr) 90px 150px 92px 100px 28px';

export interface TemasCriticosProps {
  modalidade: 'b2c' | 'b2b';
  temas: TemaTurma[] | undefined;
  estado: 'ok' | 'loading' | 'error';
  areas: string[];
  /** IDs de temas já na pauta da próxima oficina (B2B). */
  naPauta?: Set<string>;
  proximaOficinaRotulo?: string; // "19/11"
  onLevarParaOficina?: (tema: TemaTurma) => void;
  onCriarIntervencao: (tema: TemaTurma) => void;
  onTentarNovamente?: () => void;
}

export function TemasCriticos(props: TemasCriticosProps) {
  const { modalidade, temas, estado, areas, naPauta, proximaOficinaRotulo, onLevarParaOficina, onCriarIntervencao } = props;
  const [area, setArea] = React.useState<string | null>(null);
  const [ordem, setOrdem] = React.useState<OrdemTemas>('impacto');
  const [limite, setLimite] = React.useState(PASSO_TEMAS);
  const [aberto, setAberto] = React.useState<string | null>(null);

  const lista = React.useMemo(
    () => ordenarTemas(filtrarTemasCriticos(temas ?? [], modalidade, area), ordem),
    [temas, modalidade, area, ordem],
  );
  const visiveis = lista.slice(0, limite);
  const faltam = lista.length - visiveis.length;
  const estadoBloco = estado === 'ok' && lista.length === 0 ? 'empty' : estado;

  const resetar = () => { setLimite(PASSO_TEMAS); setAberto(null); };

  return (
    <section aria-labelledby="temas-h" style={{ background: 'var(--gp-surface-1)', border: '1px solid var(--gp-border-strong)', borderRadius: 12 }}>
      <header className="flex flex-wrap items-end" style={{ gap: 12, padding: '16px 20px 12px' }}>
        <h2 id="temas-h" className="flex-1" style={{ fontSize: 15, fontWeight: 650, margin: 0, minWidth: 220 }}>
          Temas críticos da turma <span className="tabular-nums" style={{ fontWeight: 500, color: 'var(--gp-text-3)' }}>{lista.length}</span>
        </h2>
        <label className="flex items-center" style={{ gap: 6, fontSize: 12.5, color: 'var(--gp-text-2)' }}>
          Grande área
          <select
            value={area ?? ''}
            onChange={(e) => { setArea(e.target.value || null); resetar(); }}
            style={{ height: 32, borderRadius: 8, border: '1px solid var(--gp-border-input)', padding: '0 8px', fontSize: 13 }}
          >
            <option value="">Todas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex items-center" style={{ gap: 6, fontSize: 12.5, color: 'var(--gp-text-2)' }}>
          Ordenar por
          <select
            value={ordem}
            onChange={(e) => { setOrdem(e.target.value as OrdemTemas); resetar(); }}
            style={{ height: 32, borderRadius: 8, border: '1px solid var(--gp-border-input)', padding: '0 8px', fontSize: 13 }}
          >
            <option value="impacto">Impacto na prova</option>
            <option value="acerto">Menor acerto</option>
            <option value="alunos">Mais alunos abaixo de 50%</option>
          </select>
        </label>
      </header>

      <BlocoGestor
        estado={estadoBloco}
        alturaSkeleton={160}
        mensagemVazio={modalidade === 'b2b' ? 'Nenhum tema abaixo de 50% de acerto.' : 'Nenhum tema com 30+ respostas no recorte.'}
        aoTentarNovamente={props.onTentarNovamente}
        bloco="mentor-temas-criticos"
      >
        <div className="overflow-x-auto">
          <div role="table" aria-label="Temas críticos" className="tabular-nums" style={{ minWidth: 820 }}>
            <div role="row" className="grid" style={{ gridTemplateColumns: COLUNAS, gap: 10, padding: '9px 20px', background: 'var(--gp-surface-2)', fontSize: 12, fontWeight: 600, color: 'var(--gp-text-2)' }}>
              <span role="columnheader">#</span><span role="columnheader">Tema</span><span role="columnheader">Grande área</span>
              <span role="columnheader">Prevalência</span><span role="columnheader">Acerto da turma</span>
              <span role="columnheader" className="text-right">Respostas</span><span role="columnheader" className="text-right">Alunos &lt; 50%</span><span />
            </div>
            {visiveis.map((t, i) => {
              const nivel = nivelDesempenho(t.acertoPct) ?? 'mediano';
              const open = aberto === t.id;
              const pautado = naPauta?.has(t.id) ?? false;
              return (
                <div key={t.id} role="rowgroup" style={{ borderTop: '1px solid var(--gp-border-subtle)' }}>
                  <button
                    type="button"
                    role="row"
                    aria-expanded={open}
                    onClick={() => setAberto(open ? null : t.id)}
                    className="grid w-full items-center text-left"
                    style={{ gridTemplateColumns: COLUNAS, gap: 10, padding: '11px 20px', background: open ? 'var(--gp-surface-2)' : 'transparent' }}
                  >
                    <span style={{ color: 'var(--gp-text-3)', fontSize: 13 }}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block" style={{ fontWeight: 600, fontSize: 13.5 }}>{t.tema}</span>
                      <span className="block" style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>{t.especialidade}</span>
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>{t.grandeArea}</span>
                    <span style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>{ROTULO_PREV[t.prevalencia]}</span>
                    <span className="flex items-center" style={{ gap: 8 }}>
                      <span className="flex-1 overflow-hidden rounded-full" style={{ height: 6, background: 'var(--gp-border-subtle)' }}>
                        <span className="block h-full" style={{ width: `${t.acertoPct}%`, background: COR_BARRA[nivel] }} />
                      </span>
                      <span style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 650, color: nivel === 'critico' ? 'var(--gp-danger-on)' : undefined }}>
                        {formatPct(t.acertoPct)}
                      </span>
                    </span>
                    <span className="text-right" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>{t.respostas}</span>
                    <span className="text-right" style={{ fontSize: 13, color: 'var(--gp-text-2)' }}>{t.alunosAbaixo50}</span>
                    <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
                  </button>
                  {open ? (
                    <div className="flex flex-wrap" style={{ gap: '16px 32px', padding: '4px 20px 16px 66px', background: 'var(--gp-surface-2)' }}>
                      <div className="flex flex-1 flex-col" style={{ gap: 4, minWidth: 220 }}>
                        <span style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>Evolução no tema</span>
                        <span style={{ fontSize: 13.5 }}>
                          {t.serie.length >= 2 ? t.serie.map((p) => `${p.rotulo}: ${formatPct(p.valor)}`).join(' → ') : 'Só 1 simulado no recorte.'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-start" style={{ gap: 8 }}>
                        {modalidade === 'b2b' && onLevarParaOficina ? (
                          <button
                            type="button"
                            disabled={pautado}
                            onClick={() => onLevarParaOficina(t)}
                            className="inline-flex items-center whitespace-nowrap"
                            style={{ gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--gp-border-strong)', background: 'var(--gp-surface-1)', fontSize: 12, fontWeight: 600, color: pautado ? 'var(--gp-success-on)' : 'var(--gp-text-2)' }}
                          >
                            <Icon name={pautado ? 'check' : 'calendar_month'} size={14} />
                            {pautado ? 'Na pauta da oficina' : `Levar para a próxima oficina (${proximaOficinaRotulo})`}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onCriarIntervencao(t)}
                          className="inline-flex items-center whitespace-nowrap"
                          style={{ gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--gp-border-strong)', background: 'var(--gp-surface-1)', fontSize: 12, fontWeight: 600, color: 'var(--gp-text-2)' }}
                        >
                          <Icon name="add" size={14} />Criar intervenção
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <footer className="flex flex-wrap items-center" style={{ gap: 12, padding: '12px 20px', borderTop: '1px solid var(--gp-border-subtle)' }}>
          <span className="whitespace-nowrap" style={{ fontSize: 12.5, color: 'var(--gp-text-2)' }}>Mostrando {visiveis.length} de {lista.length}</span>
          {faltam > 0 ? (
            <button
              type="button"
              onClick={() => setLimite((l) => l + PASSO_TEMAS)}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--gp-border-strong)', background: 'var(--gp-surface-1)', fontWeight: 600, fontSize: 12 }}
            >
              Mostrar mais {Math.min(PASSO_TEMAS, faltam)}{faltam > PASSO_TEMAS ? ` (faltam ${faltam})` : ''}
            </button>
          ) : null}
          {limite > PASSO_TEMAS && lista.length > PASSO_TEMAS ? (
            <button type="button" onClick={resetar} style={{ border: 0, background: 'none', color: 'var(--gp-brand)', fontWeight: 600, fontSize: 13 }}>
              Recolher para os 5 primeiros
            </button>
          ) : null}
        </footer>
      </BlocoGestor>
    </section>
  );
}
