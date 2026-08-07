/**
 * Fixtures da Task 57 (spec §12 — 17 casos de teste críticos).
 *
 * Nota importante para quem ler isto depois de olhar o plano
 * (`docs/superpowers/plans/2026-07-25-portal-gestor-v2.md`, Task 57): o
 * arquivo que o plano propõe (`fixturesRegrasCriticas.ts`, com `criarRpcMock`
 * mockando `supabase.rpc`) não corresponde ao padrão real desta árvore. Os
 * testes de componente do gestor mockam `@/features/gestor/api/queries` (a
 * camada de hooks) — ver `VisaoGeral.test.tsx`, `TabelaAlunos.test.tsx`,
 * `seguranca-lgpd.test.tsx`. Por isso as fixtures abaixo são dados de domínio
 * puros (tipados contra `api/types.ts`/`api/detalhamentoExtras.ts` REAIS,
 * checados nesta sessão) mais um helper `resultadoOk()` que já devolve a
 * forma `ResultadoGestor<T>` que os hooks mockados retornam — não o envelope
 * `{data, meta}` da RPC.
 *
 * Também diverge do plano: `LinhaAluno.proficiencias` não é mais
 * `number[]` — é `ProficienciaSimulado[]` (`{simuladoId, valor}`) desde a
 * migration `20260805160000_get_gestor_alunos_proficiencias_por_simulado.sql`
 * (ver `api/types.ts`). Os poucos números aqui que usam essa forma já
 * refletem o contrato atual.
 */
import { vi } from 'vitest';
import type {
  AlunoNoSimulado,
  ContextoGestor,
  ItemCronograma,
  Meta,
  MetricasSimulado,
  Questao,
  TemaCritico,
  VisaoGeral,
} from '@/features/gestor/api/types';
import type {
  AcertoPorAreaESemestreComMatriz,
  CelulaAreaSemestre,
  DetalhamentoComExtras,
} from '@/features/gestor/api/detalhamentoExtras';

// ─────────────────────────────────────────────────────────────────────────────
// Identificadores
// ─────────────────────────────────────────────────────────────────────────────

export const IES_ID = '11111111-1111-4111-8111-111111111111';
/** IES "de outra instituição" — nunca deve aparecer na tela do gestor da IES_ID (caso 17). */
export const IES_BETA_ID = '55555555-5555-4555-8555-555555555555';
/** UUID fora de `iesDisponiveis` — simula o parâmetro `?ies=` de um acesso indevido (caso 17). */
export const IES_FORA_DE_ESCOPO_ID = 'aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa';

export const SIM_1 = 'bbbbbbbb-0000-4bbb-8bbb-bbbbbbbbbbb1';
export const SIM_2 = 'bbbbbbbb-0000-4bbb-8bbb-bbbbbbbbbbb2';

export const ALUNO_ID = '33333333-3333-4333-8333-333333333333';
export const ALUNO_SEM_PARTICIPACAO_ID = '99999999-9999-4999-8999-999999999999';

// ─────────────────────────────────────────────────────────────────────────────
// Meta / helper de resultado de hook
// ─────────────────────────────────────────────────────────────────────────────

export const META: Meta = {
  periodo: '01/01/2026 a 26/07/2026',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T12:00:00.000Z',
  criterio: 'Proficiência >= 60',
  partial: false,
  lowSample: false,
};

/**
 * Forma exata que os hooks de `@/features/gestor/api/queries` devolvem quando
 * mockados (`ResultadoGestor<T>`) — NÃO o envelope `{data, meta}` da RPC.
 * Chamar dentro de `beforeEach`/`it` (não como constante de topo de módulo):
 * cada chamada cria um `vi.fn()` novo para `refetch`, sem estado vazado entre
 * testes.
 */
