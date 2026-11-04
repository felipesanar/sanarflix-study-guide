import type { AlunoTurma, ContagemQuestoes } from '@/services/mentor/turma';
import { formatPct } from '../detalhamento/util';
import { plural } from './util';

export const NOTA_SEM_QUESTOES_B2C = 'Questões respondidas ainda não chegam para alunos B2C';
export const TOOLTIP_SEM_QUESTOES = 'Sem dado de questões para este aluno';

type ComQuestoes = Pick<AlunoTurma, 'tem_dado_questoes' | 'questoes_7d'>;

export function temDadoQuestoes(a: Pick<AlunoTurma, 'tem_dado_questoes'>): boolean {
  return a.tem_dado_questoes === true;
}

export function totalQuestoes7d(a: ComQuestoes): number | null {
  return temDadoQuestoes(a) ? a.questoes_7d?.respondidas ?? null : null;
}

export function descreverQuestoes(c: ContagemQuestoes | null | undefined): string {
  if (c?.respondidas == null) return '–';
  const n = c.respondidas;
  const total = plural(n, 'questão', 'questões').replace(String(n), n.toLocaleString('pt-BR'));
  if (c.pct_acerto != null) return `${total} · ${formatPct(c.pct_acerto)} de acerto`;
  return n === 0 ? total : `${total} · sem correção`;
}

export function resumoQuestoesTurma(alunos: ComQuestoes[]): { comDado: number; media: number | null; pctAcerto: number | null } {
  const comFonte = alunos.filter(temDadoQuestoes);
  if (comFonte.length === 0) return { comDado: 0, media: null, pctAcerto: null };
  const respondidas = comFonte.reduce((t, a) => t + (a.questoes_7d?.respondidas ?? 0), 0);
  const acertos = comFonte.reduce((t, a) => t + (a.questoes_7d?.acertos ?? 0), 0);
  const erros = comFonte.reduce((t, a) => t + (a.questoes_7d?.erros ?? 0), 0);
  return {
    comDado: comFonte.length,
    media: respondidas / comFonte.length,
    pctAcerto: acertos + erros > 0 ? (acertos / (acertos + erros)) * 100 : null,
  };
}
