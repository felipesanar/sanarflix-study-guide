import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, ChevronRight, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RankingData } from '@/hooks/useHomeData';
import { Progress } from '@/components/ui/progress';
import { RankingConsumoModal } from './RankingConsumoModal';
import { Badge } from '@/components/ui/badge';

interface RankingCardProps {
  data: RankingData;
}

export const RankingCard: React.FC<RankingCardProps> = ({ data }) => {
  const navigate = useNavigate();
  const [showRankingConsumoModal, setShowRankingConsumoModal] = useState(false);

  const getPercentile = (rank: number, total: number) => {
    if (total === 0) return 0;
    return Math.round(((total - rank + 1) / total) * 100);
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl card-premium h-full glass-subtle">
      {/* Decorative gradient accent */}
      <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/5 blur-2xl" />
      
      {/* Header */}
      <div className="relative px-4 pt-4 pb-2.5 sm:px-5 sm:pt-5 sm:pb-3 md:px-6 md:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground">Ranking</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Comparativo semanal</p>
            </div>
          </div>
          <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 animate-pulse" />
        </div>
      </div>
      
      <div className="relative px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6 space-y-3 sm:space-y-4">
        {/* Ranking de Simulado */}
        <motion.div
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => navigate('/simulados?aba=desempenho')}
          className="p-3 sm:p-4 rounded-lg sm:rounded-xl glass cursor-pointer transition-all duration-300 group hover:glow-primary"
        >
          <div className="flex items-center justify-between mb-2.5 sm:mb-3">
            <Badge className="rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide bg-transparent text-red-500 dark:text-white border-red-500">
              <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5" />
              SIMULADOS
            </Badge>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          
          {data.simuladoRank && data.simuladoTotal ? (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                {getRankEmoji(data.simuladoRank) && (
                  <span className="text-xl sm:text-2xl">{getRankEmoji(data.simuladoRank)}</span>
                )}
                <span className="text-2xl sm:text-3xl font-bold text-foreground">#{data.simuladoRank}</span>
                <span className="text-[10px] sm:text-sm text-muted-foreground">de {data.simuladoTotal} alunos</span>
              </div>
              <div className="space-y-1 sm:space-y-1.5">
                <Progress 
                  value={getPercentile(data.simuladoRank, data.simuladoTotal)} 
                  className="h-1.5 sm:h-2 bg-primary/10"
                />
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Top {100 - getPercentile(data.simuladoRank, data.simuladoTotal) + 1}% da turma
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground py-1.5 sm:py-2">Sem dados de simulados</p>
          )}
        </motion.div>

        {/* Ranking de Consumo */}
        <motion.div
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setShowRankingConsumoModal(true)}
          className="p-3 sm:p-4 rounded-lg sm:rounded-xl glass cursor-pointer transition-all duration-300 group hover:glow-blue"
        >
          <div className="flex items-center justify-between mb-2.5 sm:mb-3">
            <Badge className="rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide bg-transparent text-blue-600 dark:text-blue-400 border-blue-500 hover:bg-transparent">
              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5" />
              CONSUMO
            </Badge>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/50 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          
          {data.conteudoRank && data.conteudoTotal ? (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                {getRankEmoji(data.conteudoRank) && (
                  <span className="text-xl sm:text-2xl">{getRankEmoji(data.conteudoRank)}</span>
                )}
                <span className="text-2xl sm:text-3xl font-bold text-foreground">#{data.conteudoRank}</span>
                <span className="text-[10px] sm:text-sm text-muted-foreground">de {data.conteudoTotal} alunos</span>
              </div>
              <div className="space-y-1 sm:space-y-1.5">
                <Progress 
                  value={getPercentile(data.conteudoRank, data.conteudoTotal)} 
                  className="h-1.5 sm:h-2 bg-blue-500/10 [&>div]:bg-blue-500"
                />
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Top {100 - getPercentile(data.conteudoRank, data.conteudoTotal) + 1}% em engajamento
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground py-1.5 sm:py-2">Sem dados de consumo</p>
          )}
        </motion.div>
      </div>

      <RankingConsumoModal 
        open={showRankingConsumoModal} 
        onOpenChange={setShowRankingConsumoModal} 
      />
    </div>
  );
};
