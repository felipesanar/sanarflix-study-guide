/**
 * Regras puras da Visão Geral B2B (docs/handoff/mentor/docs/03 § Tela 2, docs/05, docs/06 § Estado de UI).
 * Cortes e formatadores compartilhados vêm do Gestor e de `lib/regrasMentor.ts`; aqui só a composição
 * desta tela. `null` nunca vira zero.
 */
import type { GrupoEvolucao, PontoSerie } from '@/features/gestor/api/types';
import { TRACO, formatPct } from '@/features/gestor/lib/formatters';
import { NIVEL_CRITICO_MAX } from '@/features/gestor/lib/regras';
import type { AlunoB2b, GrupoPrioridadeB2B, PerfilB2B, PeriodoB2b, QuestaoResumoMentor, Sessao, TemaTurmaMentor } from '../../api/types';
import { engajamento, type OrdemTemas } from '../../lib/regrasMentor';

export type { OrdemTemas };

// ─── Período ────────────────────────────────────────────────────────────────

export const PERIODO_PADRAO: PeriodoB2b = '6m';
const PERIODOS_VALIDOS: readonly PeriodoB2b[] = ['30d', '90d', '6m', 'ciclo'];
export function rotulosPeriodo(ano: number): { chave: PeriodoB2b; rotulo: string }[] {
  return [
    { chave: '30d', rotulo: 'Últimos 30 dias' },
    { chave: '90d', rotulo: 'Últimos 90 dias' },
    { chave: '6m', rotulo: 'Últimos 6 meses' },
    { chave: 'ciclo', rotulo: `Ciclo ${ano}` },
  ];
}
export function lerPeriodo(v: string | null): PeriodoB2b {
  return PERIODOS_VALIDOS.includes(v as PeriodoB2b) ? (v as PeriodoB2b) : PERIODO_PADRAO;
}

// ─── Perfil (vindo do Início) e grupo de evolução ───────────────────────────

const PERFIS_VALIDOS: readonly GrupoPrioridadeB2B[] = ['virada', 'muito_baixo', 'sem_acesso', 'muito_bom'];
export function lerPerfil(v: string | null): GrupoPrioridadeB2B | null {
  return PERFIS_VALIDOS.includes(v as GrupoPrioridadeB2B) ? (v as GrupoPrioridadeB2B) : null;
}
export type FiltroGrupo = 'todos' | GrupoEvolucao | 'sem_resultado';
export const FILTROS_GRUPO: readonly FiltroGrupo[] = [
  'todos', 'consistentemente_proficiente', 'em_variacao', 'consistentemente_nao_proficiente', 'sem_resultado',
];
export function lerGrupo(v: string | null): FiltroGrupo {
  return FILTROS_GRUPO.includes(v as FiltroGrupo) ? (v as FiltroGrupo) : 'todos';
}

/** Rótulo do chip removível (texto do protótipo: "Perfil: com potencial de virada · 23"). */
export const ROTULO_CHIP_PERFIL: Record<GrupoPrioridadeB2B, string> = {
  virada: 'com potencial de virada',
  muito_baixo: 'com desempenho muito baixo',
  sem_acesso: 'sumiram',
  muito_bom: 'com desempenho muito bom',
};
/** Tag de perfil na linha do aluno. */
export const ROTULO_PERFIL: Record<PerfilB2B, string> = {
  virada: 'Potencial de virada',
  muito_baixo: 'Desempenho muito baixo',
  muito_bom: 'Desempenho muito bom',
};

/** Perfil vem do servidor; "sem acesso" é a régua de 15 dias do shell (nunca acessou conta como sumido). */
export function alunoNoPerfil(a: AlunoB2b, perfil: GrupoPrioridadeB2B | null): boolean {
  if (perfil === null) return true;
  if (perfil === 'sem_acesso') return engajamento(a.diasSemAtividade) === 'sumido';
  return a.perfil === perfil;
}
export function alunoNoGrupo(a: AlunoB2b, grupo: FiltroGrupo): boolean {
  if (grupo === 'todos') return true;
  if (grupo === 'sem_resultado') return a.grupo === null;
  return a.grupo === grupo;
}
/** Ordens de simulado presentes nas proficiências (colunas "Proficiência 1º → 4º"). */
export function colunasProficiencia(alunos: AlunoB2b[]): number[] {
  const ordens = new Set<number>();
  for (const a of alunos) for (const p of a.proficiencias) if (p.ordem !== null) ordens.add(p.ordem);
  return [...ordens].sort((x, y) => x - y);
}

// ─── Indicadores ────────────────────────────────────────────────────────────

export const ordinal = (n: number | null | undefined): string => (n == null ? TRACO : `${n}º`);
export function pontosValidos(serie: PontoSerie[]): PontoSerie[] {
  return serie.filter((p) => p.valor !== null);
}
/**
 * Régua "1º · anterior · atual" (docs/01 § Padrões): só com 2+ pontos válidos. O `KpiCard` desenha todos
 * os pontos que recebe, então o corte para 3 células é daqui.
 */
