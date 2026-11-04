/**
 * Hooks de dados do Portal do Mentor (docs/handoff/mentor/IMPLEMENTACAO.md § Fontes de dados).
 * As telas consomem SÓ estes hooks. Flix = `fonteAtiva()` (academy | flix | mock); DAG e kanban =
 * `dadosAtivos()` (Academy, ou o mock quando `VITE_MENTOR_FONTE=mock`). O recorte é sempre a turma do
 * mentor logado; `triboId` sai de `useMe()` (primeira tribo) e nenhum hook recebe lista de alunos.
 *
 * Retornos: hooks "Flix" e "Academy" devolvem `UseQueryResult`/`UseMutationResult`; hooks de DAG
 * devolvem `ResultadoMentor<T>` (= `ResultadoGestor<T>` + `error`), com `data` e `meta` separados
 * (B2C: `meta` undefined — as RPCs do mentor não têm envelope; B2B: repassa o `meta` do envelope).
 * Erros: `ErroFonte` → `mensagemErro(e)` / `tratamentoErro(e)` de `erros.ts`.
 *
 * ── Shell ──
 * useMe()                                   mentor, tribos/turma e toggle portalMentor
 * useContagensNav()                         badges: cards "A fazer" e (B2B) rotina de hoje pendente
 * useTriboId()                              id da turma do mentor (para chaves; telas raramente precisam)
 * ── Flix (alunos, mural, sessões, convites, canais) ──
 * useAlunos(busca?)                         AlunoFlix[] da turma (busca local por nome/e-mail)
 * useAluno(alunoId)                         AlunoFlix (contato, acesso, meta); null → desligado
 * useCanais()                               CanalTurma[] (avisos, plantão, grupo da turma)
 * useSalvarGrupoTribo()                     mutate(url) → link do grupo da tribo
 * useMural(filtro?)                         Pagina<Publicacao> ({ status?, tag? })
 * usePublicar()                             mutate({ pub, registrarIntervencao, descricaoDestino? }) — composta
 * useEditarPublicacao()                     mutate({ id, mudancas })
 * useExcluirPublicacao()                    mutate(id)
 * useSessoes(filtro?)                       Pagina<Sessao> ({ de?, ate?, status?, tipo? })
 * useCriarSessao()                          mutate({ sessao, alunoNome? }) — composta; devolve warnings
 * useEditarSessao()                         mutate({ id, mudancas }) (link, pauta, tema, data)
 * useMarcarRealizada()                      mutate(sessaoId) — composta
 * useExcluirSessao()                        mutate(id) (só futura e agendada)
 * useVincularGravacao()                     mutate({ id, url, duracaoSeg? })
 * useConvites()                             ConviteFlix[] (agendas liberadas)
 * useLiberarAgenda()                        mutate({ aluno: { alunoId, nome }, titulo, mensagem }) — composta
 * useDesligarAgenda()                       mutate(conviteId)
 * useAtualizarPerfil()                      mutate({ agendaUrl?, fotoUrl? })
 * ── DAG B2C ──
 * useSimuladosMentor()                      SimuladoMentor[] publicados (para o seletor)
 * useDesempenhoTurma(simulados)             DesempenhoTurmaB2c (null/[] = todos)
 * useSerieTurma(simulados)                  PontoSerieTurma[] por simulado
 * useEngajamentoTurma(semanas = 8)          EngajamentoAluno[] semana a semana
 * useTemasTurma(simulados)                  TemaTurmaMentor[] (prevalência pode ser null)
 * useDetalhamento(simulados, emails?)       DetalhamentoMentor (áreas, questões, bloqueados)
 * useQuestao(questaoId, simulados)          QuestaoMentor com quem marcou cada alternativa
 * useAlunoDetalhe(email)                    AlunoDetalheB2c (drawer: aluno, notas, consumo, questões, log)
 * useTurmaAcademy()                         AlunoTurmaAcademy[] (segmento, consumo e questões 7/30 dias)
 * ── DAG B2B ──
 * useVisaoGeralB2b(periodo)                 VisaoGeralB2b (conceito/TRI projetados + observados)
 * useAlunosB2b(periodo)                     AlunoB2b[] (proficiências, perfil, grupo)
 * useTemasTurmaB2b(periodo)                 TemaTurmaMentor[]
 * useDetalhamentoB2b(simulados)             DetalhamentoB2b
 * useQuestoesB2b(simulados)                 QuestaoResumoMentor[]
 * useRespondentesB2b(questaoId, simulados)  RespondenteB2b[] (quem marcou)
 * useCronogramaB2b()                        SimuladoMentor[] do contrato
 * useAlunoB2b(email)                        AlunoB2bDetalhe (drawer B2B)
 * ── Academy (kanban, rotina, sinalizações, pérolas) ──
 * useIntervencoes(periodo?)                 QuadroIntervencoes ({ de, ate } em YYYY-MM-DD)
 * useCriarIntervencao()                     mutate(NovaIntervencaoManual)
 * useAtualizarIntervencao()                 mutate({ id, titulo?, nota?, status? })
 * useComentarIntervencao()                  mutate({ id, texto })
 * useRegistrarEvento()                      mutate(EventoMentor) (tema/questão, aluno, WhatsApp, status)
 * useRotina(semana)                         ItemRotinaAcademy[] (B2B; semana = segunda YYYY-MM-DD)
 * useMarcarRotinaEnviada()                  mutate(id)
 * useSinalizarIes()                         mutate({ email, motivo }) (B2B)
 * usePerolas()                              Perola[] (B2B)
 * useSalvarPerola()                         mutate({ texto, tema? }) (B2B)
 */
import { useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { GESTOR_STALE_TIME, type ResultadoGestor } from '@/features/gestor/api/queries';
import type { EventoMentor } from '../lib/eventosIntervencao';
import { dadosAtivos, fonteAtiva } from './ativa';
import { ErroFonte, type AlunoFlix, type ConviteFlix, type FonteMentoria, type MeFlix, type NovaPublicacao, type NovaSessao, type Pagina } from './fonte';
import { dataHoraSp, eventoParaSql, type ComMeta, type DadosAcademy } from './fonteAcademy';
import type {
  AlunoB2b,
  AlunoB2bDetalhe,
  AlunoDetalheB2c,
  AlunoTurmaAcademy,
  CanalTurma,
  DesempenhoTurmaB2c,
  DetalhamentoB2b,
  DetalhamentoMentor,
  EngajamentoAluno,
  ItemRotinaAcademy,
  NovaIntervencaoManual,
  PeriodoB2b,
  PeriodoIntervencoes,
  Perola,
  PontoSerieTurma,
  Publicacao,
  QuadroIntervencoes,
  QuestaoMentor,
  QuestaoResumoMentor,
  RespondenteB2b,
  Sessao,
  SimuladoMentor,
  StatusIntervencao,
  TemaTurmaMentor,
  VisaoGeralB2b,
} from './types';

// ─── Chaves ─────────────────────────────────────────────────────────────────

const ord = (s: readonly string[] | null | undefined) => (s && s.length ? [...s].sort() : null);
const PERIODO_TODO: PeriodoIntervencoes = { de: null, ate: null };

export const chavesMentor = {
  raiz: ['mentor'] as const,
  me: ['mentor', 'me'] as const,
  contagensNav: ['mentor', 'contagens-nav'] as const,
  alunos: (t: string) => ['mentor', 'alunos', t] as const,
  aluno: (t: string, id: string) => ['mentor', 'aluno', t, id] as const,
  canais: (t: string) => ['mentor', 'canais', t] as const,
  mural: (t: string, f?: { status?: string; tag?: string }) => ['mentor', 'mural', t, f?.status ?? null, f?.tag ?? null] as const,
  sessoes: (t: string, f?: { de?: string; ate?: string; status?: string; tipo?: string }) =>
    ['mentor', 'sessoes', t, f?.de ?? null, f?.ate ?? null, f?.status ?? null, f?.tipo ?? null] as const,
  convites: (t: string) => ['mentor', 'convites', t] as const,
  turma: ['mentor', 'dag', 'turma'] as const,
  desempenho: (s: readonly string[] | null) => ['mentor', 'dag', 'desempenho', ord(s)] as const,
  serie: (s: readonly string[] | null) => ['mentor', 'dag', 'serie', ord(s)] as const,
  engajamento: (semanas: number) => ['mentor', 'dag', 'engajamento', semanas] as const,
  temas: (s: readonly string[] | null) => ['mentor', 'dag', 'temas', ord(s)] as const,
  detalhamento: (s: readonly string[], emails?: readonly string[] | null) => ['mentor', 'dag', 'detalhamento', ord(s), ord(emails)] as const,
  questao: (id: string, s: readonly string[] | null) => ['mentor', 'dag', 'questao', id, ord(s)] as const,
  alunoDetalhe: (email: string) => ['mentor', 'dag', 'aluno-detalhe', email] as const,
  visaoGeralB2b: (p: PeriodoB2b) => ['mentor', 'dag', 'b2b', 'visao-geral', p] as const,
  alunosB2b: (p: PeriodoB2b) => ['mentor', 'dag', 'b2b', 'alunos', p] as const,
  temasB2b: (p: PeriodoB2b) => ['mentor', 'dag', 'b2b', 'temas', p] as const,
  detalhamentoB2b: (s: readonly string[]) => ['mentor', 'dag', 'b2b', 'detalhamento', ord(s)] as const,
  questoesB2b: (s: readonly string[]) => ['mentor', 'dag', 'b2b', 'questoes', ord(s)] as const,
  respondentesB2b: (id: string, s: readonly string[]) => ['mentor', 'dag', 'b2b', 'respondentes', id, ord(s)] as const,
  cronogramaB2b: ['mentor', 'dag', 'b2b', 'cronograma'] as const,
  alunoB2b: (email: string) => ['mentor', 'dag', 'b2b', 'aluno', email] as const,
  intervencoes: (p: PeriodoIntervencoes = PERIODO_TODO) => ['mentor', 'intervencoes', p.de, p.ate] as const,
  rotina: (semana: string) => ['mentor', 'rotina', semana] as const,
  perolas: ['mentor', 'perolas'] as const,
};

/** Prefixos para invalidação (cobrem qualquer tribo/filtro). */
const P = {
  me: chavesMentor.me,
  nav: chavesMentor.contagensNav,
  alunos: ['mentor', 'alunos'],
  canais: ['mentor', 'canais'],
  mural: ['mentor', 'mural'],
  sessoes: ['mentor', 'sessoes'],
  convites: ['mentor', 'convites'],
  intervencoes: ['mentor', 'intervencoes'],
  alunoDetalhe: ['mentor', 'dag', 'aluno-detalhe'],
  b2bAlunos: ['mentor', 'dag', 'b2b', 'alunos'],
  b2bAluno: ['mentor', 'dag', 'b2b', 'aluno'],
  rotina: ['mentor', 'rotina'],
  perolas: chavesMentor.perolas,
} as const;
function invalidar(qc: QueryClient, ...prefixos: readonly (readonly unknown[])[]) {
  return Promise.all(prefixos.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })));
}

