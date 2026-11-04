/**
 * Contrato da camada de dados do Portal do Mentor (docs/handoff/mentor/IMPLEMENTACAO.md § Fontes de dados).
 *
 * As telas nunca chamam uma fonte direto: usam os hooks de `queries.ts`, que delegam para a
 * fonte ativa (`fonteAtiva()`). Três implementações cumprem esta interface:
 *  - `fonteAcademy` (padrão): RPCs `mentor_*` do Supabase do Academy;
 *  - `fonteFlix` (`VITE_FLIX_MENTORIA=on`): API de Mentoria do Flix via Edge `flix-mentoria-proxy`;
 *  - `fonteMock` (`VITE_MENTOR_FONTE=mock`, só dev/testes): dados dos protótipos.
 *
 * Os tipos de borda seguem o contrato v2.1 (Notion, 29/10): camelCase, ISO 8601 UTC, vazio = null.
 */
import type { CanalTurma, Publicacao, Sessao } from './types';

export class ErroFonte extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ErroFonte';
  }
}

export interface TriboMe {
  id: string;
  nome: string;
  slug: string;
  modalidade: 'b2c' | 'b2b';
  papel: 'titular' | 'apoio';
  lema?: string | null;
  iconeUrl?: string | null;
  cores?: { sig: string; shadow: string; glow: string } | null;
  /** B2B */
  iesId?: string | null;
  iesNome?: string | null;
  campus?: string | null;
  encontrosPorMes?: number | null;
  totalAlunos?: number | null;
}

export interface MeFlix {
  mentor: {
    id: string;
    nome: string;
    fotoUrl: string | null;
    agendaUrl: string | null;
    modalidade: 'b2c' | 'b2b';
  };
  tribos: TriboMe[];
  /** Toggle `mentor_portal` (mentores.portal_mentor). Falso → o portal redireciona para `/`. */
  portalMentor: boolean;
}

export interface AlunoFlix {
  /** fonteAcademy: e-mail normalizado; fonteFlix: userId do Flix. */
  alunoId: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  produto: 'pro' | 'padrao';
  acessoAte: string | null;
  /** B2C: sempre null. */
  semestre: number | null;
  campus: string | null;
  triboId: string;
  entrouNaTriboEm: string | null;
  origemAlocacao: 'onboarding' | 'cx' | 'sgi_lote' | 'retroativo' | 'planilha';
  ultimaAtividadeEm: string | null;
  meta: { especialidade: string; instituicao: string; cortePct: number } | null;
}

export interface ConviteFlix {
  id: string;
  alunoId: string;
  alunoNome?: string | null;
  publicacaoId: string | null;
  mensagem?: string | null;
  ativo: boolean;
  liberadoEm: string;
}

export interface Pagina<T> {
  data: T[];
  nextCursor: string | null;
}

export type NovaPublicacao = Pick<Publicacao, 'tag' | 'titulo' | 'mensagem' | 'link' | 'status'> & {
  anexo?: { url: string; nome: string; mime: string; bytes: number } | null;
  destino: { tipo: 'tribo' } | { tipo: 'alunos'; alunoIds: string[] };
  fixada?: boolean;
  /** Só a fonteAcademy usa: cria o card de intervenção no servidor. */
  registrarIntervencao?: boolean;
};

export interface NovaSessao {
  tipo: Sessao['tipo'];
  inicio: string;
  duracaoMin?: number;
  tema?: string | null;
  descricao?: string | null;
  alunoId?: string | null;
  meetUrl?: string | null;
  avisarTribo?: boolean;
  pauta?: { texto: string; origem: 'tema_critico' | 'mais_erradas' | 'livre'; referenciaId?: string; ordem: number }[];
}

/**
 * Parte do contrato que pertence ao Flix (alunos, mural, sessões, convites, canais).
 * Desempenho (DAGs) e kanban/rotina/sinalizações (Academy) não passam por aqui: os hooks de
 * `queries.ts` chamam as RPCs do Academy direto, nas três fontes (a mock substitui também esses).
 */
export interface FonteMentoria {
  readonly nome: 'academy' | 'flix' | 'mock';
  /** true: as ações de escrita já criam/movem o card do kanban no servidor (não chamar registrar_evento_mentor). */
  readonly eventosNoServidor: boolean;

  me(): Promise<MeFlix>;
  atualizarPerfil(p: Partial<{ fotoUrl: string; agendaUrl: string }>): Promise<MeFlix['mentor']>;

  alunos(triboId: string, busca?: string): Promise<AlunoFlix[]>;
  aluno(triboId: string, alunoId: string): Promise<AlunoFlix>;

  canais(triboId: string): Promise<CanalTurma[]>;
  salvarGrupoTribo(triboId: string, url: string): Promise<CanalTurma>;

  publicacoes(triboId: string, filtro?: { status?: string; tag?: string }): Promise<Pagina<Publicacao>>;
  criarPublicacao(triboId: string, p: NovaPublicacao): Promise<Publicacao>;
  editarPublicacao(id: string, p: Partial<NovaPublicacao>): Promise<Publicacao>;
  excluirPublicacao(id: string): Promise<void>;
  pedirUpload(arquivo: { nome: string; mime: string; bytes: number }): Promise<{ uploadUrl: string; fileUrl: string }>;

  sessoes(triboId: string, filtro?: { de?: string; ate?: string; status?: string; tipo?: string }): Promise<Pagina<Sessao>>;
  criarSessao(triboId: string, s: NovaSessao): Promise<Sessao & { warnings: string[] }>;
  editarSessao(id: string, s: Partial<NovaSessao> & { status?: Sessao['status'] }): Promise<Sessao>;
  excluirSessao(id: string): Promise<void>;
  vincularGravacao(id: string, g: { url: string; duracaoSeg?: number }): Promise<Sessao>;

  convites(triboId: string): Promise<ConviteFlix[]>;
  liberarAgenda(triboId: string, alunoId: string, mensagem: { titulo: string; mensagem: string }): Promise<ConviteFlix>;
  desligarAgenda(conviteId: string): Promise<void>;
}
