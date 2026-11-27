import type { StatusPillVariant } from '@/experiences/admin/ui';
import type { StatusLeitura } from '@/features/cartoes/leitura/types';

/** Rótulo e cor de cada situação de uma leitura de cartões. */
export const STATUS: Record<StatusLeitura, { rotulo: string; variant: StatusPillVariant }> = {
  enviado: { rotulo: 'Enviado', variant: 'muted' },
  processando: { rotulo: 'Lendo…', variant: 'blue' },
  concluido: { rotulo: 'Para revisar', variant: 'amber' },
  falhou: { rotulo: 'Falhou', variant: 'red' },
  importado: { rotulo: 'Importado', variant: 'emerald' },
};
