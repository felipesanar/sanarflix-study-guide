/**
 * Primitivas compartilhadas do console de Gestão (`/gestor/*`).
 *
 * Ver contrato em `.superpowers/gestor-design/PLANO-IMPLEMENTACAO.md`. Todas
 * as telas do console (Panorama, Diagnóstico, Alunos & risco, etc.) devem
 * consumir estas primitivas em vez de recriar cabeçalhos, badges ou estados
 * de carregamento/erro/vazio próprios.
 */
export { SectionHeader } from './SectionHeader';
export { MetricValue } from './MetricValue';
export { DeltaChip } from './DeltaChip';
export { StatusBadge, statusFromPercent, type StatusLevel } from './StatusBadge';
export { GestorPanel } from './GestorPanel';
export { GestorLoading } from './GestorLoading';
export { GestorError } from './GestorError';
export { GestorEmpty } from './GestorEmpty';
export { GestorDemoBadge } from './GestorDemoBadge';
export { GestorTriPending } from './GestorTriPending';
