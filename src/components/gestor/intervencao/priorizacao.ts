import type { InstitutionalViewModel } from '@/types/desempenhoV2';
import { statusFromPercent, type StatusLevel } from '@/experiences/gestor/ui';

/**
 * Um tema da árvore curricular já enriquecido com as métricas usadas pela
 * tela de Intervenção & Impacto: prevalência no exame (% de questões do tema
 * sobre o total do simulado) e impacto (prevalência × (1 − acerto)).
 */
export interface TemaPrioridade {
  /** Chave estável para uso em Select/lista (área‖especialidade‖tema). */
  id: string;
  tema: string;
  area: string;
  especialidade: string;
  /** % de acerto da turma no tema (0-100). */
  acerto: number;
  /** % de questões do tema sobre o total de questões do simulado (0-100). */
  prevalencia: number;
  /** Número de questões do tema no simulado. */
  questoes: number;
  /** impacto = prevalência × (1 − acerto/100). Quanto maior, mais prioritário. */
  impacto: number;
  status: StatusLevel;
}

/**
 * Extrai todos os temas da árvore curricular e calcula prevalência + impacto.
 * Fórmula de impacto (documentada no contrato da tela):
 *   impacto = prevalência_no_exame × (1 − acerto_da_turma)
 * onde prevalência_no_exame = questões_do_tema / total_de_questões_do_simulado.
 */
export function buildTemasPrioridade(data: InstitutionalViewModel): TemaPrioridade[] {
  const totalQuestoes = data.curricular.areas.reduce((sum, area) => sum + area.total, 0) || 1;
  const temas: TemaPrioridade[] = [];

  for (const area of data.curricular.areas) {
    for (const especialidade of area.specialties) {
      for (const tema of especialidade.temas) {
        const prevalencia = (tema.total / totalQuestoes) * 100;
        const acerto = tema.percentual;
        const impacto = prevalencia * (1 - acerto / 100);

        temas.push({
          id: `${area.name}‖${especialidade.name}‖${tema.name}`,
          tema: tema.name,
          area: area.name,
          especialidade: especialidade.name,
          acerto,
          prevalencia,
          questoes: tema.total,
          impacto,
          status: statusFromPercent(acerto),
        });
      }
    }
  }

  return temas;
}

/** Fila de intervenções: temas ordenados por impacto desc (maior impacto primeiro). */
export function sortByImpacto(temas: TemaPrioridade[]): TemaPrioridade[] {
  return [...temas].sort((a, b) => b.impacto - a.impacto);
}

export type PriorityTag = 'critico' | 'ganho-rapido' | 'ponto-forte';

/** Tag de priorização exibida na fila — CRÍTICO (<50%) / GANHO RÁPIDO (50-60%) / PONTO FORTE (≥60%). */
export function priorityTagFromAcerto(acerto: number): PriorityTag {
  if (acerto < 50) return 'critico';
  if (acerto < 60) return 'ganho-rapido';
  return 'ponto-forte';
}

export const PRIORITY_TAG_CONFIG: Record<PriorityTag, { label: string; className: string; borderClassName: string }> = {
  critico: {
    label: 'CRÍTICO',
    className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    borderClassName: 'border-l-red-500',
  },
  'ganho-rapido': {
    label: 'GANHO RÁPIDO',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    borderClassName: 'border-l-amber-500',
  },
  'ponto-forte': {
    label: 'PONTO FORTE',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    borderClassName: 'border-l-emerald-500',
  },
};

/** Cor do ponto no scatter, por status de proficiência do tema (mesma paleta do StatusBadge). */
export function scatterColorFromStatus(status: StatusLevel): string {
  switch (status) {
    case 'critico':
      return 'hsl(var(--destructive))';
    case 'proximo':
      return 'hsl(var(--chart-3))';
    case 'proficiente':
      return 'hsl(var(--chart-1))';
  }
}
