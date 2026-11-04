/**
 * Regras de apresentação do kanban de Intervenções (docs/02 § Tela 6, docs/03 § Tela 6).
 * Datas sempre em America/Sao_Paulo, no formato `YYYY-MM-DD` que `useIntervencoes` recebe.
 */
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { Intervencao, OrigemIntervencao, PerfilB2B, StatusIntervencao, TipoIntervencao } from '../../api/types';

export type Modalidade = 'b2c' | 'b2b';

/** TODO(P6): meta mensal de intervenções ainda é hipótese (coordenação de mentores). */
export const META_MENSAL = 15;

export const FUSO = 'America/Sao_Paulo';
export const TRACO = '—';

// ─── Datas ──────────────────────────────────────────────────────────────────

const fmtYmd = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Hoje (`YYYY-MM-DD`) no fuso de São Paulo. */
export const hojeSP = (agora: Date = new Date()): string => fmtYmd.format(agora);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const parse = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const somarDias = (dia: string, n: number): string => {
  const d = parse(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};
const ultimoDiaDoMes = (dia: string): string => {
  const d = parse(dia);
  return ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
};

/** `dd/mm` de uma data `YYYY-MM-DD`. */
export const ddmm = (dia: string): string => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** `dd/mm` de um instante ISO, no fuso de SP. Vazio/inválido → "—". */
export function ddmmDeIso(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return TRACO;
  return ddmm(fmtYmd.format(d));
}

export type PeriodoId = 'semana' | 'quinzena' | 'mes' | 'intervalo';
export const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: 'semana', rotulo: 'Esta semana' },
  { id: 'quinzena', rotulo: 'Quinzena' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'intervalo', rotulo: 'Intervalo' },
];
export interface Intervalo { de: string; ate: string }

/**
 * Intervalo do período, em dias de calendário: semana de segunda a domingo; quinzena = 1–15 ou 16–fim
 * do mês; mês inteiro; intervalo livre só quando completo e em ordem (senão `null`, sem consulta).
 */
export function intervaloPeriodo(periodo: PeriodoId, hoje: string, livre?: { de: string; ate: string }): Intervalo | null {
  switch (periodo) {
    case 'semana': {
      const desde = somarDias(hoje, -((parse(hoje).getUTCDay() + 6) % 7));
      return { de: desde, ate: somarDias(desde, 6) };
    }
    case 'quinzena': {
      const mes = hoje.slice(0, 8);
      return Number(hoje.slice(8, 10)) <= 15 ? { de: `${mes}01`, ate: `${mes}15` } : { de: `${mes}16`, ate: ultimoDiaDoMes(hoje) };
    }
    case 'mes':
      return { de: `${hoje.slice(0, 8)}01`, ate: ultimoDiaDoMes(hoje) };
    case 'intervalo':
      return livre && livre.de && livre.ate && livre.de <= livre.ate ? { de: livre.de, ate: livre.ate } : null;
  }
}

/** Texto ao lado do seletor: "01/10 a 15/10"; no mês, o nome do mês. */
export function rotuloIntervalo(periodo: PeriodoId, i: Intervalo): string {
  if (periodo === 'mes') return MESES[parse(i.de).getUTCMonth()];
  return `${ddmm(i.de)} a ${ddmm(i.ate)}`;
}

/** Mês corrente do medidor (a meta é mensal, independente do período do quadro). */
export function mesDe(hoje: string): Intervalo & { nome: string; ultimoDia: string } {
  const ate = ultimoDiaDoMes(hoje);
  return { de: `${hoje.slice(0, 8)}01`, ate, nome: MESES[parse(hoje).getUTCMonth()], ultimoDia: ddmm(ate) };
}

export function medidorDoMes(realizadas: number): { feitas: number; faltam: number; preenchidos: number } {
  return { feitas: realizadas, faltam: Math.max(0, META_MENSAL - realizadas), preenchidos: Math.min(META_MENSAL, realizadas) };
}

// ─── Rótulos ────────────────────────────────────────────────────────────────

/** Tipo = ícone + texto neutro (nunca cor). B2B chama a coletiva de "Sessão coletiva" (protótipo B2B). */
export function rotuloTipo(tipo: TipoIntervencao, modalidade: Modalidade): string {
  if (tipo === 'individual') return 'Reunião individual';
  if (tipo === 'coletiva') return modalidade === 'b2b' ? 'Sessão coletiva' : 'Reunião coletiva';
  return 'Mensagem';
}
/** Ícones do Dendê mais próximos dos traçados do protótipo (user, users, msg). */
export const ICONE_TIPO: Record<TipoIntervencao, DendeIconName> = { individual: 'account_circle', coletiva: 'groups', mensagem: 'email' };

