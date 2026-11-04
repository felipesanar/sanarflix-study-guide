import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { MeFlix } from '../../api/fonte';
import { useAlunos, useDesempenhoTurma, useEngajamentoTurma, useIntervencoes, useSerieTurma, useSessoes, useTurmaAcademy } from '../../api/queries';
import type { AlertaB2C } from '../../api/types';
import { FaixaContexto } from '../FaixaContexto';
import { ListaPrioridades } from '../ListaPrioridades';
import { AFazer } from './AFazer';
import { contextoInicio } from './contextoInicio';
import { alertasB2c, iniciaisDe, indicadoresB2c, indicadoresV0, temSimuladoFechado } from './dadosInicio';
import { SkeletonInicio, resumoLista, useHorarioDados } from './comum';
import { linksInicio } from './links';
import { ProximasSessoes } from './ProximasSessoes';
import { VisaoGeralResumo } from './VisaoGeralResumo';

const ICONE_ALERTA: Record<AlertaB2C, { nome: DendeIconName; cor: string }> = {
  sumiram: { nome: 'visibility_off', cor: 'var(--gp-danger)' },
  regrediram: { nome: 'arrow_downward', cor: 'var(--gp-danger)' },
  estagnados: { nome: 'arrow_forward', cor: 'var(--gp-warning)' },
  nao_fizeram: { nome: 'date-picker', cor: 'var(--gp-text-2)' },
  esfriando: { nome: 'schedule', cor: 'var(--gp-warning)' },
};

/** Início B2C (docs/02 § Tela 1): faixa da tribo, visão geral, Quem precisa de você, Próximas sessões e A fazer. */
export function InicioB2c({ me }: { me: MeFlix }) {
  const navigate = useNavigate();
  const ctx = contextoInicio(me);
  const desempenho = useDesempenhoTurma(null);
  const serie = useSerieTurma(null);
  const turma = useTurmaAcademy();
  const engajamento = useEngajamentoTurma(8);
  const sessoes = useSessoes({ status: 'agendada' });
  const intervencoes = useIntervencoes();
  const alunos = useAlunos();
  const horario = useHorarioDados(turma.data, desempenho.data);

  const nomes = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alunos.data ?? []) { m.set(a.alunoId, a.nome); m.set(a.email, a.nome); }
    for (const a of turma.data ?? []) if (a.nome && !m.has(a.email)) m.set(a.email, a.nome);
    return m;
  }, [alunos.data, turma.data]);

  const carregando = desempenho.isLoading || turma.isLoading;
  const erro = desempenho.isError || turma.isError;
  const comSimulado = temSimuladoFechado(desempenho.data);
  const resumo = !desempenho.data || !turma.data ? null
    : comSimulado ? indicadoresB2c(desempenho.data, serie.data) : indicadoresV0(turma.data, engajamento.data);
  const alertas = turma.data ? alertasB2c(turma.data, desempenho.data, comSimulado) : [];

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="mentor-inicio">
      {erro ? (
        <EstadoErro
          className="mentor-erro-global" titulo="Não foi possível carregar os dados da turma." descricao=""
          tentandoNovamente={desempenho.isFetching || turma.isFetching}
          onRetry={() => { if (desempenho.isError) desempenho.refetch(); if (turma.isError) turma.refetch(); }}
        />
      ) : null}
      <FaixaContexto
        tema={ctx.tema} primeiroNome={ctx.primeiroNome} eyebrow={ctx.eyebrow} marca={ctx.marca}
        acaoSecundaria={{ rotulo: 'Nova intervenção', icone: 'add', onClick: () => navigate(linksInicio.novaIntervencao()) }}
        acaoPrimaria={{ rotulo: 'Publicar no mural', icone: 'campaign', onClick: () => navigate(linksInicio.mural()) }}
      />
      {carregando ? <SkeletonInicio /> : erro || !resumo ? null : (
        <>
          {!comSimulado ? (
            <p role="note" className="m-0 rounded-xl px-4 py-3 text-[13.5px]" style={{ background: 'var(--gp-info-surface)', color: 'var(--gp-info-on)' }}>
              Simulados ainda não disponíveis. Por enquanto, só alertas de engajamento.
            </p>
          ) : null}
          <VisaoGeralResumo
            titulo="Visão geral da tribo" resumo={resumo}
            link={comSimulado
              ? { rotulo: 'Detalhar simulado', onClick: () => navigate(linksInicio.detalhamento(resumo.simuladoId)) }
              : { rotulo: 'Ver turma', onClick: () => navigate(linksInicio.turma()) }}
          />
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-[2_1_520px]">
              <ListaPrioridades<AlertaB2C>
                titulo="Quem precisa de você" resumo={resumoLista(alertas, 'alerta', 'alertas', horario)} itens={alertas} estado="ok"
                icone={(k) => ICONE_ALERTA[k]}
                iniciais={(ids) => ids.slice(0, 3).map((id) => iniciaisDe(nomes.get(id), id))}
                onSelecionar={(k) => navigate(linksInicio.turmaPorAlerta(k))}
              />
            </div>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
              <ProximasSessoes
                modalidade="b2c" sessoes={sessoes.data?.data} carregando={sessoes.isLoading} erro={sessoes.isError}
                tentandoNovamente={sessoes.isFetching} onTentarNovamente={() => void sessoes.refetch()}
                nomes={nomes} iconeTribo={ctx.iconeTribo}
                onVerAgenda={() => navigate(linksInicio.sessoes())} onAbrirSessao={(id) => navigate(linksInicio.sessao(id))}
              />
              <AFazer
                cards={intervencoes.data?.cards} carregando={intervencoes.isLoading} erro={intervencoes.isError}
                tentandoNovamente={intervencoes.isFetching} onTentarNovamente={() => void intervencoes.refetch()} nomes={nomes}
                onAbrirKanban={() => navigate(linksInicio.intervencoes())} onAbrirCard={(id) => navigate(linksInicio.card(id))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
