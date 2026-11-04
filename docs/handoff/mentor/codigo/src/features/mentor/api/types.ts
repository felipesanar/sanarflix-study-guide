/**
 * Tipos de domínio do Portal do Mentor (B2C e B2B).
 *
 * Reaproveita os tipos do Gestor sempre que o conceito é o mesmo
 * (NivelDesempenho, GrupoEvolucao, PontoSerie, Meta). Os tipos novos aqui
 * são os que NÃO existem no Gestor: tribo, metas do aluno, mural, sessões,
 * intervenções, rotina do grupo e sinalizações à IES.
 *
 * Referência visual: capturas/b2c e capturas/b2b. Regras: docs/05.
 */
import type { GrupoEvolucao, NivelDesempenho, PontoSerie } from '@/features/gestor/api/types';

export type { GrupoEvolucao, NivelDesempenho, PontoSerie };

export type Modalidade = 'b2c' | 'b2b';

export type TriboId = 'carcara' | 'camaleao' | 'colmeia' | 'octopus';

export interface Tribo {
  id: TriboId;
  nome: string;
  lema: string;
  /** Ver `tema/tribos.ts` — cores e assets saem do cadastro, não do componente. */
  brasaoUrl: string;
  iconeUrl: string;
}

export interface Mentor {
  id: string;
  nome: string;
  fotoUrl: string | null;
  modalidade: Modalidade;
  triboId: TriboId | null; // B2C
  iesId: string | null; // B2B
  turmaId: string;
  /** Link do Google Agenda usado no botão "Agendar com o mentor" (B2C). */
  agendaUrl: string | null;
}

/** Meta do aluno (B2C). Depende do produto Metas — V1, previsto para novembro. */
export interface MetaAluno {
  especialidade: string;
  instituicao: string;
  /** Corte da meta mais difícil do aluno, em % de acerto. */
  cortePct: number;
}

export interface AlunoMentor {
  id: string;
  nome: string;
  /** Só B2B (dado da compra). B2C: sempre null — não exibir. */
  semestre: number | null;
  telefone: string | null;
  acessoAte: string | null; // ISO
  /** Última ATIVIDADE DE ESTUDO (pendência P1: confirmar com dados). `null` = nunca. */
  ultimaAtividade: string | null; // ISO
  meta: MetaAluno | null;
}

export type StatusSimulado = 'realizado' | 'agendado' | 'previsto' | 'processando';

export interface SimuladoMentor {
  id: string;
  ordem: number; // 1º, 2º…
  nome: string;
  data: string | null; // ISO
  status: StatusSimulado;
  participantes: number | null;
}

/** Resultado de UM aluno em UM simulado. `null` = não fez (nunca zero). */
export interface ResultadoAluno {
  alunoId: string;
  simuladoId: string;
  acertoPct: number | null;
  acertos: number | null;
  /** Proficiência TRI 0–100 (B2B). */
  proficiencia: number | null;
}

// ─── Prioridades (Início) ────────────────────────────────────────────────

export type AlertaB2C = 'sumiram' | 'esfriando' | 'regrediram' | 'estagnados' | 'nao_fizeram';
export type PerfilB2B = 'virada' | 'muito_baixo' | 'muito_bom';
export type GrupoPrioridadeB2B = PerfilB2B | 'sem_acesso';
export type Prioridade = 'alta' | 'media' | 'baixa';

export interface ItemPrioridade<K extends string = string> {
  chave: K;
  titulo: string;
  criterio: string;
  prioridade: Prioridade;
  alunoIds: string[];
}

// ─── Temas críticos ─────────────────────────────────────────────────────

export type Prevalencia = 'alta' | 'media' | 'baixa';

export interface TemaTurma {
  id: string;
  tema: string;
  especialidade: string;
  grandeArea: string;
  prevalencia: Prevalencia;
  acertoPct: number;
  respostas: number;
  alunosAbaixo50: number;
  /** Acerto no tema por simulado, do mais antigo ao mais recente. */
  serie: PontoSerie[];
}

// ─── Sessões ────────────────────────────────────────────────────────────

export type TipoSessao = 'encontro_tribo' | 'individual' | 'pos_simulado' | 'oficina';
export type StatusSessao = 'agendada' | 'realizada';

export interface ItemPauta {
  id: string;
  origem: 'tema_critico' | 'mais_erradas' | 'livre';
  referenciaId: string | null; // temaId ou simuladoId
  texto: string;
}

export interface Sessao {
  id: string;
  tipo: TipoSessao;
  data: string; // ISO date
  hora: string; // "20:00"
  tema: string | null;
  alunoId: string | null; // individual
  link: string | null;
  status: StatusSessao;
  /** Preenchido pela automação do Drive (só coletivas vão ao acervo). */
  gravacaoUrl: string | null;
  pauta: ItemPauta[];
}

/** Consumo por aluno (DAGs de questões e conteúdos), janela de 30 dias. */
export interface ConsumoAluno {
  alunoId: string;
  questoes: number;
  acertoQuestoesPct: number | null;
  aulas: number;
  pdfs: number;
}

export interface CanalTurma {
  tipo: 'avisos' | 'plantao' | 'grupo_turma';
  url: string;
  /** Só `grupo_turma` é editável pelo mentor. */
  editavel: boolean;
}

/** Estado DERIVADO, nunca persistido: ver `regrasMentor.statusSessao`. */
export type StatusSessaoExibido = 'agendada' | 'falta_link' | 'pauta_pendente' | 'falta_link_e_pauta' | 'realizada';

// ─── Mural ──────────────────────────────────────────────────────────────

export type TagMural = 'desempenho' | 'aviso' | 'fique_por_dentro'; // P2: "novidade"?

export interface Publicacao {
  id: string;
  tag: TagMural;
  titulo: string;
  mensagem: string;
  link: { url: string; titulo: string } | null;
  anexoUrl: string | null;
  destino: { tipo: 'turma' } | { tipo: 'selecionados'; alunoIds: string[] };
  status: 'rascunho' | 'publicada';
  publicadaEm: string | null;
}

// ─── Intervenções (kanban) ──────────────────────────────────────────────

export type TipoIntervencao = 'individual' | 'coletiva' | 'mensagem';
export type StatusIntervencao = 'afazer' | 'andamento' | 'feito';
export type OrigemIntervencao =
  | 'manual'
  | 'agenda_liberada'
  | 'tema_critico'
  | 'questao'
  | 'mural'
  | 'sessao_criada';

export interface Intervencao {
  id: string;
  tipo: TipoIntervencao;
  titulo: string;
  nota: string | null;
  destino: { alunoIds?: string[]; grupo?: string; turmaToda?: boolean };
  perfil: PerfilB2B | null;
  status: StatusIntervencao;
  origem: OrigemIntervencao;
  /** Liga o card à sessão/publicação que o criou, para mover junto. */
  referenciaId: string | null;
  criadaEm: string;
  historico: { em: string; texto: string }[];
}

// ─── B2B: rotina e IES ──────────────────────────────────────────────────

export interface ItemRotina {
  dia: 'ter' | 'qui' | 'sex';
  tipo: 'enquete' | 'resposta' | 'perola';
  conteudo: string;
  enviadoEm: string | null;
}

export interface Sinalizacao {
  alunoId: string;
  motivo: string;
  em: string;
  comiteId: string | null;
}

export interface ContratoIes {
  encontrosPorMes: number; // UniAtenas: 2 · USCS: 4 (P13)
  tiposSessao: TipoSessao[];
  simuladosContratados: number;
}
