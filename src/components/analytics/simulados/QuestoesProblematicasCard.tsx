import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, ChevronDown, ChevronRight, BookOpen, 
  Target, XCircle, Info, Copy, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestaoProblematica } from '@/hooks/useSimuladosAnalytics';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface QuestoesProblematicasCardProps {
  questoes: QuestaoProblematica[];
  isLoading?: boolean;
}

// Helper to get ranking badge styles
const getRankingBadge = (index: number) => {
  if (index < 5) {
    return {
      bg: 'bg-destructive/15 dark:bg-destructive/25',
      text: 'text-destructive',
      border: 'border-destructive/30',
    };
  }
  if (index < 10) {
    return {
      bg: 'bg-amber-500/15 dark:bg-amber-500/25',
      text: 'text-amber-600 dark:text-amber-500',
      border: 'border-amber-500/30',
    };
  }
  return {
    bg: 'bg-yellow-500/15 dark:bg-yellow-500/25',
    text: 'text-yellow-600 dark:text-yellow-500',
    border: 'border-yellow-500/30',
  };
};

// Helper to get error badge gradient
const getErrorBadgeClass = (taxa: number) => {
  if (taxa >= 90) return 'bg-gradient-to-r from-red-600 to-red-500 text-white';
  if (taxa >= 80) return 'bg-gradient-to-r from-red-500 to-orange-500 text-white';
  if (taxa >= 70) return 'bg-gradient-to-r from-orange-500 to-amber-500 text-white';
  return 'bg-destructive text-destructive-foreground';
};

// Extract unique values for filters
const extractFilterOptions = (questoes: QuestaoProblematica[]) => {
  const areas = [...new Set(questoes.map(q => q.grande_area).filter(Boolean))] as string[];
  const dificuldades = [...new Set(questoes.map(q => q.dificuldade).filter(Boolean))] as string[];
  return { areas, dificuldades };
};

