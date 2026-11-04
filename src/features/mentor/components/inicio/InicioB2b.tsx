import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { MeFlix } from '../../api/fonte';
import { mensagemErro } from '../../api/erros';
import { hojeRotina, useAlunos, useAlunosB2b, useMarcarRotinaEnviada, useRotina, useSessoes, useVisaoGeralB2b } from '../../api/queries';
import type { GrupoPrioridadeB2B } from '../../api/types';
import { ordenarSessoes } from '../../lib/regrasMentor';
import { FaixaContexto } from '../FaixaContexto';
import { ListaPrioridades } from '../ListaPrioridades';
import { SkeletonInicio, resumoLista } from './comum';
import { contextoInicio } from './contextoInicio';
import { dataSp, iniciaisDe, indicadoresB2b, prioridadesB2bInicio } from './dadosInicio';
import { GrupoDaSemana } from './GrupoDaSemana';
import { linksInicio } from './links';
import { ProximasSessoes } from './ProximasSessoes';
import { useToast } from './ui';
import { VisaoGeralResumo } from './VisaoGeralResumo';

const ICONE_PERFIL: Record<GrupoPrioridadeB2B, { nome: DendeIconName; cor: string }> = {
  virada: { nome: 'radio_button_checked', cor: 'var(--gp-brand)' },
  muito_baixo: { nome: 'report_problem', cor: 'var(--gp-danger)' },
  sem_acesso: { nome: 'visibility_off', cor: 'var(--gp-warning)' },
  muito_bom: { nome: 'arrow_upward', cor: 'var(--gp-success)' },
};
/** O Início lê o ciclo inteiro: os indicadores comparam o último simulado com o anterior. */
const PERIODO = 'ciclo' as const;

/** Início B2B (docs/03 § Tela 1): faixa da IES, visão geral da instituição, prioridades, sessões e rotina do grupo. */
export function InicioB2b({ me }: { me: MeFlix }) {
  const navigate = useNavigate();
  const ctx = contextoInicio(me);
  const visao = useVisaoGeralB2b(PERIODO);
  const alunosB2b = useAlunosB2b(PERIODO);
  const sessoes = useSessoes({ status: 'agendada' });
  const alunos = useAlunos();
  const { semana } = hojeRotina();
  const hoje = dataSp(new Date().toISOString()) ?? semana;
  const rotina = useRotina(semana);
  const marcar = useMarcarRotinaEnviada();
  const [marcando, setMarcando] = useState<string | null>(null);
  const { mostrar, toast } = useToast();

  const nomes = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alunos.data ?? []) { m.set(a.alunoId, a.nome); m.set(a.email, a.nome); }
    for (const a of alunosB2b.data ?? []) if (a.nome && !m.has(a.email)) m.set(a.email, a.nome);
    return m;
  }, [alunos.data, alunosB2b.data]);

  const carregando = visao.isLoading || alunosB2b.isLoading;
  const erro = visao.isError || alunosB2b.isError;
  const prioridades = alunosB2b.data ? prioridadesB2bInicio(alunosB2b.data) : [];
  const proxima = ordenarSessoes(sessoes.data?.data ?? [], 'proximas')[0];

  const onMarcar = (id: string, rotulo: string) => {
    setMarcando(id);
    marcar.mutate(id, {
      onSuccess: () => mostrar(`${rotulo} marcada como enviada · entrou no log da semana`),
      onError: (e) => mostrar(mensagemErro(e)),
      onSettled: () => setMarcando(null),
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="mentor-inicio">
      {erro ? (
        <EstadoErro
          className="mentor-erro-global" titulo="Não foi possível carregar os indicadores." descricao=""
          tentandoNovamente={visao.isFetching || alunosB2b.isFetching}
          onRetry={() => { if (visao.isError) visao.refetch(); if (alunosB2b.isError) alunosB2b.refetch(); }}
        />
      ) : null}
      <FaixaContexto
        tema={ctx.tema} primeiroNome={ctx.primeiroNome} marca={ctx.marca}
        acaoSecundaria={{ rotulo: 'Rotina do grupo', icone: 'whatsapp', onClick: () => navigate(linksInicio.canais()) }}
        acaoPrimaria={{ rotulo: 'Preparar sessão', icone: 'edit_calendar', onClick: () => navigate(linksInicio.sessao(proxima?.id)) }}
      />
      {carregando ? <SkeletonInicio /> : erro || !visao.data || !alunosB2b.data ? null : (
        <>
          <VisaoGeralResumo
            titulo="Visão geral da instituição" resumo={indicadoresB2b(visao.data)} legendaProjetado
            link={{ rotulo: 'Ver análise completa', onClick: () => navigate(linksInicio.visaoGeral()) }}
          />
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-[2_1_520px]">
              <ListaPrioridades<GrupoPrioridadeB2B>
                titulo="Prioridades de acompanhamento" resumo={resumoLista(prioridades, 'grupo', 'grupos')} itens={prioridades} estado="ok"
                icone={(k) => ICONE_PERFIL[k]}
                iniciais={(ids) => ids.slice(0, 3).map((id) => iniciaisDe(nomes.get(id), id))}
                onSelecionar={(k) => navigate(linksInicio.visaoGeralPorPerfil(k))}
              />
            </div>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
              <ProximasSessoes
                modalidade="b2b" sessoes={sessoes.data?.data} carregando={sessoes.isLoading} erro={sessoes.isError}
                tentandoNovamente={sessoes.isFetching} onTentarNovamente={() => void sessoes.refetch()} nomes={nomes}
                onVerAgenda={() => navigate(linksInicio.sessoes())} onAbrirSessao={(id) => navigate(linksInicio.sessao(id))}
              />
              <GrupoDaSemana
                itens={rotina.data} hoje={hoje} carregando={rotina.isLoading} erro={rotina.isError}
                tentandoNovamente={rotina.isFetching} onTentarNovamente={() => void rotina.refetch()}
                marcando={marcando} onMarcar={onMarcar} onAbrirCanais={() => navigate(linksInicio.canais())}
              />
            </div>
          </div>
        </>
      )}
      {toast}
    </div>
  );
}
