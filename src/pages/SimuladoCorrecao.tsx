import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ChevronDown, FileDown, Loader2, BookOpen, ClipboardCheck,
  AlertTriangle, BookMarked, Hash, TrendingUp, Minus, GraduationCap,
  Lightbulb, Stethoscope
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageLightbox } from '@/components/simulados/ImageLightbox';
import { QuestionNavigationRail } from '@/components/simulados/QuestionNavigationRail';
import { AddToErrorNotebookButton } from '@/components/caderno-erros/AddToErrorNotebookButton';
import { AddToErrorNotebookDrawer } from '@/components/caderno-erros/AddToErrorNotebookDrawer';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { generateProvaRevisadaPDF, QuestaoRevisada, ProvaRevisadaStats } from '@/utils/pdfProvaRevisada';
import { toast } from '@/hooks/use-toast';
import { Logger } from '@/utils/logger';
import { normalizeGrandeArea } from '@/utils/grandeArea';

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
  imagem_2: string | null;
  imagem_comentario: string | null;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  anulada: boolean;
  resposta_usuario: string | null;
  acertou: boolean | null;
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

// --- Stat Card ---
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  accentClass: string;
  delay?: number;
}> = ({ label, value, icon, accentClass, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
  >
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-200 group',
      'hover:shadow-md dark:hover:shadow-lg',
      accentClass,
    )}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-background/80 dark:bg-background/40 shadow-sm">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-0.5">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">
            {value}
          </p>
        </div>
      </div>
    </div>
  </motion.div>
);

// QuestionChip moved to QuestionNavigationRail component

// --- Alternative Card ---
const AlternativeCard: React.FC<{
  letra: string;
  texto: string;
  isCorreta: boolean;
  isUserWrong: boolean;
  index: number;
}> = ({ letra, texto, isCorreta, isUserWrong, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2, delay: index * 0.04, ease: 'easeOut' }}
    className={cn(
      'relative p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 flex gap-4 items-start group',
      isCorreta
        ? 'bg-green-50 border-green-500/40 dark:bg-green-950/60 dark:border-green-500/40 shadow-sm shadow-green-500/5'
        : isUserWrong
          ? 'bg-red-50 border-red-500/40 dark:bg-red-950/60 dark:border-red-500/40 shadow-sm shadow-red-500/5'
          : 'bg-card border-border/60 hover:border-border',
    )}
  >
    <span
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-xl text-xs font-bold shrink-0 transition-all duration-200',
        isCorreta
          ? 'bg-green-500 text-white shadow-sm shadow-green-500/30'
          : isUserWrong
            ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {letra}
    </span>
    <span className={cn(
      'text-sm sm:text-[15px] leading-relaxed flex-1 pt-0.5',
      isCorreta ? 'text-green-900 dark:text-green-100 font-medium' : '',
      isUserWrong ? 'text-red-900 dark:text-red-100' : ''
    )}>
      {texto}
    </span>
    {isCorreta && (
      <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
    )}
    {isUserWrong && (
      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
    )}
  </motion.div>
);

