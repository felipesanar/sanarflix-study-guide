import * as React from 'react';
import { TagNivel } from '@/features/gestor/components/Tag';
import type { NivelDesempenho } from '@/features/gestor/api/types';

/** Níveis de desempenho sobre % de acerto (spec §4.4). */
export const ROTULO_NIVEL: Record<NivelDesempenho, string> = {
  excelente: 'Excelente',
  mediano: 'Mediano',
  critico: 'Crítico',
};

/**
 * Nível de desempenho de uma grande área / especialidade / tema.
 *
 * Casca fina sobre `TagNivel` — a anatomia de nível do handoff §5, com o par
 * semântico on/surface (`--gp-success-*`, `--gp-warning-*`, `--gp-danger-*`)
 * aplicado TAMBÉM ao texto. Antes daqui saía uma pílula improvisada com
 * `color-mix()` sobre a paleta de GRÁFICO (`--chart-1`/`--chart-3`/
 * `--destructive`): cor de série não é cor de status, e o rótulo herdava
 * `foreground`, deixando a classificação sem cor nenhuma no texto.
 *
 * O componente continua existindo (em vez de os chamadores importarem
 * `TagNivel` direto) porque `ROTULO_NIVEL` mora aqui e é o vocabulário
 * compartilhado — `Tag.tsx` e `CascataDiagnostico.tsx` importam dele.
 */
export const ChipNivel: React.FC<{ nivel: NivelDesempenho; className?: string }> = ({
  nivel,
  className,
}) => <TagNivel nivel={nivel} className={className} />;
