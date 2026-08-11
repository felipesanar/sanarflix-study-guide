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

/**
 * `kpis.enamedProjetado` acrescido de `origem` (campo novo confirmado em
 * produção em `get_gestor_visao_geral`): `'oficial'` quando a RPC tem a nota
 * oficial do MEC para o recorte atual, `'estimado'` quando ela falta e o
 * conceito 1–5 é derivado do percentual de alunos proficientes — o mesmo
 * cálculo que já valia antes deste campo existir (ver `criterio`), agora
 * identificado explicitamente em vez de ficar implícito.
 */
export interface KpiEnamedProjetado extends Kpi {
  origem: 'oficial' | 'estimado';
}

export interface VisaoGeral {
  kpis: {
    enamedProjetado: KpiEnamedProjetado;
    proficientesPct: Kpi;
    acertoPct: Kpi;
    /**
     * `realizados` é RECALCULADO no cliente (`contarSimuladosComNotaReal`,
     * `api/queries.ts`, dentro de `useVisaoGeral`) a partir de `evolucao`:
     * conta pontos com `valor !== null`, a MESMA condição que decide se o
     * simulado aparece com nota real no gráfico "Evolução institucional"
     * (`EvolucaoChart`, que usa `connectNulls={false}`). NÃO é mais o valor
     * cru que a RPC devolve neste campo (slots do contrato vigente com
     * simulado vinculado) — aquele número zera sempre que a IES não tem
     * `ies_simulado_previsto` vinculado, mesmo com simulados reais no
     * gráfico (achado de 05/08, IES FAI: "0 de —" ao lado de 3 simulados com
     * nota no gráfico, mesma tela).
     *
     * `contratados` é `null` quando a IES não tem linha em
     * `ies_contrato_simulados` — nunca `0` (spec §4.10, "nunca zero onde não há
     * dado"). O front renderiza TRACO nesse caso. Este campo CONTINUA vindo
     * direto da RPC, sem recálculo — só `realizados` muda de fonte.
     */
    simulados: { realizados: number; contratados: number | null };
  };
  /**
   * Total de alunos matriculados da IES no recorte vigente (campo novo
   * confirmado em produção em `get_gestor_visao_geral`, mesmo nível de
   * `kpis`/`evolucao`) — a POPULAÇÃO real, sem o corte que
   * `distribuicaoAlunos` aplica. `distribuicaoAlunos.reduce(...)` conta só
   * quem tem ao menos um resultado de TRI no recorte; este campo é sempre
   * `>=` aquela soma, e normalmente maior (bug documentado, não é o que este
   * campo corrige — ele só dá o denominador honesto para contextualizar o
   * corte, ver `VisaoDeAlunos`).
   */
  alunosMatriculadosNoRecorte: number;
  /**
   * Semestres da IES que têm ao menos um aluno com nota de proficiência —
   * SEM o recorte vigente aplicado. Alimenta o dropdown "Por semestre".
   *
   * Existe porque o dropdown era montado a partir de `dispersao`, que É
   * recortada: desde que o filtro `6ano` passou a valer de verdade
   * (migration `20260807200000_gestor_recorte_6ano_e_conceito_geral.sql`),
   * derivar as opções de `dispersao` faria o gestor em "6º ano" ver só 11º e
   * 12º no dropdown — as outras dez sumiriam justamente porque o recorte
   * começou a funcionar, e não haveria caminho de volta.
   *
   * Opcional no tipo: RPCs antigas (e mocks de teste) não devolvem o campo, e
   * nesse caso o consumidor volta a derivar de `dispersao`.
   */
  semestresComResultado?: number[];
  evolucao: {
    simuladoId: string;
    nome: string;
    data: string;
    /** Média de proficiência do simulado. `null` = TRI ainda não processado. */
    valor: number | null;
    /**
     * Percentual de alunos proficientes (nota >= 60) no simulado — a MESMA
     * conta do KPI "Alunos proficientes". É a série do gráfico "Evolução
     * institucional" no modo Geral. Opcional porque RPCs antigas e mocks não
     * devolvem o campo; `null`/ausente é buraco na série, nunca zero (§4.10).
     */
    proficientesPct?: number | null;
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
  /**
   * Alunos distintos com resposta neste nó — base do `lowSample`/"cobertura
   * parcial" (§ o quanto a turma participou, não quanto ela respondeu).
   */
  amostra: number;
  /**
   * Total de respostas neste nó (campo novo, 09/08) — é isso, não `amostra`,
   * que alimenta `acertoPct` (`count(*)`, nunca média por aluno). Exibir
   * este número, não `amostra`, ao lado do percentual: `amostra` responde
   * "quantos alunos", `respostas` responde "quanto dado sustenta esse %".
   */
  respostas: number;
  lowSample: boolean;
  temFilhos: boolean;
}

export interface TemaCritico {
  id: string;
  nome: string;
  acertoPct: number;
  amostra: number;
  /** Ver `NoDiagnostico.respostas` — mesma distinção alunos × respostas. */
  respostas: number;
  lowSample: boolean;
}

/**
 * Uma posição de `LinhaAluno.proficiencias`: a proficiência do aluno num
 * simulado específico, identificado por `simuladoId` — nunca por posição no
 * array. Contrato decidido por Felipe em 05/08 (decisão 1, "Decisões
 * abertas", de `docs/superpowers/notes/2026-08-05-handoff-portal-gestor-v2.md`:
 * "Contrato de proficiencias (o mais importante)"). Migration
 * `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql` aplicada
 * em produção em 05/08 (readback confirmou `simuladoId` no corpo vivo da
 * função) — `get_gestor_alunos` só devolve esta forma.
 *
 * Antes desta mudança, `get_gestor_alunos` devolvia `proficiencias` como
 * array anônimo `(number | null)[]`, e `TabelaAlunos` casava por ÍNDICE com
 * `colunasSimulados` (que vem de `get_gestor_visao_geral`, outro recorte de
 * simulados — a visão geral filtra por semestre, esta RPC não). Quando os
 * dois recortes coincidem em TAMANHO mas não em CONTEÚDO, casar por índice
 * desloca a nota de um simulado para a coluna de outro, silenciosamente — o
 * mitigador antigo (TRAÇO na linha inteira quando os TAMANHOS divergiam)
 * nunca cobria esse caso, e por isso saiu.
 *
 * `simuladoId` é `simulados_admin.id` do simulado "pai" — o mesmo espaço de
 * id que `VisaoGeral.evolucao[].simuladoId`/`colunasSimulados[].id`, o que
 * permite casar as duas listas com segurança.
 *
 * `simuladoId: null` não é mais artefato do array legado — esse ramo saiu de
 * `normalizarProficiencia` (`api/queries.ts`) junto com a migration acima.
 * Hoje só acontece se a RPC devolver uma posição malformada (campo ausente ou
 * de tipo inesperado): `normalizarProficiencia` valida cada campo porque
 * `chamarRpcGestor` faz um cast não verificado a partir da resposta bruta.
 * Nesse ramo a tabela não encontra correspondência em `colunasSimulados` e
 * mostra TRAÇO só naquela célula, nunca a linha inteira.
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
   * linha inteira — ver `ProficienciaSimulado` para o porquê do casamento por
   * id e para os casos em que `simuladoId` vem `null`.
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

/**
 * Contato do aluno — `get_gestor_aluno_contato(p_aluno_id)`, já em produção
 * desde 31/07. Decisão de Felipe: qualquer gestor com acesso ao aluno vê o
 * telefone, sem flag de permissão extra — mesma régua que valia no
 * `StudentAnalyticsDrawer` do console antigo, removido em 05/08 (este tipo
 * existe para o dado não sumir de produção sem substituto, ver handoff).
 *
 * Ao contrário de TODO outro `get_gestor_*`, esta RPC NÃO devolve o envelope
 * `{ data, meta }` — devolve `{ id, telefone }` direto (migration
 * `20260804171500_get_gestor_aluno_contato_gestor_pode_acessar_ies.sql`:
 * `RETURN jsonb_build_object('id', p_aluno_id, 'telefone', v_telefone)`, sem
 * chave `data`/`meta`). Faz sentido: telefone é dado de cadastro cru, não um
 * indicador calculado — não há "fonte/critério" de rastreabilidade (spec
 * §4.1) para expor. Por isso `useAlunoContato` (`api/queries.ts`) não passa
 * por `useEnvelope`/`chamarRpcGestor`: usá-los aqui leria `.data`/`.meta` de
 * um objeto que não os tem e devolveria `undefined` mesmo numa resposta de
 * sucesso.
 *
 * `telefone: null` é o aluno sem telefone cadastrado (`public.users.telefone`
 * é nullable) — nunca string vazia. Renderiza TRACO, nunca um espaço em branco.
 */
export interface AlunoContato {
  id: string;
  telefone: string | null;
}

export interface MetricasSimulado {
  simuladoId: string;
  nome: string;
  data: string;
  participantes: number;
  acertoMedioPct: number | null;
  enamedProjetado: number | null;
  proficienciaMedia: number | null;
  /**
   * Percentual de alunos proficientes (nota ≥ 60) entre quem tem nota TRI no
   * simulado. Campo aditivo do envelope de `get_gestor_detalhamento`
   * (11/08): é a série que "Evolução do recorte" plota, no lugar da média de
   * proficiência. `null` quando nenhum aluno tem TRI no simulado — nunca 0.
   */
  proficientesPct?: number | null;
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
  /**
   * Imagem do enunciado — URL ou `null` quando a questão não tem imagem.
   * Chave sempre presente na resposta (nunca omitida), então `null` é o
   * único caso de "sem imagem" — `undefined` não é uma forma real deste
   * campo. Migration `20260809231000_get_gestor_questoes_semestre_imagens_e_respondentes.sql`
   * (PARTE 1), já em produção em 09/08.
   */
  imagemEnunciado: string | null;
  /** Segunda imagem do enunciado (ex.: gráfico e tabela na mesma questão) — mesma regra de `imagemEnunciado`. */
  imagemEnunciado2: string | null;
  /**
   * Imagem do comentário/gabarito. `null` TAMBÉM enquanto o simulado está
   * ABERTO — a RPC zera este campo antes do encerramento (`CASE WHEN
   * v_aberta THEN NULL ELSE o.imagem_comentario END`), mesmo tratamento que
   * `correta`/`distratorDominante` já recebem. Por isso este campo não
   * distingue "questão sem imagem de gabarito" de "simulado ainda aberto" —
   * os dois chegam `null`.
   */
  imagemComentario: string | null;
  /**
   * Identificador da questão (`questoes_simulado.id`) — necessário para
   * `get_gestor_questao_respondentes(p_question_id, ...)`, que a distribuição
   * por alternativa (`DistribuicaoAlternativas`) chama ao clicar numa
   * alternativa para listar quem a marcou.
   *
   * OPCIONAL, e por um motivo real: `get_gestor_questoes` (mesma migration
   * acima) SELECIONA `q.id` internamente (`q_base`/`q_full`/`q_alts` o usam
   * para fazer JOIN entre as CTEs) mas nunca o inclui no `jsonb_build_object`
   * de cada questão — conferido nas duas versões da função (a `CREATE OR
   * REPLACE` de 29/07 e o patch textual de 09/08, nenhuma das duas expõe uma
   * chave `id`/`questaoId`). Até uma migration futura acrescentar essa chave,
   * este campo chega `undefined` em todo payload real, e a UI mostra "lista
   * indisponível" no clique em vez de chamar a RPC com um id inventado.
   */
  id?: string;
}

/**
 * Uma linha de `get_gestor_questao_respondentes(p_ies_id, p_question_id,
 * p_alternativa)` — aluno que marcou aquela alternativa daquela questão.
 * RPC nova (migration `20260809231000_..._respondentes.sql`, PARTE 2, já em
 * produção em 09/08), consumida por `useQuestaoRespondentes` (`api/queries.ts`)
 * a partir do clique numa linha de `DistribuicaoAlternativas`.
 */
export interface QuestaoRespondente {
  alunoId: string;
  nome: string;
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
  /**
   * Filtro por grupo de evolução — só `useAlunos`/`get_gestor_alunos`
   * consome (mesmo padrão de `area`, que só `useQuestoes` usa: a interface é
   * o formato genérico de paginação, cada RPC lê os campos que lhe cabem).
   * `null`/ausente = sem filtro, todos os grupos.
   */
  grupo?: GrupoEvolucao | null;
}
