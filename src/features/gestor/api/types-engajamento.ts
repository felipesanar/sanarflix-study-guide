/**
 * Tipos das respostas das RPCs do Engajamento SanarFlix (spec 2026-10-22-engajamento §8).
 *
 * Os nomes de campo são IDÊNTICOS aos que o SQL emite em `jsonb_build_object`.
 * O teste `contratoEnvelopeRpc.test.ts` lê o SQL vigente de cada RPC e compara
 * as chaves de primeiro nível de `data` com as declaradas aqui — nunca invente
 * uma chave que a RPC não emite.
 *
 * Envelope e `meta` são os de `api/types.ts` (`Envelope<T>`, `Meta`). Atenção:
 * `meta.atualizadoEm` é `null` até o pipeline rodar a primeira vez (spec §11,
 * "Nunca atualizado"), embora `Meta` o declare como `string`.
 *
 * Ausência de valor é `null`, nunca `0` (spec §7.5): percentual sem base,
 * comparativo indisponível, média sem engajados.
 */

/** Ciclo da taxonomia de questões (`eng_no_taxonomia.ciclo`). */
export type CicloTaxonomia = 'clinico' | 'basico';

/** Ciclo do SEMESTRE do aluno (D15). Não confundir com `CicloTaxonomia`. */
export type CicloSemestre = 'basico' | 'clinico' | 'internato';

export type NivelEngajamento = 'frequente' | 'esporadico' | 'parou' | 'nunca';
export type FaixaRecencia = 'ativos30' | 'sumidos30a59' | 'sumidos60' | 'nunca_acessou';
/** Faixas de dias ativos no mês de referência de "Do acesso ao hábito". */
export type FaixaHabito = 'habito_baixo' | 'habito_medio' | 'habito_alto' | 'habito_altissimo';
export type CategoriaLista = NivelEngajamento | FaixaRecencia | FaixaHabito | 'sumidos30mais';
/** Aba de "Consumo dos alunos": só escolhe o que a tela realça, não ordena a tabela. */
export type AbaConsumo = 'questoes' | 'videos' | 'documentos';

/** Coluna da tabela "Por aluno" pela qual a lista pode ser ordenada (clique no cabeçalho). */
export type OrdemAlunos = 'nome' | 'semestre' | 'questoes' | 'acerto' | 'videos' | 'documentos' | 'ultima_atividade';
export type DirecaoOrdem = 'asc' | 'desc';
export type SituacaoAlunoEngajamento = 'ativo' | 'sumido' | 'sem_atividade';
export type TipoAtividade = 'questoes' | 'video' | 'documento';
export type TipoConteudoBanco = 'video' | 'document';

/** `eng_detalhe_atividade`: o que o aluno fez no último dia com atividade. */
export interface DetalheAtividade {
  dia: string;
  tipo: TipoAtividade;
  especialidade: string | null;
}

// ---------------------------------------------------------------------------
// §8.1 get_gestor_engajamento_visao_geral
// ---------------------------------------------------------------------------

export interface PeriodoAnterior {
  inicio: string;
  fim: string;
  comparavelQuestoes: boolean;
  comparavelConteudos: boolean;
}

export interface KpisVisaoGeral {
  baseAtiva: number;
  engajados: number;
  engajadosPct: number | null;
  /** `null` quando o período anterior começa antes de 2026-01-01 (D10). */
  engajadosPctAnterior: number | null;
  /** Só com `p_semestre`. */
  engajadosPctIes: number | null;
  semRetorno30: number;
  semRetorno30Pct: number | null;
  questoes: number;
  questoesPorEngajado: number | null;
  acertoPct: number | null;
  acertoPctAnterior: number | null;
  /** Só com `p_semestre`. */
  acertoPctIes: number | null;
}

export interface AlunoRecorte {
  id: string;
  nome: string;
  semestre: number;
}

export interface EspecialidadeDestaque {
  nome: string;
  total: number;
}

/** Bloco `aluno` — só vem preenchido com `p_aluno`. */
export interface ResumoAlunoVisaoGeral {
  situacao: SituacaoAlunoEngajamento;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
  diasAtivos: number;
  diasNoPeriodo: number;
  diasComQuestoes: number;
  baseSemestre: number;
  mediaSemestreQuestoes: number | null;
  mediaSemestreAcertoPct: number | null;
  mediaSemestreVideos: number | null;
  mediaSemestreDocumentos: number | null;
  especialidadeMaisAssistida: EspecialidadeDestaque | null;
  especialidadeMaisLida: EspecialidadeDestaque | null;
}

