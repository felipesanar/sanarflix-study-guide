import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { OverviewTab } from '@/components/analytics/OverviewTab';
import { EngagementTab } from '@/components/analytics/EngagementTab';
import { ProgressTab } from '@/components/analytics/ProgressTab';
import { DemographicsTab } from '@/components/analytics/DemographicsTab';
import { InsightsTab } from '@/components/analytics/InsightsTab';
import { AnalyticsFilters } from '@/components/analytics/AnalyticsFilters';
import { ExportModal } from '@/components/analytics/ExportModal';
import { LoginPrompt } from '@/components/analytics/LoginPrompt';
import { isB2BUser } from '@/utils/accessRules';
import { BarChart3, RefreshCw, Download, Info, Shield } from 'lucide-react';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Check if user has analytics access (any B2B user)
  const hasAnalyticsAccess = isB2BUser(user);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: "Dados atualizados",
        description: "Analytics atualizado com sucesso",
        duration: 2000,
      });
    }, 2000);
  };

  const handleFilterChange = (newFilters: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (!hasAnalyticsAccess) {
    return <LoginPrompt />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="px-4 md:px-8 lg:px-12 pb-20">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">
                Dashboard Analytics
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar Dados
              </Button>

              <Badge variant="secondary" className="gap-1">
                <Shield className="w-3 h-3" />
                <span className="hidden sm:inline">Dados anonimizados conforme LGPD</span>
                <span className="sm:hidden">LGPD</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-card border rounded-lg p-4 mb-6">
          <AnalyticsFilters filters={filters} onFilterChange={handleFilterChange} />
        </div>

        {/* Demo Watermark for unauthenticated users */}
        {!user && (
          <div className="fixed inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 flex items-center justify-center transform rotate-45">
              <div className="text-6xl md:text-8xl font-bold text-muted-foreground/10 select-none">
                DADOS DE EXEMPLO
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 bg-muted/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="engagement" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Engajamento
            </TabsTrigger>
            <TabsTrigger value="progress" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Progresso
            </TabsTrigger>
            <TabsTrigger value="demographics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Demografia
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewTab filters={filters} />
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <EngagementTab filters={filters} />
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <ProgressTab filters={filters} />
          </TabsContent>

          <TabsContent value="demographics" className="space-y-6">
            <DemographicsTab filters={filters} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <InsightsTab filters={filters} />
          </TabsContent>
        </Tabs>

        {/* Footer Section */}
        <div className="mt-8 pt-4 border-t bg-muted/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>Métricas baseadas em cliques e marcações no cronograma</span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal 
        open={showExportModal} 
        onOpenChange={setShowExportModal}
        filters={filters}
      />
    </div>
  );
};

export default Analytics;