/** Alunos "em tempo real" (22/10): cache curto. */
const STALE_OPERACIONAL = 60_000;

// ─── Shell ──────────────────────────────────────────────────────────────────

/** Mentor logado, suas tribos/turmas e o toggle `portalMentor`. */
export function useMe(): UseQueryResult<MeFlix> {
  return useQuery({
    queryKey: chavesMentor.me,
    queryFn: (): Promise<MeFlix> => fonteAtiva().me(),
    staleTime: GESTOR_STALE_TIME,
  });
}

/** Id da turma do mentor logado (primeira tribo de `useMe`). */
export function useTriboId(): string | undefined {
  return useMe().data?.tribos[0]?.id;
}
function useModalidade(): 'b2c' | 'b2b' | undefined {
  return useMe().data?.mentor.modalidade;
}

export interface ContagensNav {
  /** Cards em "A fazer" no kanban (badge de Intervenções). `null` = sem dado. */
  intervencoesAFazer: number | null;
  /** B2B: itens da rotina de hoje ainda não enviados (badge de Canais). `null` no B2C. */
  canaisPendentes: number | null;
}

const DIA_ROTINA: Record<string, ItemRotinaAcademy['dia'] | undefined> = { Tue: 'ter', Thu: 'qui', Fri: 'sex' };
/** Hoje em São Paulo: dia da rotina (ter/qui/sex ou null) e a segunda-feira da semana. */
export function hojeRotina(agora: Date = new Date()): { dia: ItemRotinaAcademy['dia'] | null; semana: string } {
  const { data } = dataHoraSp(agora.toISOString());
  const semanaDia = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(agora);
  const isoDow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(semanaDia) + 1;
  const seg = new Date(`${data}T12:00:00Z`);
  seg.setUTCDate(seg.getUTCDate() - (isoDow - 1));
  return { dia: DIA_ROTINA[semanaDia] ?? null, semana: seg.toISOString().slice(0, 10) };
}

