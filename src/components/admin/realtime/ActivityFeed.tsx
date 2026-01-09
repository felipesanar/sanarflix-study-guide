import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, PlayCircle, CheckCircle, BookOpen } from 'lucide-react';
import { AtividadeRecente } from '@/hooks/useRealtimeAnalytics';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
  atividades: AtividadeRecente[];
  maxHeight?: string;
}

const getIconForTipo = (tipo: AtividadeRecente['tipo']) => {
  switch (tipo) {
    case 'resposta':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'aula':
      return <PlayCircle className="h-4 w-4 text-green-500" />;
    case 'simulado':
      return <CheckCircle className="h-4 w-4 text-purple-500" />;
    case 'progresso':
      return <BookOpen className="h-4 w-4 text-orange-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
  }
};

const getBgColorForTipo = (tipo: AtividadeRecente['tipo']) => {
  switch (tipo) {
    case 'resposta':
      return 'bg-blue-500/10 border-blue-500/20';
    case 'aula':
      return 'bg-green-500/10 border-green-500/20';
    case 'simulado':
      return 'bg-purple-500/10 border-purple-500/20';
    case 'progresso':
      return 'bg-orange-500/10 border-orange-500/20';
    default:
      return 'bg-muted/50';
  }
};

const formatTimestamp = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 5) return 'Agora';
  if (diffSecs < 60) return `${diffSecs}s atrás`;
  if (diffMins < 60) return `${diffMins}min atrás`;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const ActivityFeed = ({ atividades, maxHeight = '400px' }: ActivityFeedProps) => {
  if (atividades.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        <div className="text-center">
          <div className="animate-pulse mb-2">⏳</div>
          Aguardando atividades em tempo real...
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="pr-4" style={{ maxHeight }}>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {atividades.map((atividade) => (
            <motion.div
              key={atividade.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                getBgColorForTipo(atividade.tipo)
              )}
            >
              <div className="flex-shrink-0">{getIconForTipo(atividade.tipo)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{atividade.descricao}</p>
                {atividade.userId && (
                  <p className="text-xs text-muted-foreground truncate">
                    ID: {atividade.userId.substring(0, 8)}...
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-xs text-muted-foreground">
                {formatTimestamp(atividade.timestamp)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
};
