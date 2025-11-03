import * as React from 'react';
const { useState } = React;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Calendar, 
  Clock, 
  Repeat, 
  MousePointer, 
  Trophy,
  TrendingUp,
  TrendingDown,
  Bell,
  Send,
  Target
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AnalyticsFilters } from '@/pages/Analytics';

interface OverviewTabProps {
  filters: AnalyticsFilters;
}

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  subtitle: string;
  icon: React.ReactNode;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, changeType, subtitle, icon }) => {
  const changeColor = changeType === 'positive' ? 'text-green-600' : 
                     changeType === 'negative' ? 'text-red-600' : 'text-muted-foreground';
  
  const ChangeIcon = changeType === 'positive' ? TrendingUp : 
                    changeType === 'negative' ? TrendingDown : Clock;

  return (
    <Card className="hover-lift transition-all duration-300 border-l-4 border-l-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            {icon}
          </div>
          <div className={`flex items-center gap-1 text-sm ${changeColor}`}>
            <ChangeIcon className="w-4 h-4" />
            {change}
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{title}</h3>
          <div className="text-3xl font-bold text-primary">{value}</div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
};

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  buttonText: string;
  onAction: () => void;
  isLowMetric?: boolean;
}

const ActionCard: React.FC<ActionCardProps> = ({ 
  title, 
  description, 
  icon, 
  buttonText, 
  onAction,
  isLowMetric = false 
}) => {
  return (
    <Card className={`hover-lift transition-all duration-300 cursor-pointer ${
      isLowMetric ? 'animate-pulse border-red-200 bg-red-50/50' : ''
    }`}>
      <CardContent className="p-4 text-center">
        <div className="flex justify-center mb-3">
          <div className="p-2 rounded-full bg-blue-100 text-blue-600">
            {icon}
          </div>
        </div>
        <h4 className="font-medium mb-2">{title}</h4>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        <Button size="sm" variant="outline" onClick={onAction} className="w-full">
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};

export const OverviewTab: React.FC<OverviewTabProps> = ({ filters }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');

  // Mock KPI data - would come from API based on filters
  const kpis = [
    {
      title: "DAU",
      value: "800",
      change: "+5% vs. semana passada",
      changeType: "positive" as const,
      subtitle: "Usuários ativos diários",
      icon: <Users className="w-6 h-6 text-blue-600" />
    },
    {
      title: "Cronogramas Ativos",
      value: "2.500",
      change: "+12% este mês",
      changeType: "positive" as const,
      subtitle: "Usuários com cronograma aberto",
      icon: <Calendar className="w-6 h-6 text-green-600" />
    },
    {
      title: "Retenção Geral",
      value: "50%",
      change: "-3% vs. anterior",
      changeType: "negative" as const,
      subtitle: "Taxa de usuários que retornam",
      icon: <Repeat className="w-6 h-6 text-orange-600" />
    },
    {
      title: "Completude Média",
      value: "55%",
      change: "+8% este mês",
      changeType: "positive" as const,
      subtitle: "Progresso médio dos cronogramas",
      icon: <Target className="w-6 h-6 text-purple-600" />
    },
    {
      title: "Churn Rate",
      value: "12%",
      change: "Acima da meta",
      changeType: "negative" as const,
      subtitle: "Usuários que abandonaram",
      icon: <TrendingDown className="w-6 h-6 text-red-600" />
    },
    {
      title: "Cliques para SanarFlix",
      value: "10.000",
      change: "+25% esta semana",
      changeType: "positive" as const,
      subtitle: "Redirecionamentos para conteúdo",
      icon: <MousePointer className="w-6 h-6 text-indigo-600" />
    },
    {
      title: "Cronogramas Completos",
      value: "300",
      change: "+15% vs. anterior",
      changeType: "positive" as const,
      subtitle: "Usuários que finalizaram 100%",
      icon: <Trophy className="w-6 h-6 text-yellow-600" />
    },
    {
      title: "WAU",
      value: "2.100",
      change: "+7% esta semana",
      changeType: "positive" as const,
      subtitle: "Usuários ativos semanais",
      icon: <Clock className="w-6 h-6 text-teal-600" />
    }
  ];

  const handleAction = (actionType: string) => {
    setSelectedAction(actionType);
    setIsModalOpen(true);
  };

  const simulateNotification = () => {
    setIsModalOpen(false);
    toast({
      title: "Notificação enviada!",
      description: `${selectedAction} executada para 50 usuários`,
      duration: 3000,
    });
    
    // Simulate confetti effect
    setTimeout(() => {
      toast({
        title: "Métricas atualizadas",
        description: "Retenção aumentou 2%",
        duration: 2000,
      });
    }, 1000);
  };

  const actions = [
    {
      title: "Notificar baixa completude",
      description: "Lembrar usuários com progresso <30%",
      icon: <Bell className="w-5 h-5" />,
      buttonText: "Simular",
      isLowMetric: true
    },
    {
      title: "Incentivar engajamento",
      description: "Gamificação para usuários inativos",
      icon: <Trophy className="w-5 h-5" />,
      buttonText: "Ativar",
      isLowMetric: false
    },
    {
      title: "Push para SanarFlix",
      description: "Promover conteúdo personalizado",
      icon: <Send className="w-5 h-5" />,
      buttonText: "Enviar",
      isLowMetric: false
    }
  ];

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Progress Bars Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Metas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Retenção</span>
                <span>50% / 60%</span>
              </div>
              <Progress value={83} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Completude</span>
                <span>55% / 50%</span>
              </div>
              <Progress value={110} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Engajamento</span>
                <span>800 / 1000</span>
              </div>
              <Progress value={80} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Tendências
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Pico de acesso</span>
              <Badge variant="outline">19h-21h</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Curso mais ativo</span>
              <Badge variant="secondary">Medicina</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Melhor dia</span>
              <Badge variant="outline">Domingo</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Section */}
      <div>
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Ações Recomendadas
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action, index) => (
            <ActionCard 
              key={index} 
              {...action} 
              onAction={() => handleAction(action.title)}
            />
          ))}
        </div>
      </div>

      {/* Action Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulação de Ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">{selectedAction}</h4>
              <p className="text-blue-700 text-sm">
                "Revise seu cronograma! Você está quase lá. Continue progredindo para alcançar suas metas."
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={simulateNotification}>
                Enviar para 50 usuários
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};