/** Badges da navegação: só aparecem com pendência real (docs/01 § Shell). */
export function useContagensNav(): UseQueryResult<ContagensNav> {
  const qc = useQueryClient();
  return useQuery({
    queryKey: chavesMentor.contagensNav,
    queryFn: async (): Promise<ContagensNav> => {
      const dados = dadosAtivos();
      const me = await qc.fetchQuery({ queryKey: chavesMentor.me, queryFn: () => fonteAtiva().me(), staleTime: GESTOR_STALE_TIME });
      const quadro = await qc.fetchQuery({ queryKey: chavesMentor.intervencoes(PERIODO_TODO), queryFn: () => dados.intervencoes(PERIODO_TODO) });
      const intervencoesAFazer = quadro.cards.filter((c) => c.status === 'afazer').length;
      if (me.mentor.modalidade !== 'b2b') return { intervencoesAFazer, canaisPendentes: null };
      const { dia, semana } = hojeRotina();
      if (!dia) return { intervencoesAFazer, canaisPendentes: 0 };
      const rotina = await qc.fetchQuery({ queryKey: chavesMentor.rotina(semana), queryFn: () => dados.rotina(semana) });
      return { intervencoesAFazer, canaisPendentes: rotina.filter((r) => r.dia === dia && r.enviadoEm == null).length };
    },
  });
}

// ─── Mutations compostas (exportadas para teste) ────────────────────────────

export interface CtxComposto {
  fonte: FonteMentoria;
  dados: Pick<DadosAcademy, 'registrarEvento'>;
  /** alunoId da fonte → e-mail do Academy. Só é chamado quando a fonte não grava o evento. */
  resolverEmails: () => Promise<(alunoId: string) => string>;
}

/** Mural: fonte primeiro; se a fonte não grava o card e o mentor pediu, `mural_publicado` depois. */
export async function publicarComposto(
  ctx: CtxComposto, triboId: string,
  entrada: { pub: NovaPublicacao; registrarIntervencao: boolean; descricaoDestino?: string },
): Promise<Publicacao> {
  const criada = await ctx.fonte.criarPublicacao(triboId, { ...entrada.pub, registrarIntervencao: entrada.registrarIntervencao });
  if (!ctx.fonte.eventosNoServidor && entrada.pub.status === 'publicada' && entrada.registrarIntervencao) {
    const emailDe = await ctx.resolverEmails();
    await ctx.dados.registrarEvento(eventoParaSql({ tipo: 'mural_publicado', publicacao: criada, registrarIntervencao: true, descricaoDestino: entrada.descricaoDestino ?? '' }, { emailDe }));
  }
  return criada;
}

/** Agenda: convite na fonte; depois `agenda_liberada` (referência = id do convite). */
export async function liberarAgendaComposto(
  ctx: CtxComposto, triboId: string,
  entrada: { aluno: Pick<AlunoFlix, 'alunoId' | 'nome'>; titulo: string; mensagem: string },
): Promise<ConviteFlix> {
  const convite = await ctx.fonte.liberarAgenda(triboId, entrada.aluno.alunoId, { titulo: entrada.titulo, mensagem: entrada.mensagem });
  if (!ctx.fonte.eventosNoServidor) {
    const emailDe = await ctx.resolverEmails();
    await ctx.dados.registrarEvento(eventoParaSql({ tipo: 'agenda_liberada', alunoId: entrada.aluno.alunoId, alunoNome: entrada.aluno.nome }, { referenciaId: convite.id, emailDe }));
  }
  return convite;
}

