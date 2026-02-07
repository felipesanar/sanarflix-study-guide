import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertTriangle, ChevronDown, ChevronRight, BookOpen, 
  Target, BarChart2, XCircle, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestaoProblematica } from '@/hooks/useSimuladosAnalytics';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface QuestoesProblematicasCardProps {
  questoes: QuestaoProblematica[];
  isLoading?: boolean;
}

export const QuestoesProblematicasCard: React.FC<QuestoesProblematicasCardProps> = ({
  questoes,
  isLoading,
}) => {
  const [incluirAnuladas, setIncluirAnuladas] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const questoesFiltradas = incluirAnuladas 
    ? questoes 
    : questoes.filter(q => !q.anulada);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Questões com Alta Taxa de Erro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questoes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">Nenhuma questão problemática</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Questões com taxa de erro acima de 50% (e mínimo 5 respostas) aparecem aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Questões que Mais Derrubam Desempenho
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Top 20 questões com maior taxa de erro (≥50%) e mínimo de 5 respostas.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="incluir-anuladas"
              checked={incluirAnuladas}
              onCheckedChange={setIncluirAnuladas}
            />
            <Label htmlFor="incluir-anuladas" className="text-sm text-muted-foreground cursor-pointer">
              Incluir anuladas ({questoes.filter(q => q.anulada).length})
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[500px]">
          <div className="p-4 space-y-2">
            {questoesFiltradas.map((questao) => (
              <Collapsible
                key={questao.id}
                open={expandedId === questao.id}
                onOpenChange={(open) => setExpandedId(open ? questao.id : null)}
              >
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                      expandedId === questao.id && "bg-muted/50 border-primary/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {expandedId === questao.id ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium line-clamp-2">
                            {questao.enunciado.length > 150 
                              ? questao.enunciado.slice(0, 150) + '...' 
                              : questao.enunciado
                            }
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {questao.anulada && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <XCircle className="w-3 h-3" />
                                Anulada
                              </Badge>
                            )}
                            <Badge variant="destructive" className="font-mono">
                              {questao.taxa_erro}% erro
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {questao.grande_area && (
                            <span className="bg-muted px-2 py-0.5 rounded">{questao.grande_area}</span>
                          )}
                          {questao.especialidade && (
                            <span className="bg-muted px-2 py-0.5 rounded">{questao.especialidade}</span>
                          )}
                          {questao.dificuldade && (
                            <span className="bg-muted px-2 py-0.5 rounded">{questao.dificuldade}</span>
                          )}
                          <span className="text-muted-foreground/70">
                            n={questao.n_respostas}
                          </span>
                        </div>
                        <Progress value={questao.taxa_erro} className="h-1.5 mt-2" />
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-7 mt-2 p-4 bg-muted/30 rounded-lg space-y-3">
                    {questao.tema && (
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Tema:</span>
                        <span className="font-medium">{questao.tema}</span>
                      </div>
                    )}
                    
                    {questao.comentario && (
                      <div className="p-3 bg-background rounded border text-sm">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Comentário do professor:</p>
                        <p className="text-muted-foreground">{questao.comentario}</p>
                      </div>
                    )}

                    {!questao.comentario && (
                      <p className="text-xs text-muted-foreground italic">
                        Sem comentário do professor disponível.
                      </p>
                    )}

                    <div className="pt-2 text-xs text-muted-foreground">
                      <p><strong>Interpretação:</strong> Taxa de erro de {questao.taxa_erro}% pode indicar:</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Questão mal formulada ou ambígua</li>
                        <li>Conteúdo não abordado adequadamente</li>
                        <li>Nível de dificuldade muito elevado</li>
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
