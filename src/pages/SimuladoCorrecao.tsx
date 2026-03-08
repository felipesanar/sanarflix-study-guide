import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle, XCircle, HelpCircle, Ban, ChevronLeft, ChevronRight,
  ChevronDown, Eye, EyeOff, FileDown, Loader2, BookOpen, ClipboardCheck,
  Target, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageLightbox } from '@/components/simulados/ImageLightbox';
import { AddToErrorNotebookButton } from '@/components/caderno-erros/AddToErrorNotebookButton';
import { AddToErrorNotebookDrawer } from '@/components/caderno-erros/AddToErrorNotebookDrawer';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { generateProvaRevisadaPDF, QuestaoRevisada, ProvaRevisadaStats } from '@/utils/pdfProvaRevisada';
import { toast } from '@/hooks/use-toast';

// --- Types ---
interface CorrectedQuestion {
  id: string;
  ordem: number;
  enunciado: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string | null;
  correta: string;
  comentario: string | null;
  imagem: string | null;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  grau_dificuldade: string | null;
  anulada: boolean;
  // Student answer data
  resposta_usuario: string | null;
  acertou: boolean | null; // true=correct, false=wrong, null=not answered
}

interface SimuladoOption {
  id: string;
  nome: string;
}

// --- Error Notebook Helper ---
const ErrorNotebookButtonInCorrection: React.FC<{
  questionId: string;
  simuladoId: string;
  simuladoNome: string;
  wasCorrect: boolean;
  grandeArea: string | null;
  especialidade: string | null;
  tema: string | null;
}> = ({ questionId, simuladoId, simuladoNome, wasCorrect, grandeArea, especialidade, tema }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <AddToErrorNotebookButton
        key={refreshKey}
        questionId={questionId}
        simuladoId={simuladoId}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
      <AddToErrorNotebookDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        questionId={questionId}
        simuladoId={simuladoId}
        simuladoNome={simuladoNome}
        grandeArea={grandeArea}
        especialidade={especialidade}
        tema={tema}
        wasCorrect={wasCorrect}
        onSuccess={() => setRefreshKey(k => k + 1)}
      />
    </>
  );
};

// --- Difficulty Badge ---
const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const styles: Record<string, string> = {
    Fácil: 'bg-green-500/10 text-green-600 dark:text-green-400',
    Moderado: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Médio: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Difícil: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-xs font-semibold', styles[difficulty] || 'bg-muted text-muted-foreground')}>
      {difficulty}
    </span>
  );
};

