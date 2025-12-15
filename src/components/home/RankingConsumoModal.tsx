import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  PlayCircle, 
  FileCheck,
  BookOpen,
  TrendingUp,
  Award,
  Gift
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface RankingConsumoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initialMetrics = {
  aulasAssistidas: { quantidade: 0, posicao: 0, total: 0 },
  questoesRespondidas: { quantidade: 0, posicao: 0, total: 0 },
};

export const RankingConsumoModal: React.FC<RankingConsumoModalProps> = ({ 
  open, 
  onOpenChange 
}) => {
  const { user } = useAuth() || {};
  const [metrics, setMetrics] = useState(initialMetrics);
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      let iesId = user.id_ies || null;
      let semestreVal: number | null = (user.semestre ?? null) as number | null;
      try {
        const [{ data: iesRpc }, { data: semRpc }] = await Promise.all([
          supabase.rpc('get_current_user_ies_id'),
          supabase.rpc('get_current_user_semester'),
        ]);
        if (iesRpc) iesId = iesRpc as string;
        if (semRpc !== null && semRpc !== undefined) semestreVal = semRpc as number;
      } catch {}
      if (!iesId || semestreVal === null || semestreVal === undefined) return;
      const sb: any = supabase;

      try {
        const { data: ranking } = await sb.rpc('get_cohort_consumo_ranking');
        if (ranking && ranking.length) {
          const total = ranking[0]?.total ?? ranking.length;
          const myRow = ranking.find((r: any) => r.supabase_user_id === user.id);
          const myVideos = Number(myRow?.videos_assistidos ?? 0);
          const myQuests = Number(myRow?.questoes_respondidas ?? 0);
          const videosPos = Number(myRow?.rank_videos ?? total);
          const questsPos = Number(myRow?.rank_questoes ?? total);
          console.log('[RankingConsumo] RPC ranking', {
            total,
            myRow,
            sample: ranking.slice(0, 3),
          });
          setMetrics({
            aulasAssistidas: { quantidade: myVideos, posicao: videosPos, total },
            questoesRespondidas: { quantidade: myQuests, posicao: questsPos, total },
          });
          return;
        }
      } catch {}

      const { data: usersRes } = await sb
        .from('users')
        .select('id')
        .eq('id_ies', iesId)
        .eq('semestre', semestreVal);
      const userIds = (usersRes || []).map((u: any) => u.id);
      const { data: mapRes } = await sb
        .from('supabase_to_metabase')
        .select('id, user_id_metabase')
        .in('id', userIds);
      const idToMetabase = new Map<string, string>();
      (mapRes || []).forEach((m: any) => idToMetabase.set(m.id, m.user_id_metabase));
      const metabaseIds = Array.from(idToMetabase.values());
      let consumoRes: any[] = [];
      if (metabaseIds.length > 0) {
        const { data: consumo } = await sb
          .from('consumo_metabase')
          .select('id, videos_assistidos, documentos_lidos, questoes_respondidas')
          .in('id', metabaseIds);
        consumoRes = consumo || [];
      }
      const consumoByMetabaseId = new Map<string, any>();
      consumoRes.forEach((c: any) => consumoByMetabaseId.set(c.id, c));
      const total = userIds.length;
      const sortBy = (key: 'videos_assistidos' | 'questoes_respondidas') => {
        return userIds
          .map((uid: string) => {
            const mid = idToMetabase.get(uid);
            const c = mid ? consumoByMetabaseId.get(mid) : null;
            const val = Number(c?.[key] ?? 0);
            return { uid, val };
          })
          .sort((a, b) => b.val - a.val);
      };
      console.log('[RankingConsumo] Cohort', { iesId, semestreVal, userCount: userIds.length, sampleUserIds: userIds.slice(0, 5) });
      console.log('[RankingConsumo] Mapping', { mapCount: idToMetabase.size, sampleMap: Array.from(idToMetabase.entries()).slice(0, 5) });
      console.log('[RankingConsumo] Consumo rows', { count: consumoRes.length, sample: consumoRes.slice(0, 3) });

      const videosBoard = sortBy('videos_assistidos');
      const questsBoard = sortBy('questoes_respondidas');
      const myId = user.id;
      const myVideos = videosBoard.find((s) => s.uid === myId)?.val ?? 0;
      const myQuests = questsBoard.find((s) => s.uid === myId)?.val ?? 0;
      const videosIdx = videosBoard.findIndex((s) => s.uid === myId);
      const questsIdx = questsBoard.findIndex((s) => s.uid === myId);
      const allZeroVideos = videosBoard.every((s) => s.val === 0);
      const allZeroQuests = questsBoard.every((s) => s.val === 0);
      const lastZeroVideos = videosBoard.map((s) => s.val).lastIndexOf(0);
      const lastZeroQuests = questsBoard.map((s) => s.val).lastIndexOf(0);
      const videosPos = videosIdx >= 0
        ? (myVideos === 0
            ? (lastZeroVideos >= 0 ? lastZeroVideos + 1 : total)
            : (allZeroVideos ? total : videosIdx + 1))
        : total;
      const questsPos = questsIdx >= 0
        ? (myQuests === 0
            ? (lastZeroQuests >= 0 ? lastZeroQuests + 1 : total)
            : (allZeroQuests ? total : questsIdx + 1))
        : total;
      console.log('[RankingConsumo] Scoreboards', {
        total,
        videosTop5: videosBoard.slice(0, 5),
        questsTop5: questsBoard.slice(0, 5),
        myId,
        myVideos,
        myQuests,
        videosIdx,
        questsIdx,
        videosPos,
        questsPos,
        allZeroVideos,
        allZeroQuests,
        lastZeroVideos,
        lastZeroQuests,
      });

      setMetrics({
        aulasAssistidas: { quantidade: myVideos, posicao: videosPos, total },
        questoesRespondidas: { quantidade: myQuests, posicao: questsPos, total },
      });
    };
    if (open) load();
  }, [open, user?.id]);
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
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            Ranking de Consumo de Conteúdo
          </DialogTitle>
          <DialogDescription className="text-base">
            Veja sua posição em aulas assistidas e questões respondidas na sua instituição.
          </DialogDescription>

          {/* Aviso de Premiação */}
          <div className="mt-4 p-4 bg-gradient-to-r from-amber-500/10 to-amber-500/5 rounded-lg border border-amber-500/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Gift className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100 mb-1">
                  🏆 Premiação Semestral
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Ao final do semestre, os <span className="font-semibold">2 melhores alunos por ciclo</span> são premiados! 
                  Continue estudando e melhore sua posição no ranking.
                </p>
              </div>
            </div>
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
                  {user?.nome || ''} • {user?.semestre || ''}º Semestre • {user?.ies_nome || ''}
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
                          {getMedalIcon(metrics.aulasAssistidas.posicao)}
                        </span>
                        <span className="text-2xl font-bold">
                          #{metrics.aulasAssistidas.posicao}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          de {metrics.aulasAssistidas.total}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Top {getPercentile(
                          metrics.aulasAssistidas.posicao,
                          metrics.aulasAssistidas.total
                        )}%
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-3">
                        Você assistiu <span className="font-semibold text-foreground">
                          {metrics.aulasAssistidas.quantidade} aulas
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
                          {getMedalIcon(metrics.questoesRespondidas.posicao)}
                        </span>
                        <span className="text-2xl font-bold">
                          #{metrics.questoesRespondidas.posicao}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          de {metrics.questoesRespondidas.total}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Top {getPercentile(
                          metrics.questoesRespondidas.posicao,
                          metrics.questoesRespondidas.total
                        )}%
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-3">
                        Você respondeu <span className="font-semibold text-foreground">
                          {metrics.questoesRespondidas.quantidade} questões
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Estado vazio quando não há dados */}
          {metrics.aulasAssistidas.quantidade === 0 && 
           metrics.questoesRespondidas.quantidade === 0 && (
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