import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, TrendingUp, ChevronRight, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RankingData } from '@/hooks/useHomeData';
import { Progress } from '@/components/ui/progress';
import { RankingConsumoModal } from './RankingConsumoModal';

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
    <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="py-5">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Ranking do Aluno
        </CardTitle>
        <CardDescription>Sua posição entre os colegas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Ranking de Simulado */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => navigate('/desempenho-simulado')}
          className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
                <Award className="h-3 w-3" />
                Ranking de Simulado
              </p>
              {data.simuladoRank && data.simuladoTotal ? (
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold">
                    #{data.simuladoRank}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      de {data.simuladoTotal}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Top {getPercentile(data.simuladoRank, data.simuladoTotal)}%
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
          </div>
          {data.simuladoRank && data.simuladoTotal && (
            <Progress 
              value={getPercentile(data.simuladoRank, data.simuladoTotal)} 
              className="h-2 bg-amber-500/20"
            />
          )}
        </motion.div>

        {/* Ranking de Consumo (Mock) */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => setShowRankingConsumoModal(true)}
          className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl border border-blue-500/20 cursor-pointer hover:border-blue-500/40 transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Ranking de Consumo
              </p>
              {data.conteudoRank && data.conteudoTotal ? (
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold">
                    #{data.conteudoRank}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      de {data.conteudoTotal}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Top {getPercentile(data.conteudoRank, data.conteudoTotal)}%
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </div>
          {data.conteudoRank && data.conteudoTotal && (
            <Progress 
              value={getPercentile(data.conteudoRank, data.conteudoTotal)} 
              className="h-2 bg-blue-500/20"
            />
          )}
        </motion.div>
      </CardContent>

      {/* Modal de Ranking de Consumo */}
      <RankingConsumoModal 
        open={showRankingConsumoModal} 
        onOpenChange={setShowRankingConsumoModal} 
      />
    </Card>
  );
};
