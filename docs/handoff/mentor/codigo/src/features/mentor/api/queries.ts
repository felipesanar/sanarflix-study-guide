/**
 * Camada de dados do Mentor (react-query). Três fontes (docs/07 § Quem guarda o quê):
 *  1. Flix (API de Mentoria) → `flixClient.ts`: alunos, mural, sessões, convites, canais.
 *  2. DAGs via Supabase do Academy → `chamarRpcGestor`: desempenho e consumo.
 *     As RPCs abaixo são PROPOSTAS: devem reusar as funções SQL do Gestor
 *     recortadas por `p_aluno_ids` (os IDs vêm da lista do Flix).
 *  3. Supabase do Academy → kanban, log, rotina, sinalizações.
 *
 * Regra de ordem: ação que grava no Flix E gera card → Flix primeiro; se ok,
 * `registrar_evento_mentor`. Se o Flix falhar, nada é gravado no Academy.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chamarRpcGestor, GESTOR_STALE_TIME } from '@/features/gestor/api/queries';
import { flix, type AlunoFlix, type NovaPublicacao, type NovaSessao } from './flixClient';
import type { ConsumoAluno, Intervencao, ItemRotina, ResultadoAluno, TemaTurma } from './types';
import type { EventoMentor } from '../lib/eventosIntervencao';

const k = {
  me: ['mentor', 'me'] as const,
  alunos: (t: string) => ['mentor', 'alunos', t] as const,
  canais: (t: string) => ['mentor', 'canais', t] as const,
  mural: (t: string) => ['mentor', 'mural', t] as const,
  sessoes: (t: string) => ['mentor', 'sessoes', t] as const,
  convites: (t: string) => ['mentor', 'convites', t] as const,
  resultados: (t: string, s: string[]) => ['mentor', 'resultados', t, [...s].sort()] as const,
  temas: (t: string, s: string[]) => ['mentor', 'temas', t, [...s].sort()] as const,
  consumo: (t: string) => ['mentor', 'consumo', t] as const,
  intervencoes: (t: string) => ['mentor', 'intervencoes', t] as const,
  rotina: (t: string, sem: string) => ['mentor', 'rotina', t, sem] as const,
};

// ─── Flix ────────────────────────────────────────────────────────────────

export const useMe = () => useQuery({ queryKey: k.me, staleTime: GESTOR_STALE_TIME, queryFn: flix.me });

/** Em tempo real (22/10): sem cache longo; staleTime curto. */
export const useAlunos = (triboId?: string) =>
  useQuery({ queryKey: k.alunos(triboId ?? ''), enabled: !!triboId, staleTime: 60_000, queryFn: () => flix.alunos(triboId!) });

export const useCanais = (triboId?: string) =>
  useQuery({ queryKey: k.canais(triboId ?? ''), enabled: !!triboId, queryFn: () => flix.canais(triboId!) });

export const useMural = (triboId?: string) =>
  useQuery({ queryKey: k.mural(triboId ?? ''), enabled: !!triboId, queryFn: () => flix.publicacoes(triboId!) });

export const useSessoes = (triboId?: string) =>
  useQuery({ queryKey: k.sessoes(triboId ?? ''), enabled: !!triboId, queryFn: () => flix.sessoes(triboId!) });

export const useConvites = (triboId?: string) =>
  useQuery({ queryKey: k.convites(triboId ?? ''), enabled: !!triboId, queryFn: () => flix.convites(triboId!) });

// ─── DAGs (via Supabase) ────────────────────────────────────────────────

const ids = (alunos?: AlunoFlix[]) => (alunos ?? []).map((a) => a.alunoId);

export function useResultados(triboId: string | undefined, alunos: AlunoFlix[] | undefined, simulados: string[]) {
  return useQuery({
    queryKey: k.resultados(triboId ?? '', simulados),
    enabled: !!alunos?.length && simulados.length > 0,
    staleTime: GESTOR_STALE_TIME,
    queryFn: () => chamarRpcGestor<ResultadoAluno[]>('get_mentor_resultados', { p_aluno_ids: ids(alunos), p_simulados: simulados }),
  });
}

