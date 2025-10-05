import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  Search, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Play,
  FileText,
  Brain,
  Target,
  Sparkles,
  ArrowUp,
  Calendar
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface Aula {
  aula: string;
  link_aula?: string | null;
  link_pdf?: string | null;
  link_quiz?: string | null;
}

interface Subtema {
  subtema: string;
  aulas: Aula[];
}

interface Tema {
  tema: string;
  subtemas: Subtema[];
}

interface Materia {
  materia: string;
  temas: Tema[];
}

interface ConteudoData {
  id?: string;
  id_ies?: string;
  semestre: string;
  materia: string;
  tema: string;
  subtema: string;
  aula: string;
  link_aula?: string | null;
  link_pdf?: string | null;
  link_quiz?: string | null;
}

export const StudyGuide: React.FC = () => {
  const { user } = useAuth();
  const [conteudos, setConteudos] = useState<ConteudoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSemestre, setSelectedSemestre] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Load completed items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('study-progress');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setCompletedItems(new Set(data));
      } catch (e) {
        console.error('Error loading progress:', e);
      }
    }
  }, []);

  // Save completed items to localStorage
  const saveProgress = (items: Set<string>) => {
    localStorage.setItem('study-progress', JSON.stringify([...items]));
  };

  // Fetch conteudos from Supabase
  useEffect(() => {
    const fetchConteudos = async () => {
      if (!user?.id_ies || !user?.semestre) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Use edge function to fetch conteudos (bypasses RLS issues)
        const { data: response, error } = await supabase.functions.invoke('get-study-contents');

        if (error) {
          console.error('Edge function error:', error);
          throw error;
        }

        if (!response?.data) {
          throw new Error('Invalid response from server');
        }

        // Transform data to match ConteudoData interface
        const transformedData: ConteudoData[] = (response.data || []).map((item: any) => ({
          id: item.id,
          id_ies: item.id_ies,
          semestre: item.semestre || '',
          materia: item.materia || '',
          tema: item.tema || '',
          subtema: item.subtema || '',
          aula: item.aula || '',
          link_aula: item.link_aula,
          link_pdf: item.link_pdf,
          link_quiz: item.link_quiz,
        }));

        setConteudos(transformedData);
        
        // Auto-select user's current semester
        if (user.semestre) {
          setSelectedSemestre(user.semestre.toString());
        }
      } catch (error) {
        console.error('Error fetching conteudos:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os conteúdos',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConteudos();
  }, [user]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Group conteudos by structure
  const groupedData = useMemo(() => {
    if (!selectedSemestre) return [];

    const filtered = conteudos.filter(
      (c) => c.semestre === selectedSemestre || c.semestre === `${selectedSemestre}º Semestre`
    );

    const materiaMap = new Map<string, Materia>();

    filtered.forEach((item) => {
      const materia = item.materia;
      const tema = item.tema || 'Sem tema';
      const subtema = item.subtema || 'Sem subtema';
      const aula: Aula = {
        aula: item.aula,
        link_aula: item.link_aula,
        link_pdf: item.link_pdf,
        link_quiz: item.link_quiz,
      };

      if (!materiaMap.has(materia)) {
        materiaMap.set(materia, { materia, temas: [] });
      }

      const materiaObj = materiaMap.get(materia)!;
      let temaObj = materiaObj.temas.find((t) => t.tema === tema);
      if (!temaObj) {
        temaObj = { tema, subtemas: [] };
        materiaObj.temas.push(temaObj);
      }

      let subtemaObj = temaObj.subtemas.find((st) => st.subtema === subtema);
      if (!subtemaObj) {
        subtemaObj = { subtema, aulas: [] };
        temaObj.subtemas.push(subtemaObj);
      }

      subtemaObj.aulas.push(aula);
    });

    return Array.from(materiaMap.values());
  }, [conteudos, selectedSemestre]);

  // Filter by search
  const filteredMaterias = useMemo(() => {
    if (!searchQuery.trim()) return groupedData;

    const query = searchQuery.toLowerCase();
    return groupedData
      .map((materia) => ({
        ...materia,
        temas: materia.temas
          .map((tema) => ({
            ...tema,
            subtemas: tema.subtemas
              .map((subtema) => ({
                ...subtema,
                aulas: subtema.aulas.filter(
                  (aula) =>
                    materia.materia.toLowerCase().includes(query) ||
                    tema.tema.toLowerCase().includes(query) ||
                    subtema.subtema.toLowerCase().includes(query) ||
                    aula.aula.toLowerCase().includes(query)
                ),
              }))
              .filter((st) => st.aulas.length > 0),
          }))
          .filter((t) => t.subtemas.length > 0),
      }))
      .filter((m) => m.temas.length > 0);
  }, [groupedData, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalAulas = conteudos.filter(
      (c) => c.semestre === selectedSemestre || c.semestre === `${selectedSemestre}º Semestre`
    ).length;
    const completed = Array.from(completedItems).filter((id) =>
      id.startsWith(`${selectedSemestre}-`)
    ).length;
    const percentage = totalAulas > 0 ? Math.round((completed / totalAulas) * 100) : 0;

    const pendingAulas = conteudos
      .filter(
        (c) =>
          (c.semestre === selectedSemestre || c.semestre === `${selectedSemestre}º Semestre`) &&
          !completedItems.has(getAulaId(c))
      )
      .slice(0, 3);

    return { totalAulas, completed, percentage, pendingAulas };
  }, [conteudos, selectedSemestre, completedItems]);

  // Get unique semestres
  const semestres = useMemo(() => {
    const unique = new Set(
      conteudos.map((c) => c.semestre.replace('º Semestre', '').trim())
    );
    return Array.from(unique).sort((a, b) => parseInt(a) - parseInt(b));
  }, [conteudos]);

  const getAulaId = (item: ConteudoData) => {
    return `${item.semestre}-${item.materia}-${item.tema}-${item.subtema}-${item.aula}`;
  };

  const toggleCompletion = (item: ConteudoData) => {
    const id = getAulaId(item);
    const newSet = new Set(completedItems);
    
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    
    setCompletedItems(newSet);
    saveProgress(newSet);
  };

  const isCompleted = (item: ConteudoData) => {
    return completedItems.has(getAulaId(item));
  };

  const getMateriaIcon = (materia: string) => {
    const lower = materia.toLowerCase();
    if (lower.includes('anatomia')) return '🦴';
    if (lower.includes('fisiologia')) return '❤️';
    if (lower.includes('bioquímica')) return '🧪';
    if (lower.includes('farmacologia')) return '💊';
    if (lower.includes('patologia')) return '🔬';
    if (lower.includes('clínica')) return '🩺';
    if (lower.includes('cirurgia')) return '⚕️';
    if (lower.includes('pediatria')) return '👶';
    if (lower.includes('ginecologia')) return '🤰';
    return '📚';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando seu guia de estudos...</p>
        </div>
      </div>
    );
  }

  if (!user?.id_ies) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-2xl font-bold">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Você precisa estar vinculado a uma instituição para acessar o guia de estudos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">Guia de Estudos</h1>
                <p className="text-sm text-muted-foreground">Seu Plano Definitivo para Medicina</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por matéria, tema ou aula..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={selectedSemestre} onValueChange={setSelectedSemestre}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Selecione o semestre" />
                </SelectTrigger>
                <SelectContent>
                  {semestres.map((sem) => (
                    <SelectItem key={sem} value={sem}>
                      {sem}º Semestre
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {selectedSemestre && (
          <>
            {/* Dashboard Section */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Progress Card */}
              <Card className="premium-card hover-lift">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Progresso do Semestre
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{stats.percentage}%</span>
                      <span className="text-sm text-muted-foreground">
                        {stats.completed} de {stats.totalAulas} aulas
                      </span>
                    </div>
                    <Progress value={stats.percentage} className="h-2" />
                    {stats.percentage >= 80 && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Excelente progresso!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Today's Study */}
              <Card className="premium-card hover-lift md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    O Que Estudar Hoje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.pendingAulas.length > 0 ? (
                    <div className="space-y-2">
                      {stats.pendingAulas.map((aula, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-accent transition-colors"
                        >
                          <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                          <span className="flex-1">{aula.aula}</span>
                          <Badge variant="outline" className="text-xs">
                            {aula.materia}
                          </Badge>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Dica: Estude em blocos de 25min para máxima retenção
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Parabéns! Você completou todas as aulas deste semestre.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Content */}
            {filteredMaterias.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-3">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-semibold">Nenhum conteúdo encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? 'Tente uma busca diferente ou limpe os filtros.'
                      : 'Não há conteúdos disponíveis para este semestre.'}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {filteredMaterias.map((materia, mIdx) => (
                  <Card key={mIdx} className="premium-card overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                      <CardTitle className="flex items-center gap-3">
                        <span className="text-2xl">{getMateriaIcon(materia.materia)}</span>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold">{materia.materia}</h2>
                          <p className="text-sm text-muted-foreground font-normal">
                            {materia.temas.reduce(
                              (sum, t) => sum + t.subtemas.reduce((s, st) => s + st.aulas.length, 0),
                              0
                            )}{' '}
                            aulas disponíveis
                          </p>
                        </div>
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="pt-6">
                      <Accordion type="multiple" className="space-y-4">
                        {materia.temas.map((tema, tIdx) => (
                          <AccordionItem
                            key={tIdx}
                            value={`tema-${mIdx}-${tIdx}`}
                            className="border rounded-lg px-4"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3 flex-1 text-left">
                                <Brain className="h-5 w-5 text-primary shrink-0" />
                                <div className="flex-1">
                                  <h3 className="font-semibold">{tema.tema}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {tema.subtemas.reduce((s, st) => s + st.aulas.length, 0)} aulas
                                  </p>
                                </div>
                              </div>
                            </AccordionTrigger>

                            <AccordionContent className="space-y-3 pt-4">
                              {tema.subtemas.map((subtema, stIdx) => (
                                <div key={stIdx} className="space-y-2">
                                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4" />
                                    {subtema.subtema}
                                  </h4>

                                  <div className="space-y-2 ml-6">
                                    {subtema.aulas.map((aula, aIdx) => {
                                      const aulaData: ConteudoData = {
                                        semestre: selectedSemestre,
                                        materia: materia.materia,
                                        tema: tema.tema,
                                        subtema: subtema.subtema,
                                        aula: aula.aula,
                                        link_aula: aula.link_aula,
                                        link_pdf: aula.link_pdf,
                                        link_quiz: aula.link_quiz,
                                      };
                                      const completed = isCompleted(aulaData);

                                      return (
                                        <div
                                          key={aIdx}
                                          className={cn(
                                            'p-4 rounded-lg border transition-all',
                                            completed
                                              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900'
                                              : 'bg-card hover:bg-accent'
                                          )}
                                        >
                                          <div className="flex items-start gap-3">
                                            <button
                                              onClick={() => toggleCompletion(aulaData)}
                                              className="shrink-0 mt-1"
                                            >
                                              {completed ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                              ) : (
                                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary transition-colors" />
                                              )}
                                            </button>

                                            <div className="flex-1 space-y-2">
                                              <h5
                                                className={cn(
                                                  'font-medium',
                                                  completed && 'line-through text-muted-foreground'
                                                )}
                                              >
                                                {aula.aula}
                                              </h5>

                                              <div className="flex flex-wrap gap-2">
                                                {aula.link_aula && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() => window.open(aula.link_aula!, '_blank')}
                                                  >
                                                    <Play className="h-3 w-3" />
                                                    Assistir Aula
                                                  </Button>
                                                )}
                                                {aula.link_pdf && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() => window.open(aula.link_pdf!, '_blank')}
                                                  >
                                                    <FileText className="h-3 w-3" />
                                                    Material PDF
                                                  </Button>
                                                )}
                                                {aula.link_quiz && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() => window.open(aula.link_quiz!, '_blank')}
                                                  >
                                                    <Brain className="h-3 w-3" />
                                                    Fazer Quiz
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {!selectedSemestre && (
          <Card className="p-12">
            <div className="text-center space-y-3">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">Selecione um Semestre</h3>
              <p className="text-muted-foreground">
                Escolha um semestre acima para começar seus estudos.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Scroll to Top */}
      {showScrollTop && (
        <Button
          size="icon"
          className="fixed bottom-8 right-8 rounded-full shadow-lg z-50"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
