/** Domínio do Portal do Mentor; conceitos compartilhados vêm do Gestor. */
import type { AcertoPorAreaESemestre, GrupoEvolucao, MetricasSimulado, NivelDesempenho, PontoSerie, Tendencia } from '@/features/gestor/api/types';
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
  statusOriginal?: string;
  modalidade?: 'online' | 'presencial' | null;
  indisponivelPorque?: string | null;
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
  /** Acréscimos da frente de dados (opcionais; a fonte preenche quando tem). */
  titulo?: string | null;
  /** ISO 8601 UTC; `data`/`hora` são derivados em America/Sao_Paulo. */
  inicio?: string;
  duracaoMin?: number | null;
  descricao?: string | null;
  realizadaEm?: string | null;
  /** Academy: 'academy' | 'arquivo_2025'. */
  origem?: string | null;
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
  /** Acréscimos: rótulo do canal e se a URL já foi cadastrada (`url` fica '' quando não foi). */
  nome?: string;
  configurado?: boolean;
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
  /** Acréscimos da frente de dados. `editadaEm != null` → "editada" no histórico. */
  editadaEm?: string | null;
  fixada?: boolean;
  anexoNome?: string | null;
  /** Academy: 'mentor' | 'sessao_coletiva' | 'liberacao_agenda'. */
  origem?: string | null;
  /** Texto da tag como gravado na fonte (ex.: 'Agenda'), quando difere das três tags do contrato. */
  tagOriginal?: string | null;
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
  /** Acréscimos da frente de dados. */
  comentarios?: { em: string; texto: string }[];
  /** Peso no medidor planejadas/realizadas (turma = 1; grupo = nº de alunos). */
  peso?: number;
  /** Tipo cru do Academy (reuniao_individual, whatsapp, outro…). */
  tipoOriginal?: string;
}