export interface MesVisaoGeral {
  /** `'AAAA-MM'` */
  mes: string;
  parcial: boolean;
  alunosAtivos: number;
  pctBase: number | null;
  /** Só com `p_aluno`. */
  diasAtivos: number | null;
  questoes: number;
  acertoPct: number | null;
  videos: number;
  documentos: number;
}

export interface HabitoVisaoGeral {
  mes: string;
  ativosNoMes: number;
  baixo: number;
  medio: number;
  alto: number;
  altissimo: number;
  /** Só com `p_aluno`. */
  diasAtivosAluno: number | null;
}

export interface AmostraNivel {
  id: string;
  nome: string;
}

export interface NivelVisaoGeral {
  nivel: NivelEngajamento;
  total: number;
  amostra: AmostraNivel[];
}

export interface LinhaRecencia {
  id: string;
  nome: string;
  semestre: number;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
  detalhe: DetalheAtividade | null;
}

export interface RecenciaVisaoGeral {
  ativos30: number;
  sumidos30a59: number;
  sumidos60: number;
  nuncaAcessou: number;
  previaSumidos30mais: LinhaRecencia[];
}

export interface ConsumoQuestoes {
  total: number;
  totalAnterior: number | null;
  totalIes: number | null;
  acertoPct: number | null;
  acertoPctAnterior: number | null;
  acertoPctIes: number | null;
  alunos: number;
}

export interface ConsumoConteudo {
  total: number;
  totalAnterior: number | null;
  totalIes: number | null;
  alunos: number;
}

export interface ConsumoVisaoGeral {
  questoes: ConsumoQuestoes;
  videos: ConsumoConteudo;
  documentos: ConsumoConteudo;
}

export interface EspecialidadePraticada {
  id: string;
  nome: string;
  ciclo: CicloTaxonomia;
  questoes: number;
  acertoPct: number | null;
}

export interface SemestreVisaoGeral {
  semestre: number;
  ciclo: CicloSemestre;
  base: number;
  engajados: number;
  engajadosPct: number | null;
  videosPorEngajado: number | null;
  documentosPorEngajado: number | null;
  questoesPorEngajado: number | null;
  acertoPct: number | null;
}

export interface VisaoGeralEngajamento {
  ies: { id: string; nome: string };
  temDados: boolean;
  periodo: {
    inicio: string;
    fim: string;
    dias: number;
    hoje: string;
    mesReferenciaHabito: string;
    anterior: PeriodoAnterior;
  };
  recorte: { semestre: number | null; aluno: AlunoRecorte | null };
  kpis: KpisVisaoGeral;
  aluno: ResumoAlunoVisaoGeral | null;
  meses: MesVisaoGeral[];
  habito: HabitoVisaoGeral;
  niveis: NivelVisaoGeral[];
  recencia: RecenciaVisaoGeral;
  consumo: ConsumoVisaoGeral;
  especialidades: EspecialidadePraticada[];
  semestres: SemestreVisaoGeral[];
}

// ---------------------------------------------------------------------------
// §8.2 get_gestor_engajamento_alunos (tabela "Por aluno")
// ---------------------------------------------------------------------------

export interface LinhaAlunoEngajamento {
  id: string;
  nome: string;
  semestre: number;
  questoes: number;
  acertoPct: number | null;
  videos: number;
  documentos: number;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
}