// --- Main Component ---
export const SimuladoCorrecao: React.FC = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();

  const [simulados, setSimulados] = useState<SimuladoOption[]>([]);
  const [selectedSimulado, setSelectedSimulado] = useState<string | null>(null);
  const [questions, setQuestions] = useState<CorrectedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingSimulados, setLoadingSimulados] = useState(true);
  const [commentOpen, setCommentOpen] = useState(true);
  const [viewedQuestions, setViewedQuestions] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  // Track page view
  useEffect(() => {
    trackEvent({ eventName: 'correction_page_viewed', category: 'navigation', data: {} });
  }, []);

  // Fetch simulados list
  useEffect(() => {
    if (!user?.id) return;
    const fetchSimulados = async () => {
      setLoadingSimulados(true);
      try {
        const { data, error } = await supabase.rpc('get_user_simulados');
        if (error) throw error;
        setSimulados((data || []).map((s: any) => ({ id: s.id, nome: s.nome })));
      } catch (err) {
        console.error('[Correção] Erro ao buscar simulados:', err);
      } finally {
        setLoadingSimulados(false);
      }
    };
    fetchSimulados();
  }, [user?.id]);

  // Fetch questions when simulado changes
  useEffect(() => {
    if (!selectedSimulado || !user?.id) {
      setQuestions([]);
      setCurrentIndex(0);
      return;
    }

    const fetchQuestions = async () => {
      setLoading(true);
      setCurrentIndex(0);
      setViewedQuestions(new Set([0]));

      try {
        // Check cache first
        const cacheKey = `correction_${user.id}_${selectedSimulado}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setQuestions(JSON.parse(cached));
          setLoading(false);
          return;
        }

        // Fetch questions and answers in parallel
        const [questoesRes, respostasRes] = await Promise.all([
          supabase
            .from('questoes_simulado')
            .select('id, ordem, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, comentario, imagem, grande_area, especialidade, tema, grau_dificuldade, anulada')
            .eq('simulado_id', selectedSimulado)
            .order('ordem', { ascending: true }),
          supabase
            .from('answer_progress')
            .select('question_id, resposta_usuario, correct')
            .eq('simulado', selectedSimulado)
            .eq('user_id', user.id),
        ]);

        if (questoesRes.error) throw questoesRes.error;
        if (respostasRes.error) throw respostasRes.error;

        const respostasMap = new Map(
          (respostasRes.data || []).map(r => [r.question_id, r])
        );

        const merged: CorrectedQuestion[] = (questoesRes.data || []).map(q => {
          const resp = respostasMap.get(q.id);
          const respostaUsuario = resp?.resposta_usuario?.toUpperCase() || null;
          const gabarito = q.correta?.toUpperCase() || 'A';

          let acertou: boolean | null = null;
          if (q.anulada) {
            acertou = true;
          } else if (respostaUsuario) {
            acertou = respostaUsuario === gabarito;
          }

          return {
            ...q,
            correta: gabarito,
            resposta_usuario: respostaUsuario,
            acertou,
          };
        });

        setQuestions(merged);
        sessionStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (err) {
        console.error('[Correção] Erro ao buscar questões:', err);
        toast({ title: 'Erro', description: 'Não foi possível carregar as questões.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [selectedSimulado, user?.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        goToQuestion(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        goToQuestion(currentIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, questions.length]);

  const goToQuestion = useCallback((index: number) => {
    setCurrentIndex(index);
    setViewedQuestions(prev => new Set(prev).add(index));
    setCommentOpen(true);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = questions.length;
    const acertos = questions.filter(q => q.acertou === true).length;
    const erros = questions.filter(q => q.acertou === false).length;
    const naoRespondidas = questions.filter(q => q.acertou === null).length;
    return { total, acertos, erros, naoRespondidas };
  }, [questions]);

  const currentQuestion = questions[currentIndex] || null;
  const simuladoNome = simulados.find(s => s.id === selectedSimulado)?.nome || 'Simulado';

  // PDF download (reuse existing logic)
  const handleDownloadPDF = async () => {
    if (!selectedSimulado || !user || questions.length === 0) return;
    setIsDownloading(true);
    setDownloadProgress('Preparando...');

    try {
      const questoesRevisadas: QuestaoRevisada[] = questions.map((q, index) => {
        const alternativas: Array<{ letra: 'A' | 'B' | 'C' | 'D' | 'E'; texto: string; isCorreta: boolean; isMarcadaPeloAluno: boolean }> = [
          { letra: 'A', texto: q.alternativa_a, isCorreta: q.correta === 'A', isMarcadaPeloAluno: q.resposta_usuario === 'A' },
          { letra: 'B', texto: q.alternativa_b, isCorreta: q.correta === 'B', isMarcadaPeloAluno: q.resposta_usuario === 'B' },
          { letra: 'C', texto: q.alternativa_c, isCorreta: q.correta === 'C', isMarcadaPeloAluno: q.resposta_usuario === 'C' },
          { letra: 'D', texto: q.alternativa_d, isCorreta: q.correta === 'D', isMarcadaPeloAluno: q.resposta_usuario === 'D' },
        ];
        if (q.alternativa_e) {
          alternativas.push({ letra: 'E', texto: q.alternativa_e, isCorreta: q.correta === 'E', isMarcadaPeloAluno: q.resposta_usuario === 'E' });
        }
        return {
          numero: index + 1,
          enunciado: q.enunciado,
          alternativas,
          respostaAluno: q.resposta_usuario,
          gabarito: q.correta,
          acertou: q.acertou,
          comentario: q.comentario,
          imagem: q.imagem,
          grandeArea: q.grande_area || 'Geral',
          especialidade: q.especialidade || '',
          tema: q.tema || '',
          dificuldade: q.grau_dificuldade || 'Médio',
          anulada: q.anulada,
        };
      });

      const acertos = questoesRevisadas.filter(q => q.acertou === true).length;
      const erros = questoesRevisadas.filter(q => q.acertou === false).length;
      const naoRespondidas = questoesRevisadas.filter(q => q.acertou === null).length;
      const total = questoesRevisadas.length;

      const areaMap = new Map<string, { acertos: number; total: number }>();
      questoesRevisadas.forEach(q => {
        const area = q.grandeArea || 'Outros';
        const existing = areaMap.get(area) || { acertos: 0, total: 0 };
        existing.total++;
        if (q.acertou === true) existing.acertos++;
        areaMap.set(area, existing);
      });
      const porArea = Array.from(areaMap.entries()).map(([area, d]) => ({
        area, acertos: d.acertos, total: d.total, percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
      }));

      const diffMap = new Map<string, { acertos: number; total: number }>();
      questoesRevisadas.forEach(q => {
        const nivel = q.dificuldade || 'Médio';
        const existing = diffMap.get(nivel) || { acertos: 0, total: 0 };
        existing.total++;
        if (q.acertou === true) existing.acertos++;
        diffMap.set(nivel, existing);
      });
      const porDificuldade = Array.from(diffMap.entries()).map(([nivel, d]) => ({
        nivel, acertos: d.acertos, total: d.total, percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
      }));

      const provaStats: ProvaRevisadaStats = {
        acertos, erros, naoRespondidas, total,
        percentual: total > 0 ? Math.round((acertos / total) * 100) : 0,
        porArea, porDificuldade,
      };

      await generateProvaRevisadaPDF(simuladoNome, user.email || 'Aluno', questoesRevisadas, provaStats, (stage, current, totalItems) => {
        switch (stage) {
          case 'preparing': setDownloadProgress('Preparando...'); break;
          case 'loading_images': setDownloadProgress(`Carregando imagens (${current}/${totalItems})...`); break;
          case 'generating': setDownloadProgress(`Gerando PDF (${current}/${totalItems} questões)...`); break;
          case 'complete': setDownloadProgress('Concluído!'); break;
        }
      });

      toast({ title: 'Prova revisada gerada!', description: 'O PDF foi baixado com sucesso.' });
    } catch (error) {
      console.error('[Correção] Erro ao gerar PDF:', error);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* Simulator selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          {loadingSimulados ? (
            <Skeleton className="h-10 w-full max-w-sm" />
          ) : (
            <Select
              value={selectedSimulado || 'placeholder'}
              onValueChange={(v) => setSelectedSimulado(v === 'placeholder' ? null : v)}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Selecione um simulado" />
              </SelectTrigger>
              <SelectContent>
                {simulados.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {selectedSimulado && questions.length > 0 && (
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="gap-2 shrink-0"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {isDownloading ? downloadProgress : 'Baixar Prova Revisada'}
          </Button>
        )}
      </div>

      {/* Empty state */}
      {!selectedSimulado && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium text-muted-foreground">Selecione um simulado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Escolha um simulado acima para revisar suas respostas questão a questão
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {/* Main content */}
      {selectedSimulado && !loading && questions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</span>
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Acertos</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.acertos}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">Erros</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.erros}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Em branco</span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.naoRespondidas}</p>
              </CardContent>
            </Card>
          </div>

          {/* Question navigator */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex-1 overflow-x-auto scrollbar-thin">
                  <div className="flex gap-1.5 py-1 min-w-max">
                    {questions.map((q, i) => {
                      const isCurrent = i === currentIndex;
                      const isViewed = viewedQuestions.has(i);
                      let bgClass = 'bg-muted text-muted-foreground hover:bg-muted/80';
                      if (q.anulada) {
                        bgClass = 'bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-500/25';
                      } else if (q.acertou === true) {
                        bgClass = 'bg-green-500/15 text-green-700 dark:text-green-300 hover:bg-green-500/25';
                      } else if (q.acertou === false) {
                        bgClass = 'bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-500/25';
                      } else {
                        bgClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20';
                      }

                      return (
                        <button
                          key={q.id}
                          onClick={() => goToQuestion(i)}
                          className={cn(
                            'w-8 h-8 rounded-md text-xs font-semibold transition-all flex items-center justify-center shrink-0',
                            bgClass,
                            isCurrent && 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110',
                          )}
                          title={`Questão ${i + 1}`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => goToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
                  disabled={currentIndex === questions.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Current position */}
              <p className="text-center text-xs text-muted-foreground mt-2">
                Questão {currentIndex + 1} de {questions.length}
                <span className="mx-1.5">·</span>
                Use as setas ← → para navegar
              </p>
            </CardContent>
          </Card>

          {/* Question card */}
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="overflow-hidden">
                  {/* Status header */}
                  <div className={cn(
                    'px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 border-b',
                    currentQuestion.anulada
                      ? 'bg-purple-500/5'
                      : currentQuestion.acertou === true
                        ? 'bg-green-500/5'
                        : currentQuestion.acertou === false
                          ? 'bg-red-500/5'
                          : 'bg-amber-500/5'
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Questão {currentIndex + 1}</span>
                      {currentQuestion.anulada ? (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1">
                          <Ban className="h-3 w-3" /> Anulada
                        </Badge>
                      ) : currentQuestion.acertou === true ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 gap-1">
                          <CheckCircle className="h-3 w-3" /> Correto!
                        </Badge>
                      ) : currentQuestion.acertou === false ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 gap-1">
                          <XCircle className="h-3 w-3" /> Incorreto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                          <HelpCircle className="h-3 w-3" /> Não respondida
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentQuestion.grau_dificuldade && (
                        <DifficultyBadge difficulty={currentQuestion.grau_dificuldade} />
                      )}
                      {currentQuestion.grande_area && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                          {currentQuestion.grande_area}
                        </span>
                      )}
                      {currentQuestion.tema && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                          {currentQuestion.tema}
                        </span>
                      )}
                    </div>
                    </div>

                  {/* Error Notebook CTA — only for wrong/unanswered */}
                  {currentQuestion.acertou !== true && !currentQuestion.anulada && (
                    <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BookMarked className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">Registre no Caderno de Erros</p>
                        <p className="text-xs text-muted-foreground">Anote o motivo e evite repetir esse erro</p>
                      </div>
                      <ErrorNotebookButtonInCorrection
                        questionId={currentQuestion.id}
                        simuladoId={selectedSimulado}
                        simuladoNome={simuladoNome}
                        wasCorrect={false}
                        grandeArea={currentQuestion.grande_area}
                        especialidade={currentQuestion.especialidade}
                        tema={currentQuestion.tema}
                      />
                    </div>
                  )}

                  <CardContent className="p-4 sm:p-6 space-y-5">
                    {/* Enunciado */}
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{currentQuestion.enunciado}</p>

                    {/* Image */}
                    {currentQuestion.imagem && (
                      <div className="flex justify-center">
                        <ImageLightbox
                          src={currentQuestion.imagem}
                          alt={`Imagem da questão ${currentIndex + 1}`}
                          className="max-w-full max-h-80 rounded-lg object-contain"
                        />
                      </div>
                    )}

                    {/* Alternatives */}
                    <div className="space-y-2.5">
                      {(['A', 'B', 'C', 'D', 'E'] as const).map(letra => {
                        const textoMap: Record<string, string | null> = {
                          A: currentQuestion.alternativa_a,
                          B: currentQuestion.alternativa_b,
                          C: currentQuestion.alternativa_c,
                          D: currentQuestion.alternativa_d,
                          E: currentQuestion.alternativa_e,
                        };
                        const texto = textoMap[letra];
                        if (!texto) return null;

                        const isCorreta = currentQuestion.correta === letra;
                        const isUserWrong = currentQuestion.resposta_usuario === letra && !currentQuestion.acertou;

                        return (
                          <div
                            key={letra}
                            className={cn(
                              'p-3 sm:p-4 border rounded-xl text-left transition-colors flex gap-3 items-start',
                              isCorreta
                                ? 'bg-green-50 border-green-500/50 dark:bg-green-500/10 dark:border-green-500/30'
                                : isUserWrong
                                  ? 'bg-red-50 border-red-500/50 dark:bg-red-500/10 dark:border-red-500/30'
                                  : 'bg-muted/20 border-border'
                            )}
                          >
                            <span
                              className={cn(
                                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 mt-0.5',
                                isCorreta
                                  ? 'bg-green-500 text-white'
                                  : isUserWrong
                                    ? 'bg-red-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {letra}
                            </span>
                            <span className={cn(
                              'text-sm leading-relaxed flex-1',
                              isCorreta ? 'text-green-800 dark:text-green-200 font-medium' : '',
                              isUserWrong ? 'text-red-800 dark:text-red-200' : ''
                            )}>
                              {texto}
                            </span>
                            {isCorreta && (
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-1" />
                            )}
                            {isUserWrong && (
                              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-1" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Comment collapse */}
                    {currentQuestion.comentario && (
                      <Collapsible open={commentOpen} onOpenChange={setCommentOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between gap-2 text-sm font-semibold text-primary hover:bg-primary/5">
                            <span className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              Comentário do Professor
                            </span>
                            <ChevronDown className={cn('h-4 w-4 transition-transform', commentOpen && 'rotate-180')} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-muted/40 p-4 rounded-xl border mt-2"
                          >
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {currentQuestion.comentario}
                            </p>
                          </motion.div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                  </CardContent>

                  {/* Bottom navigation */}
                  <div className="px-4 sm:px-6 py-4 border-t bg-muted/10 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      onClick={() => goToQuestion(currentIndex - 1)}
                      disabled={currentIndex === 0}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <span className="text-sm text-muted-foreground font-medium">
                      {currentIndex + 1} / {questions.length}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => goToQuestion(currentIndex + 1)}
                      disabled={currentIndex === questions.length - 1}
                      className="gap-2"
                    >
                      <span className="hidden sm:inline">Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* No questions found */}
      {selectedSimulado && !loading && questions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium text-muted-foreground">Nenhuma questão encontrada</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Não encontramos questões para este simulado
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimuladoCorrecao;