export const FILTROS_TIPO: { id: TipoIntervencao | 'todos'; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos os tipos' },
  { id: 'individual', rotulo: 'Individual' },
  { id: 'coletiva', rotulo: 'Coletiva' },
  { id: 'mensagem', rotulo: 'Mensagem' },
];
export const TIPOS_CRIADOR: { id: TipoIntervencao; rotulo: string }[] = [
  { id: 'individual', rotulo: 'Individual' },
  { id: 'coletiva', rotulo: 'Coletiva' },
  { id: 'mensagem', rotulo: 'Mensagem' },
];
export const FILTROS_PERFIL: { id: PerfilB2B | 'todos'; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'virada', rotulo: 'Potencial de virada' },
  { id: 'muito_baixo', rotulo: 'Muito baixo' },
  { id: 'muito_bom', rotulo: 'Muito bom' },
];
export const ROTULO_PERFIL: Record<PerfilB2B, string> = {
  virada: 'Potencial de virada',
  muito_baixo: 'Desempenho muito baixo',
  muito_bom: 'Desempenho muito bom',
};

export const COLUNAS: { status: StatusIntervencao; rotulo: string; ponto: string }[] = [
  { status: 'afazer', rotulo: 'A fazer', ponto: 'var(--gp-border-input)' },
  { status: 'andamento', rotulo: 'Em andamento', ponto: 'var(--gp-warning)' },
  { status: 'feito', rotulo: 'Feito', ponto: 'var(--gp-success)' },
];
export const ROTULO_STATUS: Record<StatusIntervencao, string> = { afazer: 'A fazer', andamento: 'Em andamento', feito: 'Feito' };

const ORIGENS: Record<OrigemIntervencao, string> = {
  manual: 'Manual',
  agenda_liberada: 'Auto · agenda liberada',
  tema_critico: 'Auto · tema crítico',
  questao: 'Auto · questão',
  mural: 'Auto · mural',
  sessao_criada: 'Auto · sessão criada',
};
export const rotuloOrigem = (o: OrigemIntervencao): string => ORIGENS[o] ?? 'Manual';

// ─── Destino ────────────────────────────────────────────────────────────────

const normal = (e: string) => e.trim().toLowerCase();
export const nomeDe = (email: string, nomes: ReadonlyMap<string, string>): string => nomes.get(normal(email)) || email;

/** "Para quem": aluno pelo nome (e-mail de reserva), "Turma toda", "{grupo} · {n} alunos" ou "{n} alunos". */
export function paraQuem(c: Pick<Intervencao, 'destino'>, nomes: ReadonlyMap<string, string>): string {
  if (c.destino.turmaToda) return 'Turma toda';
  const ids = c.destino.alunoIds ?? [];
  if (ids.length === 0) return TRACO;
  if (ids.length === 1 && !c.destino.grupo) return nomeDe(ids[0], nomes);
  const n = `${ids.length} ${ids.length === 1 ? 'aluno' : 'alunos'}`;
  return c.destino.grupo ? `${c.destino.grupo} · ${n}` : n;
}

/** Aluno único do card (e-mail), quando o destino é uma pessoa. */
export function alunoUnico(c: Pick<Intervencao, 'destino'>): string | null {
  const ids = c.destino.alunoIds ?? [];
  return !c.destino.turmaToda && ids.length === 1 ? ids[0] : null;
}

// ─── Histórico ──────────────────────────────────────────────────────────────

export interface EntradaHistorico { em: string; data: string; texto: string }

/**
 * Histórico do drawer (protótipo): "Criada · {origem}", "Status → {coluna}", "Comentário: {texto}" e os
 * demais eventos do servidor. O evento "Comentário adicionado" sai porque o comentário entra com o texto.
 */
export function historicoExibido(c: Intervencao): EntradaHistorico[] {
  const criada = `Criada · ${rotuloOrigem(c.origem)}`;
  let temCriacao = false;
  const doServidor = c.historico.flatMap((h) => {
    if (h.texto === 'Comentário adicionado') return [];
    if (h.texto === 'Intervenção criada') {
      if (temCriacao) return [];
      temCriacao = true;
      return [{ em: h.em, texto: criada }];
    }
    const status = /^Status alterado para (.+)$/.exec(h.texto);
    return [{ em: h.em, texto: status ? `Status → ${status[1]}` : h.texto }];
  });
  const lista = [
    ...(temCriacao ? [] : [{ em: c.criadaEm, texto: criada }]),
    ...doServidor,
    ...(c.comentarios ?? []).map((k) => ({ em: k.em, texto: `Comentário: ${k.texto}` })),
  ];
  const t = (iso: string) => { const v = new Date(iso).getTime(); return Number.isNaN(v) ? 0 : v; };
  return lista
    .map((h, i) => ({ ...h, i }))
    .sort((a, b) => t(a.em) - t(b.em) || a.i - b.i)
    .map(({ em, texto }) => ({ em, texto, data: ddmmDeIso(em) }));
}

// ─── Filtros ────────────────────────────────────────────────────────────────

export interface FiltroCards { modalidade: Modalidade; tipo: TipoIntervencao | 'todos'; perfil: PerfilB2B | 'todos' }

/** B2C filtra por tipo; B2B por perfil (docs/06 § Estado de UI: "tipo/perfil"). */
export function filtrarCards(cards: readonly Intervencao[], f: FiltroCards): Intervencao[] {
  if (f.modalidade === 'b2b') return f.perfil === 'todos' ? [...cards] : cards.filter((c) => c.perfil === f.perfil);
  return f.tipo === 'todos' ? [...cards] : cards.filter((c) => c.tipo === f.tipo);
}
