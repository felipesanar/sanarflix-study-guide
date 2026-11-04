/**
 * Visão Geral (B2B) · docs/handoff/mentor/docs/03 § Tela 2, docs/08 3.3.
 *
 * Dados só pelos hooks de `api/queries.ts` (TODO(contrato-b2b): formas provisórias). Estado na URL
 * (docs/06): `periodo` (padrão 6m, omitido), `perfil` (chip vindo do Início: virada | muito_baixo |
 * sem_acesso | muito_bom), `grupo` e `aluno` (abre o drawer do shell). Busca, filtros e expansão dos temas
 * ficam locais. Cada bloco tem o próprio carregando/erro: uma falha não derruba os outros.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct } from '@/features/gestor/lib/formatters';
import { mensagemErro } from '../../api/erros';
import { metaMentor } from '../../api/meta';
import type { NovaSessao } from '../../api/fonte';
import {
  useAlunosB2b, useEditarSessao, useQuestoesB2b, useRegistrarEvento, useSessoes, useTemasTurmaB2b, useVisaoGeralB2b,
  type ResultadoMentor,
} from '../../api/queries';
import type { PeriodoB2b, TemaTurmaMentor } from '../../api/types';
import { AlunosVisaoGeral } from '../../components/visao-geral/AlunosVisaoGeral';
import { ProjecaoEnamed } from '../../components/visao-geral/ProjecaoEnamed';
import { ResultadosObservados } from '../../components/visao-geral/ResultadosObservados';
import { FOCO, SeletorPeriodo } from '../../components/visao-geral/SeletorPeriodo';
import { TemasCriticos } from '../../components/visao-geral/TemasCriticos';
import { useToast } from '../../components/visao-geral/Toast';
import {
  PERIODO_PADRAO, ddmm, hojeSp, lerGrupo, lerPerfil, lerPeriodo, proximaOficina, questoesDoTema, rotulosPeriodo, temaNaPauta,
  type FiltroGrupo,
} from '../../components/visao-geral/util';

/** Sem dado e sem erro = carregando (inclui a consulta ainda desligada enquanto `useMe` resolve). */
function estadoDe<T>(r: ResultadoMentor<T>): 'ok' | 'loading' | 'error' {
  if (r.isError && r.data === undefined) return 'error';
  return r.data === undefined ? 'loading' : 'ok';
}

