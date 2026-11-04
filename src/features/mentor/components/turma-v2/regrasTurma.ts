/**
 * Regras puras da Minha Turma (B2C) — docs/handoff/mentor/docs/02 § Tela 2 e § Estados.
 * Cortes e réguas compartilhados vêm de `lib/regrasMentor` e do Gestor; aqui só a montagem da tela.
 * Regra transversal: `null` nunca vira zero e sai das médias.
 */
import { TRACO } from '@/features/gestor/lib/formatters';
import type { PontoSerie } from '@/features/gestor/api/types';
import type {
  AcertoArea, AlertaB2C, AlunoTurmaAcademy, DesempenhoTurmaB2c, EngajamentoAluno, MetaAluno, Prevalencia,
  SegmentoAtividade, SimuladoMentor, TemaTurmaMentor,
} from '../../api/types';
import { segmentoCorte, type SegmentoCorte } from '../../lib/regrasMentor';

// ─── Linhas da tabela ───────────────────────────────────────────────────────

export interface LinhaAluno {
  /** Chave do aluno na fonte Academy (e-mail normalizado) — vai para `?aluno=`. */
  email: string;
  nome: string;
  segmentoCorte: SegmentoCorte;
  engajamento: SegmentoAtividade;
  questoes30d: number | null;
  acessoAte: string | null;
  meta: MetaAluno | null;
  /** Uma nota por simulado realizado, do mais antigo ao mais recente; null = não fez. */
  notas: (number | null)[];
  /** vs corte no último simulado fechado; null = não fez, sem meta ou sem dado. */
  vsCortePp: number | null;
  /** null = ainda não há simulado fechado (ou aluno sem desempenho). */
  fezUltimo: boolean | null;
  diasSemAtividade: number | null;
  alertas: AlertaB2C[];
}

export interface TurmaMontada {
  linhas: LinhaAluno[];
  realizados: SimuladoMentor[];
  /** Último simulado fechado (referência dos indicadores e do alerta "Não fizeram"). */
  ultimo: SimuladoMentor | null;
  /** V0: nenhum simulado realizado ainda (docs/02 § Estados). */
  v0: boolean;
}

const chave = (email: string) => email.trim().toLowerCase();

export function montarTurma(turma: AlunoTurmaAcademy[], desempenho: DesempenhoTurmaB2c | undefined): TurmaMontada {
  const realizados = [...(desempenho?.simulados ?? [])]
    .filter((s) => s.status === 'realizado')
    .sort((a, b) => a.ordem - b.ordem);
  const idUltimo = desempenho?.participacaoUltimo.simuladoId ?? null;
  const ultimo = realizados.find((s) => s.id === idUltimo) ?? null;
  const porEmail = new Map((desempenho?.alunos ?? []).map((d) => [chave(d.email), d]));

  const linhas = turma.map((a): LinhaAluno => {
    const d = porEmail.get(chave(a.email));
    const notas = d ? realizados.map((s) => d.notas.find((n) => n.simuladoId === s.id)?.acertoPct ?? null) : [];
    const corte = d?.corteMaisDificil ?? a.meta?.cortePct ?? null;
    const fezUltimo = d ? d.fezUltimo : null;
    const alertas: AlertaB2C[] = [];
    if (a.segmento === 'sumido') alertas.push('sumiram');
    if (a.segmento === 'esfriando') alertas.push('esfriando');
    if (d?.regrediu) alertas.push('regrediram');
    if (d?.estagnado) alertas.push('estagnados');
    if (fezUltimo === false) alertas.push('nao_fizeram');
    return {
      email: a.email,
      nome: a.nome?.trim() || d?.nome?.trim() || a.email,
      segmentoCorte: segmentoCorte(notas, corte),
      engajamento: a.segmento,
      questoes30d: a.temDadoQuestoes ? a.questoes30d.respondidas : null,
      acessoAte: a.acessoAte,
      meta: a.meta,
      notas,
      vsCortePp: fezUltimo === false ? null : d?.vsCortePp ?? null,
      fezUltimo,
      diasSemAtividade: a.diasSemAtividade,
      alertas,
    };
  });
  return { linhas, realizados, ultimo, v0: realizados.length === 0 };
}

// ─── Alertas (deep link do Início: `?alerta=`) ──────────────────────────────

export const CHAVES_ALERTA: readonly AlertaB2C[] = ['sumiram', 'regrediram', 'estagnados', 'nao_fizeram', 'esfriando'];
export const ehAlerta = (v: string | null | undefined): v is AlertaB2C => !!v && (CHAVES_ALERTA as readonly string[]).includes(v);

