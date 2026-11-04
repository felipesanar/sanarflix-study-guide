/**
 * Cliente da API de Mentoria do Flix (contrato: docs/07-integracao-flix.md
 * e a página do Notion "Contrato de API · Academy × Flix", v2.1).
 *
 * O browser NUNCA vê o token de serviço: as chamadas vão para a Edge Function
 * `flix-mentoria-proxy` (Supabase do Academy), que injeta `Authorization` e
 * `X-Mentor-Id` a partir do usuário autenticado e repassa ao proxy do Cloud.
 */
import { supabase } from '@/integrations/supabase/client'; // conferir o caminho do client no repo
import type { CanalTurma, Publicacao, Sessao } from './types';

export class ErroFlix extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function chamar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('flix-mentoria-proxy', {
    body: { metodo, caminho, corpo },
  });
  if (error) {
    // A Edge Function devolve o corpo de erro do Flix em `error.context`.
    const ctx = (error as { context?: { status?: number; body?: { error?: { code: string; message: string; field?: string } } } }).context;
    const e = ctx?.body?.error;
    throw new ErroFlix(ctx?.status ?? 500, e?.code ?? 'rede', e?.message ?? 'Não foi possível falar com o Flix.', e?.field);
  }
  return data as T;
}

interface Pagina<T> { data: T[]; nextCursor: string | null }

// ─── Tipos de borda (formato da API, campos em camelCase) ───────────────

export interface MeFlix {
  mentor: { id: string; nome: string; fotoUrl: string | null; agendaUrl: string | null; modalidade: 'b2c' | 'b2b' };
  tribos: { id: string; nome: string; slug: string; modalidade: 'b2c' | 'b2b'; papel: 'titular' | 'apoio' }[];
}

export interface AlunoFlix {
  alunoId: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  produto: 'pro' | 'padrao';
  acessoAte: string;
  semestre: number | null; // B2C: sempre null
  campus: string | null;
  triboId: string;
  entrouNaTriboEm: string;
  origemAlocacao: 'onboarding' | 'cx' | 'sgi_lote' | 'retroativo';
  ultimaAtividadeEm: string | null;
  meta: { especialidade: string; instituicao: string; cortePct: number } | null;
}

export interface ConviteFlix { id: string; alunoId: string; publicacaoId: string; ativo: boolean; liberadoEm: string }

export type NovaPublicacao = Pick<Publicacao, 'tag' | 'titulo' | 'mensagem' | 'link' | 'status'> & {
  anexo?: { url: string; nome: string; mime: string; bytes: number } | null;
  destino: { tipo: 'tribo' } | { tipo: 'alunos'; alunoIds: string[] };
  fixada?: boolean;
};

export interface NovaSessao {
  tipo: Sessao['tipo'];
  inicio: string; // ISO UTC
  duracaoMin?: number;
  tema?: string | null;
  descricao?: string | null;
  alunoId?: string | null;
  meetUrl?: string | null;
  avisarTribo?: boolean;
  pauta?: { texto: string; origem: 'tema_critico' | 'mais_erradas' | 'livre'; referenciaId?: string; ordem: number }[];
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const flix = {
  me: () => chamar<MeFlix>('GET', '/me'),
  atualizarPerfil: (p: Partial<{ fotoUrl: string; bio: string; agendaUrl: string }>) => chamar<MeFlix['mentor']>('PATCH', '/me', p),

  alunos: async (triboId: string, busca?: string): Promise<AlunoFlix[]> => {
    // Carrega todas as páginas: a turma cabe na memória (B2C ~90, B2B até ~1.500).
    const todos: AlunoFlix[] = [];
    let cursor: string | null = null;
    do {
      const q = new URLSearchParams({ limit: '200', ...(busca ? { busca } : {}), ...(cursor ? { cursor } : {}) });
      const pg: Pagina<AlunoFlix> = await chamar('GET', `/tribos/${triboId}/alunos?${q}`);
      todos.push(...pg.data);
      cursor = pg.nextCursor;
    } while (cursor);
    return todos;
  },
  aluno: (triboId: string, alunoId: string) => chamar<AlunoFlix>('GET', `/tribos/${triboId}/alunos/${alunoId}`),

  canais: (triboId: string) => chamar<CanalTurma[]>('GET', `/tribos/${triboId}/canais`),
  salvarGrupoTribo: (triboId: string, url: string) => chamar<CanalTurma>('PUT', `/tribos/${triboId}/canais/grupo_tribo`, { url }),

  publicacoes: (triboId: string, filtro?: { status?: string; tag?: string }) =>
    chamar<Pagina<Publicacao>>('GET', `/tribos/${triboId}/publicacoes?${new URLSearchParams(filtro as Record<string, string>)}`),
  criarPublicacao: (triboId: string, p: NovaPublicacao) => chamar<Publicacao>('POST', `/tribos/${triboId}/publicacoes`, p),
  editarPublicacao: (id: string, p: Partial<NovaPublicacao>) => chamar<Publicacao>('PATCH', `/publicacoes/${id}`, p),
  excluirPublicacao: (id: string) => chamar<void>('DELETE', `/publicacoes/${id}`),
  pedirUpload: (arquivo: { nome: string; mime: string; bytes: number }) =>
    chamar<{ uploadUrl: string; fileUrl: string }>('POST', '/uploads', arquivo),

  sessoes: (triboId: string, filtro?: { de?: string; ate?: string; status?: string; tipo?: string }) =>
    chamar<Pagina<Sessao & { warnings?: string[] }>>('GET', `/tribos/${triboId}/sessoes?${new URLSearchParams(filtro as Record<string, string>)}`),
  criarSessao: (triboId: string, s: NovaSessao) => chamar<Sessao & { warnings: string[] }>('POST', `/tribos/${triboId}/sessoes`, s),
  editarSessao: (id: string, s: Partial<NovaSessao> & { status?: Sessao['status'] }) => chamar<Sessao>('PATCH', `/sessoes/${id}`, s),
  excluirSessao: (id: string) => chamar<void>('DELETE', `/sessoes/${id}`),
  vincularGravacao: (id: string, g: { url: string; duracaoSeg?: number }) =>
    chamar<Sessao>('POST', `/sessoes/${id}/gravacao`, { ...g, origem: 'manual' }),

  convites: (triboId: string) => chamar<ConviteFlix[]>('GET', `/tribos/${triboId}/convites`),
  liberarAgenda: (triboId: string, alunoId: string, mensagem: { titulo: string; mensagem: string }) =>
    chamar<ConviteFlix>('POST', `/tribos/${triboId}/convites`, { alunoId, mensagem }),
  desligarAgenda: (conviteId: string) => chamar<void>('DELETE', `/convites/${conviteId}`),
};

/** Mensagem de UI por código de erro (docs/07 § Conexão). */
export function mensagemErroFlix(e: unknown): string {
  if (!(e instanceof ErroFlix)) return 'Algo deu errado. Tente de novo.';
  switch (e.code) {
    case 'validacao': return e.message;
    case 'sem_acesso_tribo': return 'Você não tem acesso a esta turma.';
    case 'mentor_sem_agenda': return 'Cadastre seu link do Google Agenda no perfil para liberar agendamentos.';
    case 'aluno_fora_da_tribo': return 'Um dos alunos não está mais na turma. Atualize a lista.';
    case 'convite_ativo': return 'A agenda deste aluno já está liberada.';
    default: return 'Não foi possível falar com o Flix. Tente de novo.';
  }
}