export default function VisaoGeral() {
  const [params, setParams] = useSearchParams();
  const periodo = lerPeriodo(params.get('periodo'));
  const perfil = lerPerfil(params.get('perfil'));
  const grupo = lerGrupo(params.get('grupo'));
  const alunoAberto = params.get('aluno');
  const [busca, setBusca] = useState('');
  const [temaAberto, setTemaAberto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroTema, setErroTema] = useState<{ temaId: string; mensagem: string } | null>(null);
  const toast = useToast();
  const hoje = hojeSp();
  const ano = Number(hoje.slice(0, 4));

  const visao = useVisaoGeralB2b(periodo);
  const temas = useTemasTurmaB2b(periodo);
  const alunos = useAlunosB2b(periodo);
  const oficinas = useSessoes({ status: 'agendada', tipo: 'oficina' });
  const editarSessao = useEditarSessao();
  const registrarEvento = useRegistrarEvento();

  const v = visao.data;
  const referencia = v?.simulados.find((s) => s.id === v.simuladoReferenciaId) ?? null;
  const questoes = useQuestoesB2b(temaAberto && referencia ? [referencia.id] : []);
  const ordemDe = useMemo(() => {
    const mapa = new Map((v?.simulados ?? []).map((s) => [s.id, s.ordem]));
    return (id: string) => mapa.get(id) ?? null;
  }, [v?.simulados]);
  const sessoes = oficinas.data?.data ?? [];
  const oficina = proximaOficina(sessoes, hoje);
  const noPeriodo = v?.triProjetado.serie.length ?? 0;
  const rotuloPeriodo = rotulosPeriodo(ano).find((p) => p.chave === periodo)!.rotulo;
  const meta = visao.meta ?? metaMentor({
    periodo: rotuloPeriodo,
    criterio: 'Indicadores do simulado mais recente do período, comparados com os anteriores do período.',
  });

  const definir = (mudancas: Record<string, string | null>) => setParams((atual) => {
    const nova = new URLSearchParams(atual);
    for (const [k, valor] of Object.entries(mudancas)) {
      if (valor === null) nova.delete(k); else nova.set(k, valor);
    }
    return nova;
  }, { replace: true });
  const mudarPeriodo = (p: PeriodoB2b) => definir({ periodo: p === PERIODO_PADRAO ? null : p });

  const levarParaOficina = (t: TemaTurmaMentor) => {
    if (!oficina) return;
    const pauta: NonNullable<NovaSessao['pauta']> = oficina.pauta.map((item, i) => ({
      texto: item.texto, origem: item.origem, ...(item.referenciaId ? { referenciaId: item.referenciaId } : {}), ordem: i,
    }));
    pauta.push({ texto: `${t.tema} · ${formatPct(t.acertoPct)} de acerto`, origem: 'tema_critico', referenciaId: t.id, ordem: pauta.length });
    setOcupado(t.id);
    setErroTema(null);
    editarSessao.mutate({ id: oficina.id, mudancas: { pauta } }, {
      onSuccess: () => toast.mostrar(`${t.tema} entrou na pauta da oficina de ${ddmm(oficina.data)}`),
      onError: (e) => setErroTema({ temaId: t.id, mensagem: mensagemErro(e) }),
      onSettled: () => setOcupado(null),
    });
  };
  const criarIntervencao = (t: TemaTurmaMentor) => {
    setOcupado(t.id);
    setErroTema(null);
    registrarEvento.mutate({ tipo: 'intervencao_tema', temaId: t.id, tema: t.tema, acertoPct: t.acertoPct, origem: 'tema_critico' }, {
      onSuccess: () => toast.mostrar('Intervenção criada em A fazer'),
      onError: (e) => setErroTema({ temaId: t.id, mensagem: mensagemErro(e) }),
      onSettled: () => setOcupado(null),
    });
  };

  const estadoVisao = estadoDe(visao);
  const semSimulado = v !== undefined && v.simuladoReferenciaId === null;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <h1 data-testid="mentor-visao-geral" className="m-0 min-w-[min(280px,100%)] flex-1 text-2xl font-bold tracking-[-0.02em]">Visão Geral</h1>
        <div className="flex min-w-0 max-w-full flex-col items-start gap-1.5 min-[600px]:items-end">
          <SeletorPeriodo valor={periodo} ano={ano} onChange={mudarPeriodo} />
          {v && !semSimulado ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--gp-text-2)]">
              <span>{noPeriodo} {noPeriodo === 1 ? 'simulado' : 'simulados'} no período</span>
              <Link to={`/mentor/detalhamento?s=${encodeURIComponent(v.simuladoReferenciaId!)}`}
                className={`inline-flex min-h-11 min-[600px]:min-h-0 items-center gap-0.5 rounded-sm text-[13px] font-semibold text-[var(--gp-brand)] hover:text-[var(--gp-brand-strong)] ${FOCO}`}>
                Detalhar este simulado<Icon name="chevron_right" size={15} />
              </Link>
            </span>
          ) : null}
        </div>
      </header>

      {estadoVisao === 'loading' ? <>
        <GestorSkeleton altura={220} forma="cartao" rotulo="Carregando a projeção para o ENAMED" />
        <GestorSkeleton altura={96} rotulo="Carregando os resultados observados" />
      </> : estadoVisao === 'error' ? (
        <EstadoErro titulo="Não foi possível carregar os indicadores da turma." onRetry={visao.refetch} />
      ) : semSimulado ? (
        <EstadoVazio titulo="Nenhum simulado realizado neste período." glifo="calendar_month" glifoVariante="filled"
          acao={periodo !== PERIODO_PADRAO ? { rotulo: 'Ver últimos 6 meses', onClick: () => mudarPeriodo(PERIODO_PADRAO) } : undefined} />
      ) : <>
        <ProjecaoEnamed visao={v!} meta={meta} ordemReferencia={referencia?.ordem ?? null} />
        <ResultadosObservados visao={v!} ordemReferencia={referencia?.ordem ?? null} noPeriodo={noPeriodo} />
      </>}

      <TemasCriticos key={periodo} temas={temas.data} estado={estadoDe(temas)} onTentarNovamente={temas.refetch}
        ordemDe={ordemDe} ordemReferencia={referencia?.ordem ?? null} onAbrir={setTemaAberto}
        questoesDoTema={(t) => (questoes.data ? questoesDoTema(questoes.data, t.tema) : null)}
        oficina={oficina ? { rotulo: ddmm(oficina.data) } : null} naPauta={(id) => temaNaPauta(sessoes, id, hoje)}
        ocupado={ocupado} erro={erroTema} onLevarParaOficina={levarParaOficina} onCriarIntervencao={criarIntervencao} />

      <AlunosVisaoGeral alunos={alunos.data} estado={estadoDe(alunos)} onTentarNovamente={alunos.refetch}
        perfil={perfil} grupo={grupo} busca={busca} alunoAberto={alunoAberto}
        onPerfil={(x) => definir({ perfil: x })} onGrupo={(g: FiltroGrupo) => definir({ grupo: g === 'todos' ? null : g })}
        onBusca={setBusca} onLimpar={() => { setBusca(''); definir({ perfil: null, grupo: null }); }}
        onAbrirAluno={(email) => definir({ aluno: email })} />

      {toast.elemento}
    </div>
  );
}