export interface ItemRotina {
  dia: 'ter' | 'qui' | 'sex';
  tipo: 'enquete' | 'resposta' | 'perola';
  conteudo: string;
  enviadoEm: string | null;
  /** Acréscimos: id do slot (para marcar enviado) e a segunda-feira da semana. */
  id?: string;
  semana?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Acréscimos da frente de dados (D): formas camelCase das RPCs do Academy.
// Regra transversal: `null` = sem dado; nunca é convertido para zero.
// ─────────────────────────────────────────────────────────────────────────────

export type SegmentoAtividade = 'ativo' | 'esfriando' | 'sumido' | 'sem_dado';
export type SituacaoMetaB2c = 'sem_simulado' | 'sem_meta' | 'acima' | 'proximo' | 'longe';

export interface ConsumoPeriodo { videos: number | null; documentos: number | null; total: number | null }
export interface QuestoesPeriodo { respondidas: number | null; acertos: number | null; erros: number | null; pctAcerto: number | null }

/** Linha de `mentor_turma` (DAGs de consumo e questões + identidade do vínculo). */
export interface AlunoTurmaAcademy {
  email: string;
  nome: string | null;
  telefone: string | null;
  /** Só B2B; B2C sempre null. */
  semestre: number | null;
  acessoAte: string | null;
  b2b: boolean;
  academyUserId: string | null;
  sanarflixUserId: string | null;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
  segmento: SegmentoAtividade;
  meta: MetaAluno | null;
  conteudos7d: ConsumoPeriodo;
  conteudos30d: ConsumoPeriodo;
  temDadoConsumo: boolean;
  questoes7d: QuestoesPeriodo;
  questoes30d: QuestoesPeriodo;
  temDadoQuestoes: boolean;
}

export interface NotaSimuladoAluno { simuladoId: string; ordem: number | null; acertoPct: number | null; finalizadaEm: string | null }
export interface DesempenhoAlunoB2c {
  email: string;
  nome: string | null;
  notas: NotaSimuladoAluno[];
  ultimoAcerto: number | null;
  corteMaisDificil: number | null;
  vsCortePp: number | null;
  situacao: SituacaoMetaB2c;
  regrediu: boolean;
  estagnado: boolean;
  /** null = ainda não há simulado encerrado. */
  fezUltimo: boolean | null;
}
export interface DesempenhoTurmaB2c {
  alunos: DesempenhoAlunoB2c[];
  possivelAprovacaoPct: number | null;
  acertoMedioUltimo: number | null;
  simulados: SimuladoMentor[];
  participacaoUltimo: { simuladoId: string | null; fizeram: number; total: number };
}

export interface PontoSerieTurma {
  simuladoId: string;
  ordem: number | null;
  titulo: string | null;
  fechado: boolean;
  participantes: number;
  acertoMedio: number | null;
  acimaCortePct: number | null;
}

export interface SemanaEngajamento { semana: string; questoes: number | null; acertos: number | null; conteudos: number | null }
export interface EngajamentoAluno {
  email: string;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
  segmento: SegmentoAtividade;
  /** Vazio quando o aluno nunca teve atividade. */
  semanas: SemanaEngajamento[];
}

/** Tema de `mentor_temas_turma` / `mentor_temas_turma_b2b`. Prevalência null = não cadastrada. */
export interface TemaTurmaMentor {
  impacto?: number | null;
  amostra?: number | null;
  lowSample?: boolean;
  id: string;
  tema: string;
  especialidade: string | null;
  grandeArea: string;
  prevalencia: Prevalencia | null;
  /** Alta 3 · Média 2 · Baixa 1; null sem prevalência. */
  peso: number | null;
  respostas: number;
  acertoPct: number | null;
  alunosAbaixo50: string[];
  /** 30+ respostas no recorte. */
  critico: boolean;
  serie: { simuladoId: string; acertoPct: number | null }[];
}

export interface AcertoTema { tema: string; acertoPct: number | null; respostas: number }
export interface AcertoEspecialidade { especialidade: string | null; acertoPct: number | null; respostas: number; temas: AcertoTema[] }
export interface AcertoArea { grandeArea: string; acertoPct: number | null; respostas: number | null; especialidades: AcertoEspecialidade[]; temas: AcertoTema[]; id?: string; critica?: boolean }

export interface QuestaoResumoMentor {
  questaoId: string | null;
  numero: number | null;
  ordem: number | null;
  grandeArea: string;
  especialidade: string | null;
  tema: string;
  temaCurto: string | null;
  dificuldade: string | null;
  enunciadoInicio: string | null;
  temImagem: boolean;
  corretaLabel: string | null;
  acertoPct: number | null;
  respostas: number | null;
  /** label → nº de respostas ('branco' incluso). */
  distribuicao: Record<string, number>;
  /** label errada → e-mails de quem marcou. */
  emailsPorAlternativa: Record<string, string[]>;
  simuladoId?: string | null;
  distribuicaoPct?: Record<string, number | null>;
  alternativas?: { letra: string; texto: string | null; correta: boolean | null; marcadaPct: number | null }[];
  imagemEnunciado?: string | null;
  imagemEnunciado2?: string | null;
  imagemComentario?: string | null;
  distratorDominante?: string | null;
}
export interface SimuladoBloqueado { simuladoId: string; ordem: number | null; liberaEm: string | null }
export interface DetalhamentoMentor { areas: AcertoArea[]; questoes: QuestaoResumoMentor[]; bloqueados: SimuladoBloqueado[] }

export interface AlternativaQuestao { label: string; texto: string | null; correta: boolean; n: number; pct: number; emails: string[] | null }
export interface QuestaoMentor {
  questaoId: string;
  simuladoId: string | null;
  ordem: number | null;
  numero: number | null;
  grandeArea: string;
  especialidade: string | null;
  tema: string;
  temaCurto: string | null;
  dificuldade: string | null;
  enunciado: string | null;
  imagens: string[];
  explicacao: string | null;
  explicacaoImagemUrl: string | null;
  respostas: number;
  acertoPct: number | null;
  alternativas: AlternativaQuestao[];
  branco: { n: number; emails: string[] };
}

export interface LogAluno { tipo: string; em: string; payload: Record<string, unknown> }
export interface IntervencaoResumo { id: string; tipo: TipoIntervencao; tipoOriginal: string; titulo: string; status: StatusIntervencao; criadaEm: string }
export interface NotaAlunoSimulado {
  simuladoId: string;
  ordem: number | null;
  titulo: string | null;
  acertoPct: number | null;
  finalizadaEm: string | null;
  acertos: number | null;
  respondidas: number | null;
  posicao: number | null;
  participantes: number | null;
  percentil: number | null;
  dentroJanela: boolean | null;
}
export interface ConsumoAlunoDetalhe {
  temDadoConsumo: boolean;
  porSemana: { semana: string; videos: number | null; documentos: number | null }[];
  recentes: { quando: string; tipo: string; conteudo: string | null; curso: string | null; modulo: string | null }[];
  topCursos: { curso: string; total: number }[];
}
export interface QuestoesAlunoDetalhe {
  temDadoQuestoes: boolean;
  ultimaResposta: string | null;
  porSemana: { semana: string; respondidas: number | null; acertos: number | null; erros: number | null }[];
  porArea: { area: string; respondidas: number; acertos: number; erros: number; pctAcerto: number | null }[];
}
/** Drawer do aluno B2C: mentor_aluno + mentor_aluno_notas + mentor_aluno_conteudos + mentor_aluno_questoes. */
export interface AlunoDetalheB2c {
  email: string;
  aluno: AlunoTurmaAcademy | null;
  liberacao: { ligado: boolean; desde: string; mensagem: string | null } | null;
  intervencoes: IntervencaoResumo[];
  log: LogAluno[];
  sinalizadoEm: string | null;
  notas: NotaAlunoSimulado[];
  areas: AcertoArea[];
  conteudos: ConsumoAlunoDetalhe;
  questoes: QuestoesAlunoDetalhe;
}

// ─── Kanban, rotina, pérolas (Academy) ──────────────────────────────────────
export interface QuadroIntervencoes { cards: Intervencao[]; planejadas: number; realizadas: number }
/** Datas `YYYY-MM-DD` (America/Sao_Paulo); null = sem limite. */
export interface PeriodoIntervencoes { de: string | null; ate: string | null }
export interface NovaIntervencaoManual {
  tipo: TipoIntervencao;
  titulo: string;
  nota?: string | null;
  destino: { alunoIds?: string[]; turmaToda?: boolean };
}
export interface ItemRotinaAcademy extends ItemRotina { id: string; semana: string }
export interface Perola { id: string; texto: string; tema: string | null; criadaEm: string }
export interface SinalizacaoCriada { id: string; sinalizadoEm: string }

// ─── B2B · adaptadores das RPCs reais para o contrato publico dos hooks ───
export type PeriodoB2b = '30d' | '90d' | '6m' | 'ciclo';
export interface IndicadorB2b { valor: number | null; delta: number | null; serie: PontoSerie[] }
export interface VisaoGeralB2b {
  comTri?: number | null;
  faltamParaProximoConceito?: number | null;
  simulados: SimuladoMentor[];
  /** Simulado mais recente do período (referência dos indicadores). */
  simuladoReferenciaId: string | null;
  /** Projetado (badge "projetado"). */
  conceitoEnamed: IndicadorB2b;
  /** Projetado (badge "projetado"). */
  triProjetado: IndicadorB2b;
  proficientesPct: IndicadorB2b;
  proficientes: number | null;
  participantes: number | null;
  totalAlunos: number | null;
  acertoPct: number | null;
  simuladosRealizados: number | null;
  simuladosContratados: number | null;
}
export interface ProficienciaSimulado { simuladoId: string; ordem: number | null; valor: number | null }
export interface AlunoB2b {
  id?: string | null;
  perfis?: PerfilB2B[];
  tendencia?: Tendencia | null;
  email: string;
  nome: string | null;
  semestre: number | null;
  telefone: string | null;
  proficiencias: ProficienciaSimulado[];
  acertoUltimoPct: number | null;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
  perfil: PerfilB2B | null;
  grupo: GrupoEvolucao | null;
  sinalizadoEm: string | null;
}
export interface DetalhamentoB2b extends DetalhamentoMentor {
  metricas?: MetricasSimulado[];
  acertoPorAreaESemestre?: AcertoPorAreaESemestre;
  acertoMedioPct: number | null;
  conceitoEnamed: IndicadorB2b;
  triProjetado: IndicadorB2b;
  proficientesPct: number | null;
}
export interface RespondenteB2b { email: string; nome: string | null; alternativa: string; alunoId?: string | null }
export interface AlunoB2bDetalhe {
  aluno: AlunoB2b | null;
  simulados: { simuladoId: string; ordem: number | null; titulo: string | null; proficiencia: number | null; acertoPct: number | null; participou: boolean; data?: string | null; acertos?: number | null; situacao?: string | null; posicao?: { lugar: number; total: number; percentil: number } | null; acertoPorArea?: { area: string; acertoPct: number; critica: boolean }[]; variacao?: number | null }[];
  consumo30d: { questoes: number | null; acertoQuestoesPct: number | null; aulas: number | null; pdfs: number | null } | null;
  intervencoes: IntervencaoResumo[];
  log: LogAluno[];
  sinalizadoEm: string | null;
}
