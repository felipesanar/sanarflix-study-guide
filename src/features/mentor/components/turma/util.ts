import type { Segmento } from '@/services/mentor/turma';

export const FUSO = 'America/Sao_Paulo';

export const SEGMENTOS: Segmento[] = ['ativo', 'esfriando', 'sumido', 'sem_dado'];

/** Plural, para abas e cards de contagem. */
export const SEGMENTO_PLURAL: Record<Segmento, string> = {
  ativo: 'Ativos',
  esfriando: 'Esfriando',
  sumido: 'Sumidos',
  sem_dado: 'Sem dado',
};

/** Singular, para a etiqueta de um aluno. */
export const SEGMENTO_ETIQUETA: Record<Segmento, string> = {
  ativo: 'Ativo',
  esfriando: 'Esfriando',
  sumido: 'Sumido',
  sem_dado: 'Sem dado',
};

export const SEGMENTO_CLASSE: Record<Segmento, string> = {
  ativo: 'bg-emerald-100 text-emerald-800',
  esfriando: 'bg-amber-100 text-amber-800',
  sumido: 'bg-red-100 text-red-800',
  sem_dado: 'bg-muted text-muted-foreground',
};

export function ehSegmento(valor: string | null): valor is Segmento {
  return valor !== null && (SEGMENTOS as string[]).includes(valor);
}

/** "há N dias" / "hoje" / "ontem", ou "Sem dado" quando não há atividade conhecida. */
export function formatUltimoAcesso(dias: number | null): string {
  if (dias === null || dias === undefined) return 'Sem dado';
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  return `há ${dias} dias`;
}

function partes(iso: string, opts: Intl.DateTimeFormatOptions): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, ...opts }).format(data);
}

/** dd/MM no fuso de São Paulo. */
export function formatDiaMes(iso: string): string {
  return partes(iso, { day: '2-digit', month: '2-digit' });
}

/** dd/MM às HH:mm no fuso de São Paulo. */
export function formatDiaMesHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return `${formatDiaMes(iso)} às ${partes(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/**
 * dd/MM/yyyy de uma data de calendário (`acesso_ate`). Lê os dígitos do ISO em
 * vez de instanciar `Date`, para o dia não andar com o fuso.
 */
export function formatDataCalendario(valor: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function formatSemestre(semestre: number | null): string {
  return semestre === null || semestre === undefined ? '—' : `${semestre}º semestre`;
}

export function nomeOuEmail(a: { nome: string | null; email: string }): string {
  return a.nome?.trim() || a.email;
}

export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
