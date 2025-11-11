import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  PlayCircle, 
  FileCheck, 
  X,
  BookOpen,
  TrendingUp,
  Award
} from 'lucide-react';

interface RankingConsumoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock data - será substituído por dados reais do Supabase
const mockUserData = {
  nome: "Diego Dias",
  semestre: 10,
  ies_nome: "USCS",
  aulasAssistidas: {
    quantidade: 87,
    posicao: 21,
    total: 150
  },
  questoesRespondidas: {
    quantidade: 342,
    posicao: 15,
    total: 150
  }
};

export const RankingConsumoModal: React.FC<RankingConsumoModalProps> = ({ 
  open, 
  onOpenChange 
}) => {
  const [semestreSelecionado, setSemestreSelecionado] = useState<string>(
    String(mockUserData.semestre)
  );

  const getPercentile = (rank: number, total: number) => {
    if (total === 0) return 0;
    return Math.round(((total - rank + 1) / total) * 100);
  };

  const getMedalIcon = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '🏅';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Ranking de Consumo de Conteúdo
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="text-base">
            Veja sua posição em aulas assistidas e questões respondidas na sua instituição.
          </DialogDescription>

          {/* Filtro de Semestre */}
          <div className="flex items-center gap-3 pt-2">
            <label className="text-sm font-medium">Semestre:</label>
            <Select value={semestreSelecionado} onValueChange={setSemestreSelecionado}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((sem) => (
                  <SelectItem key={sem} value={String(sem)}>
                    {sem}º Semestre
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Card: Minha Posição Geral */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Award className="h-5 w-5 text-primary" />
                  Minha Posição no Ranking
                </CardTitle>
                <CardDescription>
                  {mockUserData.nome} • {mockUserData.semestre}º Semestre • {mockUserData.ies_nome}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aulas Assistidas */}
                  <div className="p-4 bg-background/80 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <PlayCircle className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-sm">Aulas Assistidas</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {getMedalIcon(mockUserData.aulasAssistidas.posicao)}
                        </span>
                        <span className="text-2xl font-bold">
                          #{mockUserData.aulasAssistidas.posicao}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          de {mockUserData.aulasAssistidas.total}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Top {getPercentile(
                          mockUserData.aulasAssistidas.posicao,
                          mockUserData.aulasAssistidas.total
                        )}%
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-3">
                        Você assistiu <span className="font-semibold text-foreground">
                          {mockUserData.aulasAssistidas.quantidade} aulas
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Questões Respondidas */}
                  <div className="p-4 bg-background/80 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCheck className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-sm">Questões Respondidas</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {getMedalIcon(mockUserData.questoesRespondidas.posicao)}
                        </span>
                        <span className="text-2xl font-bold">
                          #{mockUserData.questoesRespondidas.posicao}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          de {mockUserData.questoesRespondidas.total}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Top {getPercentile(
                          mockUserData.questoesRespondidas.posicao,
                          mockUserData.questoesRespondidas.total
                        )}%
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-3">
                        Você respondeu <span className="font-semibold text-foreground">
                          {mockUserData.questoesRespondidas.quantidade} questões
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Estado vazio quando não há dados */}
          {mockUserData.aulasAssistidas.quantidade === 0 && 
           mockUserData.questoesRespondidas.quantidade === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Ainda não há dados suficientes para gerar o ranking.
              </h3>
              <p className="text-muted-foreground mb-6">
                Comece a estudar e suba no placar!
              </p>
              <Button 
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = '/guia-estudos';
                }}
                className="gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Ir para Guia de Estudos
              </Button>
            </motion.div>
          )}

          {/* Dica informativa */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border">
            <p>
              💡 <span className="font-medium">Nota:</span> O ranking é atualizado diariamente 
              e considera apenas alunos do mesmo semestre e instituição. Continue estudando 
              para melhorar sua posição!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar para Home
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};