import * as React from 'react';
import { cn } from '@/lib/utils';
import { ROTULO_NIVEL } from '@/features/gestor/lib/rotulos';
import type { NivelDesempenho } from '@/features/gestor/api/types';

/** Cor semântica por token do projeto — nenhum hex solto (spec §11). */
const COR_NIVEL: Record<NivelDesempenho, string> = {
  excelente: 'hsl(var(--chart-1))',
  mediano: 'hsl(var(--chart-3))',
  critico: 'hsl(var(--destructive))',
};

/**
 * Nível de desempenho de uma grande área / especialidade / tema.
 * A cor é reforço, nunca o único canal: o rótulo textual está sempre presente.
 */
export const ChipNivel: React.FC<{ nivel: NivelDesempenho; className?: string }> = ({
  nivel,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
      className,
    )}
    style={{
      borderColor: `color-mix(in srgb, ${COR_NIVEL[nivel]} 40%, transparent)`,
      backgroundColor: `color-mix(in srgb, ${COR_NIVEL[nivel]} 12%, transparent)`,
    }}
  >
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: COR_NIVEL[nivel] }}
    />
    {ROTULO_NIVEL[nivel]}
  </span>
);
