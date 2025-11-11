import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Clock, Trophy, ChevronRight, FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SimuladoPerformance } from '@/hooks/useHomeData';

interface SimuladoPerformanceCardProps {
  data: SimuladoPerformance | null;
}

export const SimuladoPerformanceCard: React.FC<SimuladoPerformanceCardProps> = ({ data }) => {
  const navigate = useNavigate();

  const getPerformanceColor = (nota: number) => {
    if (nota >= 70) return 'text-green-600';
    if (nota >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceGradient = (nota: number) => {
    if (nota >= 70) return 'from-green-500/20 to-green-500/5';
    if (nota >= 50) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  return (
    <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="py-5">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Desempenho no Simulado
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Você ainda não respondeu nenhum simulado.
              </p>
              <Button onClick={() => navigate('/desempenho-simulado')}>
                Fazer simulado agora
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Performance Circle */}
            <div className={`relative mx-auto w-36 h-36 rounded-full bg-gradient-to-br ${getPerformanceGradient(data.nota)} flex items-center justify-center border-4 border-background shadow-lg`}>
              <div className="text-center">
                <div className={`text-4xl font-bold ${getPerformanceColor(data.nota)}`}>
                  {data.nota}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Acertos</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Tempo</p>
                </div>
                <p className="text-lg font-bold">{data.tempoGasto}</p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Posição</p>
                </div>
                <p className="text-lg font-bold">
                  #{data.ranking}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    /{data.totalAlunos}
                  </span>
                </p>
              </div>
            </div>

            {/* Simulado Name */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
              <p className="text-xs text-muted-foreground mb-1">Último simulado</p>
              <p className="text-sm font-semibold">{data.simuladoNome}</p>
            </div>

            {/* CTA */}
            <Button 
              onClick={() => navigate('/desempenho-simulado')}
              className="w-full"
              variant="outline"
            >
              Ver detalhes do simulado
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
