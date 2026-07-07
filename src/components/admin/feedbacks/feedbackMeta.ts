import type { ComponentType } from 'react';
import { Bug, MessageSquare, FileText, CheckCircle } from 'lucide-react';
import type { StatAccent } from '@/experiences/admin/ui/StatCard';
import type { StatusPillVariant } from '@/experiences/admin/ui/StatusPill';

export type FeedbackCategory = 'bug' | 'suggestion' | 'feature_request' | 'praise';
export type FeedbackStatus = 'received' | 'in_review' | 'resolved' | 'archived';

export interface FeedbackCategoryMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Cor do ícone/valor — classe tailwind (token), nunca hex literal. */
  iconClassName: string;
  /** Acento do StatCard quando existe token equivalente em `StatAccent`; senão 'default'. */
  statAccent: StatAccent;
}

/**
 * Categoria → ícone/cor/rótulo do feedback do aluno. Cores conforme o
 * contrato de implementação (§F): Bugs vermelho, Sugestões cor primária,
 * Funcionalidades violeta, Elogios verde-esmeralda.
 */
export const FEEDBACK_CATEGORY_META: Record<FeedbackCategory, FeedbackCategoryMeta> = {
  bug: { label: 'Bugs', icon: Bug, iconClassName: 'text-red-600 dark:text-red-400', statAccent: 'red' },
  suggestion: { label: 'Sugestões', icon: MessageSquare, iconClassName: 'text-primary', statAccent: 'default' },
  feature_request: {
    label: 'Funcionalidades',
    icon: FileText,
    iconClassName: 'text-violet-600 dark:text-violet-400',
    statAccent: 'violet',
  },
  praise: {
    label: 'Elogios',
    icon: CheckCircle,
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
    statAccent: 'emerald',
  },
};

export const FEEDBACK_CATEGORY_ORDER: FeedbackCategory[] = ['bug', 'suggestion', 'feature_request', 'praise'];

export const FEEDBACK_STATUS_META: Record<FeedbackStatus, { label: string; variant: StatusPillVariant }> = {
  received: { label: 'Recebido', variant: 'muted' },
  in_review: { label: 'Em análise', variant: 'blue' },
  resolved: { label: 'Resolvido', variant: 'emerald' },
  archived: { label: 'Arquivado', variant: 'muted' },
};

export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = ['received', 'in_review', 'resolved', 'archived'];
