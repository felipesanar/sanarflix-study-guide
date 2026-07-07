import * as React from 'react';
import { useState } from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RealEngagementTab } from '@/components/analytics/RealEngagementTab';
import { RealProgressTab } from '@/components/analytics/RealProgressTab';
import { RealDemographicsTab } from '@/components/analytics/RealDemographicsTab';
import { RealSimuladosTab } from '@/components/analytics/RealSimuladosTab';
import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters';
import { ExportReportModal } from '@/components/analytics/ExportReportModal';
import { DataStatusIndicator } from '@/components/analytics/DataStatusIndicator';
import { LiveUsersIndicator } from '@/components/analytics/LiveUsersIndicator';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { useOnlineUsersCount } from '@/hooks/useOnlineUsersCount';
import { RefreshCw, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getBrazilDate } from '@/utils/timezone';
import type { AnalyticsFilters as AnalyticsFiltersState } from '@/pages/Analytics';

type AnalyticsTab = 'engagement' | 'progress' | 'demographics' | 'simulados';

const TABS: Array<{ id: AnalyticsTab; label: string }> = [
  { id: 'engagement', label: 'Engajamento' },
  { id: 'progress', label: 'Progresso' },
  { id: 'demographics', label: 'Demografia' },
  { id: 'simulados', label: 'Simulados' },
];

/**
 * Seção Analytics do Portal do Admin (`/admin/analytics`).
 *
 * Encaixa a página `Analytics` original (dados reais via `useAnalyticsData`)
 * no shell novo: header único (sem duplicação — o antigo `Analytics.tsx`
 * segue existindo só para reexportar o tipo `AnalyticsFilters`, consumido
 * pelos `Real*Tab`) e sub-abas no padrão visual do console (mesmo estilo de
 * `SimuladosPage`).
 */
const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('engagement');
  const [showExportModal, setShowExportModal] = useState(false);
  const [filters, setFilters] = useState<AnalyticsFiltersState>({
    dateRange: {
      start: new Date(getBrazilDate().getTime() - 30 * 24 * 60 * 60 * 1000),
      end: getBrazilDate(),
    },
    course: '',
    university: '',
    excludedIES: [],
    searchTerm: '',
  });

  const analyticsFilters = {
    dateRange: filters.dateRange,
    iesId: filters.university,
    excludedIES: filters.excludedIES,
  };

  const data = useAnalyticsData(analyticsFilters);
  const { overview, engagement, progress, demographics, simulados, isLoading, refetch } = data;
  const { count: onlineUsersCount, isConnected } = useOnlineUsersCount();

  const handleFilterChange = (newFilters: Partial<AnalyticsFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: 'Dados atualizados',
      description: 'Analytics atualizado com sucesso',
      duration: 2000,
    });
  };

  const subtitle = isConnected
    ? `${onlineUsersCount.toLocaleString('pt-BR')} usuário${onlineUsersCount === 1 ? '' : 's'} online agora — engajamento, progresso, demografia e simulados com dados reais.`
    : 'Engajamento, progresso, demografia e simulados — dados reais.';

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Analytics"
        subtitle={subtitle}
        actions={
          <>
            <LiveUsersIndicator sessionsCount={onlineUsersCount} isConnected={isConnected} />
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <DataStatusIndicator lastUpdated={data.lastUpdated} isLoading={isLoading} />
            <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card p-4">
        <AnalyticsFilters filters={filters} onFilterChange={handleFilterChange} />
      </div>

      <div className="flex gap-1 border-b" role="tablist" aria-label="Sub-seções de Analytics">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'engagement' && (
          <RealEngagementTab
            engagement={engagement}
            isLoading={isLoading}
            filters={{
              dateRange: filters.dateRange,
              iesId: filters.university,
              excludedIES: filters.excludedIES,
            }}
          />
        )}
        {activeTab === 'progress' && <RealProgressTab progress={progress} isLoading={isLoading} />}
        {activeTab === 'demographics' && <RealDemographicsTab demographics={demographics} isLoading={isLoading} />}
        {activeTab === 'simulados' && <RealSimuladosTab filters={filters} />}
      </div>

      <ExportReportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        filters={filters}
        data={{
          overview,
          engagement,
          progress,
          demographics,
          simulados,
        }}
      />
    </div>
  );
};

export default AnalyticsPage;
