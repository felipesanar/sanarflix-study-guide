import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { Icon } from '@/features/gestor/components/Icon';
import { cn } from '@/lib/utils';
import { mensagemErro } from '@/features/mentor/api/erros';
import { useAlunos, useAtualizarIntervencao, useCriarIntervencao, useIntervencoes, useMe } from '@/features/mentor/api/queries';
import type { PerfilB2B, StatusIntervencao, TipoIntervencao } from '@/features/mentor/api/types';
import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';
import { tituloDeParam } from '@/features/mentor/lib/textoSeguro';
import { CriadorIntervencao } from '@/features/mentor/components/intervencoes-v2/CriadorIntervencao';
import { DrawerCardIntervencao } from '@/features/mentor/components/intervencoes-v2/DrawerCardIntervencao';
import { BOTAO_PRIMARIO } from '@/features/mentor/components/intervencoes-v2/estilos';
import { FiltrosIntervencoes } from '@/features/mentor/components/intervencoes-v2/FiltrosIntervencoes';
import { MedidorMeta } from '@/features/mentor/components/intervencoes-v2/MedidorMeta';
import { QuadroKanban, QuadroKanbanSkeleton } from '@/features/mentor/components/intervencoes-v2/QuadroKanban';
import { Toast, useToast } from '@/features/mentor/components/intervencoes-v2/Toast';
import {
  ROTULO_STATUS, filtrarCards, hojeSP, intervaloPeriodo, mesDe, rotuloIntervalo, type Intervalo, type PeriodoId,
} from '@/features/mentor/components/intervencoes-v2/util';

/** Parâmetros de entrada do criador (Início, drawer do aluno, Detalhamento) — saem da URL ao criar. */
const PARAMS_CRIADOR = ['novo', 'aluno', 'alunos', 'alvo', 'titulo'] as const;
const ERRO_INTERVALO = 'A data inicial precisa ser anterior à final.';

/**
 * Tela 6 · Intervenções (docs/02 § Tela 6, docs/03 § Tela 6). Kanban A fazer · Em andamento · Feito,
 * medidor da meta mensal (P6), período e tipo (B2C) / perfil (B2B). O card aberto fica em `?card=`.
 */