/** Sessão: cria na fonte; depois `sessao_criada`. `warnings` (ex.: acima_do_contrato) é aviso não bloqueante. */
export async function criarSessaoComposto(
  ctx: CtxComposto, triboId: string, entrada: { sessao: NovaSessao; alunoNome?: string },
): Promise<Sessao & { warnings: string[] }> {
  const criada = await ctx.fonte.criarSessao(triboId, entrada.sessao);
  if (!ctx.fonte.eventosNoServidor) {
    const emailDe = await ctx.resolverEmails();
    await ctx.dados.registrarEvento(eventoParaSql({ tipo: 'sessao_criada', sessao: criada, alunoNome: entrada.alunoNome }, { emailDe }));
  }
  return criada;
}

/** Realizada: status na fonte; depois `sessao_realizada` (move o card para Feito). */
export async function marcarRealizadaComposto(ctx: CtxComposto, triboId: string, sessaoId: string): Promise<Sessao> {
  const sessao = await ctx.fonte.editarSessao(sessaoId, { status: 'realizada' });
  if (!ctx.fonte.eventosNoServidor) {
    const emailDe = await ctx.resolverEmails();
    await ctx.dados.registrarEvento(eventoParaSql({ tipo: 'sessao_realizada', sessao }, { emailDe }));
  }
  return sessao;
}

function exigirTribo(triboId: string | undefined): string {
  if (!triboId) throw new ErroFonte(403, 'sem_acesso_tribo', 'Turma do mentor ainda não carregada.');
  return triboId;
}

/** Contexto das mutations compostas a partir do cache: e-mails resolvidos pela lista de alunos da fonte. */
function useCtxComposto(): { ctx: () => CtxComposto; triboId: string | undefined; qc: QueryClient } {
  const qc = useQueryClient();
  const triboId = useTriboId();
  const ctx = (): CtxComposto => {
    const fonte = fonteAtiva();
    return {
      fonte,
      dados: dadosAtivos(),
      resolverEmails: async () => {
        const t = exigirTribo(triboId);
        const alunos = await qc.fetchQuery({ queryKey: chavesMentor.alunos(t), queryFn: () => fonte.alunos(t), staleTime: STALE_OPERACIONAL });
        const mapa = new Map(alunos.map((a) => [a.alunoId, a.email]));
        return (id: string) => mapa.get(id) ?? id;
      },
    };
  };
  return { ctx, triboId, qc };
}

// ─── Flix ───────────────────────────────────────────────────────────────────

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function useAlunos(busca?: string): UseQueryResult<AlunoFlix[]> {
  const triboId = useTriboId();
  const q = busca ? normalizar(busca) : '';
  return useQuery({
    queryKey: chavesMentor.alunos(triboId ?? ''),
    enabled: !!triboId,
    staleTime: STALE_OPERACIONAL,
    queryFn: () => fonteAtiva().alunos(triboId!),
    select: q ? (lista: AlunoFlix[]) => lista.filter((a) => normalizar(a.nome).includes(q) || normalizar(a.email).includes(q)) : undefined,
  });
}

export function useAluno(alunoId: string | null | undefined): UseQueryResult<AlunoFlix> {
  const triboId = useTriboId();
  return useQuery({
    queryKey: chavesMentor.aluno(triboId ?? '', alunoId ?? ''),
    enabled: !!triboId && !!alunoId,
    staleTime: STALE_OPERACIONAL,
    queryFn: () => fonteAtiva().aluno(triboId!, alunoId!),
  });
}

export function useCanais(): UseQueryResult<CanalTurma[]> {
  const triboId = useTriboId();
  return useQuery({ queryKey: chavesMentor.canais(triboId ?? ''), enabled: !!triboId, queryFn: () => fonteAtiva().canais(triboId!) });
}

export function useSalvarGrupoTribo() {
  const { triboId, qc } = useCtxComposto();
  return useMutation({
    mutationFn: (url: string) => fonteAtiva().salvarGrupoTribo(exigirTribo(triboId), url),
    onSuccess: () => invalidar(qc, P.canais),
  });
}

export function useMural(filtro?: { status?: string; tag?: string }): UseQueryResult<Pagina<Publicacao>> {
  const triboId = useTriboId();
  return useQuery({ queryKey: chavesMentor.mural(triboId ?? '', filtro), enabled: !!triboId, queryFn: () => fonteAtiva().publicacoes(triboId!, filtro) });
}

