import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BarChart3, Clock, Trophy, ChevronRight, FileQuestion, Target, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SimuladoPerformance } from '@/hooks/useHomeData';
import { Badge } from '@/components/ui/badge';

interface SimuladoPerformanceCardProps {
  data: SimuladoPerformance | null;
}

export const SimuladoPerformanceCard: React.FC<SimuladoPerformanceCardProps> = ({ data }) => {
  const navigate = useNavigate();

  const getPerformanceConfig = (nota: number) => {
    if (nota >= 70) return { 
      color: 'text-emerald-500',
      bg: 'from-emerald-500 to-teal-500',
      glow: 'shadow-emerald-500/20',
      label: 'Excelente!',
      labelBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    };
    if (nota >= 50) return { 
      color: 'text-amber-500',
      bg: 'from-amber-500 to-orange-500',
      glow: 'shadow-amber-500/20',
      label: 'Bom progresso',
      labelBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    };
    return { 
      color: 'text-rose-500',
      bg: 'from-rose-500 to-red-500',
      glow: 'shadow-rose-500/20',
      label: 'Continue praticando',
      labelBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    };
  };

  return (
    <div className="relative overflow-hidden rounded-2xl card-premium h-full">
      {/* Decorative gradient */}
      {data && (
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${getPerformanceConfig(data.nota).bg} opacity-10 blur-3xl`} />
      )}
      
      {/* Header */}
      <div className="relative px-5 pt-5 pb-3 md:px-6 md:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Desempenho</h3>
              <p className="text-xs text-muted-foreground">Último simulado</p>
            </div>
          </div>
          {data && (
            <Badge className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getPerformanceConfig(data.nota).labelBg}`}>
              {getPerformanceConfig(data.nota).label}
            </Badge>
          )}
        </div>
      </div>
      
      <div className="relative px-5 pb-5 md:px-6 md:pb-6">
        {!data ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
              <FileQuestion className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Nenhum simulado realizado
              </p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Faça seu primeiro simulado e acompanhe seu progresso aqui.
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={() => navigate('/simulados')} 
                className="gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg shadow-primary/20"
              >
                <Zap className="h-4 w-4" />
                Fazer simulado agora
              </Button>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Circular Progress with glassmorphism */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Glow effect */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${getPerformanceConfig(data.nota).bg} opacity-20 blur-xl`} />
                
                {/* Progress ring */}
                <div className="relative glass-subtle rounded-full p-2">
                  <svg className="w-32 h-32 md:w-36 md:h-36 -rotate-90" viewBox="0 0 144 144">
                    {/* Background ring */}
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-muted/20"
                    />
                    {/* Progress ring with gradient effect */}
                    <circle
                      cx="72"
                      cy="72"
                      r="60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(data.nota / 100) * 377} 377`}
                      className={getPerformanceConfig(data.nota).color}
                      style={{
                        filter: 'drop-shadow(0 0 8px currentColor)',
                      }}
                    />
                  </svg>
                  {/* Center content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      className={`text-4xl md:text-5xl font-bold ${getPerformanceConfig(data.nota).color}`}
                    >
                      {data.nota}%
                    </motion.span>
                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-1">
                      Acertos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl glass">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tempo</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  {data.tempoGasto}
                  <span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                </p>
              </div>

              <div className="p-3 rounded-xl glass">
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Posição</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  #{data.ranking}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/{data.totalAlunos}</span>
                </p>
              </div>
            </div>

            {/* Last Simulado */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-primary/8 to-primary/4 dark:from-primary/15 dark:to-primary/8 border border-primary/10">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Último Simulado</span>
              </div>
              <p className="text-sm font-medium text-foreground mt-1.5 line-clamp-1">{data.simuladoNome}</p>
            </div>

            {/* CTA */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button 
                onClick={() => navigate('/simulados?aba=desempenho')}
                variant="outline"
                className="w-full gap-2 rounded-xl border-border/50 hover:border-primary/30 hover:bg-primary/5"
              >
                Ver detalhes completos
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