export function resultadoOk<T>(data: T, meta: Meta = META) {
  return {
    data,
    meta,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}

/** Resultado de hook em erro — `data`/`meta` ausentes, mesma forma de `ResultadoGestor`. */
export function resultadoErro() {
  return {
    data: undefined,
    meta: undefined,
    isLoading: false,
    isError: true,
    isPlaceholderData: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto do gestor (SidebarIes — caso 13; caso 17)
// ─────────────────────────────────────────────────────────────────────────────

export const CONTEXTO_ADMIN: ContextoGestor = {
  usuario: { id: '44444444-4444-4444-8444-444444444444', nome: 'Admin Teste', papel: 'admin' },
  iesDisponiveis: [
    { id: IES_ID, nome: 'IES Alfa' },
    { id: IES_BETA_ID, nome: 'IES Beta' },
  ],
  iesAtual: { id: IES_ID, nome: 'IES Alfa' },
  contrato: { nome: 'Contrato 2026', simuladosContratados: 4, vigencia: '2026' },
  podeTrocarIes: true,
  podeExportar: true,
};

export const CONTEXTO_GESTOR: ContextoGestor = {
  ...CONTEXTO_ADMIN,
  usuario: { id: '66666666-6666-4666-8666-666666666666', nome: 'Gestor Teste', papel: 'gestor' },
  iesDisponiveis: [{ id: IES_ID, nome: 'IES Alfa' }],
  podeTrocarIes: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Visão Geral (casos 2, 15, 17)
// ─────────────────────────────────────────────────────────────────────────────

export const VISAO_GERAL: VisaoGeral = {
  kpis: {
    enamedProjetado: {
      valor: 3,
      delta: 1,
      serie: [
        { rotulo: '1º simulado', valor: 2 },
        { rotulo: 'anterior', valor: 2 },
        { rotulo: 'atual', valor: 3 },
      ],
      criterio: 'concept de resultados_ies_tri',
    },
    proficientesPct: {
      valor: 62,
      delta: 4,
      serie: [
        { rotulo: '1º simulado', valor: 55 },
        { rotulo: 'anterior', valor: 58 },
        { rotulo: 'atual', valor: 62 },
      ],
      criterio: 'score_proprio >= 60',
    },
    acertoPct: {
      valor: 57,
      delta: -2,
      serie: [
        { rotulo: '1º simulado', valor: 60 },
        { rotulo: 'anterior', valor: 59 },
        { rotulo: 'atual', valor: 57 },
      ],
      criterio: 'answer_progress.correct',
    },
    simulados: { realizados: 2, contratados: 4 },
  },
  evolucao: [
    { simuladoId: SIM_1, nome: 'Simulado 1', data: '2026-03-10', valor: 58, participantes: 120 },
    { simuladoId: SIM_2, nome: 'Simulado 2', data: '2026-06-10', valor: 62, participantes: 118 },
  ],
  evolucaoPorArea: [
    { area: 'Clínica Médica', pontos: [{ rotulo: 'Simulado 1', valor: 61 }, { rotulo: 'Simulado 2', valor: 64 }], critica: false },
    { area: 'Pediatria', pontos: [{ rotulo: 'Simulado 1', valor: 28 }, { rotulo: 'Simulado 2', valor: 26 }], critica: true },
  ],
  diagnosticoResumo: [
    { nivel: 'excelente', areas: [{ id: 'a1', nome: 'Clínica Médica', acertoPct: 82 }] },
    { nivel: 'mediano', areas: [{ id: 'a2', nome: 'Cirurgia', acertoPct: 55 }] },
    { nivel: 'critico', areas: [{ id: 'a3', nome: 'Pediatria', acertoPct: 26 }] },
  ],
  distribuicaoAlunos: [
    { grupo: 'consistentemente_proficiente', quantidade: 40, percentual: 40 },
    { grupo: 'em_variacao', quantidade: 35, percentual: 35 },
    { grupo: 'consistentemente_nao_proficiente', quantidade: 25, percentual: 25 },
  ],
  /** Multi-semestre de propósito (5, 11, 12) — caso 9. */
  dispersao: [
    { alunoId: ALUNO_ID, semestre: 11, nota: 72 },
    { alunoId: '77777777-7777-4777-8777-777777777777', semestre: 12, nota: 64 },
    { alunoId: '88888888-8888-4888-8888-888888888888', semestre: 5, nota: 41 },
  ],
  insights: [
    { escopo: 'area', texto: 'Pediatria segue como a área de menor desempenho nas duas aplicações.' },
    { escopo: 'aluno', texto: '25% dos alunos permanecem abaixo do limiar nas duas aplicações.' },
  ],
};

/** Mesmos alunos da dispersão, mas todos no MESMO semestre — modo "distribuição interna" (caso 9, §4.5). */
export const DISPERSAO_SEMESTRE_UNICO: VisaoGeral['dispersao'] = [
  { alunoId: 'c1', semestre: 11, nota: 72 },
  { alunoId: 'c2', semestre: 11, nota: 58 },
  { alunoId: 'c3', semestre: 11, nota: 64 },
  { alunoId: 'c4', semestre: 11, nota: 81 },
  { alunoId: 'c5', semestre: 11, nota: 49 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Alunos no simulado — TabelaAlunosSimulado (casos 2, 7, 8)
// ─────────────────────────────────────────────────────────────────────────────

export const ALUNO_PARTICIPOU: AlunoNoSimulado = {
  id: ALUNO_ID,
  nome: 'Ana Souza',
  semestre: 11,
  participou: true,
  acertos: 72,
  proficiencia: 72,
  situacao: 'proficiente',
  posicao: { lugar: 3, total: 118, percentil: 97 },
  acertoPorArea: [{ area: 'Pediatria', acertoPct: 30, critica: true }],
  variacao: 4,
};

/** Nunca participou: acertos/proficiência/variação null — TRACO em toda coluna numérica, nunca 0 (caso 7). */
export const ALUNO_NAO_PARTICIPOU: AlunoNoSimulado = {
  id: ALUNO_SEM_PARTICIPACAO_ID,
  nome: 'Bruno Lima',
  semestre: 12,
  participou: false,
  acertos: null,
  proficiencia: null,
  situacao: 'nao_participou',
  variacao: null,
};

export const ALUNOS_SIMULADO: AlunoNoSimulado[] = [ALUNO_PARTICIPOU, ALUNO_NAO_PARTICIPOU];

// ─────────────────────────────────────────────────────────────────────────────
// Temas críticos — DrawerTemas (caso 14)
// ─────────────────────────────────────────────────────────────────────────────

export const TEMAS_CRITICOS: TemaCritico[] = [
  { id: 't1', nome: 'Icterícia neonatal', acertoPct: 22, amostra: 118, lowSample: false },
  { id: 't2', nome: 'Aleitamento materno', acertoPct: 31, amostra: 6, lowSample: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Detalhamento — cruzamento área × semestre (casos 10, 11), métricas (casos 3, 5, 6)
// ─────────────────────────────────────────────────────────────────────────────

const METRICA_1: MetricasSimulado = {
  simuladoId: SIM_1,
  nome: 'Simulado 1',
  data: '2026-03-10',
  participantes: 120,
  acertoMedioPct: 57,
  enamedProjetado: 2,
  proficienciaMedia: 58,
};

const METRICA_2: MetricasSimulado = {
  simuladoId: SIM_2,
  nome: 'Simulado 2',
  data: '2026-06-10',
  participantes: 118,
  acertoMedioPct: 59,
  enamedProjetado: 3,
  proficienciaMedia: 62,
};

export const METRICAS_1_SIMULADO: MetricasSimulado[] = [METRICA_1];
export const METRICAS_2_SIMULADOS: MetricasSimulado[] = [METRICA_1, METRICA_2];

/**
 * Matriz área×semestre completa (toda combinação preenchida) para o caso 11
 * poder clicar em QUALQUER área/semestre e sempre recalcular algo não-vazio.
 */
export const CRUZAMENTO_MATRIZ: CelulaAreaSemestre[] = [
  { areaId: 'a1', semestre: 5, acertoPct: 50, amostra: 20 },
  { areaId: 'a1', semestre: 11, acertoPct: 65, amostra: 40 },
  { areaId: 'a1', semestre: 12, acertoPct: 58, amostra: 38 },
  { areaId: 'a3', semestre: 5, acertoPct: 20, amostra: 15 },
  { areaId: 'a3', semestre: 11, acertoPct: 24, amostra: 40 },
  { areaId: 'a3', semestre: 12, acertoPct: 28, amostra: 38 },
];

/** `disponiveis` de semestre inclui 5 (fora do 6º ano) para o caso 10 provar a referência esmaecida. */
export const AREAS_E_SEMESTRES: AcertoPorAreaESemestreComMatriz = {
  areas: [
    { id: 'a1', nome: 'Clínica Médica', acertoPct: 61, critica: false },
    { id: 'a3', nome: 'Pediatria', acertoPct: 26, critica: true },
  ],
  semestres: [
    { semestre: 5, acertoPct: 41, emEvidencia: false },
    { semestre: 11, acertoPct: 60, emEvidencia: true },
    { semestre: 12, acertoPct: 63, emEvidencia: true },
  ],
  matriz: CRUZAMENTO_MATRIZ,
};

const QUESTAO_1: Questao = {
  numero: 1,
  grandeArea: 'Pediatria',
  especialidade: 'Neonatologia',
  tema: 'Icterícia neonatal',
  acertoPct: 22,
  enunciado: 'Recém-nascido de 3 dias com icterícia...',
  alternativas: [
    { letra: 'A', texto: 'Fototerapia', correta: true, marcadaPct: 22 },
    { letra: 'B', texto: 'Exsanguineotransfusão', correta: false, marcadaPct: 51 },
    { letra: 'C', texto: 'Observação', correta: false, marcadaPct: 27 },
  ],
  distratorDominante: 'B',
};

/** Detalhamento com 1 simulado — Detalhamento das Questões deve aparecer (caso 6). */
export const DETALHAMENTO_1_SIMULADO: DetalhamentoComExtras = {
  metricas: METRICAS_1_SIMULADO,
  acertoPorAreaESemestre: AREAS_E_SEMESTRES,
  dispersao: VISAO_GERAL.dispersao,
  questoes: { data: [QUESTAO_1], page: 1, pageSize: 25, total: 1, totalPages: 1 },
  alunos: ALUNOS_SIMULADO,
};

/** Detalhamento com 2 simulados — comparativo, sem Detalhamento das Questões (casos 3, 6). */
export const DETALHAMENTO_2_SIMULADOS: DetalhamentoComExtras = {
  metricas: METRICAS_2_SIMULADOS,
  acertoPorAreaESemestre: AREAS_E_SEMESTRES,
  dispersao: VISAO_GERAL.dispersao,
  comparativoTemas: [
    { tema: 'Icterícia neonatal', porSimulado: [{ simuladoId: SIM_1, acertoPct: 22 }, { simuladoId: SIM_2, acertoPct: 29 }] },
  ],
  alunos: ALUNOS_SIMULADO,
};

/** Cronograma mínimo — só o necessário para `Detalhamento` montar sem erro (caso 5). */
export const CRONOGRAMA_VAZIO: ItemCronograma[] = [];
