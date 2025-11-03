import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, RefreshCw, Shield } from 'lucide-react';

interface AnalyticsHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  onRefresh,
  isRefreshing
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white h-[60px] flex items-center justify-between px-4 md:px-8 z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6" />
        <h1 className="text-xl md:text-2xl font-bold">
          Dashboard Analytics - Guia de Estudos
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>

        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className="bg-white/10 text-white border-white/20 gap-1">
              <Shield className="w-3 h-3" />
              <span className="hidden sm:inline">Dados anonimizados conforme LGPD</span>
              <span className="sm:hidden">LGPD</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>Todos os dados são agregados e sem identificação pessoal. 
            Respeitamos sua privacidade conforme a Lei Geral de Proteção de Dados.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};