export const QuestoesProblematicasCard: React.FC<QuestoesProblematicasCardProps> = ({
  questoes,
  isLoading,
}) => {
  const [incluirAnuladas, setIncluirAnuladas] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtroArea, setFiltroArea] = useState<string>('all');
  const [filtroDificuldade, setFiltroDificuldade] = useState<string>('all');
  const [filtroFaixaErro, setFiltroFaixaErro] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filterOptions = useMemo(() => extractFilterOptions(questoes), [questoes]);

  const questoesFiltradas = useMemo(() => {
    return questoes.filter(q => {
      // Anuladas filter
      if (!incluirAnuladas && q.anulada) return false;
      
      // Area filter
      if (filtroArea !== 'all' && q.grande_area !== filtroArea) return false;
      
      // Dificuldade filter
      if (filtroDificuldade !== 'all' && q.dificuldade !== filtroDificuldade) return false;
      
      // Error range filter
      if (filtroFaixaErro !== 'all') {
        const taxa = q.taxa_erro;
        if (filtroFaixaErro === '90+' && taxa < 90) return false;
        if (filtroFaixaErro === '70-89' && (taxa < 70 || taxa >= 90)) return false;
        if (filtroFaixaErro === '50-69' && (taxa < 50 || taxa >= 70)) return false;
      }
      
      return true;
    });
  }, [questoes, incluirAnuladas, filtroArea, filtroDificuldade, filtroFaixaErro]);

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      toast.success('ID copiado!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const anuladasCount = questoes.filter(q => q.anulada).length;
  const hasActiveFilters = filtroArea !== 'all' || filtroDificuldade !== 'all' || filtroFaixaErro !== 'all';

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-6 w-8 rounded-md flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded" />
                      <Skeleton className="h-5 w-16 rounded" />
                      <Skeleton className="h-5 w-12 rounded" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questoes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-2 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full flex items-center justify-center">
              <Target className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhuma questão problemática!</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Questões com taxa de erro acima de 50% e mínimo de 5 respostas aparecem aqui. 
            Parece que os alunos estão indo bem! 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Questões que Mais Derrubam Desempenho</span>
              <Badge variant="secondary" className="ml-1 font-mono text-xs">
                {questoesFiltradas.length}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Top 20 questões com maior taxa de erro (≥50%) e mínimo de 5 respostas. Ranking colorido por criticidade.</p>
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
              <Label htmlFor="incluir-anuladas" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                Anuladas ({anuladasCount})
              </Label>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Grande Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Áreas</SelectItem>
                {filterOptions.areas.map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroDificuldade} onValueChange={setFiltroDificuldade}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Dificuldade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {filterOptions.dificuldades.map(dif => (
                  <SelectItem key={dif} value={dif}>{dif}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroFaixaErro} onValueChange={setFiltroFaixaErro}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Taxa de Erro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="90+">90%+ (Crítica)</SelectItem>
                <SelectItem value="70-89">70-89% (Alta)</SelectItem>
                <SelectItem value="50-69">50-69% (Média)</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setFiltroArea('all');
                  setFiltroDificuldade('all');
                  setFiltroFaixaErro('all');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="p-4 space-y-2">
            <AnimatePresence mode="popLayout">
              {questoesFiltradas.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center"
                >
                  <p className="text-muted-foreground">
                    Nenhuma questão encontrada com os filtros selecionados.
                  </p>
                </motion.div>
              ) : (
                questoesFiltradas.map((questao, index) => {
                  const rankingStyle = getRankingBadge(index);
                  const isExpanded = expandedId === questao.id;
                  
                  return (
                    <motion.div
                      key={questao.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      layout
                    >
                      <Collapsible
                        open={isExpanded}
                        onOpenChange={(open) => setExpandedId(open ? questao.id : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <div
                            role="button"
                            aria-expanded={isExpanded}
                            className={cn(
                              "p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                              isExpanded && "bg-muted/50 border-primary/30"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {/* Ranking badge */}
                              <div className={cn(
                                "flex-shrink-0 w-8 h-6 rounded-md flex items-center justify-center text-xs font-bold border",
                                rankingStyle.bg,
                                rankingStyle.text,
                                rankingStyle.border
                              )}>
                                #{index + 1}
                              </div>

                              {/* Expand icon */}
                              <div className="flex-shrink-0 mt-0.5">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>

                              {/* Content */}
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
                                    <Badge className={cn("font-mono text-xs", getErrorBadgeClass(questao.taxa_erro))}>
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
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="ml-11 mt-2 p-4 bg-muted/30 rounded-lg space-y-4"
                          >
                            {/* Tema */}
                            {questao.tema && (
                              <div className="flex items-center gap-2 text-sm">
                                <BookOpen className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Tema:</span>
                                <span className="font-medium">{questao.tema}</span>
                              </div>
                            )}
                            
                            {/* Comentário do professor */}
                            {questao.comentario ? (
                              <div className="p-3 bg-background rounded border text-sm">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Comentário do professor:</p>
                                <p className="text-muted-foreground">{questao.comentario}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Sem comentário do professor disponível.
                              </p>
                            )}

                            {/* Distribuição de alternativas (preparado para dados futuros) */}
                            {questao.distribuicao && questao.distribuicao.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Distribuição de respostas:</p>
                                <div className="space-y-1">
                                  {questao.distribuicao.map(d => (
                                    <div key={d.alternativa} className="flex items-center gap-2 text-xs">
                                      <span className="w-4 font-medium">{d.alternativa}</span>
                                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                                        <div 
                                          className="h-full bg-primary/60"
                                          style={{ width: `${d.percent}%` }}
                                        />
                                      </div>
                                      <span className="w-12 text-right text-muted-foreground">{d.percent}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Interpretação */}
                            <div className="pt-2 text-xs text-muted-foreground border-t">
                              <p><strong>Interpretação:</strong> Taxa de erro de {questao.taxa_erro}% pode indicar:</p>
                              <ul className="list-disc list-inside mt-1 space-y-0.5">
                                <li>Questão mal formulada ou ambígua</li>
                                <li>Conteúdo não abordado adequadamente</li>
                                <li>Nível de dificuldade muito elevado</li>
                              </ul>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyId(questao.id);
                                }}
                              >
                                {copiedId === questao.id ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                Copiar ID
                              </Button>
                            </div>
                          </motion.div>
                        </CollapsibleContent>
                      </Collapsible>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
