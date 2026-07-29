/**
 * Contratos de dado do Portal do Gestor v2.
 * Espelha `contracts/types.ts` do handoff de design, com duas divergências
 * deliberadas resolvidas na spec:
 *  - NÃO existe `notaTri`: "Nota TRI" foi eliminada como métrica separada e o
 *    rótulo único é "Proficiência" (spec §4.1).
 *  - Papéis são `admin | gestor_grupo | gestor` do enum `app_role`, não
 *    `admin_b2b | gestor_grupo | gestor_ies` do handoff (spec §3).
 */

export type FiltroSemestre =
  | '6ano'
  | 'geral'
  | '1' | '2' | '3' | '4' | '5' | '6'
  | '7' | '8' | '9' | '10' | '11' | '12';

export type NivelDesempenho = 'excelente' | 'mediano' | 'critico';

export type GrupoEvolucao =
  | 'consistentemente_proficiente'
  | 'em_variacao'
  | 'consistentemente_nao_proficiente';

export type StatusSimulado =
  | 'realizado'
  | 'agendado'
  | 'reagendado'
  | 'previsto'
  | 'processing';

export type Tendencia = 'subindo' | 'descendo' | 'alternando' | 'estavel';

export type ModoGrafico = 'geral' | 'area' | 'aluno';

/** Rastreabilidade obrigatória de todo indicador (spec §4.1). */
export interface Meta {
  periodo: string;
  fonte: string;
  atualizadoEm: string;
  criterio: string;
  partial: boolean;
  lowSample: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface Paginado<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContextoGestor {
  usuario: { id: string; nome: string; papel: 'admin' | 'gestor_grupo' | 'gestor' };
  iesDisponiveis: { id: string; nome: string }[];
  iesAtual: { id: string; nome: string };
  contrato: { nome: string; simuladosContratados: number; vigencia: string } | null;
  podeTrocarIes: boolean;
  podeExportar: boolean;
}

export interface ItemCronograma {
  id: string;
  nome: string;
  data: string | null;
  status: StatusSimulado;
  modalidade: 'online' | 'presencial' | null;
  participantes?: number;
  indisponivelPorque?: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
  lido: boolean;
}

export interface PontoSerie {
  rotulo: string;
  valor: number | null;
}

export interface Kpi {
  valor: number | null;
  delta: number | null;
  serie: PontoSerie[];
  criterio: string;
}

export interface VisaoGeral {
  kpis: {
    enamedProjetado: Kpi;
    proficientesPct: Kpi;
    acertoPct: Kpi;
    /**
     * `contratados` é `null` quando a IES não tem linha em
     * `ies_contrato_simulados` — nunca `0` (spec §4.10, "nunca zero onde não há
     * dado"). O front renderiza TRACO nesse caso.
     */
    simulados: { realizados: number; contratados: number | null };
  };
  evolucao: {
    simuladoId: string;
    nome: string;
    data: string;
    valor: number | null;
    participantes: number;
  }[];
  evolucaoPorArea: { area: string; pontos: PontoSerie[]; critica: boolean }[];
  diagnosticoResumo: {
    nivel: NivelDesempenho;
    areas: { id: string; nome: string; acertoPct: number }[];
  }[];
  distribuicaoAlunos: { grupo: GrupoEvolucao; quantidade: number; percentual: number }[];
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  insights: { escopo: 'area' | 'aluno'; texto: string }[];
}

export interface NoDiagnostico {
  id: string;
  nome: string;
  nivel: 'grande_area' | 'especialidade';
  acertoPct: number;
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

export interface LinhaAluno {
  id: string;
  nome: string;
  semestre: number;
  grupo: GrupoEvolucao;
  proficiencias: (number | null)[];
  tendencia: Tendencia;
}

export interface AlunoNoSimulado {
  id: string;
  nome: string;
  semestre: number;
  participou: boolean;
  acertos: number | null;
  proficiencia: number | null;
  situacao: 'proficiente' | 'abaixo_do_limiar' | 'nao_participou';
  posicao?: { lugar: number; total: number; percentil: number };
  acertoPorArea?: { area: string; acertoPct: number; critica: boolean }[];
  variacao?: number | null;
}

export interface MetricasSimulado {
  simuladoId: string;
  nome: string;
  data: string;
  participantes: number;
  acertoMedioPct: number | null;
  enamedProjetado: number | null;
  proficienciaMedia: number | null;
}

export interface Alternativa {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  texto: string;
  correta: boolean;
  marcadaPct: number;
}

export interface Questao {
  numero: number;
  grandeArea: string;
  especialidade: string;
  tema: string;
  acertoPct: number;
  enunciado: string;
  alternativas: Alternativa[];
  distratorDominante?: Alternativa['letra'];
}

export interface AcertoPorAreaESemestre {
  areas: { id: string; nome: string; acertoPct: number; critica: boolean }[];
  semestres: { semestre: number; acertoPct: number; emEvidencia: boolean }[];
  recorte?: { tipo: 'area' | 'semestre'; id: string };
}

export interface Detalhamento {
  metricas: MetricasSimulado[];
  acertoPorAreaESemestre: AcertoPorAreaESemestre;
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  questoes?: Paginado<Questao>;
  comparativoTemas?: {
    tema: string;
    porSimulado: { simuladoId: string; acertoPct: number }[];
  }[];
}
