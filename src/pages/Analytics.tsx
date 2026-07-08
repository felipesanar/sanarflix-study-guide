/**
 * P3 (auditoria): este arquivo já foi uma página completa (195 linhas), mas
 * NÃO é roteado — `/analytics` redireciona para `/admin/analytics`
 * (`src/experiences/admin/adminRoutes.tsx`), que usa
 * `src/experiences/admin/pages/AnalyticsPage.tsx`. Confirmado sem nenhum
 * `import Analytics from '@/pages/Analytics'` (default export) no repo.
 *
 * O único motivo deste arquivo continuar existindo é `AnalyticsFilters`: o
 * tipo é importado por `AnalyticsPage.tsx`, `RealSimuladosTab.tsx`,
 * `ExportModal.tsx` e `AnalyticsFilters.tsx` (componente de filtros). Mantido
 * aqui só como export de tipo — sem componente, sem JSX, sem imports mortos.
 */
export interface AnalyticsFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  course: string;
  university: string;
  excludedIES: string[];
  searchTerm: string;
}
