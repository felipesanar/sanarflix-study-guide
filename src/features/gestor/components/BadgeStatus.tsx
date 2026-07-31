import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { StatusSimulado } from '@/features/gestor/api/types';

/** Rótulos de status do cronograma (spec §6.4). `previsto` = slot sem data. */
export const ROTULO_STATUS: Record<StatusSimulado, string> = {
  realizado: 'Realizado',
  agendado: 'Agendado',
  reagendado: 'Reagendado',
  previsto: 'A definir',
  processing: 'Em processamento',
};

const VARIANTE: Record<StatusSimulado, 'default' | 'secondary' | 'outline'> = {
  realizado: 'default',
  agendado: 'secondary',
  reagendado: 'secondary',
  previsto: 'outline',
  processing: 'outline',
};

/** Status de um simulado no cronograma — sempre com rótulo textual. */
export const BadgeStatus: React.FC<{ status: StatusSimulado }> = ({ status }) => (
  <Badge variant={VARIANTE[status]} className="text-[10px] font-medium">
    {ROTULO_STATUS[status]}
  </Badge>
);
