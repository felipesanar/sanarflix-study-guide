import type { Meta } from '@/features/gestor/api/types';

/**
 * Envelope `meta` para componentes do Gestor (ex.: `KpiCard`) quando a RPC do mentor não devolve
 * envelope (B2C). Nunca inventa data: sem `atualizadoEm` conhecido, fica string vazia e o componente
 * omite a linha de atualização.
 */
export function metaMentor(p: {
  periodo: string;
  criterio: string;
  fonte?: string;
  atualizadoEm?: string | null;
  partial?: boolean;
  lowSample?: boolean;
}): Meta {
  return {
    periodo: p.periodo,
    criterio: p.criterio,
    fonte: p.fonte ?? 'Simulados SanarFlix PRO e dados de estudo do SanarFlix',
    atualizadoEm: p.atualizadoEm ?? '',
    partial: p.partial ?? false,
    lowSample: p.lowSample ?? false,
  };
}
