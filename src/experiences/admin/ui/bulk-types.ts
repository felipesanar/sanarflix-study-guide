/** Fases do ciclo de vida de uma operação em lote (BulkRunner). */
export type BulkPhase = 'idle' | 'preview' | 'running' | 'done' | 'cancelled' | 'error';

/** Status de uma linha na pré-visualização (dry-run). */
export type PreviewRowStatus = 'ok' | 'novo' | 'atualizar' | 'conflito' | 'erro';

export interface PreviewDetalhe {
  linha: number;
  status: PreviewRowStatus;
  mensagem?: string;
  dados?: unknown;
}

/** Estatísticas de pré-visualização (dry-run) de uma operação em lote. */
export interface PreviewStats {
  total: number;
  novos?: number;
  atualizados?: number;
  conflitos?: number;
  erros: number;
  detalhes: PreviewDetalhe[];
}

export type RunItemStatus = 'ok' | 'erro' | 'cancelada';

export interface RunResultItem {
  linha: number;
  status: RunItemStatus;
  mensagem?: string;
}

/** Resultado final (ou parcial, se cancelado) da execução de uma operação em lote. */
export interface RunResult {
  ok: number;
  falhas: number;
  canceladas: number;
  itens: RunResultItem[];
}
