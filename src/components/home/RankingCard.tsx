import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, ChevronRight } from 'lucide-react';
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

  return (
    <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-2 pt-6 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            Ranking
          </CardTitle>
          <span className="text-xs text-muted-foreground font-medium">Comparativo Semanal</span>
        </div>
      </CardHeader>
      
      <CardContent className="px-6 pb-6 pt-4 space-y-4">
        {/* Ranking de Simulado */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => navigate('/simulados?aba=desempenho')}
          className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 cursor-pointer transition-all duration-200 group"
        >
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border-primary/30 bg-primary/5 text-primary">
              <Trophy className="w-3 h-3 mr-1.5" />
              SIMULADOS
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
          
          {data.simuladoRank && data.simuladoTotal ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">#{data.simuladoRank}</span>
                <span className="text-sm text-muted-foreground">de {data.simuladoTotal} alunos</span>
              </div>
              <Progress 
                value={getPercentile(data.simuladoRank, data.simuladoTotal)} 
                className="h-1.5 bg-primary/10"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados de simulados</p>
          )}
        </motion.div>

        {/* Ranking de Consumo */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setShowRankingConsumoModal(true)}
          className="p-4 rounded-xl bg-card border border-border/50 hover:border-blue-500/30 cursor-pointer transition-all duration-200 group"
        >
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide border-blue-500/30 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <TrendingUp className="w-3 h-3 mr-1.5" />
              CONSUMO
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
          
          {data.conteudoRank && data.conteudoTotal ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">#{data.conteudoRank}</span>
                <span className="text-sm text-muted-foreground">de {data.conteudoTotal} alunos</span>
              </div>
              <Progress 
                value={getPercentile(data.conteudoRank, data.conteudoTotal)} 
                className="h-1.5 bg-blue-500/10"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados de consumo</p>
          )}
        </motion.div>
      </CardContent>

      <RankingConsumoModal 
        open={showRankingConsumoModal} 
        onOpenChange={setShowRankingConsumoModal} 
      />
    </Card>
  );
};