export function usePublicar() {
  const { ctx, triboId, qc } = useCtxComposto();
  return useMutation({
    mutationFn: (entrada: { pub: NovaPublicacao; registrarIntervencao: boolean; descricaoDestino?: string }) =>
      publicarComposto(ctx(), exigirTribo(triboId), entrada),
    onSuccess: () => invalidar(qc, P.mural, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useEditarPublicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mudancas }: { id: string; mudancas: Partial<NovaPublicacao> }) => fonteAtiva().editarPublicacao(id, mudancas),
    onSuccess: () => invalidar(qc, P.mural, P.intervencoes, P.nav),
  });
}

export function useExcluirPublicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fonteAtiva().excluirPublicacao(id),
    onSuccess: () => invalidar(qc, P.mural),
  });
}

export function useSessoes(filtro?: { de?: string; ate?: string; status?: string; tipo?: string }): UseQueryResult<Pagina<Sessao>> {
  const triboId = useTriboId();
  return useQuery({ queryKey: chavesMentor.sessoes(triboId ?? '', filtro), enabled: !!triboId, queryFn: () => fonteAtiva().sessoes(triboId!, filtro) });
}

export function useCriarSessao() {
  const { ctx, triboId, qc } = useCtxComposto();
  return useMutation({
    mutationFn: (entrada: { sessao: NovaSessao; alunoNome?: string }) => criarSessaoComposto(ctx(), exigirTribo(triboId), entrada),
    onSuccess: () => invalidar(qc, P.sessoes, P.intervencoes, P.mural, P.nav, P.alunoDetalhe),
  });
}

export function useEditarSessao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mudancas }: { id: string; mudancas: Partial<NovaSessao> }) => fonteAtiva().editarSessao(id, mudancas),
    onSuccess: () => invalidar(qc, P.sessoes, P.intervencoes, P.mural),
  });
}

export function useMarcarRealizada() {
  const { ctx, triboId, qc } = useCtxComposto();
  return useMutation({
    mutationFn: (sessaoId: string) => marcarRealizadaComposto(ctx(), exigirTribo(triboId), sessaoId),
    onSuccess: () => invalidar(qc, P.sessoes, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useExcluirSessao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fonteAtiva().excluirSessao(id),
    onSuccess: () => invalidar(qc, P.sessoes, P.mural, P.intervencoes),
  });
}

export function useVincularGravacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, url, duracaoSeg }: { id: string; url: string; duracaoSeg?: number }) => fonteAtiva().vincularGravacao(id, { url, duracaoSeg }),
    onSuccess: () => invalidar(qc, P.sessoes, P.intervencoes, P.nav),
  });
}

export function useConvites(): UseQueryResult<ConviteFlix[]> {
  const triboId = useTriboId();
  return useQuery({ queryKey: chavesMentor.convites(triboId ?? ''), enabled: !!triboId, queryFn: () => fonteAtiva().convites(triboId!) });
}

export function useLiberarAgenda() {
  const { ctx, triboId, qc } = useCtxComposto();
  return useMutation({
    mutationFn: (entrada: { aluno: Pick<AlunoFlix, 'alunoId' | 'nome'>; titulo: string; mensagem: string }) =>
      liberarAgendaComposto(ctx(), exigirTribo(triboId), entrada),
    onSuccess: () => invalidar(qc, P.convites, P.mural, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useDesligarAgenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conviteId: string) => fonteAtiva().desligarAgenda(conviteId),
    onSuccess: () => invalidar(qc, P.convites, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useAtualizarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<{ fotoUrl: string; agendaUrl: string }>) => fonteAtiva().atualizarPerfil(p),
    onSuccess: (mentor) => {
      qc.setQueryData<MeFlix>(chavesMentor.me, (atual) => (atual ? { ...atual, mentor } : atual));
      return invalidar(qc, P.me);
    },
  });
}

// ─── DAG (B2C e B2B) ────────────────────────────────────────────────────────

/** Resultado dos hooks de DAG: mesmo formato do Gestor (data e meta separados) + o erro para `mensagemErro`. */
export type ResultadoMentor<T> = ResultadoGestor<T> & { error: unknown };

