import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, PlayCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { useRealtimeAnalytics } from '@/hooks/useRealtimeAnalytics';
import { LiveCounter } from './realtime/LiveCounter';
import { ActivityFeed } from './realtime/ActivityFeed';
import { LiveChart } from './realtime/LiveChart';

export const RealtimeDashboard = () => {
  const stats = useRealtimeAnalytics();

  return (
    <div className="space-y-6">
      {/* Header com status de conexão */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            📡 Analytics em Tempo Real
          </h2>
          <p className="text-muted-foreground">
            Visualize a atividade dos alunos ao vivo
          </p>
        </div>
        <Badge
          variant={stats.isConnected ? 'default' : 'destructive'}
          className="flex items-center gap-1"
        >
          {stats.isConnected ? (
            <>
              <Wifi className="h-3 w-3" />
              Conectado
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Desconectado
            </>
          )}
        </Badge>
      </div>

      {/* KPIs ao Vivo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <LiveCounter
          value={stats.respostasUltimaHora}
          label="Respostas na Última Hora"
          icon={<MessageSquare className="h-6 w-6" />}
          colorClass="text-blue-500"
          showPulse={stats.isConnected}
        />
        <LiveCounter
          value={stats.aulasAssistidasHoje}
          label="Aulas Assistidas Hoje"
          icon={<PlayCircle className="h-6 w-6" />}
          colorClass="text-green-500"
          showPulse={stats.isConnected}
        />
        <LiveCounter
          value={stats.simuladosConcluidosHoje}
          label="Simulados Concluídos Hoje"
          icon={<CheckCircle className="h-6 w-6" />}
          colorClass="text-purple-500"
          showPulse={stats.isConnected}
        />
      </div>

      {/* Gráfico e Feed lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Respostas por Minuto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Respostas por Minuto</CardTitle>
            <CardDescription>Atividade em tempo real dos últimos 20 minutos</CardDescription>
          </CardHeader>
          <CardContent>
            <LiveChart data={stats.respostasPorMinuto} height={250} />
          </CardContent>
        </Card>

        {/* Feed de Atividades */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Feed de Atividades
              {stats.isConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </CardTitle>
            <CardDescription>Últimas 50 atividades registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed atividades={stats.atividadesRecentes} maxHeight="250px" />
          </CardContent>
        </Card>
      </div>

      {/* Info sobre o que está sendo monitorado */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500"></span>
              <span>Respostas de simulados</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500"></span>
              <span>Visualizações de aulas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-purple-500"></span>
              <span>Simulados finalizados</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500"></span>
              <span>Progresso de estudo</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeDashboard;
