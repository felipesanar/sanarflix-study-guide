/**
 * Bloco "Alunos" da Minha Turma (docs/02 § Tela 2, bloco 3): busca, chip de alerta removível (vindo
 * do Início), chips de segmento e tabela com "Questões · acesso" (sem semestre: B2C). A linha inteira
 * abre o drawer do aluno (`?aluno=`, montado pelo shell).
 */
import { useEffect, useId, useState } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { TRACO, formatNumero } from '@/features/gestor/lib/formatters';
import type { AlertaB2C, SegmentoAtividade } from '../../api/types';
import { DIAS_SUMIDO, type SegmentoCorte } from '../../lib/regrasMentor';
import {
  SEGMENTOS_CORTE, SEGMENTOS_ENGAJAMENTO, contarSegmentos, filtrarLinhas, formatMesAno, formatNotas, formatPp,
  formatUltimoAcesso, rotuloAlerta, type LinhaAluno, type SegmentoFiltro,
} from './regrasTurma';
import { ALVO, BLOCO, FOCO, TOM, estiloTom, type Tom } from './ui';

export const TAMANHO_PAGINA = 20;

const SEG_CORTE: Record<SegmentoCorte, { chip: string; tag: string; tom: Tom }> = {
  acima: { chip: 'Constantemente acima do corte', tag: 'Acima do corte', tom: 'sucesso' },
  variacao: { chip: 'Em variação', tag: 'Em variação', tom: 'atencao' },
  abaixo: { chip: 'Constantemente abaixo', tag: 'Abaixo do corte', tom: 'perigo' },
  sem_historico: { chip: 'Sem histórico', tag: 'Sem histórico', tom: 'neutro' },
};
const SEG_ENG: Record<SegmentoAtividade, { chip: string; tag: string; tom: Tom }> = {
  ativo: { chip: 'Ativos · até 7 dias', tag: 'Ativo', tom: 'sucesso' },
  esfriando: { chip: 'Esfriando · 8 a 14', tag: 'Esfriando', tom: 'atencao' },
  sumido: { chip: 'Sumidos · 15+', tag: 'Sumido', tom: 'perigo' },
  sem_dado: { chip: 'Sem dado', tag: 'Sem dado', tom: 'neutro' },
};

const COLUNAS = 'minmax(200px,1.4fr) 120px minmax(170px,1fr) 200px 76px 100px 24px';
const CHIP = `inline-flex ${ALVO} items-center gap-1.5 whitespace-nowrap rounded-full border bg-[var(--gp-surface-1)] px-3 text-[13px] text-[var(--gp-text-1)] disabled:cursor-not-allowed ${FOCO}`;
const BOTAO_PAG = `h-7 whitespace-nowrap rounded-md border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-2.5 text-[12.5px] text-[var(--gp-text-1)] disabled:text-[var(--gp-border-input)] disabled:cursor-not-allowed ${FOCO}`;

export interface TabelaAlunosTurmaProps {
  estado: 'ok' | 'loading' | 'error';
  linhas: LinhaAluno[];
  v0: boolean;
  ordemUltimo: number | null;
  alerta: AlertaB2C | null;
  segmento: SegmentoFiltro | null;
  busca: string;
  alunoAberto: string | null;
  onBusca: (v: string) => void;
  onRemoverAlerta: () => void;
  onSegmento: (s: SegmentoFiltro | null) => void;
  onLimpar: () => void;
  onAbrir: (email: string) => void;
  onTentarNovamente?: () => void;
}

function Chip({ rotulo, n, on, ponto, desabilitado, onClick }: { rotulo: string; n?: number; on: boolean; ponto?: string; desabilitado?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={desabilitado ? undefined : on} disabled={desabilitado} onClick={onClick} className={CHIP}
      style={{ borderColor: on ? 'var(--gp-text-1)' : 'var(--gp-border-strong)', fontWeight: on ? 650 : 500, opacity: desabilitado ? 0.45 : 1 }}>
      {ponto ? <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: ponto }} /> : null}
      {rotulo}
      {n === undefined ? null : <span className="tabular-nums text-[var(--gp-text-3)]">{n}</span>}
    </button>
  );
}

