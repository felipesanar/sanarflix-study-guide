import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Award, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface SimuladoData {
  nome: string;
  nota: number;
  posicao: number;
  totalParticipantes: number;
  tempoGasto: string;
  dataRealizacao: string;
}

interface SimuladoPerformanceCardProps {
  simulado?: SimuladoData;
}

export const SimuladoPerformanceCard = ({ simulado }: SimuladoPerformanceCardProps) => {
  const navigate = useNavigate();

  if (!simulado) {
    return (
      <Card className="premium-card bg-gradient-to-br from-purple-600/5 to-blue-600/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Desempenho em Simulados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ClipboardList className="h-16 w-16 mx-auto mb-4 text-purple-600/20" />
            <p className="text-muted-foreground mb-4">
              Você ainda não respondeu nenhum simulado
            </p>
            <Button
              onClick={() => navigate('/simulado-desempenho')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
            >
              Fazer Simulado
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentual = Math.round((simulado.nota / 100) * 100);

  return (
    <Card className="premium-card bg-gradient-to-br from-purple-600/5 to-blue-600/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-purple-600" />
          Último Simulado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">{simulado.nome}</div>

        {/* Gráfico Circular de Desempenho */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative w-32 h-32 mx-auto"
        >
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="8"
              strokeDasharray={`${(percentual / 100) * 351.86} 351.86`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--uscs-blue))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{percentual}%</div>
            </div>
          </div>
        </motion.div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Award className="h-5 w-5 mx-auto mb-1 text-uscs-orange" />
            <div className="text-sm font-medium">
              {simulado.posicao}º lugar
            </div>
            <div className="text-xs text-muted-foreground">
              de {simulado.totalParticipantes}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Clock className="h-5 w-5 mx-auto mb-1 text-uscs-blue" />
            <div className="text-sm font-medium">{simulado.tempoGasto}</div>
            <div className="text-xs text-muted-foreground">tempo gasto</div>
          </div>
        </div>

        <Button
          onClick={() => navigate('/simulado-desempenho')}
          variant="outline"
          className="w-full"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Ver Detalhes
        </Button>
      </CardContent>
    </Card>
  );
};
