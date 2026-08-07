import * as React from 'react';
import { TagNivel } from '@/features/gestor/components/Tag';
import type { NivelDesempenho } from '@/features/gestor/api/types';

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
 * O rótulo em si vem de `lib/rotulos.ts`, a fonte única de vocabulário pt-BR
 * do portal — este arquivo não guarda mais cópia própria de `ROTULO_NIVEL`.
 * O componente continua existindo só para não obrigar os chamadores atuais a
 * trocar de import; quem for escrever tela nova pode usar `TagNivel` direto.
 */
export const ChipNivel: React.FC<{ nivel: NivelDesempenho; className?: string }> = ({
  nivel,
  className,
}) => <TagNivel nivel={nivel} className={className} />;