export function TabelaAlunosTurma(p: TabelaAlunosTurmaProps) {
  const id = useId();
  const [pagina, setPagina] = useState(0);
  const filtradas = filtrarLinhas(p.linhas, { alerta: p.alerta, segmento: p.segmento, busca: p.busca, v0: p.v0 });
  const total = filtradas.length;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(pag * TAMANHO_PAGINA, (pag + 1) * TAMANHO_PAGINA);
  useEffect(() => { setPagina(0); }, [p.alerta, p.segmento, p.busca, p.v0]);

  const contagens = contarSegmentos(p.linhas, p.v0);
  const nAlerta = p.alerta ? p.linhas.filter((l) => l.alertas.includes(p.alerta!)).length : 0;
  const ok = p.estado === 'ok';

  return (
    <section aria-labelledby={`${id}-titulo`} className={BLOCO}>
      <div className="flex flex-wrap items-end gap-3 px-5 pb-3 pt-[18px]">
        <h2 id={`${id}-titulo`} className="m-0 min-w-[200px] flex-1 text-[15px] font-[650]">Alunos</h2>
        <label className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-[var(--gp-border-input)] px-3 text-[var(--gp-text-3)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--gp-brand)] sm:w-auto sm:min-w-[240px]">
          <Icon name="search" size={16} />
          <input type="search" value={p.busca} onChange={(e) => p.onBusca(e.target.value)} placeholder="Buscar aluno por nome" aria-label="Buscar aluno"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-[var(--gp-text-1)] outline-none" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        {p.alerta ? (
          <>
            <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--gp-text-1)] pl-3 pr-1.5 text-[13px] font-semibold text-white">
              Alerta: {rotuloAlerta(p.alerta, p.ordemUltimo)} · {ok ? nAlerta : TRACO}
              <button type="button" onClick={p.onRemoverAlerta} aria-label="Remover filtro de alerta"
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/[0.16] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}>
                <Icon name="close" size={13} />
              </button>
            </span>
            <span className="mr-2 text-xs text-[var(--gp-text-3)]">vindo do Início</span>
          </>
        ) : null}
        <div role="group" aria-label="Segmentos" className="flex flex-wrap items-center gap-2">
          <Chip rotulo="Todos" n={ok ? contagens.todos : undefined} on={p.segmento === null} onClick={() => p.onSegmento(null)} />
          {p.v0 ? <>
            {SEGMENTOS_ENGAJAMENTO.map((s) => (
              <Chip key={s} rotulo={SEG_ENG[s].chip} n={ok ? contagens[s] : undefined} on={p.segmento === s} ponto={TOM[SEG_ENG[s].tom].ponto} onClick={() => p.onSegmento(s)} />
            ))}
            {/* V0: corte depende de simulado e de Metas — visíveis, mas desabilitados (docs/02 § Estados). */}
            <Chip rotulo="Acima do corte" on={false} desabilitado onClick={() => undefined} />
            <Chip rotulo="Abaixo do corte" on={false} desabilitado onClick={() => undefined} />
          </> : SEGMENTOS_CORTE.map((s) => (
            <Chip key={s} rotulo={SEG_CORTE[s].chip} n={ok ? contagens[s] : undefined} on={p.segmento === s} ponto={TOM[SEG_CORTE[s].tom].ponto} onClick={() => p.onSegmento(s)} />
          ))}
        </div>
      </div>

      {p.estado === 'loading' ? (
        <div className="px-5 pb-5"><GestorSkeleton altura={320} forma="cartao" rotulo="Carregando alunos" /></div>
      ) : p.estado === 'error' ? (
        <div className="px-5 pb-5">
          <EstadoErro titulo="Não foi possível carregar os dados da turma." altura={200} onRetry={p.onTentarNovamente ?? (() => undefined)} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div role="table" aria-label="Alunos da turma" className="min-w-[920px] tabular-nums">
              <div role="row" className="grid gap-2.5 bg-[var(--gp-surface-2)] px-5 py-[9px] text-xs font-semibold text-[var(--gp-text-2)]" style={{ gridTemplateColumns: COLUNAS }}>
                <span role="columnheader">Aluno</span>
                <span role="columnheader">Questões · acesso</span>
                <span role="columnheader">Meta · corte mais difícil</span>
                <span role="columnheader" className="text-right">% de acerto por simulado</span>
                <span role="columnheader" className="text-right">vs corte</span>
                <span role="columnheader">Último acesso</span>
                <span role="columnheader"><span className="sr-only">Abrir</span></span>
              </div>
              {visiveis.map((l) => <LinhaTabela key={l.email} l={l} v0={p.v0} aberta={p.alunoAberto === l.email} onAbrir={p.onAbrir} />)}
            </div>
          </div>
          {total === 0 ? (
            <div className="px-5 py-4">
              <EstadoVazio titulo="Nenhum aluno neste recorte" descricao="Ajuste a busca ou remova o filtro de alerta."
                glifo="groups" acao={{ rotulo: 'Limpar filtros', onClick: p.onLimpar }} />
            </div>
          ) : null}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--gp-border-subtle)] px-5 py-3 text-[12.5px] text-[var(--gp-text-2)]">
            <span>Mostrando {visiveis.length} de {total}</span>
            <span className="flex gap-1.5">
              <button type="button" className={BOTAO_PAG} disabled={pag === 0} onClick={() => setPagina(pag - 1)}>Anterior</button>
              <button type="button" className={BOTAO_PAG} disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)}>Próxima</button>
            </span>
          </footer>
        </>
      )}
    </section>
  );
}