export default function Intervencoes() {
  const me = useMe();
  const modalidade = me.data?.mentor.modalidade ?? 'b2c';
  const [params, setParams] = useSearchParams();
  const { toast, mostrar } = useToast();

  const hoje = React.useMemo(() => hojeSP(), []);
  const mes = React.useMemo(() => mesDe(hoje), [hoje]);
  const [periodo, setPeriodo] = React.useState<PeriodoId>('quinzena');
  const [livre, setLivre] = React.useState({ de: '', ate: '' });
  const [tipo, setTipo] = React.useState<TipoIntervencao | 'todos'>('todos');
  const [perfil, setPerfil] = React.useState<PerfilB2B | 'todos'>('todos');

  const intervalo = intervaloPeriodo(periodo, hoje, livre);
  const ultimoValido = React.useRef<Intervalo>(intervaloPeriodo('quinzena', hoje)!);
  if (intervalo) ultimoValido.current = intervalo;
  const consulta = intervalo ?? ultimoValido.current;
  const erroLivre = periodo === 'intervalo' && livre.de && livre.ate && livre.de > livre.ate ? ERRO_INTERVALO : null;

  const quadro = useIntervencoes({ de: consulta.de, ate: consulta.ate });
  const doMes = useIntervencoes({ de: mes.de, ate: mes.ate });
  const alunosQ = useAlunos();
  const alunos = React.useMemo(() => alunosQ.data ?? [], [alunosQ.data]);
  const nomes = React.useMemo(() => new Map(alunos.map((a) => [a.email.toLowerCase(), a.nome])), [alunos]);
  const estadoAlunos = alunosQ.isError ? 'error' : alunosQ.isPending ? 'loading' : 'ok';

  // ── Criador ──
  const [criando, setCriando] = React.useState(() => params.get('novo') === '1' || params.has('aluno') || params.has('alunos'));
  const [inicialCriador] = React.useState(() => ({
    destinatarios: params.get('alvo') === 'turma'
      ? { turmaToda: true, emails: [] }
      : { turmaToda: false, emails: parseEmailsParam(params.get('aluno'), params.get('alunos')) },
    descricao: tituloDeParam(params.get('titulo')),
  }));
  const [erroCriar, setErroCriar] = React.useState<string | null>(null);
  const criar = useCriarIntervencao();
  const abrirCriador = () => {
    setTipo('todos');
    setPerfil('todos');
    setErroCriar(null);
    setCriando(true);
  };
  const limparParamsCriador = () => {
    if (!PARAMS_CRIADOR.some((k) => params.has(k))) return;
    setParams((atual) => {
      const p = new URLSearchParams(atual);
      PARAMS_CRIADOR.forEach((k) => p.delete(k));
      return p;
    }, { replace: true });
  };
  const fecharCriador = () => { setCriando(false); setErroCriar(null); limparParamsCriador(); };

  // ── Mover (B2B no card; B2C e B2B no drawer) ──
  const atualizar = useAtualizarIntervencao();
  const mover = (id: string, status: StatusIntervencao) =>
    atualizar.mutate({ id, status }, {
      onSuccess: () => mostrar(`Intervenção movida para ${ROTULO_STATUS[status]}`),
      onError: (e) => mostrar(mensagemErro(e), 'erro'),
    });

  // ── Card aberto na URL ──
  const cardId = params.get('card');
  const todos = useIntervencoes();
  const cardAberto = cardId
    ? quadro.data?.cards.find((c) => c.id === cardId) ?? todos.data?.cards.find((c) => c.id === cardId) ?? null
    : null;
  const procurando = !!cardId && !cardAberto && (quadro.isPending || todos.isPending);
  React.useEffect(() => {
    if (cardId && !cardAberto && !procurando) {
      setParams((atual) => { const p = new URLSearchParams(atual); p.delete('card'); return p; }, { replace: true });
    }
  }, [cardId, cardAberto, procurando, setParams]);
  const abrirCard = (id: string) => setParams((atual) => { const p = new URLSearchParams(atual); p.set('card', id); return p; });
  const fecharCard = () => setParams((atual) => { const p = new URLSearchParams(atual); p.delete('card'); return p; });

  // ── Dados do quadro ──
  const cardsPeriodo = quadro.data?.cards ?? [];
  const visiveis = filtrarCards(cardsPeriodo, { modalidade, tipo, perfil });
  const filtroAtivo = modalidade === 'b2b' ? perfil !== 'todos' : tipo !== 'todos';
  const limparFiltro = () => { setTipo('todos'); setPerfil('todos'); };

  let corpo: React.ReactNode;
  if (quadro.isPending) corpo = <QuadroKanbanSkeleton />;
  else if (quadro.isError) corpo = <EstadoErro onRetry={() => void quadro.refetch()} tentandoNovamente={quadro.isFetching} />;
  else if (!visiveis.length && !criando) {
    corpo = filtroAtivo
      ? <EstadoVazio glifo="filter_list_off" titulo="Nenhuma intervenção com este filtro." acao={{ rotulo: 'Limpar filtro', onClick: limparFiltro }} />
      : <EstadoVazio glifo="calendar_month" titulo="Nenhuma intervenção neste período." descricao="Crie a primeira em “Nova intervenção”." />;
  } else {
    corpo = (
      <QuadroKanban
        modalidade={modalidade}
        cards={visiveis}
        nomes={nomes}
        onAbrir={abrirCard}
        onMover={mover}
        movendo={atualizar.isPending}
        criador={criando ? (
          <CriadorIntervencao
            modalidade={modalidade}
            alunos={alunos}
            estadoAlunos={estadoAlunos}
            inicial={inicialCriador}
            enviando={criar.isPending}
            erroEnvio={erroCriar}
            onCancelar={fecharCriador}
            onCriar={(n) => {
              setErroCriar(null);
              criar.mutate(n, {
                onSuccess: () => { fecharCriador(); mostrar('Intervenção adicionada em A fazer'); },
                onError: (e) => setErroCriar(mensagemErro(e)),
              });
            }}
          />
        ) : null}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[min(280px,100%)] flex-1 flex-col gap-1">
          <h1 data-testid="mentor-intervencoes" className="m-0 text-2xl font-bold tracking-[-0.02em] text-[var(--gp-text-1)]">Intervenções</h1>
        </div>
        <button type="button" onClick={abrirCriador} className={cn(BOTAO_PRIMARIO, 'h-[38px] text-[13.5px]')}>
          <Icon name="add" size={16} />Nova intervenção
        </button>
      </header>

      <FiltrosIntervencoes
        modalidade={modalidade}
        periodo={periodo}
        onPeriodo={setPeriodo}
        rotuloPeriodo={intervalo ? rotuloIntervalo(periodo, intervalo) : null}
        livre={livre}
        onLivre={setLivre}
        erroLivre={erroLivre}
        tipo={tipo}
        onTipo={setTipo}
        perfil={perfil}
        onPerfil={setPerfil}
      />

      <MedidorMeta
        estado={doMes.isPending ? 'loading' : doMes.isError ? 'error' : 'ok'}
        realizadas={doMes.data ? doMes.data.realizadas : null}
        mes={mes}
        onTentarNovamente={() => void doMes.refetch()}
        tentando={doMes.isFetching}
      />

      {corpo}

      {cardAberto ? (
        <DrawerCardIntervencao card={cardAberto} modalidade={modalidade} alunos={alunos} onFechar={fecharCard} toast={toast} mostrarToast={mostrar} />
      ) : null}
      {cardAberto ? null : <Toast toast={toast} />}
    </div>
  );
}
