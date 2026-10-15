import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de desempenho B2C (Onda 3). Mesmo cast de
 * `src/services/mentor/turma.ts`: as RPCs ainda não estão nos tipos gerados.
 * Métrica: % de acerto (0-100).
 */

export type SituacaoMeta = 'acima' | 'proximo' | 'longe' | 'sem_meta' | 'sem_simulado';

export interface NotaSimulado {
  simulado_id: string;
  sequence_number: number;
  acerto_pct: number;
  finalizada_em: string;
  /** Posição do aluno entre quem fez o simulado dentro da janela. Ausente até o backend novo. */
  posicao?: number | null;
  participantes?: number | null;
  percentil?: number | null;
  /** false = o aluno fez fora da janela (não entra no ranking). */
  dentro_janela?: boolean | null;
}

export interface AlunoDesempenho {
  email: string;
  nome: string | null;
  notas: NotaSimulado[];
  ultimo_acerto: number | null;
  corte_mais_dificil: number | null;
  vs_corte_pp: number | null;
  situacao: SituacaoMeta;
  /** null quando não dá para avaliar (menos de 2/3 simulados no escopo). */
  regrediu: boolean | null;
  estagnado: boolean | null;
  /** null quando não há simulado encerrado no escopo. */
  fez_ultimo: boolean | null;
}

/**
 * Simulado B2C publicado. `mentor_desempenho_turma` devolve TODOS, ordenados por
 * `sequence_number`, independente do recorte (`p_simulados`) e de alguém da turma
 * ter feito: é a fonte dos chips e do "último simulado".
 */
export interface SimuladoB2C {
  id: string;
  sequence_number: number;
  titulo: string;
  janela_fim: string | null;
  encerrado: boolean;
}

export interface DesempenhoTurma {
  alunos: AlunoDesempenho[];
  /** Todos os simulados B2C publicados, por sequence_number (não depende do recorte). */
  simulados: SimuladoB2C[];
  possivel_aprovacao_pct: number | null;
  acerto_medio_ultimo: number | null;
  participacao_ultimo: { simulado_id: string | null; fizeram: number; total: number };
}

export interface TemaDesempenho {
  tema: string;
  acerto_pct: number;
  respostas: number;
}

/** Especialidade dentro de uma grande área; `especialidade` nula = sem classificação ("Geral"). */
export interface EspecialidadeDesempenho {
  especialidade: string | null;
  acerto_pct: number;
  respostas: number;
  temas: TemaDesempenho[];
}

export interface AreaDesempenho {
  grande_area: string;
  acerto_pct: number;
  respostas: number;
  /** Todos os temas da área (lista plana, existente). */
  temas: TemaDesempenho[];
  /** Árvore grande área → especialidade → tema. Ausente até o backend novo: a UI cai em `temas`. */
  especialidades?: EspecialidadeDesempenho[];
}

export interface QuestaoDetalhe {
  questao_id: string;
  numero: number;
  sequence_number: number;
  grande_area: string;
  tema: string;
  correta_label: string | null;
  acerto_pct: number;
  respostas: number;
  /** {A: 12, B: 3, branco: 1} */
  distribuicao: Record<string, number>;
  /** e-mails de quem marcou cada alternativa (só da turma). */
  emails: Record<string, string[]>;
  /** Campos novos (opcionais até o backend novo ser aplicado). */
  especialidade?: string | null;
  /** Parte do `tema` depois de ">" ("Especialidade > Tema"); `tema` segue sendo a string completa. */
  tema_curto?: string | null;
  dificuldade?: string | null;
  /** Primeiras linhas do enunciado, para a prévia na lista. */
  enunciado_inicio?: string | null;
  tem_imagem?: boolean;
}

/** Simulado cujo resultado ainda não foi liberado aos alunos: fica fora dos dados. */
export interface SimuladoBloqueado {
  simulado_id: string;
  sequence_number: number;
  /** Quando o resultado é liberado; nulo = sem data definida. */
  libera_em: string | null;
}

export interface Detalhamento {
  areas: AreaDesempenho[];
  questoes: QuestaoDetalhe[];
  /** Simulados do recorte ainda não liberados (excluídos de `areas` e `questoes`). */
  bloqueados?: SimuladoBloqueado[];
}

export interface AlternativaQuestao {
  label: string;
  texto: string | null;
  correta: boolean;
  n: number;
  pct: number;
  /** null = o backend não expõe os alunos desta alternativa (ex.: a correta). */
  emails: string[] | null;
}

/** Questão completa (`mentor_questao`): enunciado, imagens, alternativas com texto e explicação. */
export interface QuestaoCompleta {
  questao_id: string;
  simulado_id: string;
  sequence_number: number;
  numero: number;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  tema_curto?: string | null;
  dificuldade: string | null;
  enunciado: string | null;
  imagens: string[] | null;
  explicacao: string | null;
  explicacao_imagem_url: string | null;
  respostas: number;
  acerto_pct: number;
  alternativas: AlternativaQuestao[];
  branco: { n: number; emails: string[] | null } | null;
}

/** Mensagem da RPC quando o simulado da questão ainda não foi liberado. */
export function questaoNaoLiberada(error: unknown): boolean {
  return error instanceof Error && /ainda n[aã]o foi liberado/i.test(error.message);
}

export interface AlunoNotas {
  email: string;
  notas: (NotaSimulado & { titulo: string })[];
  areas: AreaDesempenho[];
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/mentor/desempenho] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

/**
 * Chaves de cache do desempenho da turma. Uma só fábrica para Início, Minha Turma e
 * Detalhamento: a mesma chamada de `fetchDesempenhoTurma` tem sempre a mesma chave, então
 * o cache é compartilhado entre as telas. Sem ids (ou lista vazia) = todos os simulados.
 */
export const chavesDesempenho = {
  /** Questão aberta (lazy): mesma questão + mesmo recorte = mesmo cache. */
  questao: (questaoId: string, simulados: readonly string[]) =>
    ['mentor', 'questao', questaoId, [...simulados].sort()] as const,
  turma: (simulados?: readonly string[] | null) =>
    ['mentor', 'desempenho', simulados && simulados.length > 0 ? [...simulados].sort() : 'todos'] as const,
};

/** `simulados` omitido = todos os simulados espelhados. */
export async function fetchDesempenhoTurma(simulados?: string[]): Promise<DesempenhoTurma> {
  const dados = await callRpc<DesempenhoTurma>('mentor_desempenho_turma', { p_simulados: simulados ?? null });
  // Defensivo: backend anterior à lista não manda a chave.
  return { ...dados, simulados: dados?.simulados ?? [] };
}

export async function fetchDetalhamento(simulados: string[]): Promise<Detalhamento> {
  return callRpc<Detalhamento>('mentor_detalhamento', { p_simulados: simulados });
}

export async function fetchQuestao(questaoId: string, simulados: string[]): Promise<QuestaoCompleta> {
  return callRpc<QuestaoCompleta>('mentor_questao', { p_questao_id: questaoId, p_simulados: simulados });
}

export async function fetchAlunoNotas(email: string): Promise<AlunoNotas> {
  return callRpc<AlunoNotas>('mentor_aluno_notas', { p_email: email });
}