export function rotuloAlerta(a: AlertaB2C, ordemUltimo: number | null): string {
  switch (a) {
    case 'sumiram': return 'Sumiram';
    case 'regrediram': return 'Regrediram';
    case 'estagnados': return 'Estagnados';
    case 'esfriando': return 'Esfriando';
    case 'nao_fizeram': return ordemUltimo == null ? 'Não fizeram o último simulado' : `Não fizeram o ${ordemUltimo}º simulado`;
  }
}

// ─── Segmentos (`?segmento=`) ───────────────────────────────────────────────

export type SegmentoEngajamento = 'ativo' | 'esfriando' | 'sumido';
export type SegmentoFiltro = SegmentoCorte | SegmentoEngajamento;
export const SEGMENTOS_CORTE: readonly SegmentoCorte[] = ['acima', 'variacao', 'abaixo', 'sem_historico'];
export const SEGMENTOS_ENGAJAMENTO: readonly SegmentoEngajamento[] = ['ativo', 'esfriando', 'sumido'];

/** Segmento da URL válido para o modo atual; qualquer outro valor = "Todos". */
export function segmentoValido(v: string | null, v0: boolean): SegmentoFiltro | null {
  const lista: readonly string[] = v0 ? SEGMENTOS_ENGAJAMENTO : SEGMENTOS_CORTE;
  return v && lista.includes(v) ? (v as SegmentoFiltro) : null;
}

export interface FiltroTurma {
  alerta: AlertaB2C | null;
  segmento: SegmentoFiltro | null;
  busca: string;
  v0: boolean;
}

export const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function filtrarLinhas(linhas: LinhaAluno[], f: FiltroTurma): LinhaAluno[] {
  const q = normalizarTexto(f.busca);
  return linhas.filter((l) =>
    (f.alerta === null || l.alertas.includes(f.alerta)) &&
    (f.segmento === null || (f.v0 ? l.engajamento === f.segmento : l.segmentoCorte === f.segmento)) &&
    (!q || normalizarTexto(l.nome).includes(q)));
}

export function contarSegmentos(linhas: LinhaAluno[], v0: boolean): Record<string, number> {
  const out: Record<string, number> = { todos: linhas.length };
  for (const s of v0 ? SEGMENTOS_ENGAJAMENTO : SEGMENTOS_CORTE) {
    out[s] = linhas.filter((l) => (v0 ? l.engajamento === s : l.segmentoCorte === s)).length;
  }
  return out;
}

// ─── Indicadores ────────────────────────────────────────────────────────────

/**
 * Régua "1º · anterior · atual" do KpiCard: só pontos válidos (null sai) e só com 2 ou mais.
 * O KpiCard desenha todos os pontos que recebe; o corte para 3 fica aqui.
 */
export function regua3(pontos: PontoSerie[]): PontoSerie[] {
  const validos = pontos.filter((p) => p.valor !== null);
  if (validos.length < 2) return [];
  const atual = validos[validos.length - 1];
  const anterior = validos[validos.length - 2];
  return validos.length === 2
    ? [{ rotulo: 'Anterior', valor: anterior.valor }, { rotulo: 'Atual', valor: atual.valor }]
    : [{ rotulo: '1º', valor: validos[0].valor }, { rotulo: 'Anterior', valor: anterior.valor }, { rotulo: 'Atual', valor: atual.valor }];
}

const media = (v: number[]) => (v.length ? v.reduce((s, n) => s + n, 0) / v.length : null);

/** Questões nos últimos 7 dias por aluno ativo (até 7 dias); sem fonte de questões fica fora. */
export function mediaQuestoesAtivos(turma: AlunoTurmaAcademy[]): number | null {
  const v = turma
    .filter((a) => a.segmento === 'ativo' && a.temDadoQuestoes !== false && a.questoes7d.respondidas !== null)
    .map((a) => a.questoes7d.respondidas as number);
  const m = media(v);
  return m === null ? null : Math.round(m);
}

const ativoNa = (s: EngajamentoAluno['semanas'][number] | undefined) => !!s && ((s.questoes ?? 0) > 0 || (s.conteudos ?? 0) > 0);

/** Alunos com atividade na semana `indice` (0 = mais antiga). null quando não há dado de engajamento. */
export function ativosNaSemana(eng: EngajamentoAluno[], indice: number): number | null {
  if (!eng.length || !eng.some((a) => a.semanas.length > indice)) return null;
  return eng.filter((a) => ativoNa(a.semanas[indice])).length;
}

/** Média de questões por aluno ativo na semana `indice`. */
export function questoesPorAtivoNaSemana(eng: EngajamentoAluno[], indice: number): number | null {
  const v = eng.map((a) => a.semanas[indice]).filter((s) => ativoNa(s) && s!.questoes !== null).map((s) => s!.questoes as number);
  const m = media(v);
  return m === null ? null : Math.round(m);
}

