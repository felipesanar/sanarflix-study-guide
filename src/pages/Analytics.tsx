import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RealOverviewTab } from '@/components/analytics/RealOverviewTab';
import { RealEngagementTab } from '@/components/analytics/RealEngagementTab';
import { RealProgressTab } from '@/components/analytics/RealProgressTab';
import { RealDemographicsTab } from '@/components/analytics/RealDemographicsTab';
import { RealSimuladosTab } from '@/components/analytics/RealSimuladosTab';
import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters';
import { ExportModal } from '@/components/analytics/ExportModal';
import { LoginPrompt } from '@/components/analytics/LoginPrompt';
import { RealtimeDashboard } from '@/components/admin/RealtimeDashboard';
import { isB2BUser } from '@/utils/accessRules';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { BarChart3, RefreshCw, Download, Info, Shield, Radio } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getBrazilDate } from '@/utils/timezone';

export interface AnalyticsFilters {
  dateRange: {
    start: Date;
    end: Date;
  };
  course: string;
  university: string;
  searchTerm: string;
}

const Analytics = () => {
  const { user } = useAuth();
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: {
      start: new Date(getBrazilDate().getTime() - 30 * 24 * 60 * 60 * 1000),
      end: getBrazilDate()
    },
    course: '',
    university: '',
    searchTerm: ''
  });

  const analyticsFilters = {
    dateRange: filters.dateRange,
    iesId: filters.university
  };

  const data = useAnalyticsData(analyticsFilters);
  const { 
    overview, 
    engagement, 
    progress, 
    demographics, 
    simulados, 
    isLoading, 
    refetch 
  } = data;

  const hasAnalyticsAccess = isB2BUser(user);

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: "Dados atualizados",
      description: "Analytics atualizado com sucesso",
      duration: 2000,
    });
  };

  const handleFilterChange = (newFilters: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (!hasAnalyticsAccess) {
    return <LoginPrompt />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-8 lg:px-12 pb-20">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>

              <Badge variant="secondary" className="gap-1">
                <Shield className="w-3 h-3" />
                <span className="hidden sm:inline">Dados reais</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Filters - only show if not realtime tab */}
        {activeTab !== 'realtime' && (
          <div className="bg-card border rounded-lg p-4 mb-6">
            <AnalyticsFilters filters={filters} onFilterChange={handleFilterChange} />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6 bg-muted/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="engagement" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
              Engajamento
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
              Progresso
            </TabsTrigger>
            <TabsTrigger value="demographics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
              Demografia
            </TabsTrigger>
            <TabsTrigger value="simulados" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm">
              Simulados
            </TabsTrigger>
            <TabsTrigger value="realtime" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm flex items-center gap-1">
              <Radio className="w-3 h-3" />
              <span className="hidden sm:inline">Tempo Real</span>
              <span className="sm:hidden">Live</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <RealOverviewTab overview={overview} engagement={engagement} simulados={simulados} trackingHealth={data.trackingHealth || []} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <RealEngagementTab engagement={engagement} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <RealProgressTab progress={progress} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="demographics" className="space-y-6">
            <RealDemographicsTab demographics={demographics} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="simulados" className="space-y-6">
            <RealSimuladosTab simulados={simulados} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="realtime" className="space-y-6">
            <RealtimeDashboard />
          </TabsContent>
        </Tabs>

        {/* Footer - only show if not realtime tab */}
        {activeTab !== 'realtime' && (
          <div className="mt-8 pt-4 border-t bg-muted/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              <span>Dados reais do Supabase</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportModal(true)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        )}
      </div>

      <ExportModal 
        open={showExportModal} 
        onOpenChange={setShowExportModal}
        filters={filters}
      />
    </div>
  );
};

export default Analytics;