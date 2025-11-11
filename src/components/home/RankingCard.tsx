import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RankingData {
  position: number;
  total: number;
  variation: number; // -1 = caiu, 0 = manteve, 1 = subiu
  type: 'geral' | 'semestre' | 'simulado';
}

interface RankingCardProps {
  rankings: RankingData[];
}

const getTrendIcon = (variation: number) => {
  if (variation > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (variation < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const getPercentile = (position: number, total: number) => {
  const percentile = ((total - position + 1) / total) * 100;
  return Math.round(percentile);
};

export const RankingCard = ({ rankings }: RankingCardProps) => {
  const mainRanking = rankings.find(r => r.type === 'geral') || rankings[0];

  if (!mainRanking) {
    return null;
  }

  const percentile = getPercentile(mainRanking.position, mainRanking.total);

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-uscs-orange" />
          Meu Ranking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Ranking Principal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-6 rounded-xl bg-gradient-to-br from-uscs-orange/10 to-yellow-600/10"
          >
            <div className="text-4xl font-bold text-uscs-orange mb-2">
              #{mainRanking.position}
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              de {mainRanking.total} alunos
            </div>
            <div className="flex items-center justify-center gap-2">
              {getTrendIcon(mainRanking.variation)}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground cursor-help">
                      Top {percentile}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Você está entre os {percentile}% que mais estudam</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </motion.div>

          {/* Rankings Adicionais */}
          {rankings.filter(r => r.type !== 'geral').map((rank, index) => (
            <div
              key={rank.type}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div>
                <div className="font-medium text-sm">
                  {rank.type === 'semestre' ? 'No Semestre' : 'No Simulado'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {rank.position}º de {rank.total}
                </div>
              </div>
              {getTrendIcon(rank.variation)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
