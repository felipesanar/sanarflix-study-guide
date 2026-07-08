import * as React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { AdminAttentionDetail } from '@/services/admin/useAdminAttention';

export interface AttentionQueueProps {
  /** `attentionDetail` de `useAdminAttention` — listas normalizadas (não as contagens). */
  attention: AdminAttentionDetail;
}

interface AttentionItem {
  key: string;
  count: number;
  title: string;
  subtitle: string;
  to: string;
}

/** "UEA, UFRJ e mais 20" — primeiros `max` nomes + o restante agrupado. */
function joinWithMore(names: string[], max = 2): string {
  if (names.length === 0) return '';
  const shown = names.slice(0, max).join(', ');
  const rest = names.length - max;
  return rest > 0 ? `${shown} e mais ${rest}` : shown;
}

/** [singular, plural] — pluralização de categoria de feedback não é regular em PT. */
const CATEGORY_LABEL: Record<string, [string, string]> = {
  bug: ['bug', 'bugs'],
  suggestion: ['sugestão', 'sugestões'],
  feature_request: ['pedido de feature', 'pedidos de feature'],
  praise: ['elogio', 'elogios'],
};

function feedbackBreakdown(byCategory: Record<string, number>): string {
  const parts = Object.entries(byCategory)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const forms = CATEGORY_LABEL[key];
      const label = forms ? forms[n === 1 ? 0 : 1] : key;
      return `${n} ${label}`;
    });
  return parts.join(' · ');
}

function buildItems(attention: AdminAttentionDetail): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (attention.simulados_encerrando_hoje.length > 0) {
    items.push({
      key: 'encerrando',
      count: attention.simulados_encerrando_hoje.length,
      title: 'Simulados encerrando hoje',
      subtitle: joinWithMore(attention.simulados_encerrando_hoje.map((s) => s.nome)),
      to: '/admin/simulados',
    });
  }

  // `total` é a contagem real (sem cap); `rows` só traz as 10 primeiras para
  // os exemplos do subtítulo — ver normalizeImportBatchesFalha.
  if (attention.import_batches_falha_7d.total > 0) {
    items.push({
      key: 'falhas',
      count: attention.import_batches_falha_7d.total,
      title: 'Importações com falha (7d)',
      subtitle: joinWithMore(attention.import_batches_falha_7d.rows.map((b) => b.simulado_nome)),
      to: '/admin/simulados?tab=importar',
    });
  }

  if (attention.feedbacks_pendentes.total > 0) {
    items.push({
      key: 'feedbacks',
      count: attention.feedbacks_pendentes.total,
      title: 'Feedbacks pendentes',
      subtitle: feedbackBreakdown(attention.feedbacks_pendentes.by_category) || 'Aguardando resposta.',
      to: '/admin/feedbacks',
    });
  }

  if (attention.ies_sem_simulado_ativo.length > 0) {
    items.push({
      key: 'ies',
      count: attention.ies_sem_simulado_ativo.length,
      title: 'IES sem simulado ativo',
      subtitle: joinWithMore(attention.ies_sem_simulado_ativo.map((i) => i.nome)),
      to: '/admin/ies',
    });
  }

  return items;
}

/**
 * Fila "Precisa da sua atenção" (contrato §A) — um card clicável por fila com
 * contagem > 0 (número mono grande + título + exemplos reais); navega para a
 * tela correspondente. Todas zeradas → estado positivo único.
 */
export const AttentionQueue: React.FC<AttentionQueueProps> = ({ attention }) => {
  const navigate = useNavigate();
  const items = buildItems(attention);

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {items.length > 0 ? (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        ) : (
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        )}
        Precisa da sua atenção
      </h2>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border bg-card p-4"
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div>
            <p className="font-medium">Nada pendente</p>
            <p className="text-sm text-muted-foreground">As 4 filas de atenção estão zeradas.</p>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => navigate(item.to)}
                className="w-full rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="font-mono text-2xl font-semibold tabular-nums">{item.count}</div>
                <p className="mt-1 text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};
