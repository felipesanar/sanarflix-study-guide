/**
 * Drawer do aluno · B2C (docs/02 § Drawer · Aluno; docs/05 § Ajustes: sem semestre, com Consumo no Flix).
 * Dados: `useAlunoDetalhe` (aluno, notas, áreas, log), `useMe` (tribo e agendaUrl), `useSimuladosMentor`
 * (total da participação), `useAlunos`/`useConvites` (ids da fonte para liberar/desligar a agenda).
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { linkWhatsAppAluno } from '@/features/gestor/components/DrawerAluno';
import { Tag } from '@/features/gestor/components/Tag';
import { PAR_GRUPO } from '@/features/gestor/components/tabela';
import { ErroFonte } from '../../api/fonte';
import { mensagemErro, tratamentoErro } from '../../api/erros';
import { triboIdDoSlug } from '../../api/fonteAcademy';
import { useAlunoDetalhe, useAlunos, useConvites, useDesligarAgenda, useLiberarAgenda, useMe, useRegistrarEvento, useSimuladosMentor } from '../../api/queries';
import type { AlunoTurmaAcademy, NotaAlunoSimulado, SegmentoAtividade, TriboId } from '../../api/types';
import { segmentoCorte, type SegmentoCorte } from '../../lib/regrasMentor';
import { AgendaIndividual } from './AgendaIndividual';
import { DesempenhoArea } from './DesempenhoArea';
import {
  formatAcertoQuestoes, formatContagem, formatMesAno, formatTelefone, formatUltimoAcesso, montarLog, primeiroNome, ROTULO_SEGMENTO,
} from './formatos';
import { LogInteracoes } from './LogInteracoes';
import { NotasSimulados, ordenarNotas } from './NotasSimulados';
import {
  AcaoWhatsApp, BotaoAcao, CabecalhoAluno, ConsumoFlix, CorpoDrawer, DadosAluno, LinkAcao, SkeletonDrawer, TituloOculto,
} from './partes';

// Assets oficiais do handoff (mesma origem do cartão da sidebar); o cadastro da tribo prevalece quando traz ícone.
const ICONES_TRIBO: Record<TriboId, string> = {
  carcara: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-carcara.png', import.meta.url).href,
  camaleao: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-camaleao.png', import.meta.url).href,
  colmeia: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-colmeia.png', import.meta.url).href,
  octopus: new URL('../../../../../docs/handoff/mentor/prototipos/brand/icone-octopus.png', import.meta.url).href,
};

const PAR_SEGMENTO: Record<Exclude<SegmentoCorte, 'sem_historico'>, React.CSSProperties> = {
  acima: PAR_GRUPO.consistentemente_proficiente,
  variacao: PAR_GRUPO.em_variacao,
  abaixo: PAR_GRUPO.consistentemente_nao_proficiente,
};
const ENGAJAMENTO: Record<SegmentoAtividade, { rotulo: string; par: React.CSSProperties | null }> = {
  ativo: { rotulo: 'Ativo', par: PAR_GRUPO.consistentemente_proficiente },
  esfriando: { rotulo: 'Esfriando', par: PAR_GRUPO.em_variacao },
  sumido: { rotulo: 'Sumido', par: PAR_GRUPO.consistentemente_nao_proficiente },
  sem_dado: { rotulo: 'Sem dado', par: null },
};

function TagSegmento({ notas, aluno, comSimulado }: { notas: NotaAlunoSimulado[]; aluno: AlunoTurmaAcademy; comSimulado: boolean }) {
  if (!comSimulado) {
    const e = ENGAJAMENTO[aluno.segmento];
    return e.par ? <Tag variant="positivo" style={e.par}>{e.rotulo}</Tag> : <Tag variant="neutro">{e.rotulo}</Tag>;
  }
  const serie = [...notas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((n) => n.acertoPct);
  const seg = segmentoCorte(serie, aluno.meta?.cortePct ?? null);
  if (seg === 'sem_historico') return <Tag variant="neutro">{ROTULO_SEGMENTO.sem_historico}</Tag>;
  return <Tag variant="positivo" style={PAR_SEGMENTO[seg]}>{ROTULO_SEGMENTO[seg]}</Tag>;
}

export function ConteudoAlunoB2c({ email, mostrarToast }: { email: string; mostrarToast: (t: string) => void }) {
  const navigate = useNavigate();
  const me = useMe();
  const detalhe = useAlunoDetalhe(email);
  const simulados = useSimuladosMentor();
  const alunos = useAlunos();
  const convites = useConvites();
  const registrar = useRegistrarEvento();
  const liberar = useLiberarAgenda();
  const desligar = useDesligarAgenda();
  const [erroAcao, setErroAcao] = React.useState<string | null>(null);
  const [erroAgenda, setErroAgenda] = React.useState<string | null>(null);

  if (detalhe.isError) {
    const e = detalhe.error;
    if (e instanceof ErroFonte && (e.code === 'aluno_fora_da_tribo' || e.status === 404)) {
      return (
        <div className="p-6">
          <TituloOculto titulo="Aluno" descricao="Detalhes do aluno" />
          <EstadoVazio titulo="Aluno não encontrado" descricao={mensagemErro(e)} glifo="groups" />
        </div>
      );
    }
    return (
      <div className="p-6 pt-16">
        <TituloOculto titulo="Aluno" descricao="Detalhes do aluno" />
        <EstadoErro titulo="Não foi possível carregar o aluno." descricao={mensagemErro(e)} tentandoNovamente={detalhe.isFetching} onRetry={detalhe.refetch} />
      </div>
    );
  }
  const d = detalhe.data;
  if (!d || !me.data) return <SkeletonDrawer />;
  const aluno = d.aluno;
  if (!aluno) {
    return (
      <div className="p-6">
        <TituloOculto titulo="Aluno" descricao="Detalhes do aluno" />
        <EstadoVazio titulo="Aluno não encontrado" descricao="Este aluno não está na sua turma." glifo="groups" />
      </div>
    );
  }

  const nome = aluno.nome?.trim() || aluno.email;
  const primeiro = primeiroNome(nome);
  const tribos = me.data.tribos.filter((t) => t.modalidade === 'b2c');
  const tribo = tribos.find((t) => t.papel === 'titular') ?? tribos[0];
  const triboId = tribo ? triboIdDoSlug(tribo.slug) : null;
  const icone = tribo?.iconeUrl ?? (triboId ? ICONES_TRIBO[triboId] : null);
  const realizados = simulados.data?.filter((s) => s.status === 'realizado').length;
  const comSimulado = realizados === undefined ? d.notas.length > 0 : realizados > 0;
  const feitas = ordenarNotas(d.notas);
  const participacao = !comSimulado
    ? `último acesso ${formatUltimoAcesso(aluno.diasSemAtividade)}`
    : realizados === undefined ? `participou de ${feitas.length} simulados` : `participou de ${feitas.length} de ${realizados} simulados`;
  const meta = aluno.meta ? `${aluno.meta.instituicao} · ${aluno.meta.cortePct}%` : 'Aguardando Metas';
  const alunoFonte = alunos.data?.find((a) => a.email.toLowerCase() === aluno.email.toLowerCase());
  const alunoId = alunoFonte?.alunoId ?? aluno.email;
  const convite = convites.data?.find((c) => c.ativo !== false && (c.alunoId === alunoId || c.alunoId.toLowerCase() === aluno.email.toLowerCase()));
  const liberadaDesde = d.liberacao?.ligado ? d.liberacao.desde : convite?.liberadoEm ?? null;
  const whats = linkWhatsAppAluno(aluno.telefone, `Oi, ${primeiro}! Aqui é seu mentor.`);
  const q30 = aluno.questoes30d.respondidas;
  const consumo = [
    { rotulo: 'Questões feitas', valor: formatContagem(q30) },
    { rotulo: 'Acerto em questões', valor: formatAcertoQuestoes(aluno.questoes30d.pctAcerto, q30) },
    { rotulo: 'Aulas assistidas', valor: formatContagem(aluno.conteudos30d.videos) },
    { rotulo: 'PDFs', valor: formatContagem(aluno.conteudos30d.documentos) },
  ];

  const abrirWhats = () => {
    setErroAcao(null);
    registrar.mutate({ tipo: 'whatsapp_aberto', alunoId }, {
      onSuccess: () => mostrarToast('WhatsApp aberto em nova aba · registrado no log'),
      onError: (e) => setErroAcao(mensagemErro(e)),
    });
  };
  const criarIntervencao = () => {
    setErroAcao(null);
    registrar.mutate({ tipo: 'intervencao_aluno', alunoId, alunoNome: nome, perfil: null }, {
      onSuccess: () => mostrarToast('Intervenção criada em A fazer'),
      onError: (e) => setErroAcao(mensagemErro(e)),
    });
  };
  const liberarAgenda = async (mensagem: string) => {
    setErroAgenda(null);
    try {
      await liberar.mutateAsync({ aluno: { alunoId, nome }, titulo: 'Agendamento liberado', mensagem });
      mostrarToast(`Agenda liberada para ${primeiro}. "Reunião individual" entrou em A fazer.`);
      return true;
    } catch (e) {
      setErroAgenda(mensagemErro(e));
      if (tratamentoErro(e) === 'recarregar') { detalhe.refetch(); void convites.refetch(); }
      return false;
    }
  };
  const desligarAgenda = () => {
    setErroAgenda(null);
    if (!convite) { setErroAgenda(mensagemErro(null)); return; }
    desligar.mutate(convite.id, {
      onSuccess: () => mostrarToast('Agendamento desligado'),
      onError: (e) => setErroAgenda(mensagemErro(e)),
    });
  };

  return (
    <>
      <CabecalhoAluno
        nome={nome}
        linha={<>{icone && <img src={icone} alt="" className="h-auto w-5" />}{tribo ? `Tribo ${tribo.nome} · ` : ''}{participacao}</>}
        tags={<TagSegmento notas={feitas} aluno={aluno} comSimulado={comSimulado} />}
        acoes={<>
          <AcaoWhatsApp href={whats} onAbrir={abrirWhats} />
          <LinkAcao icone="campaign" to={`/mentor/mural?para=${encodeURIComponent(aluno.email)}`}>Mensagem no mural</LinkAcao>
          <BotaoAcao icone="add" onClick={criarIntervencao} disabled={registrar.isPending}>Criar intervenção</BotaoAcao>
        </>}
        erroAcao={erroAcao}
      >
        <DadosAluno itens={[
          { rotulo: 'Telefone', valor: formatTelefone(aluno.telefone) },
          { rotulo: 'Acesso até', valor: formatMesAno(aluno.acessoAte) },
          { rotulo: 'Meta mais difícil', valor: meta },
        ]} />
      </CabecalhoAluno>
      <CorpoDrawer>
        <AgendaIndividual
          liberadaDesde={liberadaDesde}
          temAgenda={!!me.data.mentor.agendaUrl}
          enviando={liberar.isPending}
          desligando={desligar.isPending}
          erro={erroAgenda}
          onLiberar={liberarAgenda}
          onDesligar={desligarAgenda}
          onLimparErro={() => setErroAgenda(null)}
        />
        <ConsumoFlix itens={consumo} />
        <NotasSimulados
          notas={comSimulado ? d.notas : []}
          cortePct={aluno.meta?.cortePct ?? null}
          onAbrir={(id) => navigate(`/mentor/detalhamento?s=${encodeURIComponent(id)}`)}
        />
        {comSimulado && feitas.length > 0 && <DesempenhoArea areas={d.areas} />}
        <LogInteracoes itens={montarLog(d.intervencoes, d.log)} />
      </CorpoDrawer>
    </>
  );
}
