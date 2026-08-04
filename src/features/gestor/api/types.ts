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
  /**
   * `null` fora do status `realizado`, e também em `realizado` sem registro de
   * participação — nunca `0`. Note que é `| null` e não apenas opcional: o JSON
   * traz `null`, que não é `undefined`, então um teste por `undefined` não pega.
   */
  participantes: number | null;
  /**
   * Quinto campo da classe de nulabilidades da Fase 1 — os outros quatro
   * (`participantes`, `Alternativa.marcadaPct`, `Questao.acertoPct`,
   * `VisaoGeral.distribuicaoAlunos[].percentual`) saíram no commit 778dee7f;
   * este ficou pendente por decisão explícita ali ("vale decidir junto com o
   * Felipe"). A RPC devolve `null` fora de `previsto`/`processing` — não
   * `undefined` — então o mesmo motivo dos outros quatro se aplica: um teste
   * por `undefined` não pega o caso.
   */
  indisponivelPorque?: string | null;
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
  /** `percentual` é `null` quando nenhum aluno tem resultado de TRI no recorte
   *  (denominador zero) — nunca `0`. `quantidade` continua `0` legitimamente,
   *  porque contagem de grupo vazio é zero de verdade. */
  distribuicaoAlunos: { grupo: GrupoEvolucao; quantidade: number; percentual: number | null }[];
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
  /**
   * `null` quando nenhum simulado do recorte tem TRI para o aluno (achado do
   * Felipe, item 3c, 04/08) — mesmo princípio de `grupoEvolucao()` em
   * `lib/regras.ts`, que já devolve `null` para "sem ponto utilizável" em vez
   * de inventar um grupo. `get_gestor_alunos` (20260729210600, linha ~164)
   * ainda devolve `'em_variacao'` nesse caso em produção — a SQL NÃO foi
   * corrigida (exige migration em RPC de produção; fora do escopo desta
   * correção de front). Até lá, o tipo documenta a intenção; o servidor real
   * nunca envia `null` para este campo.
   */
  grupo: GrupoEvolucao | null;
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
  /**
   * Quarto estado (03/08): `aguardando_resultado` é o aluno que PARTICIPOU do
   * simulado mas ainda não tem nota TRI — `proficiencia: null` com
   * `participou: true`. Não é o mesmo caso que `abaixo_do_limiar`, que exige
   * nota conhecida e abaixo do corte.
   *
   * Por quê precisa existir: a nota TRI sobe depois, num pipeline Python que
   * roda sobre as respostas — então "participou mas sem nota" não é borda, é o
   * estado normal de todo simulado recém-encerrado, justo quando a
   * coordenadora mais olha a tela. Antes deste estado, o servidor devolvia
   * `abaixo_do_limiar` para esse caso, o que afirmava que a nota da turma
   * inteira estava abaixo do corte — falso.
   *
   * Por quê este nome: `aguardando_resultado` descreve o estado do PIPELINE
   * ("o resultado ainda não foi processado"), não o comportamento do aluno —
   * ao contrário de `nao_participou`, que é sobre o aluno. Evita nomes como
   * `sem_nota` ou `pendente`, que não deixam claro que o aluno já fez a prova.
   */
  situacao: 'proficiente' | 'abaixo_do_limiar' | 'aguardando_resultado' | 'nao_participou';
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
  /** `null` quando ninguém marcou alternativa nesta questão — nunca `0`. */
  marcadaPct: number | null;
}

export interface Questao {
  numero: number;
  grandeArea: string;
  especialidade: string;
  tema: string;
  /** `null` quando ninguém respondeu esta questão — nunca `0`. */
  acertoPct: number | null;
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

/** Recorte global da tela — o que `useFiltrosGestor` devolve, na forma que as RPCs consomem. */
export interface FiltrosGestor {
  iesId: string | null;
  semestre: FiltroSemestre;
  simulados: string[];
}

/** Paginação/ordenação das listas paginadas no servidor (alunos, questões). */
export interface PaginacaoGestor {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
  area?: string;
}
