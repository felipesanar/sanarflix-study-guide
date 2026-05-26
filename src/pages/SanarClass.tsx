import { useState, useEffect, useMemo, useRef, useDeferredValue, useTransition } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  BookOpen, 
  Download, 
  Eye, 
  FileText, 
  Filter, 
  X, 
  GraduationCap,
  MessageCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Handshake,
  User
} from "lucide-react";
// Preview retorna ao comportamento original baseado em iframe escalado
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toBrazilDate } from '@/utils/timezone';
import { Logger } from '@/utils/logger';

interface SanarClassLesson {
  id: string;
  titulo: string;
  professor: string;
  disciplina: string;
  semestre: number;
  formato: 'pdf' | 'pptx';
  data_publicacao: string;
  arquivo_url: string;
  preview_url: string | null;
  ies_id: string;
}

export default function SanarClass() {
  const { user } = useAuth();
  const { trackSanarClassAction } = useAnalyticsTracker();
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDisciplina, setSelectedDisciplina] = useState<string>("all");
  const [selectedSemestre, setSelectedSemestre] = useState<string>("all");
  const [selectedFormato, setSelectedFormato] = useState<string>("all");
  
  // Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<SanarClassLesson | null>(null);
  const [iframeLoading, setIframeLoading] = useState<boolean>(false);
  const [renderCount, setRenderCount] = useState<number>(12);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(searchTerm);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const bottomInView = useInView(bottomRef, { margin: "400px" });
  const [pageReady, setPageReady] = useState(false);
  const [gradIntro, setGradIntro] = useState(true);

  // Buscar aulas com React Query (com cache)
  const { data: lessons = [], isLoading: loading } = useQuery({
    queryKey: ['sanarclass-lessons', user?.id_ies],
    queryFn: async () => {
      if (!user?.id_ies) return [];
      
      const { data, error } = await supabase
        .from('sanarclass_lessons')
        .select('*')
        .eq('ies_id', user.id_ies)
        .order('data_publicacao', { ascending: false });

      if (error) {
        Logger.error('Erro ao buscar aulas:', error);
        toast.error('Erro ao carregar aulas do SanarClass');
        throw error;
      }

      return (data as SanarClassLesson[]) || [];
    },
    enabled: !!user?.id_ies,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000, // Mantém em cache por 10 minutos
  });

  // Opções únicas para filtros (memoizado)
  const { disciplinas, semestres } = useMemo(() => {
    const uniqueDisciplinas = [...new Set(lessons.map(l => l.disciplina))];
    const uniqueSemestres = [...new Set(lessons.map(l => l.semestre))].sort((a, b) => a - b);
    
    return {
      disciplinas: uniqueDisciplinas,
      semestres: uniqueSemestres
    };
  }, [lessons]);

  // Aplicar filtros (memoizado)
  const filteredLessons = useMemo(() => {
    let filtered = [...lessons];

    // Filtro de busca
    if (deferredSearch) {
      filtered = filtered.filter(lesson =>
        lesson.titulo.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        lesson.professor.toLowerCase().includes(deferredSearch.toLowerCase())
      );
    }

    // Filtro por disciplina
    if (selectedDisciplina !== "all") {
      filtered = filtered.filter(lesson => lesson.disciplina === selectedDisciplina);
    }

    // Filtro por semestre
    if (selectedSemestre !== "all") {
      filtered = filtered.filter(lesson => lesson.semestre === parseInt(selectedSemestre));
    }

    // Filtro por formato
    if (selectedFormato !== "all") {
      filtered = filtered.filter(lesson => lesson.formato === selectedFormato);
    }

    return filtered;
  }, [lessons, searchTerm, selectedDisciplina, selectedSemestre, selectedFormato]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDisciplina("all");
    setSelectedSemestre("all");
    setSelectedFormato("all");
  };

  const handleViewLesson = (lesson: SanarClassLesson) => {
    setSelectedLesson(lesson);
    setIframeLoading(true);
    setViewModalOpen(true);
    // Track view action
    trackSanarClassAction(lesson.id, 'view', lesson.titulo);
  };

  const handleDownload = (lesson: SanarClassLesson) => {
    window.open(lesson.arquivo_url, '_blank');
    toast.success('Download iniciado');
    // Track download action
    trackSanarClassAction(lesson.id, 'download', lesson.titulo);
  };


  useEffect(() => {
    if (bottomInView && renderCount < filteredLessons.length) {
      setRenderCount((c) => Math.min(c + 9, filteredLessons.length));
    }
  }, [bottomInView, filteredLessons.length, renderCount]);

  useEffect(() => {
    if (!loading) {
      const id = requestAnimationFrame(() => setPageReady(true));
      return () => cancelAnimationFrame(id);
    } else {
      setPageReady(false);
    }
  }, [loading]);

  const visibleLessons = useMemo(() => filteredLessons.slice(0, renderCount), [filteredLessons, renderCount]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [itemWidth, setItemWidth] = useState<number>(0);
  const gapPx = 12;
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const updateSizes = () => {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const containerPadding = 32; // px-4 on both sides
      const containerWidth = Math.min(vw, 768) - containerPadding;
      const peekWidth = Math.round(containerWidth * 0.18); // 18% visível do próximo card
      const width = Math.max(containerWidth - peekWidth, 260);
      setItemWidth(width);
    };
    updateSizes();
    window.addEventListener('resize', updateSizes);
    return () => window.removeEventListener('resize', updateSizes);
  }, []);

  useEffect(() => {
    if (carouselIndex >= visibleLessons.length) {
      setCarouselIndex(Math.max(visibleLessons.length - 1, 0));
    }
  }, [visibleLessons.length, carouselIndex]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <section className="relative py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Handshake className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Parceria SanarFlix</span>
              </div>
              <div className="mx-auto h-10 w-64 rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 animate-pulse" />
              <div className="mx-auto h-4 w-96 max-w-[80%] rounded bg-muted animate-pulse" />
            </div>
          </div>
        </section>
        <section className="px-4 pb-16">
          <div className="container mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-white/60 dark:bg-card backdrop-blur p-4 space-y-3">
                <div className="h-40 rounded-md bg-muted animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-8 flex-1 rounded bg-muted animate-pulse" />
                  <div className="h-8 flex-1 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!pageReady) {
    return (
      <div className="min-h-screen">
        <section className="relative py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Handshake className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Parceria SanarFlix</span>
              </div>
              <div className="mx-auto h-10 w-64 rounded-lg bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 animate-pulse" />
              <div className="mx-auto h-4 w-96 max-w-[80%] rounded bg-muted animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-red-50 to-white dark:from-primary/25 dark:via-black/35 dark:to-accent/18"></div>
      <div className="relative z-10">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 overflow-hidden">
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Handshake className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Parceria SanarFlix</span>
            </div>
              <motion.h1
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
              >
                {gradIntro ? (
                  <motion.span
                    initial={{ backgroundPositionX: "0%" }}
                    animate={{ backgroundPositionX: "100%" }}
                    transition={{ duration: 1.8, ease: [0.45, 0, 0.55, 1] }}
                    className="bg-[linear-gradient(90deg,theme(colors.primary.DEFAULT),theme(colors.primary.400),theme(colors.accent.DEFAULT))] bg-clip-text text-transparent [background-size:200%]"
                    style={{ willChange: 'background-position', display: 'inline-block' }}
                    onAnimationComplete={() => setGradIntro(false)}
                  >
                    SanarClass
                  </motion.span>
                ) : (
                  <motion.span
                    initial={false}
                    animate={{ backgroundPositionX: "100%" }}
                    transition={{ duration: 6, repeat: Infinity, repeatType: "mirror", ease: [0.45, 0, 0.55, 1], repeatDelay: 0.6 }}
                    className="bg-[linear-gradient(90deg,theme(colors.primary.DEFAULT),theme(colors.primary.400),theme(colors.accent.DEFAULT))] bg-clip-text text-transparent [background-size:200%]"
                    style={{ willChange: 'background-position', display: 'inline-block' }}
                  >
                    SanarClass
                  </motion.span>
                )}
              </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Todas as aulas feitas pelos professores da sua instituição em parceria com o Sanarflix
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.985 }}
              style={{ willChange: 'transform', transformOrigin: 'center' }}
              className="transform-gpu"
            >
              <Button 
                onClick={() => setInfoModalOpen(true)}
                className="gap-2 w-full sm:w-auto px-4 sm:px-8 py-2 sm:py-3 text-xs sm:text-base !whitespace-normal text-center leading-tight break-words hover:shadow-lg hover:shadow-primary/20"
              >
                <GraduationCap className="h-5 w-5 max-[360px]:hidden" />
                <span className="block">Peça uma nova aula com seu professor</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="px-4 pb-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <Card className="bg-white/70 dark:bg-card backdrop-blur-md border-white/40 dark:border-border shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Busca */}
              <div className="relative">
                <Input
                  placeholder="Buscar por nome da aula ou professor..."
                  value={searchTerm}
                  onChange={(e) => startTransition(() => setSearchTerm(e.target.value))}
                  className="pl-10"
                />
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>

              {/* Filtros em grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={selectedDisciplina} onValueChange={setSelectedDisciplina}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as disciplinas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {disciplinas.map(disc => (
                      <SelectItem key={disc} value={disc}>{disc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSemestre} onValueChange={setSelectedSemestre}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os semestres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os semestres</SelectItem>
                    {semestres.map(sem => (
                      <SelectItem key={sem} value={sem.toString()}>{sem}º Semestre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedFormato} onValueChange={setSelectedFormato}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os formatos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os formatos</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="pptx">PPTX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                onClick={clearFilters}
                className="w-full sm:w-auto gap-2"
                size="sm"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
          </motion.div>
        </div>
      </section>

      {/* Grade de Aulas */}
      <section className="px-4 pb-16">
        <div className="container mx-auto max-w-6xl">
          {filteredLessons.length === 0 ? (
            <Card className="bg-white/60 dark:bg-card backdrop-blur border-dashed border-2 border-white/40 dark:border-border">
              <CardContent className="py-16 text-center space-y-4">
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <div>
                  <h3 className="text-lg font-semibold">Nenhuma aula encontrada</h3>
                  <p className="text-muted-foreground">
                    {lessons.length === 0 
                      ? "Ainda não há aulas disponíveis do SanarClass para sua instituição" 
                      : "Tente ajustar os filtros para encontrar outras aulas"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div aria-label="Carrossel de aulas" role="region" className="sm:hidden relative -mx-4 px-4">
                <div className="relative overflow-hidden">
                  <motion.div
                    ref={carouselRef}
                    className="flex items-stretch"
                    drag="x"
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      const delta = info.offset.x;
                      const w = itemWidth + gapPx;
                      const moved = Math.round(-delta / w);
                      const next = Math.min(Math.max(carouselIndex + moved, 0), Math.max(visibleLessons.length - 1, 0));
                      setCarouselIndex(next);
                    }}
                    animate={{ x: -(itemWidth + gapPx) * carouselIndex }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    style={{ gap: `${gapPx}px` }}
                  >
                    {visibleLessons.map((lesson) => (
                      <div key={lesson.id} style={{ width: `${itemWidth}px` }} className="shrink-0">
                        <Card className="group transform-gpu bg-white/70 dark:bg-card backdrop-blur border-white/40 dark:border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden w-full">
                          <div className="relative h-44 bg-white/50 dark:bg-muted overflow-hidden ring-1 ring-white/40 dark:ring-border transform-gpu" style={{ contain: 'layout paint size', willChange: 'transform' }}>
                            <iframe
                              loading="lazy"
                              src={`${lesson.arquivo_url}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                              className="w-full h-full pointer-events-none scale-100 origin-top"
                              title={`Preview de ${lesson.titulo}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <div className="absolute top-2 left-2 flex items-center gap-2">
                              <Badge variant="default" className="bg-background/60 backdrop-blur text-foreground">
                                {lesson.formato.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <Badge variant="secondary" className="shrink-0">
                                {lesson.formato.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {lesson.semestre}º Sem
                              </Badge>
                            </div>
                            <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                              {lesson.titulo}
                            </CardTitle>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <span className="text-xs font-medium truncate">{lesson.professor}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-3 w-3" />
                                <span className="text-xs truncate">{lesson.disciplina}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(toBrazilDate(lesson.data_publicacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Button 
                              variant="default" 
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => handleViewLesson(lesson)}
                            >
                              <Eye className="h-4 w-4" />
                              Visualizar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => handleDownload(lesson)}
                            >
                              <Download className="h-4 w-4" />
                              Baixar
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </motion.div>
                </div>

                <div className="absolute inset-y-0 left-1 right-1 flex items-center justify-between pointer-events-none" aria-hidden="true">
                  <button
                    className="pointer-events-auto inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/70 backdrop-blur ring-1 ring-border hover:bg-background"
                    onClick={() => setCarouselIndex(Math.max(carouselIndex - 1, 0))}
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="pointer-events-auto inline-flex items-center justify-center w-8 h-8 rounded-full bg-background/70 backdrop-blur ring-1 ring-border hover:bg-background"
                    onClick={() => setCarouselIndex(Math.min(carouselIndex + 1, Math.max(visibleLessons.length - 1, 0)))}
                    aria-label="Próximo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2" role="tablist" aria-label="Posição do carrossel">
                  {visibleLessons.map((_, i) => (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={carouselIndex === i}
                      aria-label={`Ir para item ${i + 1}`}
                      className={`h-2 w-2 rounded-full ${carouselIndex === i ? 'bg-primary' : 'bg-muted'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                      onClick={() => setCarouselIndex(i)}
                    />
                  ))}
                </div>
              </div>

              <motion.div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" viewport={{ once: true, amount: 0.2 }}>
                {visibleLessons.map((lesson, idx) => (
                  <motion.div
                    key={lesson.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  >
                  <Card 
                    className="group transform-gpu bg-white/70 dark:bg-card backdrop-blur border-white/40 dark:border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                  >
                    <div className="relative h-56 bg-white/50 dark:bg-muted overflow-hidden ring-1 ring-white/40 dark:ring-border transform-gpu" style={{ contain: 'layout paint size', willChange: 'transform' }}>
                      <iframe
                        loading="lazy"
                        src={`${lesson.arquivo_url}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full pointer-events-none md:scale-150 md:origin-top md:-mt-[20%]"
                        title={`Preview de ${lesson.titulo}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                      <div className="absolute top-2 left-2 flex items-center gap-2">
                        <Badge variant="default" className="bg-background/60 backdrop-blur text-foreground">
                          {lesson.formato.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="secondary" className="shrink-0">
                          {lesson.formato.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {lesson.semestre}º Sem
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                        {lesson.titulo}
                      </CardTitle>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span className="text-sm font-medium truncate">{lesson.professor}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3 w-3" />
                          <span className="text-sm truncate">{lesson.disciplina}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(toBrazilDate(lesson.data_publicacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button 
                        variant="default" 
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleViewLesson(lesson)}
                      >
                        <Eye className="h-4 w-4" />
                        Visualizar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleDownload(lesson)}
                      >
                        <Download className="h-4 w-4" />
                        Baixar
                      </Button>
                    </CardContent>
                  </Card>
                  </motion.div>
                ))}
              </motion.div>
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </section>

      {/* Seção de Incentivo */}
      <section className="px-4 pb-16">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <Card className="bg-white/70 dark:bg-card backdrop-blur-md border border-primary/20 shadow-lg">
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                Quer uma aula do Sanarflix com seus professores?
              </CardTitle>
              <CardDescription className="text-base">
                Sua turma pode criar novas aulas com o Sanarflix.<br />
                Converse com seu professor e peça para ele solicitar diretamente ao nosso time.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <Button size="lg" onClick={() => setInfoModalOpen(true)} className="gap-2">
                <GraduationCap className="h-5 w-5" />
                Saiba como solicitar
              </Button>
            </CardContent>
          </Card>
          </motion.div>
        </div>
      </section>

      {/* Modal de Visualização */}
      <Dialog open={viewModalOpen} onOpenChange={(o) => { setViewModalOpen(o); if (!o) setIframeLoading(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedLesson && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedLesson.titulo}</DialogTitle>
                <DialogDescription className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedLesson.professor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>{selectedLesson.disciplina}</span>
                    <Badge variant="outline" className="ml-2">
                      {selectedLesson.semestre}º Semestre
                    </Badge>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="aspect-video bg-muted rounded-lg overflow-hidden border-2 relative">
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur z-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                  </div>
                )}
                <iframe
                  src={selectedLesson.arquivo_url}
                  className="w-full h-full"
                  title={selectedLesson.titulo}
                  onLoad={() => setIframeLoading(false)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => handleDownload(selectedLesson)}
                  className="gap-2 flex-1"
                >
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => setViewModalOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Informações */}
      <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Como solicitar uma aula SanarClass
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Converse com seu professor</h4>
                  <p className="text-sm text-muted-foreground">
                    Escolha um tema relevante e apresente a ideia de criar uma aula em parceria com o Sanarflix
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Professor entra em contato</h4>
                  <p className="text-sm text-muted-foreground">
                    Seu professor deve entrar em contato com o time do Sanarflix para formalizar a parceria
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Produção da aula</h4>
                  <p className="text-sm text-muted-foreground">
                    Nossa equipe auxilia na produção e disponibiliza a aula aqui no SanarClass
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <p className="text-sm font-medium">
                💡 Dica: Aulas sobre temas específicos da sua região ou casos clínicos locais são excelentes sugestões!
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="gap-2"
                onClick={() => {
                  const msg = encodeURIComponent('Olá, tenho interesse em uma aula personalizada do SanarClass.');
                  const url = `https://wa.me/5571993120049?text=${msg}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Voltar ao topo"
            className="fixed bottom-4 right-4 z-40 inline-flex items-center justify-center w-10 h-10 rounded-full bg-background/80 backdrop-blur ring-1 ring-border hover:bg-background"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
