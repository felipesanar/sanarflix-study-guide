import { useId, useState } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { TRACO, formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import type { Prevalencia, QuestaoResumoMentor, TemaTurmaMentor } from '../../api/types';
import { PASSO_TEMAS } from '../../lib/regrasMentor';
import { FOCO } from './SeletorPeriodo';
import { evolucaoTema, ordenarTemasB2b, ordinal, temasCriticosB2b, textoQuestoesDoTema, type OrdemTemas } from './util';

const COR_BARRA = { critico: 'var(--gp-danger)', mediano: 'var(--gp-warning)', excelente: 'var(--gp-success)' };
const ROTULO_PREV: Record<Prevalencia, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const COLUNAS = '36px minmax(200px,1.6fr) minmax(140px,1fr) 90px 150px 92px 100px 28px';
const BOTAO = `inline-flex min-h-11 min-[600px]:min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-3 text-[13px] font-semibold text-[var(--gp-text-1)] hover:border-[var(--gp-border-input)] disabled:cursor-not-allowed ${FOCO}`;
const SELECT = `min-h-11 min-[600px]:min-h-8 min-w-0 rounded-lg border border-[var(--gp-border-input)] bg-[var(--gp-surface-1)] px-2 text-[13px] ${FOCO}`;

/** `null` = consulta ainda não respondeu; lista (vazia ou não) = resposta. */
export type QuestoesDoTema = QuestaoResumoMentor[] | null;

export interface TemasCriticosProps {
  temas: TemaTurmaMentor[] | undefined;
  estado: 'ok' | 'loading' | 'error';
  onTentarNovamente: () => void;
  /** simuladoId → ordem (rótulo "2º" da evolução). */
  ordemDe: (simuladoId: string) => number | null;
  /** Ordem do simulado de referência ("Questões do tema no 4º simulado"); null esconde a linha. */
  ordemReferencia: number | null;
  /** Avisa qual tema está aberto (a tela busca as questões só quando há um tema aberto). */
  onAbrir?: (temaId: string | null) => void;
  questoesDoTema: (tema: TemaTurmaMentor) => QuestoesDoTema;
  /** Próxima oficina agendada (rótulo dd/mm) ou null quando não há. */
  oficina: { rotulo: string } | null;
  naPauta: (temaId: string) => boolean;
  /** Tema com ação em andamento (botões desabilitados). */
  ocupado: string | null;
  erro: { temaId: string; mensagem: string } | null;
  onLevarParaOficina: (tema: TemaTurmaMentor) => void;
  onCriarIntervencao: (tema: TemaTurmaMentor) => void;
}

/**
 * Temas críticos da turma (B2B, pedido do Léo de passar de 5): 5 iniciais, "Mostrar mais 5 (faltam N)" até o
 * total, "Recolher para os 5 primeiros"; trocar filtro volta para 5; linha expansível com evolução, questões do
 * simulado e as ações "Levar para a próxima oficina" e "Criar intervenção".
 */
export function TemasCriticos(p: TemasCriticosProps) {
  const id = useId();
  const [area, setArea] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<OrdemTemas>('impacto');
  const [limite, setLimite] = useState(PASSO_TEMAS);
  const [aberto, setAbertoLocal] = useState<string | null>(null);
  const setAberto = (temaId: string | null) => { setAbertoLocal(temaId); p.onAbrir?.(temaId); };

  const criticos = temasCriticosB2b(p.temas ?? []);
  const areas = [...new Set(criticos.map((t) => t.grandeArea))];
  const lista = ordenarTemasB2b(area === null ? criticos : criticos.filter((t) => t.grandeArea === area), ordem);
  const visiveis = lista.slice(0, limite);
  const faltam = lista.length - visiveis.length;
  const semPrevalencia = criticos.length > 0 && criticos.every((t) => t.prevalencia === null);
  const resetar = () => { setLimite(PASSO_TEMAS); setAberto(null); };

  let corpo;
  if (p.estado === 'loading') {
    corpo = (
      <div className="flex flex-col gap-2 px-5 pb-5">
        {[0, 1, 2].map((i) => <GestorSkeleton key={i} altura={44} rotulo="Carregando temas críticos" className="!rounded-lg" />)}
      </div>
    );
  } else if (p.estado === 'error') {
    corpo = <div className="px-5 pb-5"><EstadoErro onRetry={p.onTentarNovamente} /></div>;
  } else if (!lista.length) {
    corpo = (
      <div className="border-t border-[var(--gp-border-subtle)] px-5 py-5">
        <EstadoVazio titulo="Nenhum tema crítico neste recorte" descricao="Nenhum tema abaixo de 50% de acerto."
          acao={area !== null ? { rotulo: 'Limpar filtro', onClick: () => { setArea(null); resetar(); } } : undefined} />
      </div>
    );
  } else {
    corpo = <>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Temas críticos" className="tabular-nums" style={{ minWidth: 820 }}>
          <div role="row" className="grid gap-2.5 bg-[var(--gp-surface-2)] px-5 py-2 text-xs font-semibold text-[var(--gp-text-2)]" style={{ gridTemplateColumns: COLUNAS }}>
            {['#', 'Tema', 'Grande área', 'Prevalência', 'Acerto da turma', 'Respostas', 'Alunos < 50%'].map((col, i) => (
              <span role="columnheader" key={col} className={i >= 5 ? 'text-right' : undefined}>{col}</span>
            ))}
            <span role="columnheader"><span className="sr-only">Expandir</span></span>
          </div>
          {visiveis.map((t, i) => {
            const nivel = nivelDesempenho(t.acertoPct);
            const open = aberto === t.id;
            const detalheId = `${id}-tema-${i}`;
            return (
              <div key={t.id} role="rowgroup" className="border-t border-[var(--gp-border-subtle)]">
                <div role="row" className="relative grid items-center gap-2.5 px-5 py-2.5 text-[13px] hover:bg-[var(--gp-surface-2)]"
                  style={{ gridTemplateColumns: COLUNAS, background: open ? 'var(--gp-surface-2)' : undefined }}>
                  <span role="cell" className="text-[var(--gp-text-3)]">{i + 1}</span>
                  <span role="cell" className="min-w-0">
                    <button type="button" aria-expanded={open} aria-controls={open ? detalheId : undefined}
                      aria-label={`${open ? 'Recolher' : 'Expandir'} ${t.tema}`} onClick={() => setAberto(open ? null : t.id)}
                      className={`min-h-11 min-[600px]:min-h-8 text-left before:absolute before:inset-0 before:content-[''] ${FOCO}`}>
                      <span className="block text-[13.5px] font-semibold">{t.tema}</span>
                      {t.especialidade ? <span className="block text-xs text-[var(--gp-text-3)]">{t.especialidade}</span> : null}
                    </button>
                  </span>
                  <span role="cell" className="text-[var(--gp-text-2)]">{t.grandeArea}</span>
                  <span role="cell" className="text-[var(--gp-text-2)]">{t.prevalencia ? ROTULO_PREV[t.prevalencia] : TRACO}</span>
                  <span role="cell" className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--gp-border-subtle)]">
                      {t.acertoPct !== null && nivel ? <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, t.acertoPct))}%`, background: COR_BARRA[nivel] }} /> : null}
                    </span>
                    <span className="w-10 text-right font-semibold" style={{ color: nivel === 'critico' ? 'var(--gp-danger-on)' : undefined }}>{formatPct(t.acertoPct)}</span>
                  </span>
                  <span role="cell" className="text-right text-[var(--gp-text-2)]">{t.respostas.toLocaleString('pt-BR')}</span>
                  <span role="cell" className="text-right text-[var(--gp-text-2)]">{t.alunosAbaixo50.length.toLocaleString('pt-BR')}</span>
                  <span role="cell" className="text-[var(--gp-text-2)]"><Icon name={open ? 'expand_less' : 'expand_more'} size={16} /></span>
                </div>
                {open ? <DetalheTema {...p} tema={t} detalheId={detalheId} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--gp-border-subtle)] px-5 py-3">
        <span className="whitespace-nowrap text-[12.5px] text-[var(--gp-text-2)]">Mostrando {visiveis.length} de {lista.length}</span>
        {faltam > 0 ? (
          <button type="button" onClick={() => setLimite((l) => l + PASSO_TEMAS)} className={BOTAO}>
            Mostrar mais {Math.min(PASSO_TEMAS, faltam)}{faltam > PASSO_TEMAS ? ` (faltam ${faltam})` : ''}
          </button>
        ) : null}
        {limite > PASSO_TEMAS && lista.length > PASSO_TEMAS ? (
          <button type="button" onClick={resetar} className={`min-h-11 min-[600px]:min-h-8 whitespace-nowrap rounded-sm text-[13px] font-semibold text-[var(--gp-brand)] ${FOCO}`}>
            Recolher para os 5 primeiros
          </button>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-[var(--gp-text-2)]">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-2.5 rounded-[3px]" style={{ background: COR_BARRA.critico }} />crítico &lt; 50%</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-2.5 rounded-[3px]" style={{ background: COR_BARRA.mediano }} />mediano 50% a 79%</span>
        </span>
      </footer>
    </>;
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="min-w-0 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <header className="flex flex-wrap items-end gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-[min(260px,100%)] flex-1 flex-col gap-0.5">
          <h2 id={`${id}-titulo`} className="m-0 text-[15px] font-semibold">
            Temas críticos da turma <span className="font-medium tabular-nums text-[var(--gp-text-3)]">{p.estado === 'ok' ? criticos.length : TRACO}</span>
          </h2>
          {semPrevalencia ? <span className="text-xs text-[var(--gp-text-3)]">Prevalência ainda não cadastrada</span> : null}
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
          Grande área
          <select value={area ?? ''} onChange={(e) => { setArea(e.target.value || null); resetar(); }} className={SELECT}>
            <option value="">Todas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
          Ordenar por
          <select value={ordem} onChange={(e) => { setOrdem(e.target.value as OrdemTemas); resetar(); }} className={SELECT}>
            <option value="impacto">Impacto na prova</option>
            <option value="acerto">Menor acerto</option>
            <option value="alunos">Mais alunos abaixo de 50%</option>
          </select>
        </label>
      </header>
      {corpo}
    </section>
  );
}

function DetalheTema(p: TemasCriticosProps & { tema: TemaTurmaMentor; detalheId: string }) {
  const { tema: t } = p;
  const pautado = p.naPauta(t.id);
  const ocupado = p.ocupado === t.id;
  const questoes = p.ordemReferencia === null ? undefined : p.questoesDoTema(t);
  const erro = p.erro?.temaId === t.id ? p.erro.mensagem : null;
  return (
    <div role="row" id={p.detalheId}>
      <div role="cell" aria-colspan={8} className="flex flex-wrap gap-x-8 gap-y-4 bg-[var(--gp-surface-2)] pb-4 pl-5 pr-5 pt-1 min-[600px]:pl-[66px]">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-xs text-[var(--gp-text-3)]">Evolução no tema</span>
          <span className="text-[13.5px] tabular-nums">{evolucaoTema(t, p.ordemDe)}</span>
          {questoes !== undefined ? <>
            <span className="mt-1.5 text-xs text-[var(--gp-text-3)]">Questões do tema no {ordinal(p.ordemReferencia)} simulado</span>
            <span className="text-[13.5px]">{questoes === null ? TRACO : textoQuestoesDoTema(questoes)}</span>
          </> : null}
        </div>
        <div className="flex min-w-[240px] flex-col gap-2">
          <span className="text-xs text-[var(--gp-text-3)]">Ações</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pautado || !p.oficina || ocupado} onClick={() => p.onLevarParaOficina(t)} className={BOTAO}
              style={pautado ? { color: 'var(--gp-success-on)' } : undefined}>
              {pautado ? <Icon name="check" size={14} /> : <Icon name="calendar_month" variant="filled" size={14} />}
              {pautado ? 'Na pauta da oficina' : p.oficina ? `Levar para a próxima oficina (${p.oficina.rotulo})` : 'Nenhuma oficina agendada'}
            </button>
            <button type="button" disabled={ocupado} onClick={() => p.onCriarIntervencao(t)} className={BOTAO}>
              <Icon name="add" size={14} />Criar intervenção
            </button>
          </div>
          {erro ? <span role="alert" className="text-[12.5px] font-semibold text-[var(--gp-danger-on)]">{erro}</span> : null}
        </div>
      </div>
    </div>
  );
}
