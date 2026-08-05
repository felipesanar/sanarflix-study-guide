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

/**
 * Uma posição de `LinhaAluno.proficiencias`: a proficiência do aluno num
 * simulado específico, identificado por `simuladoId` — nunca por posição no
 * array. Contrato decidido por Felipe em 05/08 (decisão 1, "Decisões
 * abertas", de `docs/superpowers/notes/2026-08-05-handoff-portal-gestor-v2.md`:
 * "Contrato de proficiencias (o mais importante)").
 *
 * Antes desta mudança, `get_gestor_alunos` devolvia `proficiencias` como
 * array anônimo `(number | null)[]`, e `TabelaAlunos` casava por ÍNDICE com
 * `colunasSimulados` (que vem de `get_gestor_visao_geral`, outro recorte de
 * simulados — a visão geral filtra por semestre, esta RPC não). Quando os
 * dois recortes coincidem em TAMANHO mas não em CONTEÚDO, casar por índice
 * desloca a nota de um simulado para a coluna de outro, silenciosamente — o
 * mitigador antigo (TRAÇO na linha inteira quando os TAMANHOS divergiam)
 * nunca cobria esse caso, e por isso saiu (migration
 * `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql`).
 *
 * `simuladoId` é `simulados_admin.id` do simulado "pai" — o mesmo espaço de
 * id que `VisaoGeral.evolucao[].simuladoId`/`colunasSimulados[].id`, o que
 * permite casar as duas listas com segurança.
 *
 * `simuladoId: null` é só o artefato transitório da normalização de
 * compatibilidade em `api/queries.ts` (`normalizarLinhaAluno`): enquanto a
 * migration acima não estiver aplicada em produção — o ambiente de
 * desenvolvimento aponta para o banco de produção —, a RPC ainda devolve o
 * array legado de números soltos, sem identificar a qual simulado cada
 * posição pertence, informação que não existe para recuperar no cliente.
 * Nesse ramo a tabela não encontra correspondência em `colunasSimulados` e
 * mostra TRAÇO. Sai quando a migration for aplicada em produção: a partir daí
 * toda posição chega com o id real.
 */
export interface ProficienciaSimulado {
  simuladoId: string | null;
  valor: number | null;
}

export interface LinhaAluno {
  id: string;
  nome: string;
  /**
   * `null` quando o aluno foi provisionado (ex.: pelo CX) e ainda não
   * preencheu o semestre — `public.users.semestre` é nullable no banco
   * (achado 20, card 118 da revisão de 03/08). Os recortes `geral` e `6ano`
   * de `get_gestor_alunos` NÃO filtram `semestre IS NOT NULL`, ao contrário
   * de `get_gestor_visao_geral`/`get_gestor_detalhamento`, que filtram — esta
   * linha chega à UI. Exibir `TRACO` (via `formatNumero`), nunca `0`: zero
   * afirmaria "o aluno está no semestre zero", que é falso (spec §4.10) —
   * mesma classe das nulabilidades do commit 778dee7f.
   */
  semestre: number | null;
  /**
   * `null` quando o aluno não tem NENHUM resultado de TRI na janela — grupo
   * indefinido, não "em variação". Mesma família de decisão de
   * `AlunoNoSimulado.situacao === 'aguardando_resultado'`: a nota TRI sobe
   * depois, por pipeline externo, então "sem nota ainda" é o estado normal de
   * um simulado recém-encerrado, não uma borda. Mesmo princípio de
   * `grupoEvolucao()` em `lib/regras.ts`, que devolve `null` para "sem ponto
   * utilizável" em vez de inventar um grupo. Renderiza como `TRACO` via
   * `rotuloGrupo`.
   *
   * Achado 4 da revisão de 03/08. O tipo passou a aceitar `null` em
   * `873abc7a`, mas ali a SQL ainda devolvia `'em_variacao'` — ou seja, o
   * servidor nunca enviava `null` e o valor errado continuava chegando. A
   * causa raiz foi corrigida na migration
   * `20260804140000_get_gestor_alunos_guard_grupo_tendencia.sql`, que **não
   * está aplicada em produção ainda**: até alguém aplicar, o front recebe
   * `'em_variacao'` de um aluno sem nenhuma nota.
   */
  grupo: GrupoEvolucao | null;
  /**
   * Uma posição por simulado do recorte que `get_gestor_alunos` considera, na
   * ORDEM CRONOLÓGICA que a própria RPC já usa. Cada posição identifica o
   * simulado por `simuladoId` — a tabela casa por ESTE id contra
   * `colunasSimulados` (que vem de `get_gestor_visao_geral`, um recorte de
   * simulados DIFERENTE: a visão geral filtra por semestre, esta RPC não).
   * Coluna sem entrada correspondente = TRAÇO só naquela célula, nunca a
   * linha inteira — ver `ProficienciaSimulado` para o porquê e para a
   * nulabilidade transitória de compatibilidade com o array legado.
   */
  proficiencias: ProficienciaSimulado[];
  tendencia: Tendencia;
}

export interface AlunoNoSimulado {
  id: string;
  nome: string;
  /** Nullable pelo mesmo motivo de `LinhaAluno.semestre` acima (achado 20, card 118). */
  semestre: number | null;
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

/**
 * Uma entrada do array devolvido por `get_gestor_aluno` — a RPC materializa
 * UMA LINHA POR SIMULADO da janela consultada via `jsonb_agg`
 * (`20260803150000_get_gestor_aluno_aguardando_resultado.sql`), nunca um
 * objeto singular. É `AlunoNoSimulado` acrescido dos três campos que
 * identificam A QUAL simulado aquela linha pertence — sem eles, as N
 * entradas do array seriam indistinguíveis entre si (mesmo `id`/`nome`/
 * `semestre` do aluno repetidos, uma vez por simulado).
 *
 * Este é o "tipo de entrada" que faltava no card 106 da revisão de 03/08: o
 * 1º critério do card não estava cumprido porque `useAluno` tipava sua saída
 * como `AlunoNoSimulado[]` puro, sem estes três campos — apesar de a RPC já
 * devolvê-los desde 03/08.
 *
 * Nulabilidade real, lida do `jsonb_build_object` da migration (não a do
 * card nem a do handoff original, que assumiam `string` sem verificar):
 * - `simuladoId` = `sims_ord.id`, chave primária de `simulados_admin` — NOT
 *   NULL.
 * - `simuladoNome` = `simulados_admin.nome` da mesma linha — NOT NULL.
 * - `simuladoData` = `to_char(COALESCE(data_realizacao, data_encerramento,
 *   data_liberacao, created_at) AT TIME ZONE 'UTC', ...)` — `created_at` é
 *   sempre preenchido, então a cadeia de `COALESCE` nunca chega a `NULL` e
 *   `to_char` nunca devolve `NULL`.
 *
 * As três, portanto, são `string`, nunca `string | null`.
 */
export interface AlunoSimuladoEntry extends AlunoNoSimulado {
  simuladoId: string;
  simuladoNome: string;
  simuladoData: string;
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