function LinhaTabela({ l, v0, aberta, onAbrir }: { l: LinhaAluno; v0: boolean; aberta: boolean; onAbrir: (email: string) => void }) {
  const seg = v0 ? SEG_ENG[l.engajamento] : SEG_CORTE[l.segmentoCorte];
  const semMeta = v0 || !l.meta;
  const semNotas = v0 || l.notas.length === 0;
  const notas = formatNotas(l.notas);
  const vs = v0 ? TRACO : l.fezUltimo === false ? 'não fez' : formatPp(l.vsCortePp);
  const corVs = v0 || l.vsCortePp === null ? 'var(--gp-text-3)' : l.vsCortePp >= 0 ? 'var(--gp-success-on)' : 'var(--gp-danger-on)';
  const sumido = l.diasSemAtividade !== null && l.diasSemAtividade >= DIAS_SUMIDO;
  return (
    <div role="row" aria-current={aberta ? 'true' : undefined}
      className="relative grid items-center gap-2.5 border-t border-[var(--gp-border-subtle)] px-5 py-3 text-[var(--gp-text-1)] hover:bg-[var(--gp-surface-2)]"
      style={{ gridTemplateColumns: COLUNAS, lineHeight: 1.4, ...(aberta ? { background: 'var(--gp-brand-surface-soft)' } : {}) }}>
      <span role="cell" className="flex min-w-0 flex-col items-start gap-1">
        <button type="button" onClick={() => onAbrir(l.email)}
          className={`max-w-full text-left text-[13.5px] font-semibold before:absolute before:inset-0 before:content-[''] ${FOCO}`}>
          {l.nome}
        </button>
        <Tag variant="positivo" style={estiloTom(seg.tom)}>{seg.tag}</Tag>
      </span>
      <span role="cell" className="text-[13px]">
        <span className="block">{l.questoes30d === null ? TRACO : `${formatNumero(l.questoes30d)} em 30 dias`}</span>
        <span className="block text-xs text-[var(--gp-text-3)]">acesso até {formatMesAno(l.acessoAte)}</span>
      </span>
      <span role="cell" className="min-w-0 text-[13px]">
        <span className="block">{semMeta ? 'Aguardando Metas' : l.meta!.especialidade}</span>
        <span className="block text-xs text-[var(--gp-text-3)]">{semMeta ? 'corte entra com Metas' : `${l.meta!.instituicao} · ${formatNumero(l.meta!.cortePct)}%`}</span>
      </span>
      <span role="cell" className="whitespace-nowrap text-right text-[12.5px] text-[var(--gp-text-2)]">
        {semNotas ? 'Sem dado' : <>{notas.anteriores ? <>{notas.anteriores} </> : null}<b className="font-bold text-[var(--gp-text-1)]">{notas.ultima}</b></>}
      </span>
      <span role="cell" className="whitespace-nowrap text-right text-[13px] font-semibold" style={{ color: corVs }}>{vs}</span>
      <span role="cell" className="text-[13px]" style={sumido ? { color: 'var(--gp-danger-on)', fontWeight: 650 } : undefined}>
        {formatUltimoAcesso(l.diasSemAtividade)}
      </span>
      <span role="cell" className="text-[var(--gp-text-3)]"><Icon name="chevron_right" size={16} /></span>
    </div>
  );
}
