import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Clock, Users, Target, AlertTriangle, CheckCircle2, 
  TrendingUp, BarChart3, Calendar, Timer, HelpCircle, FileQuestion
} from 'lucide-react';
import type { SimuladoOverview, SegmentacaoIES, SegmentacaoDimensao } from '@/hooks/useSimuladosAnalytics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SimuladoDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  simulado: SimuladoOverview | null;
  iesBreakdown?: SegmentacaoIES[];
  areaBreakdown?: SegmentacaoDimensao[];
}

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ativo':
      return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0">Ativo</Badge>;
    case 'encerrado':
      return <Badge variant="secondary">Encerrado</Badge>;
    case 'aguardando':
      return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-0">Aguardando</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export const SimuladoDetailsDrawer: React.FC<SimuladoDetailsDrawerProps> = ({
  open,
  onOpenChange,
  simulado,
  iesBreakdown = [],
  areaBreakdown = [],
}) => {
  if (!simulado) return null;

  const taxaConclusaoColor = 
    simulado.taxa_conclusao >= 75 ? 'text-green-600' :
    simulado.taxa_conclusao >= 50 ? 'text-yellow-600' : 'text-red-600';

  const acuraciaColor = 
    simulado.acuracia_media >= 70 ? 'text-green-600' :
    simulado.acuracia_media >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden p-0">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold truncate">{simulado.nome}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-2">
                {getStatusBadge(simulado.status)}
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(simulado.duracao_minutos)}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {simulado.total_questoes} questões
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="p-6 space-y-6">
            {/* Datas */}
            {(simulado.data_liberacao || simulado.data_encerramento) && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {simulado.data_liberacao && (
                  <span>Início: {format(new Date(simulado.data_liberacao), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                )}
                {simulado.data_encerramento && (
                  <span>Fim: {format(new Date(simulado.data_encerramento), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                )}
              </div>
            )}

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">Participação</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{simulado.concluintes_unicos}</span>
                    <span className="text-sm text-muted-foreground">/ {simulado.iniciados_unicos}</span>
                  </div>
                  <div className={`text-sm font-medium ${taxaConclusaoColor}`}>
                    {simulado.taxa_conclusao}% conclusão
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="w-4 h-4" />
                    <span className="text-xs font-medium">Acurácia</span>
                  </div>
                  <div className={`text-2xl font-bold ${acuraciaColor}`}>
                    {simulado.acuracia_media}%
                  </div>
                  <div className="text-sm text-muted-foreground">média de acertos</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Timer className="w-4 h-4" />
                    <span className="text-xs font-medium">Tempo</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {formatDuration(Math.round(simulado.tempo_mediano_segundos / 60))}
                  </div>
                  <div className="text-sm text-muted-foreground">tempo mediano</div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium">Tentativas</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {simulado.tentativas_media.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">média por aluno</div>
                </CardContent>
              </Card>
            </div>

            {/* Fricção */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Indicadores de Fricção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saídas de aba (média)</span>
                  <Badge variant={simulado.saidas_aba_media > 2 ? 'destructive' : 'secondary'}>
                    {simulado.saidas_aba_media.toFixed(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saídas de fullscreen (média)</span>
                  <Badge variant={simulado.saidas_fullscreen_media > 1 ? 'destructive' : 'secondary'}>
                    {simulado.saidas_fullscreen_media.toFixed(1)}
                  </Badge>
                </div>
                {simulado.questoes_anuladas > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Questões anuladas</span>
                    <Badge variant="outline">{simulado.questoes_anuladas}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Questões Não Respondidas */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-amber-500" />
                  Questões Não Respondidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Média por aluno</span>
                  <Badge 
                    variant={simulado.questoes_nao_respondidas_media > 5 ? 'destructive' : 
                            simulado.questoes_nao_respondidas_media > 0 ? 'secondary' : 'default'}
                    className="font-mono"
                  >
                    {simulado.questoes_nao_respondidas_media.toFixed(1)}
                  </Badge>
                </div>
                
                {/* Taxa de questões não respondidas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Taxa de não preenchimento</span>
                    <span>
                      {simulado.total_questoes > 0 
                        ? ((simulado.questoes_nao_respondidas_media / simulado.total_questoes) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={simulado.total_questoes > 0 
                      ? (simulado.questoes_nao_respondidas_media / simulado.total_questoes) * 100
                      : 0} 
                    className="h-1.5" 
                  />
                </div>

                {/* Contextual insight */}
                <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  {simulado.questoes_nao_respondidas_media === 0 ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <p>Excelente! Todos os alunos responderam todas as questões.</p>
                    </div>
                  ) : simulado.questoes_nao_respondidas_media <= 3 ? (
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p>Poucos alunos deixaram questões em branco. Pode indicar dificuldade com questões específicas ou gestão de tempo.</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <p>Alta taxa de questões não respondidas. Verifique se o tempo da prova está adequado ou se há problemas técnicos.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Breakdown por IES */}
            {iesBreakdown.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Desempenho por IES
                  </h3>
                  <div className="space-y-3">
                    {iesBreakdown.slice(0, 5).map((ies) => (
                      <div key={ies.ies_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[180px]">{ies.ies_nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{ies.alunos} alunos</span>
                            <Badge variant={ies.acuracia >= 70 ? 'default' : ies.acuracia >= 50 ? 'secondary' : 'destructive'}>
                              {ies.acuracia}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={ies.acuracia} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Breakdown por Área */}
            {areaBreakdown.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Desempenho por Área
                  </h3>
                  <div className="space-y-3">
                    {areaBreakdown.slice(0, 5).map((area) => (
                      <div key={area.nome} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[180px]">{area.nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">n={area.n_respostas}</span>
                            <Badge variant={area.acuracia >= 70 ? 'default' : area.acuracia >= 50 ? 'secondary' : 'destructive'}>
                              {area.acuracia}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={area.acuracia} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