// --- Main Component ---
export const SimuladoCorrecao: React.FC = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const navigate = useNavigate();

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

  useEffect(() => {
    Logger.info('[ReviewUI] Page mounted');
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
        Logger.info('[ReviewUI] Simulados loaded:', data?.length);
      } catch (err) {
        Logger.error('[ReviewUI] Error fetching simulados:', err);
      } finally {
        setLoadingSimulados(false);
      }
    };
    fetchSimulados();
  }, [user?.id]);

  // Fetch questions
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
        const cacheKey = `correction_${user.id}_${selectedSimulado}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setQuestions(JSON.parse(cached));
          setLoading(false);
          Logger.info('[ReviewUI] Loaded from cache');
          return;
        }

        const [questoesRes, respostasRes] = await Promise.all([
          supabase
            .from('questoes_simulado')
            .select('id, ordem, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, comentario, imagem, imagem_2, imagem_comentario, grande_area, especialidade, tema, anulada')
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
            // Questões anuladas não contam — acertou fica null
            acertou = null;
          } else if (respostaUsuario) {
            acertou = respostaUsuario === gabarito;
          }

          return { ...q, correta: gabarito, resposta_usuario: respostaUsuario, acertou };
        });

        setQuestions(merged);
        sessionStorage.setItem(cacheKey, JSON.stringify(merged));
        Logger.info('[ReviewUI] Questions loaded:', merged.length);
      } catch (err) {
        Logger.error('[ReviewUI] Error fetching questions:', err);
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

  const stats = useMemo(() => {
    const questoesValidas = questions.filter(q => !q.anulada);
    const total = questoesValidas.length;
    const acertos = questoesValidas.filter(q => q.acertou === true).length;
    const erros = questoesValidas.filter(q => q.acertou === false).length;
    const naoRespondidas = questoesValidas.filter(q => q.acertou === null).length;
    const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
    return { total, acertos, erros, naoRespondidas, percentual };
  }, [questions]);

  const currentQuestion = questions[currentIndex] || null;
  const simuladoNome = simulados.find(s => s.id === selectedSimulado)?.nome || 'Simulado';

  // PDF download
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
          imagem2: (q as any).imagem_2 ?? null,
          imagemComentario: (q as any).imagem_comentario ?? null,
          grandeArea: normalizeGrandeArea(q.grande_area),
          especialidade: q.especialidade || '',
          tema: q.tema || '',
          anulada: q.anulada,
        };
      });

      const questoesValidas = questoesRevisadas.filter(q => !q.anulada);
      const acertos = questoesValidas.filter(q => q.acertou === true).length;
      const erros = questoesValidas.filter(q => q.acertou === false).length;
      const naoRespondidas = questoesValidas.filter(q => q.acertou === null).length;
      const total = questoesValidas.length;

      const areaMap = new Map<string, { acertos: number; total: number }>();
      questoesValidas.forEach(q => {
        const area = q.grandeArea || 'Outros';
        const existing = areaMap.get(area) || { acertos: 0, total: 0 };
        existing.total++;
        if (q.acertou === true) existing.acertos++;
        areaMap.set(area, existing);
      });
      const porArea = Array.from(areaMap.entries()).map(([area, d]) => ({
        area, acertos: d.acertos, total: d.total, percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
      }));

      const provaStats: ProvaRevisadaStats = {
        acertos, erros, naoRespondidas, total,
        percentual: total > 0 ? Math.round((acertos / total) * 100) : 0,
        porArea,
      };

      await generateProvaRevisadaPDF(simuladoNome, user.email || 'Aluno', questoesRevisadas, provaStats, (stage, current, totalItems) => {
        switch (stage) {
          case 'preparing': setDownloadProgress('Preparando...'); break;
          case 'loading_images': setDownloadProgress(`Imagens (${current}/${totalItems})...`); break;
          case 'generating': setDownloadProgress(`Gerando (${current}/${totalItems})...`); break;
          case 'complete': setDownloadProgress('Concluído!'); break;
        }
      });

      toast({ title: 'Prova revisada gerada!', description: 'O PDF foi baixado com sucesso.' });
    } catch (error) {
      Logger.error('[ReviewUI] Error generating PDF:', error);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  // --- Render ---
  return (
    <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6 pb-8 px-2 sm:px-4 lg:px-6">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Correção de Simulado</h1>
            <p className="text-xs text-muted-foreground">Revise suas respostas questão a questão</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            {loadingSimulados ? (
              <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
            ) : (
              <Select
                value={selectedSimulado || 'placeholder'}
                onValueChange={(v) => setSelectedSimulado(v === 'placeholder' ? null : v)}
              >
                <SelectTrigger className="w-full max-w-sm h-11 rounded-xl border-border/60 bg-card shadow-sm text-sm font-medium">
                  <SelectValue placeholder="Selecione um simulado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {simulados.map(s => (
                    <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {selectedSimulado && questions.length > 0 && (
            <Button
              variant="outline"
              onClick={() => navigate(`/caderno-de-erros/triagem?simulado=${selectedSimulado}`)}
              className="gap-2 shrink-0 h-11 rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-sm">Triar erros</span>
            </Button>
          )}
          {selectedSimulado && questions.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="gap-2 shrink-0 h-11 rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all"
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              <span className="text-sm">{isDownloading ? downloadProgress : 'Baixar Prova'}</span>
            </Button>
          )}
        </div>
      </motion.div>

      {/* ─── Empty state ─── */}
      {!selectedSimulado && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/50">
            <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-6">
              <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-base font-semibold text-muted-foreground">Selecione um simulado</p>
                <p className="text-sm text-muted-foreground/60 mt-1.5 max-w-xs mx-auto">
                  Escolha um simulado acima para revisar suas respostas e ver os comentários do professor
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Loading skeleton ─── */}
      {loading && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      )}

      {/* ─── Main content ─── */}
      {selectedSimulado && !loading && questions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total"
              value={stats.total}
              icon={<Hash className="h-5 w-5 text-muted-foreground" />}
              accentClass="bg-card border-border/60"
              delay={0}
            />
            <StatCard
              label="Acertos"
              value={stats.acertos}
              icon={<CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
              accentClass="bg-green-500/[0.04] border-green-500/20 dark:bg-green-500/[0.06]"
              delay={0.05}
            />
            <StatCard
              label="Erros"
              value={stats.erros}
              icon={<XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
              accentClass="bg-red-500/[0.04] border-red-500/20 dark:bg-red-500/[0.06]"
              delay={0.1}
            />
            <StatCard
              label="Em branco"
              value={stats.naoRespondidas}
              icon={<Minus className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
              accentClass="bg-amber-500/[0.04] border-amber-500/20 dark:bg-amber-500/[0.06]"
              delay={0.15}
            />
          </div>

          {/* ─── Score bar ─── */}
          {stats.total > 0 && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
              className="origin-left"
            >
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.percentual}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums min-w-[3ch] text-right">
                  {stats.percentual}%
                </span>
              </div>
            </motion.div>
          )}

          {/* ─── Question Navigator ─── */}
          <QuestionNavigationRail
            questions={questions}
            currentIndex={currentIndex}
            onNavigate={goToQuestion}
          />

          {/* ─── Question Card ─── */}
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                  {/* ── Status header ── */}
                  <div className={cn(
                    'px-5 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    'border-b',
                    currentQuestion.anulada
                      ? 'bg-purple-500/[0.03] dark:bg-purple-500/[0.05]'
                      : currentQuestion.acertou === true
                        ? 'bg-green-500/[0.03] dark:bg-green-500/[0.05]'
                        : currentQuestion.acertou === false
                          ? 'bg-red-500/[0.03] dark:bg-red-500/[0.05]'
                          : 'bg-amber-500/[0.03] dark:bg-amber-500/[0.05]'
                  )}>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold tracking-tight">Questão {currentIndex + 1}</span>
                      {currentQuestion.anulada ? (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold">
                          <Ban className="h-3 w-3" /> Anulada
                        </Badge>
                      ) : currentQuestion.acertou === true ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold">
                          <CheckCircle className="h-3 w-3" /> Correto
                        </Badge>
                      ) : currentQuestion.acertou === false ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold">
                          <XCircle className="h-3 w-3" /> Incorreto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold">
                          <HelpCircle className="h-3 w-3" /> Não respondida
                        </Badge>
                      )}
                    </div>

                    {/* Meta badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentQuestion.grande_area && (
                        <span className="text-[11px] text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-lg font-medium">
                          {currentQuestion.grande_area}
                        </span>
                      )}
                      {currentQuestion.tema && (
                        <span className="text-[11px] text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-lg font-medium">
                          {currentQuestion.tema}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Error Notebook CTA ── */}
                  {currentQuestion.acertou !== true && !currentQuestion.anulada && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.25, delay: 0.15 }}
                    >
                      <div className="mx-5 sm:mx-7 mt-5 p-4 rounded-xl bg-primary/[0.04] border border-primary/15 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <BookMarked className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">Registre no Caderno de Erros</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Anote o motivo e evite repetir esse erro</p>
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
                    </motion.div>
                  )}

                  {/* ── Question body ── */}
                  <div className="px-5 sm:px-7 py-6 space-y-6">
                    {/* Enunciado */}
                    <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                      <p className="text-[15px] sm:text-base leading-[1.8] text-foreground/90 whitespace-pre-wrap">
                        {currentQuestion.enunciado}
                      </p>
                    </div>

                    {/* Image */}
                    {currentQuestion.imagem && (
                      <div className="flex justify-center">
                        <ImageLightbox
                          src={currentQuestion.imagem}
                          alt={`Imagem da questão ${currentIndex + 1}`}
                          className="max-w-full max-h-80 rounded-xl object-contain"
                        />
                      </div>
                    )}

                    {/* Segunda imagem do enunciado (opcional) */}
                    {currentQuestion.imagem_2 && (
                      <div className="flex justify-center">
                        <ImageLightbox
                          src={currentQuestion.imagem_2}
                          alt={`Imagem 2 da questão ${currentIndex + 1}`}
                          className="max-w-full max-h-80 rounded-xl object-contain"
                        />
                      </div>
                    )}

                    {/* Alternatives */}
                    <div className="space-y-3">
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((letra, idx) => {
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
                          <AlternativeCard
                            key={letra}
                            letra={letra}
                            texto={texto}
                            isCorreta={isCorreta}
                            isUserWrong={isUserWrong}
                            index={idx}
                          />
                        );
                      })}
                    </div>

                    {/* ── Comment / Explanation ── */}
                    {(currentQuestion.comentario || currentQuestion.imagem_comentario) && (
                      <Collapsible open={commentOpen} onOpenChange={setCommentOpen}>
                        <CollapsibleTrigger asChild>
                          <button className={cn(
                            'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
                            'text-sm font-semibold transition-all duration-200',
                            'bg-primary/[0.04] hover:bg-primary/[0.07] text-primary',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                          )}>
                            <span className="flex items-center gap-2.5">
                              <Lightbulb className="h-4 w-4" />
                              Comentário do Professor
                            </span>
                            <ChevronDown className={cn(
                              'h-4 w-4 transition-transform duration-200',
                              commentOpen && 'rotate-180'
                            )} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.25 }}
                            className="mt-3 rounded-xl border border-border/50 bg-muted/30 dark:bg-muted/20 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/20">
                              <Stethoscope className="h-4 w-4 text-muted-foreground/60" />
                              <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                Explicação
                              </span>
                            </div>
                            <div className="px-5 py-5 space-y-4">
                              {currentQuestion.comentario && (
                                <p className="text-sm sm:text-[15px] text-muted-foreground leading-[1.85] whitespace-pre-wrap">
                                  {currentQuestion.comentario}
                                </p>
                              )}
                              {currentQuestion.imagem_comentario && (
                                <div className="flex justify-center">
                                  <ImageLightbox
                                    src={currentQuestion.imagem_comentario}
                                    alt={`Imagem do comentário da questão ${currentIndex + 1}`}
                                    className="max-w-full max-h-80 rounded-xl object-contain"
                                  />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>

                  {/* ── Bottom navigation ── */}
                  <div className="px-5 sm:px-7 py-4 border-t border-border/40 bg-muted/[0.03] flex items-center justify-between gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => goToQuestion(currentIndex - 1)}
                      disabled={currentIndex === 0}
                      className="gap-2 rounded-xl h-10 px-4 hover:bg-muted/60"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline text-sm">Anterior</span>
                    </Button>
                    <span className="text-sm text-muted-foreground font-semibold tabular-nums">
                      {currentIndex + 1} / {questions.length}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => goToQuestion(currentIndex + 1)}
                      disabled={currentIndex === questions.length - 1}
                      className="gap-2 rounded-xl h-10 px-4 hover:bg-muted/60"
                    >
                      <span className="hidden sm:inline text-sm">Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* No questions */}
      {selectedSimulado && !loading && questions.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/50">
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-muted-foreground">Nenhuma questão encontrada</p>
              <p className="text-sm text-muted-foreground/60 mt-1.5">
                Não encontramos questões para este simulado
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimuladoCorrecao;