export function regua3(serie: PontoSerie[]): PontoSerie[] {
  const v = pontosValidos(serie);
  if (v.length < 2) return [];
  const fim = [{ rotulo: 'Anterior', valor: v[v.length - 2].valor }, { rotulo: 'Atual', valor: v[v.length - 1].valor }];
  return v.length > 2 ? [{ rotulo: v[0].rotulo, valor: v[0].valor }, ...fim] : fim;
}

// ─── Datas (America/Sao_Paulo) ──────────────────────────────────────────────

const FUSO = 'America/Sao_Paulo';
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
export function hojeSp(agora: Date = new Date()): string {
  return fmtDia.format(agora);
}
/** `YYYY-MM-DD` é data-calendário (lida sem fuso); ISO com hora é convertido para São Paulo. */
export function ddmm(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (soData) return `${soData[3]}/${soData[2]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return TRACO;
  const [, mes, dia] = fmtDia.format(d).split('-');
  return `${dia}/${mes}`;
}

// ─── Oficina (pauta) ────────────────────────────────────────────────────────

const oficinasFuturas = (sessoes: Sessao[], hoje: string) =>
  sessoes.filter((s) => s.tipo === 'oficina' && s.status === 'agendada' && s.data >= hoje)
    .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
export function proximaOficina(sessoes: Sessao[], hoje: string): Sessao | null {
  return oficinasFuturas(sessoes, hoje)[0] ?? null;
}
export function temaNaPauta(sessoes: Sessao[], temaId: string, hoje: string): boolean {
  return oficinasFuturas(sessoes, hoje).some((s) => s.pauta.some((p) => p.referenciaId === temaId));
}

// ─── Temas críticos ─────────────────────────────────────────────────────────

/** Entrada (docs/05): 30+ respostas da turma no recorte (`critico`) e acerto < 50%. Acerto nulo fica fora. */
export function temasCriticosB2b(temas: TemaTurmaMentor[]): TemaTurmaMentor[] {
  return temas.filter((t) => t.critico && t.acertoPct !== null && t.acertoPct < NIVEL_CRITICO_MAX);
}
/** Peso da prevalência (Alta 3 · Média 2 · Baixa 1) × (100 − acerto). Sem prevalência: null, nunca um peso inventado. */
export function impactoTema(t: Pick<TemaTurmaMentor, 'peso' | 'acertoPct'>): number | null {
  return t.peso === null || t.acertoPct === null ? null : t.peso * (100 - t.acertoPct);
}
const crescente = (a: number | null, b: number | null) => (a === null ? (b === null ? 0 : 1) : b === null ? -1 : a - b);
/**
 * "Impacto na prova" sem prevalência cadastrada (produção hoje): os temas sem peso ficam depois dos que
 * têm, desempatados pelo menor acerto — a ordenação nunca supõe um peso.
 */
export function ordenarTemasB2b(temas: TemaTurmaMentor[], ordem: OrdemTemas): TemaTurmaMentor[] {
  return [...temas].sort((a, b) => {
    if (ordem === 'alunos') return b.alunosAbaixo50.length - a.alunosAbaixo50.length || crescente(a.acertoPct, b.acertoPct);
    if (ordem === 'acerto') return crescente(a.acertoPct, b.acertoPct);
    const ia = impactoTema(a);
    const ib = impactoTema(b);
    if (ia === null || ib === null) return ia === ib ? crescente(a.acertoPct, b.acertoPct) : ia === null ? 1 : -1;
    return ib - ia || crescente(a.acertoPct, b.acertoPct);
  });
}
/** "2º: 44% → 3º: 41% → 4º: 38%", com — para lacuna; série vazia = —. */
export function evolucaoTema(t: TemaTurmaMentor, ordemDe: (simuladoId: string) => number | null): string {
  if (!t.serie.length) return TRACO;
  return t.serie.map((p) => `${ordinal(ordemDe(p.simuladoId))}: ${formatPct(p.acertoPct)}`).join(' → ');
}

const normalizar = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Questões do simulado de referência cujo tema (ou tema curto, ou "Especialidade > Tema") é o tema. */
export function questoesDoTema(questoes: QuestaoResumoMentor[], tema: string): QuestaoResumoMentor[] {
  const alvo = normalizar(tema);
  return questoes
    .filter((q) => {
      const t = normalizar(q.tema);
      return t === alvo || normalizar(q.temaCurto) === alvo || t.endsWith(`> ${alvo}`);
    })
    .sort((a, b) => crescente(a.numero, b.numero));
}
export function textoQuestoesDoTema(questoes: QuestaoResumoMentor[]): string {
  if (!questoes.length) return 'Nenhuma questão do tema no simulado';
  const numeros = questoes.map((q) => (q.numero === null ? TRACO : `Q${q.numero}`)).join(', ');
  return `${numeros} · ${questoes.length} ${questoes.length === 1 ? 'questão' : 'questões'} no simulado`;
}
