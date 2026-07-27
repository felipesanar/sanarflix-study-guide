/**
 * Portal do Gestor · SanarFlix Academy
 * Contratos de dados que a UI consome. Fonte da verdade do frontend.
 * Regras de negócio associadas: docs/02-regras-de-negocio.md
 */

// ─── Primitivos ────────────────────────────────────────────────────────────

/** Semestre = período do aluno. "6ano" é o recorte padrão (11º e 12º em evidência). */
export type FiltroSemestre = '6ano' | 'geral' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export type NivelDesempenho = 'excelente' | 'mediano' | 'critico';
export type GrupoEvolucao = 'consistentemente_proficiente' | 'em_variacao' | 'consistentemente_nao_proficiente';
export type StatusSimulado = 'realizado' | 'agendado' | 'reagendado' | 'previsto' | 'processing';
export type Papel = 'admin_b2b' | 'gestor_grupo' | 'gestor_ies';

/** Toda resposta agregada carrega rastreabilidade — alimenta o tooltip do "i". */
export interface Meta {
  periodo: string;          // "6º ano · 3 simulados"
  fonte: string;            // "Simulados Academy · gabarito oficial"
  atualizadoEm: string;     // ISO 8601
  criterio: string;         // texto exibido no tooltip (vem do backend)
  partial: boolean;
  lowSample: boolean;
}

export interface Envelope<T> { data: T; meta: Meta; }
export interface Paginado<T> { data: T[]; page: number; pageSize: number; total: number; totalPages: number; }

// ─── Contexto e permissões ─────────────────────────────────────────────────

export interface ContextoGestor {
  usuario: { id: string; nome: string; papel: Papel };
  /** Só tem mais de 1 item para admin_b2b e gestor_grupo. */
  iesDisponiveis: { id: string; nome: string }[];
  iesAtual: { id: string; nome: string };
  contrato: { nome: string; simuladosContratados: number; vigencia: string };
  /** UI: dropdown de IES só é clicável quando true. */
  podeTrocarIes: boolean;
  podeExportar: boolean;
}

// ─── Início ────────────────────────────────────────────────────────────────

export interface ItemCronograma {
  id: string;
  nome: string;               // "Simulado Nacional 2"
  data: string | null;        // null = contratado sem data
  status: StatusSimulado;
  participantes?: number;
  /** motivo exibido quando desabilitado (previsto/processing) */
  indisponivelPorque?: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
  lido: boolean;
}

// ─── Visão Geral ───────────────────────────────────────────────────────────

export interface PontoSerie { rotulo: string; valor: number | null; }

export interface Kpi {
  /** valor null = sem dado no recorte; NUNCA usar 0 como "sem dado". */
  valor: number | null;
  delta: number | null;
  /** régua "1º simulado · anterior · atual"; some quando há só 1 simulado. */
  serie: PontoSerie[];
  criterio: string;
}

export interface VisaoGeral {
  kpis: {
    /** Conceito ENAMED PROJETADO (1–5). Nunca média com 2+ simulados. */
    enamedProjetado: Kpi;
    proficientesPct: Kpi;    // % de alunos com proficiência > 60
    acertoPct: Kpi;          // % de acerto
    simulados: { realizados: number; contratados: number };
  };
  /** Evolução da proficiência por simulado (série institucional). */
  evolucao: { simuladoId: string; nome: string; data: string; valor: number; participantes: number }[];
  /** Séries alternativas do gráfico protagonista: "Grande área" | "Aluno". */
  evolucaoPorArea: { area: string; pontos: PontoSerie[]; critica: boolean }[];
  diagnosticoResumo: { nivel: NivelDesempenho; areas: { id: string; nome: string; acertoPct: number }[] }[];
  distribuicaoAlunos: { grupo: GrupoEvolucao; quantidade: number; percentual: number }[];
  /** Dispersão nota × semestre + linha de tendência. */
  dispersao: { alunoId: string; semestre: number; nota: number }[];
}

// ─── Diagnóstico curricular ────────────────────────────────────────────────

/** Hierarquia: grande área → especialidade → tema (tema só no drawer). */
export interface NoDiagnostico {
  id: string;
  nome: string;
  nivel: 'grande_area' | 'especialidade';
  acertoPct: number;          // áreas usam % de acerto, NUNCA proficiência
  desempenho: NivelDesempenho;
  amostra: number;
  lowSample: boolean;
  temFilhos: boolean;
}

export interface TemaCritico {
  id: string;
  nome: string;
  acertoPct: number;
  amostra: number;
  lowSample: boolean;
}

// ─── Alunos ────────────────────────────────────────────────────────────────

export interface LinhaAluno {
  id: string;
  nome: string;
  semestre: number;                  // período do aluno
  grupo: GrupoEvolucao;
  /** proficiência por simulado, na ordem cronológica; null = não participou */
  proficiencias: (number | null)[];
  tendencia: 'subindo' | 'descendo' | 'alternando' | 'estavel';
}

export interface AlunoNoSimulado {
  id: string;
  nome: string;
  semestre: number;
  participou: boolean;
  acertos: number | null;
  notaTri: number | null;            // 0–100, só no Detalhamento
  proficiencia: number | null;       // 0–100
  situacao: 'proficiente' | 'abaixo_do_limiar' | 'nao_participou';
  posicao?: { lugar: number; total: number; percentil: number };
  acertoPorArea?: { area: string; acertoPct: number; critica: boolean }[];
  /** só quando o aluno participou de TODOS os simulados comparados */
  variacao?: number | null;
}

// ─── Detalhamento ──────────────────────────────────────────────────────────

export interface MetricasSimulado {
  simuladoId: string;
  nome: string;
  data: string;
  participantes: number;
  acertoMedioPct: number;
  /** conceito projetado 1–5 — nunca média entre simulados */
  enamedProjetado: number;
  proficienciaMedia: number;
}

export interface Alternativa { letra: 'A' | 'B' | 'C' | 'D' | 'E'; texto: string; correta: boolean; marcadaPct: number; }

export interface Questao {
  numero: number;
  grandeArea: string;
  especialidade: string;
  tema: string;
  acertoPct: number;
  enunciado: string;
  alternativas: Alternativa[];
  /** letra do distrator mais marcado, quando dominante */
  distratorDominante?: Alternativa['letra'];
}

export interface AcertoPorAreaESemestre {
  areas: { id: string; nome: string; acertoPct: number; critica: boolean }[];
  semestres: { semestre: number; acertoPct: number; emEvidencia: boolean }[];
  /** valores recalculados quando o usuário clica em uma área ou em um semestre */
  recorte?: { tipo: 'area' | 'semestre'; id: string };
}

export interface Detalhamento {
  /** SEMPRE uma entrada por simulado selecionado. Nunca média única. */
  metricas: MetricasSimulado[];
  acertoPorAreaESemestre: AcertoPorAreaESemestre;
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  /** só vem quando exatamente 1 simulado está selecionado */
  questoes?: Paginado<Questao>;
  /** comparação por tema quando há 2+ simulados */
  comparativoTemas?: { tema: string; porSimulado: { simuladoId: string; acertoPct: number }[] }[];
}

// ─── Erros ─────────────────────────────────────────────────────────────────

/** RFC 7807 */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  traceId?: string;
}
