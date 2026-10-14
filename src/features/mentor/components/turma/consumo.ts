import type { AlunoTurma, ContagemConteudos } from '@/services/mentor/turma';
import { plural } from './util';

export const NOTA_SEM_CONSUMO_B2C = 'Consumo de conteúdo ainda não chega para alunos B2C';
export const TOOLTIP_SEM_CONSUMO = 'Sem dado de consumo para este aluno';
export const SEM_DADO = '–';

type ComConsumo = Pick<AlunoTurma, 'tem_dado_consumo' | 'conteudos_7d'>;

/** Só `true` conta: ausente/falso significa que não há fonte de dado (mostrar "–", nunca 0). */
export function temDadoConsumo(a: Pick<AlunoTurma, 'tem_dado_consumo'>): boolean {
  return a.tem_dado_consumo === true;
}

/** Total de conteúdos dos últimos 7 dias; `null` ("–") sem dado ou com total nulo. Nunca decide pelo objeto ser nulo. */
export function totalConteudos7d(a: ComConsumo): number | null {
  if (!temDadoConsumo(a)) return null;
  return a.conteudos_7d?.total ?? null;
}

/** "3 vídeos · 1 documento". */
export function descreverConteudos(c: Pick<ContagemConteudos, 'videos' | 'documentos'> | null | undefined): string {
  const videos = c?.videos ?? 0;
  const documentos = c?.documentos ?? 0;
  return `${plural(videos, 'vídeo', 'vídeos')} · ${plural(documentos, 'documento', 'documentos')}`;
}

export interface ResumoConsumoTurma {
  /** Alunos com fonte de dado de consumo. */
  comDado: number;
  /** Média de conteúdos (7d) por aluno COM dado; `null` quando ninguém tem dado. */
  media: number | null;
}

export function resumoConsumoTurma(alunos: ComConsumo[]): ResumoConsumoTurma {
  const totais = alunos.map(totalConteudos7d).filter((t): t is number => t !== null);
  if (totais.length === 0) return { comDado: 0, media: null };
  return { comDado: totais.length, media: totais.reduce((t, n) => t + n, 0) / totais.length };
}

const FORMATO_MEDIA = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatMedia(n: number): string {
  return FORMATO_MEDIA.format(n);
}
