import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Clock, Trophy, ChevronRight, FileQuestion, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SimuladoPerformance } from '@/hooks/useHomeData';
import { Badge } from '@/components/ui/badge';

interface SimuladoPerformanceCardProps {
  data: SimuladoPerformance | null;
}

export const SimuladoPerformanceCard: React.FC<SimuladoPerformanceCardProps> = ({ data }) => {
  const navigate = useNavigate();

  const getPerformanceColor = (nota: number) => {
    if (nota >= 70) return { text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/30', bg: 'from-emerald-500' };
    if (nota >= 50) return { text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/30', bg: 'from-amber-500' };
    return { text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/30', bg: 'from-red-500' };
  };

  return (
    <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-2 pt-6 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            Desempenho
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-6 pb-6 pt-4">
        {!data ? (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted/50 rounded-2xl flex items-center justify-center">
              <FileQuestion className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Você ainda não respondeu nenhum simulado.
              </p>
              <Button onClick={() => navigate('/simulados')} className="gap-2 rounded-xl">
                Fazer simulado agora
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Circular Progress */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Background ring */}
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/30"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(data.nota / 100) * 402} 402`}
                    className={getPerformanceColor(data.nota).text}
                  />
                </svg>
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-bold ${getPerformanceColor(data.nota).text}`}>
                    {data.nota}%
                  </span>
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Acertos
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tempo</span>
                </div>
                <p className="text-xl font-bold text-foreground">{data.tempoGasto}<span className="text-sm font-normal text-muted-foreground ml-0.5">min</span></p>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Posição</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  #{data.ranking}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">/{data.totalAlunos}</span>
                </p>
              </div>
            </div>

            {/* Last Simulado */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 font-semibold border-primary/30 bg-primary/10 text-primary rounded-full">
                  ÚLTIMO SIMULADO
                </Badge>
                <Clock className="w-3.5 h-3.5 text-primary/50 ml-auto" />
              </div>
              <p className="text-sm font-medium text-foreground mt-2 line-clamp-1">{data.simuladoNome}</p>
            </div>

            {/* CTA */}
            <Button 
              onClick={() => navigate('/simulados?aba=desempenho')}
              variant="outline"
              className="w-full gap-2 rounded-xl border-border/50 hover:border-border hover:bg-muted/50"
            >
              Ver detalhes completos
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