/** Estruturalmente um `Paginado<LinhaAlunoEngajamento>` (`api/types.ts`), declarado por extenso para o teste de contrato. */
export interface AlunosEngajamento {
  data: LinhaAlunoEngajamento[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// §8.3 get_gestor_engajamento_lista (prévias, pop-ups e CSV de níveis e recência)
// ---------------------------------------------------------------------------

export interface LinhaListaEngajamento {
  id: string;
  nome: string;
  semestre: number;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
  diasAtivos30: number;
  /** Dias com atividade no mês de referência do hábito (0 quando nenhum). */
  diasAtivosMes: number;
  /** `'AAAA-MM'`; `null` quando não houve dia ativo no período. */
  melhorMes: string | null;
  melhorMesDias: number;
  detalhe: DetalheAtividade | null;
}

export interface ListaEngajamento {
  categoria: CategoriaLista;
  data: LinhaListaEngajamento[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// §8.4 get_gestor_engajamento_aluno (drawer)
// ---------------------------------------------------------------------------

export interface ItemTimeline {
  dia: string;
  tipo: TipoAtividade;
  especialidade: string;
  /** Só em `tipo = 'questoes'`. */
  questoes: number | null;
  acertoPct: number | null;
  /** Só em vídeo e documento. */
  conteudo: string | null;
}

export interface EspecialidadeDoAluno {
  id: string;
  nome: string;
  questoes: number;
  acertoPct: number | null;
  acertoPctSemestre: number | null;
}

export interface MesDrawer {
  mes: string;
  parcial: boolean;
  questoes: number;
  videos: number;
  documentos: number;
}

export interface AlunoEngajamento {
  aluno: {
    id: string;
    nome: string;
    semestre: number;
    situacao: SituacaoAlunoEngajamento;
    ultimaAtividade: string | null;
    diasSemAtividade: number | null;
  };
  resumo: {
    questoes: number;
    acertoPct: number | null;
    videos: number;
    documentos: number;
    diasAtivos: number;
    diasNoPeriodo: number;
    mediaSemestreQuestoes: number | null;
    mediaSemestreAcertoPct: number | null;
  };
  meses: MesDrawer[];
  especialidades: EspecialidadeDoAluno[];
  timeline: ItemTimeline[];
}

// ---------------------------------------------------------------------------
// §8.5 get_gestor_engajamento_questoes (aba Questões)
// ---------------------------------------------------------------------------

export interface NoQuestoes {
  id: string;
  nome: string;
  questoes: number;
  /** Distintos em CADA nível: não soma entre níveis. */
  alunos: number;
  acertoPct: number | null;
}

export interface EspecialidadeClinica extends NoQuestoes {
  temas: NoQuestoes[];
}

export interface GrandeAreaClinica extends NoQuestoes {
  especialidades: EspecialidadeClinica[];
}

export interface DisciplinaBasica extends NoQuestoes {
  assuntos: NoQuestoes[];
}

export interface ArvoreQuestoes {
  clinico: { questoes: number; acertoPct: number | null; grandesAreas: GrandeAreaClinica[] };
  basico: { questoes: number; acertoPct: number | null; disciplinas: DisciplinaBasica[] };
  total: { questoes: number; alunos: number; acertoPct: number | null };
}

export interface QuestoesEngajamento {
  kpis: { questoes: number; acertoPct: number | null; alunos: number; porAluno: number | null };
  meses: { mes: string; parcial: boolean; questoes: number; acertoPct: number | null }[];
  /** Série diária; só vem preenchida em período de até 31 dias (senão `[]`). */
  dias?: { dia: string; questoes: number; acertoPct: number | null }[];
  semestres: { semestre: number; questoes: number; acertoPct: number | null }[];
  arvore: ArvoreQuestoes;
}

// ---------------------------------------------------------------------------
// §8.6 get_gestor_engajamento_questoes_alunos (pop-up do tema/assunto)
// ---------------------------------------------------------------------------

export interface AlunoDoNo {
  id: string;
  nome: string;
  semestre: number;
  questoes: number;
  acertoPct: number | null;
  ultimaAtividade: string;
}

export interface QuestoesAlunosEngajamento {
  no: {
    id: string;
    nome: string;
    ciclo: CicloTaxonomia;
    /** Clínico: `[grande área, especialidade]`. Básico: `['Ciclo básico', disciplina]`. */
    caminho: [string, string];
  };
  resumo: { alunos: number; questoes: number; acertoPct: number | null };
  alunos: AlunoDoNo[];
}

// ---------------------------------------------------------------------------
// §8.7 get_gestor_engajamento_conteudos (aba Conteúdos)
// ---------------------------------------------------------------------------

export interface FolhaConteudo {
  id: string;
  nome: string;
  tipo: TipoConteudoBanco;
  consumos: number;
  alunos: number;
}

export interface ModuloConteudo {
  modulo: string;
  consumos: number;
  alunos: number;
  conteudos: FolhaConteudo[];
}

export interface EspecialidadeConteudo {
  especialidade: string;
  consumos: number;
  alunos: number;
  modulos: ModuloConteudo[];
}

export interface ConteudosEngajamento {
  kpis: { consumos: number; videos: number; documentos: number; alunos: number; porAluno: number | null };
  meses: { mes: string; parcial: boolean; consumos: number }[];
  /** Série diária; só vem preenchida em período de até 31 dias (senão `[]`). */
  dias?: { dia: string; consumos: number }[];
  semestres: { semestre: number; consumos: number }[];
  arvore: EspecialidadeConteudo[];
}

// ---------------------------------------------------------------------------
// §8.8 get_gestor_engajamento_conteudo_alunos (pop-up do conteúdo)
// ---------------------------------------------------------------------------

export interface AlunoDoConteudo {
  id: string;
  nome: string;
  semestre: number;
  aberturas: number;
  consumos: number;
  /** ISO em UTC (`...Z`); o front converte para America/Sao_Paulo. */
  ultimaAbertura: string;
}

export interface ConteudoAlunosEngajamento {
  conteudo: {
    id: string | null;
    /** `null` quando o conteúdo não existe no recorte. */
    nome: string | null;
    tipo: TipoConteudoBanco | null;
    especialidade: string | null;
    modulo: string | null;
  };
  resumo: { alunos: number; consumos: number; aberturas: number };
  alunos: AlunoDoConteudo[];
}

/** Chave do nó da gaveta de conteúdos: o trio (`content_id`, `especialidade`, `modulo`). */
export interface ChaveConteudo {
  content_id: string;
  especialidade: string;
  modulo: string;
}

// ---------------------------------------------------------------------------
// §8.9 get_gestor_engajamento_export_alunos ("Exportar base de alunos (CSV)")
// ---------------------------------------------------------------------------

export interface LinhaExportAluno {
  nome: string;
  /** A única RPC que devolve e-mail. */
  email: string;
  semestre: number;
  questoes: number;
  acertoPct: number | null;
  videos: number;
  documentos: number;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
}

export interface ExportAlunosEngajamento {
  alunos: LinhaExportAluno[];
}

// ---------------------------------------------------------------------------
// §8.10 get_admin_engajamento (envelope próprio do admin)
// ---------------------------------------------------------------------------

export interface ProficienciaIes {
  pct: number | null;
  alunos: number;
  proficientes: number;
  simuladoId: string;
  simuladoNome: string;
  /** `'AAAA-MM-DD'` */
  dataReferencia: string;
}

export interface LinhaRankingIes {
  iesId: string;
  nome: string;
  base: number;
  engajados: number;
  engajadosPct: number | null;
  engajadosPctAnterior: number | null;
  semRetorno30Pct: number | null;
  videosPorEngajado: number | null;
  questoesPorEngajado: number | null;
  acertoPct: number | null;
  /** `null` = IES sem simulado ENAMED. */
  proficiencia: ProficienciaIes | null;
}

export interface AdminEngajamento {
  periodo: {
    inicio: string;
    fim: string;
    dias: number;
    hoje: string;
    anterior: { inicio: string; fim: string; comparavelConteudos: boolean };
  };
  recorte: { semestre: number | null };
  rede: {
    ies: number;
    baseAtiva: number;
    engajados: number;
    engajadosPct: number | null;
    /** Só com `p_semestre`. */
    engajadosPctRede: number | null;
    medianaEngajadosPctIes: number | null;
    semRetorno30: number;
    semRetorno30Pct: number | null;
    questoes: number;
    acertoPct: number | null;
  };
  ranking: LinhaRankingIes[];
  meses: {
    mes: string;
    parcial: boolean;
    questoes: number;
    acertoPct: number | null;
    videos: number;
    documentos: number;
    conteudos: number;
  }[];
  semestres: {
    semestre: number;
    questoes: number;
    acertoPct: number | null;
    videos: number;
    documentos: number;
    conteudos: number;
  }[];
}

/**
 * `get_gestor_engajamento_versao`: a versão dos dados do Engajamento (refresh incremental, Fase 5).
 * `atualizadoEm` é o MENOR entre o fim do último refresh ok e as cargas das fontes que ele leu; é `null`
 * até o pipeline rodar a primeira vez. O front só compara o valor com o anterior: mudou, os dados mudaram.
 */
export interface VersaoEngajamento {
  atualizadoEm: string | null;
}
