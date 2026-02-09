import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface LiveUsersIndicatorProps {
  sessionsCount: number;
  isConnected: boolean;
  isLoading?: boolean;
}

export const LiveUsersIndicator: React.FC<LiveUsersIndicatorProps> = ({
  sessionsCount,
  isConnected,
  isLoading = false
}) => {
  if (isLoading) {
    return <Skeleton className="h-6 w-20" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="gap-1.5 px-2.5 py-1 cursor-default hover:bg-muted/50 transition-colors"
        >
          {/* Pulsing dot */}
          <span className="relative flex h-2 w-2">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/50" />
            )}
          </span>
          
          {/* Counter */}
          <span className="text-xs font-medium tabular-nums">
            {isConnected 
              ? `${sessionsCount.toLocaleString('pt-BR')} online` 
              : 'Offline'}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          {isConnected 
            ? 'Sessões ativas hoje (tempo real)' 
            : 'Conexão realtime perdida'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