// ─── Matriz grande área × prevalência ───────────────────────────────────────

export interface TemaMatriz { grandeArea: string; prevalencia: Prevalencia | null; acertoPct: number | null; respostas: number }
export interface LinhaMatriz { area: string; alta: number | null; media: number | null; baixa: number | null; geral: number | null }

/** Ordem das grandes áreas como na prova; as demais vão ao fim, em ordem alfabética. */
const ORDEM_AREAS = ['Clínica Médica', 'Cirurgia', 'Ginecologia e Obstetrícia', 'Pediatria', 'Preventiva', 'Medicina de Família e Comunidade', 'Saúde Mental'];

function ponderada(temas: TemaMatriz[]): number | null {
  const validos = temas.filter((t) => t.acertoPct !== null && t.respostas > 0);
  const n = validos.reduce((s, t) => s + t.respostas, 0);
  if (!n) return null;
  return Math.round((10 * validos.reduce((s, t) => s + (t.acertoPct as number) * t.respostas, 0)) / n) / 10;
}

export function matrizPrevalencia(temas: TemaMatriz[]): { linhas: LinhaMatriz[]; temPrevalencia: boolean } {
  const areas = [...new Set(temas.map((t) => t.grandeArea))].sort((a, b) => {
    const ia = ORDEM_AREAS.indexOf(a), ib = ORDEM_AREAS.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.localeCompare(b, 'pt-BR');
  });
  const linhas = areas.map((area) => {
    const da = temas.filter((t) => t.grandeArea === area);
    const de = (p: Prevalencia) => ponderada(da.filter((t) => t.prevalencia === p));
    return { area, alta: de('alta'), media: de('media'), baixa: de('baixa'), geral: ponderada(da) };
  });
  return { linhas, temPrevalencia: temas.some((t) => t.prevalencia !== null) };
}

/**
 * Temas do recorte de um segmento (`mentor_detalhamento` com e-mails) com a prevalência herdada do
 * tema da turma (`mentor_temas_turma`), casando grande área + especialidade + tema normalizados.
 */
export function temasDoDetalhamento(areas: AcertoArea[], temasTurma: TemaTurmaMentor[]): TemaMatriz[] {
  const k = (...p: (string | null)[]) => p.map((x) => normalizarTexto(x ?? '')).join('|');
  const prev = new Map<string, Prevalencia | null>();
  for (const t of temasTurma) {
    prev.set(k(t.grandeArea, t.especialidade, t.tema), t.prevalencia);
    if (!prev.has(k(t.grandeArea, t.tema))) prev.set(k(t.grandeArea, t.tema), t.prevalencia);
  }
  return areas.flatMap((a) => {
    const porEsp = a.especialidades.flatMap((e) => e.temas.map((t) => ({ ...t, esp: e.especialidade })));
    const lista = porEsp.length ? porEsp : a.temas.map((t) => ({ ...t, esp: null as string | null }));
    return lista.map((t) => ({
      grandeArea: a.grandeArea,
      prevalencia: prev.get(k(a.grandeArea, t.esp, t.tema)) ?? prev.get(k(a.grandeArea, t.tema)) ?? null,
      acertoPct: t.acertoPct,
      respostas: t.respostas,
    }));
  });
}

// ─── Formatadores da tela ───────────────────────────────────────────────────

/** "+3 p.p." · "−8 p.p." (U+2212) · "0 p.p." · "—". */
export function formatPp(v: number | null): string {
  if (v === null) return TRACO;
  const n = Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${n} p.p.`;
}

export function formatUltimoAcesso(dias: number | null): string {
  if (dias === null) return TRACO;
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2026-12-31" → "dez/26" (lê os dígitos, sem reinterpretar fuso). */
export function formatMesAno(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})/.exec(iso) : null;
  if (!m) return TRACO;
  return `${MESES[Number(m[2]) - 1]}/${m[1].slice(2)}`;
}

const DIA_MES_SP = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
/** "2026-09-21" → "21/09"; timestamp ISO é lido no fuso de São Paulo. */
export function formatDiaMes(iso: string | null): string | null {
  if (!iso) return null;
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (soData) return `${soData[3]}/${soData[2]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DIA_MES_SP.format(d);
}

/** Notas do mais antigo ao mais recente; "–" (en dash, como no protótipo) quando o aluno não fez. */
export function formatNotas(notas: (number | null)[]): { anteriores: string; ultima: string } {
  const f = (v: number | null) => (v === null ? '–' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  if (!notas.length) return { anteriores: '', ultima: '' };
  const ant = notas.slice(0, -1).map(f);
  return { anteriores: ant.length ? `${ant.join(' · ')} ·` : '', ultima: f(notas[notas.length - 1]) };
}
