export { useMeuDia } from './useMeuDia';
export { useTopAulas } from './useTopAulas';
export { useSimuladoPerformance } from './useSimuladoPerformance';
export { useAnnouncements, type Announcement, priorityIcons, gradientConfigs, getGradient } from './useAnnouncements';

// Types canônicos da decomposição de useHomeData.
// Migrar useMeuDia/etc. para importar daqui em vez de '@/hooks/useHomeData'
// é o próximo passo do refactor (ver hooks/home/README.md).
export type { MeuDiaItem, RankingData, SimuladoPerformance, TopAula, HomeDataSnapshot } from './types';

// Helpers de cache de Home (sessionStorage).
export { readHomeCache, writeHomeCache, clearHomeCache } from './cache';
