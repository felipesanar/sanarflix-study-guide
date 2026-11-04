/** Domínio do Portal do Mentor; conceitos compartilhados vêm do Gestor. */
import type { GrupoEvolucao, NivelDesempenho, PontoSerie } from '@/features/gestor/api/types';
export type { GrupoEvolucao, NivelDesempenho, PontoSerie };

export type Modalidade = 'b2c' | 'b2b';
export type TriboId = 'carcara' | 'camaleao' | 'colmeia' | 'octopus';

export interface Tribo {
  id: TriboId;
  nome: string;
  lema: string;
  brasaoUrl: string;
  iconeUrl: string;
}

export interface Mentor {
  id: string;
  nome: string;
  fotoUrl: string | null;
  modalidade: Modalidade;
  triboId: TriboId | null;
  iesId: string | null;
  turmaId: string;
  agendaUrl: string | null;
}

/** Meta mais difícil do aluno, produto Metas (V1). */
export interface MetaAluno {
  especialidade: string;
  instituicao: string;
  cortePct: number;
}

export interface AlunoMentor {
  id: string;
  nome: string;
  /** Só B2B; B2C não exibe semestre. */
  semestre: number | null;
  telefone: string | null;
  acessoAte: string | null;
  /** TODO(P1): confirmar última atividade de estudo; null = nunca. */
  ultimaAtividade: string | null;
  meta: MetaAluno | null;
}

export type StatusSimulado = 'realizado' | 'agendado' | 'previsto' | 'processando';
export interface SimuladoMentor {
  id: string;
  ordem: number;
  nome: string;
  data: string | null;
  status: StatusSimulado;
  participantes: number | null;
}

/** null = não fez; nunca preencher com zero. */
export interface ResultadoAluno {
  alunoId: string;
  simuladoId: string;
  acertoPct: number | null;
  acertos: number | null;
  proficiencia: number | null;
}

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

export type Prevalencia = 'alta' | 'media' | 'baixa';
export interface TemaTurma {
  id: string;
  tema: string;
  especialidade: string;
  grandeArea: string;
  prevalencia: Prevalencia;
  acertoPct: number | null;
  respostas: number;
  alunosAbaixo50: number;
  /** Ordem cronológica, preservando lacunas. */
  serie: PontoSerie[];
}

export type TipoSessao = 'encontro_tribo' | 'individual' | 'pos_simulado' | 'oficina';
export type StatusSessao = 'agendada' | 'realizada';
export interface ItemPauta {
  id: string;
  origem: 'tema_critico' | 'mais_erradas' | 'livre';
  referenciaId: string | null;
  texto: string;
}
export interface Sessao {
  id: string;
  tipo: TipoSessao;
  data: string;
  hora: string;
  tema: string | null;
  alunoId: string | null;
  link: string | null;
  status: StatusSessao;
  /** Só coletivas vão ao acervo. */
  gravacaoUrl: string | null;
  pauta: ItemPauta[];
}
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
  editavel: boolean;
}
export type StatusSessaoExibido = 'agendada' | 'falta_link' | 'pauta_pendente' | 'falta_link_e_pauta' | 'realizada';

// TODO(P2): validar inclusão de "Novidade"; hipótese atual = três tags.
export type TagMural = 'desempenho' | 'aviso' | 'fique_por_dentro';
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

export type TipoIntervencao = 'individual' | 'coletiva' | 'mensagem';
export type StatusIntervencao = 'afazer' | 'andamento' | 'feito';
export type OrigemIntervencao = 'manual' | 'agenda_liberada' | 'tema_critico' | 'questao' | 'mural' | 'sessao_criada';
export interface Intervencao {
  id: string;
  tipo: TipoIntervencao;
  titulo: string;
  nota: string | null;
  destino: { alunoIds?: string[]; grupo?: string; turmaToda?: boolean };
  perfil: PerfilB2B | null;
  status: StatusIntervencao;
  origem: OrigemIntervencao;
  referenciaId: string | null;
  criadaEm: string;
  historico: { em: string; texto: string }[];
}

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
  /** TODO(P13): quantidade e tipos vêm do contrato, não de constantes. */
  encontrosPorMes: number;
  tiposSessao: TipoSessao[];
  simuladosContratados: number;
}
