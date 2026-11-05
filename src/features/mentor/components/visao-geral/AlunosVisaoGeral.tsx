import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { PAR_GRUPO, TagGrupo } from '@/features/gestor/components/tabela';
import { TRACO, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { rotuloRecencia } from '@/features/gestor/lib/engajamento';
import { rotuloGrupo } from '@/features/gestor/lib/rotulos';
import type { AlunoB2b, GrupoPrioridadeB2B } from '../../api/types';
import { DIAS_SUMIDO } from '../../lib/regrasMentor';
import { FOCO } from './SeletorPeriodo';
import {
  FILTROS_GRUPO, ROTULO_CHIP_PERFIL, ROTULO_PERFIL, alunoNoGrupo, alunoNoPerfil, colunasProficiencia, ordinal, type FiltroGrupo,
} from './util';

const COLUNAS = 'minmax(220px,1.4fr) 80px 230px 90px 110px 24px';

const rotuloFiltroGrupo = (g: FiltroGrupo) => (g === 'todos' ? 'Todos' : g === 'sem_resultado' ? 'Sem resultado' : rotuloGrupo(g));
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface AlunosVisaoGeralProps {
  alunos: AlunoB2b[] | undefined;
  estado: 'ok' | 'loading' | 'error';
  onTentarNovamente: () => void;
  perfil: GrupoPrioridadeB2B | null;
  grupo: FiltroGrupo;
  busca: string;
  alunoAberto: string | null;
  onPerfil: (p: GrupoPrioridadeB2B | null) => void;
  onGrupo: (g: FiltroGrupo) => void;
  onBusca: (b: string) => void;
  onLimpar: () => void;
  onAbrirAluno: (email: string) => void;
}

/** Bloco "Alunos" da Visão Geral B2B: busca, chip de perfil (vindo do Início), chips de grupo e tabela. */
export function AlunosVisaoGeral(p: AlunosVisaoGeralProps) {
  const id = useId();
  const todos = p.alunos ?? [];
  const contagem = (g: FiltroGrupo) => todos.filter((a) => alunoNoGrupo(a, g)).length;
  const recorte = todos.filter((a) => alunoNoPerfil(a, p.perfil) && alunoNoGrupo(a, p.grupo));
  const q = normalizar(p.busca);
  const linhas = q ? recorte.filter((a) => normalizar(a.nome ?? a.email).includes(q)) : recorte;
  const ordens = colunasProficiencia(todos);
  const ultima = ordens[ordens.length - 1] ?? null;
  const cabecalhoProf = ordens.length ? `Proficiência ${ordinal(ordens[0])} → ${ordinal(ultima)}` : 'Proficiência';
  const nPerfil = p.perfil ? todos.filter((a) => alunoNoPerfil(a, p.perfil)).length : 0;

  let corpo;
  if (p.estado === 'loading') {
    corpo = <div className="px-5 pb-5"><GestorSkeleton altura={360} forma="cartao" rotulo="Carregando alunos" /></div>;
  } else if (p.estado === 'error') {
    corpo = <div className="px-5 pb-5"><EstadoErro onRetry={p.onTentarNovamente} /></div>;
  } else {
    corpo = <>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Alunos" className="tabular-nums" style={{ minWidth: 880 }}>
          <div role="row" className="grid gap-2.5 bg-[var(--gp-surface-2)] px-5 py-2 text-xs font-semibold text-[var(--gp-text-2)]" style={{ gridTemplateColumns: COLUNAS }}>
            <span role="columnheader">Aluno</span>
            <span role="columnheader">Semestre</span>
            <span role="columnheader" className="text-right">{cabecalhoProf}</span>
            <span role="columnheader" className="text-right">{ultima === null ? 'Acerto' : `Acerto ${ordinal(ultima)}`}</span>
            <span role="columnheader">Último acesso</span>
            <span role="columnheader"><span className="sr-only">Abrir</span></span>
          </div>
          {linhas.map((a) => {
            const porOrdem = new Map(a.proficiencias.map((x) => [x.ordem, x.valor]));
            const valores = ordens.map((o) => formatNumero(porOrdem.get(o) ?? null));
            const ultimoValor = valores.pop();
            const selecionado = p.alunoAberto === a.email;
            const sumido = a.diasSemAtividade !== null && a.diasSemAtividade >= DIAS_SUMIDO;
            return (
              <div key={a.email} role="row" className="relative grid items-center gap-2.5 border-t border-[var(--gp-border-subtle)] px-5 py-3 text-[13px] hover:bg-[var(--gp-surface-2)]"
                style={{ gridTemplateColumns: COLUNAS, background: selecionado ? 'var(--gp-brand-surface-soft)' : undefined }}>
                <span role="cell" className="flex min-w-0 flex-col items-start gap-1">
                  <button type="button" onClick={() => p.onAbrirAluno(a.email)} aria-current={selecionado ? 'true' : undefined}
                    className={`min-h-11 min-[600px]:min-h-0 text-left text-[13.5px] font-semibold before:absolute before:inset-0 before:content-[''] ${FOCO}`}>
                    {a.nome ?? a.email}
                  </button>
                  <span className="flex flex-wrap gap-1.5">
                    {a.grupo ? <TagGrupo grupo={a.grupo} /> : <Tag variant="ausencia">{TRACO}</Tag>}
                    {a.perfil ? <Tag variant="neutro">{ROTULO_PERFIL[a.perfil]}</Tag> : null}
                  </span>
                </span>
                <span role="cell">{a.semestre === null ? TRACO : ordinal(a.semestre)}</span>
                <span role="cell" className="whitespace-nowrap text-right text-[12.5px] text-[var(--gp-text-2)]">
                  {valores.length ? `${valores.join(' · ')} · ` : null}
                  <b className="font-semibold text-[var(--gp-text-1)]">{ultimoValor ?? TRACO}</b>
                </span>
                <span role="cell" className="text-right">{formatPct(a.acertoUltimoPct)}</span>
                <span role="cell" style={sumido ? { color: 'var(--gp-danger-on)', fontWeight: 650 } : undefined}>{rotuloRecencia(a.diasSemAtividade)}</span>
                <span role="cell" className="text-[var(--gp-text-3)]"><Icon name="chevron_right" size={16} /></span>
              </div>
            );
          })}
        </div>
      </div>
      {!linhas.length ? (
        <div className="px-5 py-5">
          <EstadoVazio titulo="Nenhum aluno neste recorte." acao={{ rotulo: 'Limpar filtros', onClick: p.onLimpar }} />
        </div>
      ) : null}
      <div className="border-t border-[var(--gp-border-subtle)] px-5 py-3 text-[12.5px] text-[var(--gp-text-2)]">
        Mostrando {linhas.length} de {recorte.length} · {TRACO} = não participou
      </div>
    </>;
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="min-w-0 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <header className="flex flex-wrap items-end gap-3 px-5 pb-3 pt-4">
        <h2 id={`${id}-titulo`} className="m-0 min-w-[min(240px,100%)] flex-1 text-[15px] font-semibold">Alunos</h2>
        <label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-[var(--gp-border-input)] px-3 text-[var(--gp-text-3)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--gp-brand)] min-[600px]:h-9 min-[600px]:w-auto min-[600px]:min-w-[240px]">
          <Icon name="search" size={16} />
          <input value={p.busca} onChange={(e) => p.onBusca(e.target.value)} placeholder="Buscar aluno" aria-label="Buscar aluno"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-[var(--gp-text-1)] outline-none" />
        </label>
      </header>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        {p.perfil ? (
          <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full pl-3 pr-1.5 text-[13px] font-semibold"
            style={{ background: 'var(--gp-text-1)', color: 'var(--gp-surface-1)' }}>
            Perfil: {ROTULO_CHIP_PERFIL[p.perfil]} · {nPerfil}
            <button type="button" aria-label="Remover filtro" onClick={() => p.onPerfil(null)}
              className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full ${FOCO}`} style={{ background: 'rgba(255,255,255,0.16)' }}>
              <Icon name="close" size={13} />
            </button>
          </span>
        ) : null}
        <div role="group" aria-label="Filtrar por grupo" className="flex flex-wrap gap-2">
          {FILTROS_GRUPO.map((g) => {
            const ativo = p.grupo === g;
            const cor = g !== 'todos' && g !== 'sem_resultado' ? String(PAR_GRUPO[g].color) : null;
            return (
              <button key={g} type="button" aria-pressed={ativo} onClick={() => p.onGrupo(g)}
                className={`inline-flex min-h-11 min-[600px]:min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border bg-[var(--gp-surface-1)] px-3 text-[13px] ${FOCO}`}
                style={{ borderColor: ativo ? 'var(--gp-text-1)' : 'var(--gp-border-strong)', fontWeight: ativo ? 650 : 500 }}>
                {cor ? <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: cor }} /> : null}
                {rotuloFiltroGrupo(g)}
                <span className="text-[var(--gp-text-3)]">{p.estado === 'ok' ? contagem(g) : TRACO}</span>
              </button>
            );
          })}
        </div>
      </div>
      {corpo}
    </section>
  );
}