export function useTemasTurma(triboId: string | undefined, alunos: AlunoFlix[] | undefined, simulados: string[]) {
  return useQuery({
    queryKey: k.temas(triboId ?? '', simulados),
    enabled: !!alunos?.length && simulados.length > 0,
    staleTime: GESTOR_STALE_TIME,
    queryFn: () => chamarRpcGestor<TemaTurma[]>('get_mentor_temas', { p_aluno_ids: ids(alunos), p_simulados: simulados }),
  });
}

/** Questões, acerto em questões, aulas e PDFs nos últimos 30 dias (DAGs de questões e conteúdos). */
export function useConsumo(triboId: string | undefined, alunos: AlunoFlix[] | undefined) {
  return useQuery({
    queryKey: k.consumo(triboId ?? ''),
    enabled: !!alunos?.length,
    staleTime: GESTOR_STALE_TIME,
    queryFn: () => chamarRpcGestor<ConsumoAluno[]>('get_mentor_consumo', { p_aluno_ids: ids(alunos), p_dias: 30 }),
  });
}

// ─── Academy (Supabase) ─────────────────────────────────────────────────

export const useIntervencoes = (triboId?: string) =>
  useQuery({ queryKey: k.intervencoes(triboId ?? ''), enabled: !!triboId, queryFn: () => chamarRpcGestor<Intervencao[]>('get_mentor_intervencoes', { p_tribo_id: triboId }) });

export const useRotina = (triboId: string | undefined, semana: string) =>
  useQuery({ queryKey: k.rotina(triboId ?? '', semana), enabled: !!triboId, queryFn: () => chamarRpcGestor<ItemRotina[]>('get_mentor_rotina', { p_tribo_id: triboId, p_semana: semana }) });

const registrar = (triboId: string, evento: EventoMentor) => chamarRpcGestor('registrar_evento_mentor', { p_tribo_id: triboId, p_evento: evento });

// ─── Mutations compostas (Flix → evento no Academy) ─────────────────────

export function usePublicar(triboId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pub, registrarIntervencao, descricaoDestino }: { pub: NovaPublicacao; registrarIntervencao: boolean; descricaoDestino: string }) => {
      const criada = await flix.criarPublicacao(triboId, pub);
      if (pub.status === 'publicada' && registrarIntervencao) {
        await registrar(triboId, { tipo: 'mural_publicado', publicacao: criada, registrarIntervencao, descricaoDestino });
      }
      return criada;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k.mural(triboId) });
      qc.invalidateQueries({ queryKey: k.intervencoes(triboId) });
    },
  });
}

export function useLiberarAgenda(triboId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ aluno, titulo, mensagem }: { aluno: AlunoFlix; titulo: string; mensagem: string }) => {
      const convite = await flix.liberarAgenda(triboId, aluno.alunoId, { titulo, mensagem });
      await registrar(triboId, { tipo: 'agenda_liberada', alunoId: aluno.alunoId, alunoNome: aluno.nome });
      return convite;
    },
    onSuccess: () => ['convites', 'mural', 'intervencoes'].forEach((r) => qc.invalidateQueries({ queryKey: ['mentor', r, triboId] })),
  });
}

export function useCriarSessao(triboId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessao, alunoNome }: { sessao: NovaSessao; alunoNome?: string }) => {
      const criada = await flix.criarSessao(triboId, sessao);
      await registrar(triboId, { tipo: 'sessao_criada', sessao: criada, alunoNome });
      return criada; // `warnings` pode conter 'acima_do_contrato' (B2B) → aviso não bloqueante
    },
    onSuccess: () => ['sessoes', 'intervencoes', 'mural'].forEach((r) => qc.invalidateQueries({ queryKey: ['mentor', r, triboId] })),
  });
}

export function useMarcarRealizada(triboId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessaoId: string) => {
      await flix.editarSessao(sessaoId, { status: 'realizada' });
      await registrar(triboId, { tipo: 'sessao_realizada', sessaoId });
    },
    onSuccess: () => ['sessoes', 'intervencoes'].forEach((r) => qc.invalidateQueries({ queryKey: ['mentor', r, triboId] })),
  });
}

/** Ações só do Academy (intervenção manual, por tema, mudança de status). */
export function useRegistrarEvento(triboId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (evento: EventoMentor) => registrar(triboId, evento),
    onSuccess: () => qc.invalidateQueries({ queryKey: k.intervencoes(triboId) }),
  });
}