function useDag<T, R = T>(
  queryKey: readonly unknown[],
  queryFn: (d: DadosAcademy) => Promise<ComMeta<T>>,
  opcoes: { enabled?: boolean; manterAnterior?: boolean; select?: (d: T) => R } = {},
): ResultadoMentor<R> {
  const q = useQuery({
    queryKey: [...queryKey],
    enabled: opcoes.enabled ?? true,
    staleTime: GESTOR_STALE_TIME,
    queryFn: () => queryFn(dadosAtivos()),
    placeholderData: opcoes.manterAnterior === false ? undefined : (anterior: ComMeta<T> | undefined) => anterior,
  });
  const bruto = q.data?.data;
  return {
    data: bruto === undefined ? undefined : opcoes.select ? opcoes.select(bruto) : (bruto as unknown as R),
    meta: q.data?.meta ?? undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    isPlaceholderData: q.isPlaceholderData,
    isFetching: q.isFetching,
    refetch: () => { void q.refetch(); },
    error: q.error,
  };
}

/** Simulados publicados (mesma consulta de `useDesempenhoTurma(null)`, sem chamada extra). */
export function useSimuladosMentor(): ResultadoMentor<SimuladoMentor[]> {
  return useDag<DesempenhoTurmaB2c, SimuladoMentor[]>(chavesMentor.desempenho(null), (d) => d.desempenhoTurma(null), { select: (x) => x.simulados });
}
export function useDesempenhoTurma(simulados: string[] | null): ResultadoMentor<DesempenhoTurmaB2c> {
  return useDag(chavesMentor.desempenho(simulados), (d) => d.desempenhoTurma(simulados));
}
export function useSerieTurma(simulados: string[] | null): ResultadoMentor<PontoSerieTurma[]> {
  return useDag(chavesMentor.serie(simulados), (d) => d.serieTurma(simulados));
}
export function useEngajamentoTurma(semanas = 8): ResultadoMentor<EngajamentoAluno[]> {
  return useDag(chavesMentor.engajamento(semanas), (d) => d.engajamentoTurma(semanas));
}
export function useTemasTurma(simulados: string[] | null): ResultadoMentor<TemaTurmaMentor[]> {
  return useDag(chavesMentor.temas(simulados), (d) => d.temasTurma(simulados));
}
export function useDetalhamento(simulados: string[], emails?: string[] | null): ResultadoMentor<DetalhamentoMentor> {
  return useDag(chavesMentor.detalhamento(simulados, emails), (d) => d.detalhamento(simulados, emails), { enabled: simulados.length > 0 });
}
export function useQuestao(questaoId: string | null | undefined, simulados: string[] | null): ResultadoMentor<QuestaoMentor> {
  return useDag(chavesMentor.questao(questaoId ?? '', simulados), (d) => d.questao(questaoId!, simulados), { enabled: !!questaoId, manterAnterior: false });
}
export function useAlunoDetalhe(email: string | null | undefined): ResultadoMentor<AlunoDetalheB2c> {
  return useDag(chavesMentor.alunoDetalhe(email ?? ''), (d) => d.alunoDetalhe(email!), { enabled: !!email, manterAnterior: false });
}
export function useTurmaAcademy(): ResultadoMentor<AlunoTurmaAcademy[]> {
  return useDag(chavesMentor.turma, (d) => d.turma());
}

