import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, BookOpen, Play, RotateCcw, TrendingUp } from 'lucide-react';
import { Simulado } from '@/types/simulado';
import { cn } from '@/lib/utils';

interface SimuladoCardProps {
  simulado: Simulado;
  onIniciar: (id: string) => void;
  onContinuar: (id: string) => void;
  onVerDesempenho: (id: string) => void;
}

export const SimuladoCard = ({ simulado, onIniciar, onContinuar, onVerDesempenho }: SimuladoCardProps) => {
  const getStatusConfig = () => {
    switch (simulado.status) {
      case 'disponivel':
        return {
          color: 'bg-green-500/10 text-green-500 border-green-500/20',
          icon: Play,
          action: onIniciar,
          buttonText: 'Iniciar Simulado',
          buttonVariant: 'default' as const
        };
      case 'em_andamento':
        return {
          color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
          icon: RotateCcw,
          action: onContinuar,
          buttonText: 'Continuar',
          buttonVariant: 'outline' as const
        };
      case 'concluido':
        return {
          color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
          icon: TrendingUp,
          action: onVerDesempenho,
          buttonText: 'Aguarde Correção',
          buttonVariant: 'secondary' as const
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{simulado.titulo}</CardTitle>
            <CardDescription className="line-clamp-2">{simulado.descricao}</CardDescription>
          </div>
          <Badge variant="outline" className={cn('border', config.color)}>
            <Icon className="h-3 w-3 mr-1" />
            {simulado.status === 'disponivel' ? 'Disponível' : 
             simulado.status === 'em_andamento' ? 'Em andamento' : 'Concluído'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{simulado.duracao_minutos} min</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>{simulado.numero_questoes} questões</span>
          </div>
        </div>

        {simulado.tema && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {simulado.tema}
            </Badge>
            {simulado.professor && (
              <Badge variant="secondary" className="text-xs">
                {simulado.professor}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full group-hover:shadow-md transition-shadow"
          variant={config.buttonVariant}
          onClick={() => config.action(simulado.id)}
        >
          <Icon className="h-4 w-4 mr-2" />
          {config.buttonText}
        </Button>
      </CardFooter>
    </Card>
  );
};
