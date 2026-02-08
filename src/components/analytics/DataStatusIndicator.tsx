import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Shield, Database, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DataStatusIndicatorProps {
  lastUpdated: Date | null;
  isLoading?: boolean;
  isOnline?: boolean;
}

export const DataStatusIndicator: React.FC<DataStatusIndicatorProps> = ({
  lastUpdated,
  isLoading = false,
  isOnline = true,
}) => {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  // Atualizar o "há X min" a cada 30 segundos
  React.useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const timeAgo = lastUpdated
    ? formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: false })
    : null;

  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const formattedDate = lastUpdated
    ? lastUpdated.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className="gap-1.5 cursor-help bg-muted/50 hover:bg-muted text-muted-foreground border border-border/50 transition-colors"
          >
            {/* Status dot */}
            <span 
              className={`
                w-2 h-2 rounded-full shrink-0
                ${isLoading 
                  ? 'bg-yellow-500 animate-pulse' 
                  : isOnline 
                    ? 'bg-green-500' 
                    : 'bg-red-500'
                }
              `}
            />
            
            {/* Status text */}
            <span className="hidden sm:inline text-xs">
              {isLoading ? 'Sincronizando...' : 'Dados reais'}
            </span>
            
            {/* Time ago - only show when not loading and has data */}
            {!isLoading && timeAgo && (
              <>
                <span className="hidden md:inline text-muted-foreground/70">|</span>
                <Clock className="hidden md:inline w-3 h-3 text-muted-foreground/70" />
                <span className="hidden md:inline text-xs text-muted-foreground/70">
                  {timeAgo}
                </span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Database className="w-4 h-4 text-primary" />
              <span>Fonte: Supabase</span>
            </div>
            
            {lastUpdated && (
              <div className="text-muted-foreground">
                <p>Última atualização:</p>
                <p className="font-mono text-xs mt-1">
                  {formattedDate} às {formattedTime}
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-xs pt-1 border-t">
              <Shield className="w-3 h-3" />
              <span>Dados anonimizados conforme LGPD</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