// B2B: só dispara para mentor B2B (as RPCs recusam B2C).
export function useVisaoGeralB2b(periodo: PeriodoB2b): ResultadoMentor<VisaoGeralB2b> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.visaoGeralB2b(periodo), (d) => d.visaoGeralB2b(periodo), { enabled: b2b });
}
export function useAlunosB2b(periodo: PeriodoB2b): ResultadoMentor<AlunoB2b[]> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.alunosB2b(periodo), (d) => d.alunosB2b(periodo), { enabled: b2b });
}
export function useTemasTurmaB2b(periodo: PeriodoB2b): ResultadoMentor<TemaTurmaMentor[]> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.temasB2b(periodo), (d) => d.temasTurmaB2b(periodo), { enabled: b2b });
}
export function useDetalhamentoB2b(simulados: string[]): ResultadoMentor<DetalhamentoB2b> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.detalhamentoB2b(simulados), (d) => d.detalhamentoB2b(simulados), { enabled: b2b && simulados.length > 0 });
}
export function useQuestoesB2b(simulados: string[]): ResultadoMentor<QuestaoResumoMentor[]> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.questoesB2b(simulados), (d) => d.questoesB2b(simulados), { enabled: b2b && simulados.length > 0 });
}
export function useRespondentesB2b(questaoId: string | null | undefined, simulados: string[]): ResultadoMentor<RespondenteB2b[]> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.respondentesB2b(questaoId ?? '', simulados), (d) => d.respondentesB2b(questaoId!, simulados), { enabled: b2b && !!questaoId, manterAnterior: false });
}
export function useCronogramaB2b(): ResultadoMentor<SimuladoMentor[]> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.cronogramaB2b, (d) => d.cronogramaB2b(), { enabled: b2b });
}
export function useAlunoB2b(email: string | null | undefined): ResultadoMentor<AlunoB2bDetalhe> {
  const b2b = useModalidade() === 'b2b';
  return useDag(chavesMentor.alunoB2b(email ?? ''), (d) => d.alunoB2b(email!), { enabled: b2b && !!email, manterAnterior: false });
}

// ─── Academy: kanban, rotina, sinalizações, pérolas ─────────────────────────

export function useIntervencoes(periodo: PeriodoIntervencoes = PERIODO_TODO): UseQueryResult<QuadroIntervencoes> {
  return useQuery({ queryKey: chavesMentor.intervencoes(periodo), queryFn: () => dadosAtivos().intervencoes(periodo) });
}

export function useCriarIntervencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (n: NovaIntervencaoManual) => dadosAtivos().criarIntervencao(n),
    onSuccess: () => invalidar(qc, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useAtualizarIntervencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string; titulo?: string | null; nota?: string | null; status?: StatusIntervencao | null }) => dadosAtivos().atualizarIntervencao(id, p),
    onSuccess: () => invalidar(qc, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useComentarIntervencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) => dadosAtivos().comentarIntervencao(id, texto),
    onSuccess: () => invalidar(qc, P.intervencoes),
  });
}

/**
 * Eventos que só existem no Academy (intervenção por tema/questão, por aluno, WhatsApp aberto, mudança
 * de status). Para mural/agenda/sessão use as mutations compostas, nunca este hook.
 */
export function useRegistrarEvento() {
  const { ctx, qc } = useCtxComposto();
  return useMutation({
    mutationFn: async (evento: EventoMentor) => {
      const c = ctx();
      const precisaEmail = c.fonte.nome === 'flix' && (evento.tipo === 'intervencao_aluno' || evento.tipo === 'whatsapp_aberto');
      const emailDe = precisaEmail ? await c.resolverEmails() : undefined;
      return dadosAtivos().registrarEvento(eventoParaSql(evento, { emailDe }));
    },
    onSuccess: () => invalidar(qc, P.intervencoes, P.nav, P.alunoDetalhe),
  });
}

export function useRotina(semana: string): UseQueryResult<ItemRotinaAcademy[]> {
  const b2b = useModalidade() === 'b2b';
  return useQuery({ queryKey: chavesMentor.rotina(semana), enabled: b2b && !!semana, queryFn: () => dadosAtivos().rotina(semana) });
}

export function useMarcarRotinaEnviada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dadosAtivos().marcarRotinaEnviada(id),
    onSuccess: () => invalidar(qc, P.rotina, P.nav),
  });
}

export function useSinalizarIes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, motivo }: { email: string; motivo: string }) => dadosAtivos().sinalizarIes(email, motivo),
    onSuccess: () => invalidar(qc, P.b2bAlunos, P.b2bAluno, P.alunoDetalhe),
  });
}

export function usePerolas(): UseQueryResult<Perola[]> {
  const b2b = useModalidade() === 'b2b';
  return useQuery({ queryKey: chavesMentor.perolas, enabled: b2b, queryFn: () => dadosAtivos().perolas() });
}

export function useSalvarPerola() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ texto, tema }: { texto: string; tema?: string | null }) => dadosAtivos().salvarPerola(texto, tema ?? null),
    onSuccess: () => invalidar(qc, P.perolas),
  });
}
