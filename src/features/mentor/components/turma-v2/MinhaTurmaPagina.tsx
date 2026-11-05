/**
 * Minha Turma (B2C) — docs/handoff/mentor/docs/02 § Tela 2 e § Estados; docs/08 3.1–3.2.
 *
 * Dados só pelos hooks de `api/queries.ts`:
 *  - `useTurmaAcademy` (cadastro, engajamento, questões 30 dias, meta) é a lista de alunos;
 *  - `useDesempenhoTurma(null)` (notas, corte, alertas de desempenho) e `useSerieTurma(null)` (régua dos KPIs);
 *  - `useEngajamentoTurma()` (semanas anteriores dos KPIs semanais);
 *  - `useTemasTurma(null)` (matriz "Turma toda" e temas críticos) e `useDetalhamento(simulados, e-mails)`
 *    (matriz de um segmento; a prevalência vem do tema da turma).
 * URL (docs/06 § Estado de UI): `?alerta=` (deep link do Início), `?segmento=` e `?aluno=` (drawer do shell).
 * Busca, segmento da matriz e temas expandidos ficam em estado local.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CabecalhoTela } from '@/features/gestor/components/CabecalhoTela';
import { Icon } from '@/features/gestor/components/Icon';
import {
  useDesempenhoTurma, useDetalhamento, useEngajamentoTurma, useRegistrarEvento, useSerieTurma, useTemasTurma, useTurmaAcademy,
} from '../../api/queries';
import { mensagemErro } from '../../api/erros';
import type { Prevalencia, TemaTurma } from '../../api/types';
import { TemasCriticos } from '../TemasCriticos';
import { KpisTurma } from './KpisTurma';
import { MatrizPrevalencia, type SegmentoMatriz } from './MatrizPrevalencia';
import { TabelaAlunosTurma } from './TabelaAlunosTurma';
import { ToastTurma, useToastTurma } from './ToastTurma';
import {
  ehAlerta, matrizPrevalencia, montarTurma, segmentoValido, temasDoDetalhamento, type SegmentoFiltro,
} from './regrasTurma';
import { FOCO } from './ui';

type Consulta = { isLoading: boolean; isError: boolean; refetch: () => void };
const estadoDe = (...qs: Consulta[]): 'ok' | 'loading' | 'error' =>
  qs.some((q) => q.isError) ? 'error' : qs.some((q) => q.isLoading) ? 'loading' : 'ok';
const refazer = (...qs: Consulta[]) => () => qs.filter((q) => q.isError).forEach((q) => q.refetch());

const BOTAO_SECUNDARIO = `inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-3 text-[13px] font-semibold text-[var(--gp-text-1)] no-underline hover:border-[var(--gp-border-input)] ${FOCO}`;

export function MinhaTurmaPagina() {
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [segMatriz, setSegMatriz] = useState<SegmentoMatriz>('turma');
  const { toast, mostrar } = useToastTurma();

  const turmaQ = useTurmaAcademy();
  const desempenhoQ = useDesempenhoTurma(null);
  const serieQ = useSerieTurma(null);
  const engajamentoQ = useEngajamentoTurma();
  const temasQ = useTemasTurma(null);
  const registrar = useRegistrarEvento();

  const montada = useMemo(
    () => (turmaQ.data && desempenhoQ.data ? montarTurma(turmaQ.data, desempenhoQ.data) : undefined),
    [turmaQ.data, desempenhoQ.data],
  );
  const v0 = montada?.v0 ?? false;
  const ultimo = montada?.ultimo ?? null;

  // Matriz de um segmento: mesmo recorte de simulados (todos os realizados) só com os e-mails do segmento.
  const idsRealizados = montada?.realizados.map((s) => s.id) ?? [];
  const emailsSegmento = segMatriz === 'turma' || !montada ? null : montada.linhas.filter((l) => l.segmentoCorte === segMatriz).map((l) => l.email);
  const detalhamentoQ = useDetalhamento(emailsSegmento?.length ? idsRealizados : [], emailsSegmento);

  const temasTurma = temasQ.data ?? [];
  const temPrevalencia = temasTurma.some((t) => t.prevalencia !== null);
  const matriz = useMemo(() => {
    if (segMatriz === 'turma') return matrizPrevalencia(temasTurma);
    return matrizPrevalencia(temasDoDetalhamento(detalhamentoQ.data?.areas ?? [], temasTurma));
  }, [segMatriz, temasTurma, detalhamentoQ.data]);
  const consultasMatriz: Consulta[] = segMatriz === 'turma' || !emailsSegmento?.length ? [temasQ, desempenhoQ] : [temasQ, desempenhoQ, detalhamentoQ];

  // Adaptador para o `TemasCriticos` da base (TemaTurma). TODO(base): a base ainda não aceita prevalência
  // null; sem prevalência a ordenação por impacto não se aplica, então a lista chega ordenada por acerto.
  const temasCriticos = useMemo((): TemaTurma[] => {
    const rotulo = new Map((montada?.realizados ?? []).map((s) => [s.id, `${s.ordem}º`]));
    const lista = [...temasTurma];
    if (!temPrevalencia) lista.sort((a, b) => (a.acertoPct ?? 101) - (b.acertoPct ?? 101));
    return lista.map((t) => ({
      id: t.id, tema: t.tema, especialidade: t.especialidade ?? '', grandeArea: t.grandeArea,
      prevalencia: t.prevalencia as Prevalencia, acertoPct: t.acertoPct, respostas: t.respostas,
      alunosAbaixo50: t.alunosAbaixo50.length,
      serie: t.serie.map((s) => ({ rotulo: rotulo.get(s.simuladoId) ?? '', valor: s.acertoPct })),
    }));
  }, [temasTurma, temPrevalencia, montada]);
  const areasTemas = [...new Set(temasTurma.map((t) => t.grandeArea))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const alertaUrl = params.get('alerta');
  const alerta = ehAlerta(alertaUrl) ? alertaUrl : null;
  const segmento = segmentoValido(params.get('segmento'), v0);
  const alunoAberto = params.get('aluno');
  const mudarUrl = (mut: (p: URLSearchParams) => void, replace = true) =>
    setParams((atual) => { const n = new URLSearchParams(atual); mut(n); return n; }, { replace });

  const anterior = ultimo ? [...(montada?.realizados ?? [])].filter((s) => s.ordem < ultimo.ordem).pop() ?? null : null;
  const hrefDetalhamento = (extra?: Record<string, string>) => {
    const q = new URLSearchParams();
    if (ultimo) q.set('s', [anterior?.id, ultimo.id].filter(Boolean).join(','));
    for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
    return `/mentor/detalhamento?${q.toString()}`;
  };

  async function criarIntervencao(t: TemaTurma) {
    try {
      const r = await registrar.mutateAsync({ tipo: 'intervencao_tema', temaId: t.id, tema: t.tema, acertoPct: t.acertoPct, origem: 'tema_critico' });
      mostrar(r?.duplicado ? `Este tema já tem intervenção: ${t.tema}` : `Intervenção criada em A fazer: ${t.tema}`);
    } catch (e) {
      mostrar(mensagemErro(e), 'erro');
    }
  }

  const consultasKpi: Consulta[] = [turmaQ, desempenhoQ, serieQ, engajamentoQ];
  const estadoBase = estadoDe(turmaQ, desempenhoQ);

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="mentor-minha-turma">
      <CabecalhoTela titulo="Minha Turma" acoes={!v0 && ultimo ? (
        <Link to={hrefDetalhamento()} className={BOTAO_SECUNDARIO}>
          <Icon name="equalizer" size={15} />Detalhar {ultimo.nome}<Icon name="chevron_right" size={14} />
        </Link>
      ) : undefined} />

      <KpisTurma estado={estadoDe(...consultasKpi)} onTentarNovamente={refazer(...consultasKpi)} turma={montada}
        alunos={turmaQ.data} desempenho={desempenhoQ.data} serie={serieQ.data} engajamento={engajamentoQ.data} />

      {v0 ? null : (
        <>
          <MatrizPrevalencia estado={estadoDe(...consultasMatriz)} onTentarNovamente={refazer(...consultasMatriz)}
            linhas={matriz.linhas} temPrevalencia={temPrevalencia} segmentoVazio={!!emailsSegmento && emailsSegmento.length === 0}
            segmento={segMatriz} onSegmento={setSegMatriz} hrefDetalhar={(area) => hrefDetalhamento({ area })} />
          <TemasCriticos modalidade="b2c" estado={estadoDe(temasQ, desempenhoQ)} onTentarNovamente={refazer(temasQ, desempenhoQ)}
            temas={temasQ.data ? temasCriticos : undefined} areas={areasTemas} onCriarIntervencao={(t) => { void criarIntervencao(t); }} />
        </>
      )}

      <TabelaAlunosTurma estado={estadoBase} onTentarNovamente={refazer(turmaQ, desempenhoQ)}
        linhas={montada?.linhas ?? []} v0={v0} ordemUltimo={ultimo?.ordem ?? null}
        alerta={alerta} segmento={segmento} busca={busca} alunoAberto={alunoAberto}
        onBusca={setBusca}
        onRemoverAlerta={() => mudarUrl((p) => p.delete('alerta'))}
        onSegmento={(s: SegmentoFiltro | null) => mudarUrl((p) => (s ? p.set('segmento', s) : p.delete('segmento')))}
        onLimpar={() => { setBusca(''); mudarUrl((p) => { p.delete('alerta'); p.delete('segmento'); }); }}
        onAbrir={(email) => mudarUrl((p) => p.set('aluno', email), false)} />

      <ToastTurma toast={toast} />
    </div>
  );
}
