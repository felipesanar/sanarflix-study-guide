import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { swrFetch } from '@/utils/performanceCache';
import { toast } from '@/hooks/use-toast';
import { useUniversity } from '@/contexts/UniversityContext';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { 
  BookOpen, 
  Search,
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
  Calendar,
  BookMarked,
  GraduationCap,
  LayoutGrid,
  List,
  Bookmark,
  Plus,
  X,
  Clock3,
  Edit2,
  Check,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls, Reorder } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  const { subjects, addSubject, removeSubject, loading: syncLoading } = useCalendarSync();
  const [conteudos, setConteudos] = useState<ConteudoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSemestre, setSelectedSemestre] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const location = useLocation();
  // Pré-seleciona matéria via query string: /guia-estudos?materia=Cardiologia
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('materia');
    if (m) {
      setSelectedMateria(m);
    }
  }, [location.search]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isEditMode, setIsEditMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEventMateria, setSelectedEventMateria] = useState<string | null>(null);
  
  // Refs para os cards de matérias
  const materiaRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Interface para eventos do calendário
  interface CalendarEvent {
    id: string;
    title: string;
    materia: string;
    day: number; // 0-6 (domingo-sábado)
    startTime: string;
    endTime: string;
    color: string;
  }
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const dragControls = useDragControls();
  
  // Sync calendar events with Supabase (via useCalendarSync)
  useEffect(() => {
    // Convert subjects from Supabase to CalendarEvent format
    const events: CalendarEvent[] = subjects.map(s => ({
      id: s.id || `temp-${s.dayOfWeek}-${s.startTime}`,
      title: s.name,
      materia: s.name,
      day: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      color: s.color
    }));
    setCalendarEvents(events);
  }, [subjects]);
  
  // Função para gerar uma cor consistente baseada no nome da matéria
  const getMateriaColor = (materia: string) => {
    let hash = 0;
    for (let i = 0; i < materia.length; i++) {
      hash = materia.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#4361ee', '#3a0ca3', '#7209b7', '#f72585', 
      '#4cc9f0', '#4895ef', '#560bad', '#f3722c',
      '#06d6a0', '#118ab2', '#073b4c', '#ff006e'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };
  
  // Função para adicionar evento ao calendário (salva no Supabase)
  const addEventToCalendar = async (materia: string, day: number) => {
    // Gerar horários aleatórios para demonstração
    const startHour = Math.floor(Math.random() * 12) + 8; // Entre 8h e 19h
    const duration = Math.floor(Math.random() * 2) + 1; // 1 ou 2 horas
    const endHour = startHour + duration;
    
    const startTime = `${startHour.toString().padStart(2, '0')}:00`;
    const endTime = `${endHour.toString().padStart(2, '0')}:00`;
    
    await addSubject({
      name: materia,
      dayOfWeek: day,
      startTime,
      endTime,
      color: getMateriaColor(materia)
    });
    
    toast({
      title: "Matéria adicionada",
      description: `${materia} adicionado ao seu calendário pessoal para ${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][day]}`,
      variant: "default",
    });
  };
  
  // Função para remover evento do calendário (remove do Supabase)
  const removeEventFromCalendar = async (id: string) => {
    const event = calendarEvents.find(e => e.id === id);
    if (!event) return;
    
    await removeSubject(event.day, event.startTime);
    
    toast({
      title: "Matéria removida",
      description: "Matéria removida do calendário",
      variant: "default",
    });
  };
  
  // Função para abrir sheet com conteúdos da matéria
  const openMateriaSheet = (materia: string) => {
    setSelectedEventMateria(materia);
    setSheetOpen(true);
  };
  
  // Função para fazer scroll até o card da matéria
  const scrollToMateria = (materia: string) => {
    const materiaCard = materiaRefs.current.get(materia);
    if (materiaCard) {
      materiaCard.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start'
      });
    }
  };
  
  // Confirmar edições do calendário
  const confirmEditMode = () => {
    setIsEditMode(false);
    toast({
      title: "Alterações salvas",
      description: "Seu calendário foi atualizado com sucesso",
      variant: "default",
    });
  };

  // Load completed items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('study-progress');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Ensure data is an array before creating Set
        if (Array.isArray(data)) {
          setCompletedItems(new Set(data));
        } else {
          setCompletedItems(new Set());
        }
      } catch (e) {
        console.error('Error loading progress:', e);
        setCompletedItems(new Set());
      }
    }
  }, []);

  // Save completed items to localStorage
  const saveProgress = (items: Set<string>) => {
    localStorage.setItem('study-progress', JSON.stringify([...items]));
  };

  // Ref to track if data has been loaded
  const hasLoadedData = useRef(false);

  // Fetch conteudos com SWR cache - apenas na montagem ou quando mudar IES/semestre
  useEffect(() => {
    const fetchConteudos = async () => {
      if (!user?.id_ies || !user?.semestre) {
        setIsLoading(false);
        return;
      }

      // Prevent refetch if already loaded
      if (hasLoadedData.current && conteudos.length > 0) {
        return;
      }

      try {
        setIsLoading(true);
        const startTime = performance.now();
        const cacheKey = `study_contents_${user.id_ies}_${user.semestre}`;

        // SWR: tentar entregar cache instantâneo e revalidar em background
        const cached = await swrFetch<ConteudoData[]>(
          cacheKey,
          async () => {
            const { data: response, error } = await supabase.functions.invoke('get-study-contents');
            if (error) throw error;
            if (!response?.data) throw new Error('Invalid response from server');
            const transformed: ConteudoData[] = (response.data || []).map((item: any) => ({
              id: item.id,
              id_ies: item.id_ies,
              semestre: item.semestre?.toString() || '',
              materia: item.materia || '',
              tema: item.tema || '',
              subtema: item.subtema || '',
              aula: item.aula || '',
              link_aula: item.link_aula,
              link_pdf: item.link_pdf,
              link_quiz: item.link_quiz,
            }));
            return transformed;
          },
          {
            ttl: 2 * 60 * 60 * 1000,
            onUpdate: (fresh) => {
              setConteudos(fresh);
              hasLoadedData.current = true;
              // Auto-select semestre após revalidação
              if (user.semestre && fresh.length > 0) {
                const userSemestre = user.semestre.toString();
                const hasUserSemestre = fresh.some(c => 
                  c.semestre === userSemestre || c.semestre === `${userSemestre}º Semestre`
                );
                if (hasUserSemestre) {
                  setSelectedSemestre(userSemestre);
                } else {
                  const firstSemestre = fresh[0].semestre.replace('º Semestre', '').trim();
                  setSelectedSemestre(firstSemestre);
                }
              }
            }
          }
        );

        if (cached && cached.length > 0) {
          setConteudos(cached);
          hasLoadedData.current = true;
          // Auto-selecionar semestre baseado no cache
          if (user.semestre) {
            const userSemestre = user.semestre.toString();
            const hasUserSemestre = cached.some(c => 
              c.semestre === userSemestre || c.semestre === `${userSemestre}º Semestre`
            );
            if (hasUserSemestre) {
              setSelectedSemestre(userSemestre);
            } else {
              const firstSemestre = cached[0].semestre.replace('º Semestre', '').trim();
              setSelectedSemestre(firstSemestre);
            }
          }
          setIsLoading(false);
          console.log('Loaded from cache in', (performance.now() - startTime).toFixed(2), 'ms');
          return;
        }

        // Se não há cache, aguardar primeiro fetch
        const { data: response, error } = await supabase.functions.invoke('get-study-contents');
        if (error) throw error;
        if (!response?.data) throw new Error('Invalid response from server');
        const transformedData: ConteudoData[] = (response.data || []).map((item: any) => ({
          id: item.id,
          id_ies: item.id_ies,
          semestre: item.semestre?.toString() || '',
          materia: item.materia || '',
          tema: item.tema || '',
          subtema: item.subtema || '',
          aula: item.aula || '',
          link_aula: item.link_aula,
          link_pdf: item.link_pdf,
          link_quiz: item.link_quiz,
        }));
        setConteudos(transformedData);
        hasLoadedData.current = true;
        const loadTime = performance.now() - startTime;
        console.log('Study contents loaded in', loadTime.toFixed(2), 'ms');
        if (user.semestre && transformedData.length > 0) {
          const userSemestre = user.semestre.toString();
          const hasUserSemestre = transformedData.some(c => 
            c.semestre === userSemestre || c.semestre === `${userSemestre}º Semestre`
          );
          if (hasUserSemestre) {
            setSelectedSemestre(userSemestre);
          } else {
            const firstSemestre = transformedData[0].semestre.replace('º Semestre', '').trim();
            setSelectedSemestre(firstSemestre);
          }
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
  }, [user?.id_ies, user?.semestre]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Helper functions (must be defined before useMemo)
  const getAulaId = (item: ConteudoData) => {
    return `${item.semestre}-${item.materia}-${item.tema}-${item.subtema}-${item.aula}`;
  };

  const isCompleted = (item: ConteudoData) => {
    return completedItems.has(getAulaId(item));
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

  const getMateriaIcon = (materia: string) => {
    const lower = materia.toLowerCase();
    if (lower.includes('anatomia')) return '🧠';
    if (lower.includes('fisiologia')) return '❤️';
    if (lower.includes('bioquímica')) return '🧪';
    if (lower.includes('farmacologia')) return '💊';
    if (lower.includes('patologia')) return '🔬';
    if (lower.includes('clínica')) return '🩺';
    if (lower.includes('cirurgia')) return '⚕️';
    if (lower.includes('pediatria')) return '👶';
    if (lower.includes('ginecologia')) return '🤰';
    if (lower.includes('microbiologia')) return '🦠';
    if (lower.includes('imunologia')) return '🛡️';
    if (lower.includes('parasitologia')) return '🦟';
    if (lower.includes('histologia')) return '🔬';
    if (lower.includes('embriologia')) return '👶';
    return '📚';
  };

  // Group conteudos by structure
  const groupedData = useMemo(() => {
    if (!selectedSemestre || !conteudos || conteudos.length === 0) return [];

    // Filter by selected semester - handle both numeric and text formats
    const filtered = conteudos.filter((conteudoItem) => {
      if (!conteudoItem.semestre) return false;
      const semestreStr = conteudoItem.semestre.toString().toLowerCase();
      const selectedStr = selectedSemestre.toLowerCase();
      
      // Match exact number or text like "internato"
      return semestreStr === selectedStr || 
             semestreStr === `${selectedStr}º semestre` ||
             semestreStr.includes(selectedStr);
    });

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
      .map((materiaItem) => {
        const filteredTemas = materiaItem.temas
          .map((temaItem) => {
            const filteredSubtemas = temaItem.subtemas
              .map((subtemaItem) => {
                const filteredAulas = subtemaItem.aulas.filter(
                  (aulaItem) =>
                    materiaItem.materia.toLowerCase().includes(query) ||
                    temaItem.tema.toLowerCase().includes(query) ||
                    subtemaItem.subtema.toLowerCase().includes(query) ||
                    aulaItem.aula.toLowerCase().includes(query)
                );
                
                return {
                  ...subtemaItem,
                  aulas: filteredAulas
                };
              })
              .filter((st) => st.aulas.length > 0);
            
            return {
              ...temaItem,
              subtemas: filteredSubtemas
            };
          })
          .filter((t) => t.subtemas.length > 0);
        
        return {
          ...materiaItem,
          temas: filteredTemas
        };
      })
      .filter((m) => m.temas.length > 0);
  }, [groupedData, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!selectedSemestre || !conteudos || conteudos.length === 0) {
      return { totalAulas: 0, completed: 0, percentage: 0, pendingAulas: [] };
    }

    const semestreAulas = conteudos.filter((conteudoItem) => {
      if (!conteudoItem.semestre) return false;
      const semestreStr = conteudoItem.semestre.toString().toLowerCase();
      const selectedStr = selectedSemestre.toLowerCase();
      return semestreStr === selectedStr || 
             semestreStr === `${selectedStr}º semestre` ||
             semestreStr.includes(selectedStr);
    });
    
    const totalAulas = semestreAulas.length;
    const completedArray = Array.from(completedItems);
    const completed = completedArray.filter((itemId) =>
      itemId.startsWith(`${selectedSemestre}-`)
    ).length;
    const percentage = totalAulas > 0 ? Math.round((completed / totalAulas) * 100) : 0;

    const pendingAulas = semestreAulas
      .filter((aulaItem) => !completedItems.has(getAulaId(aulaItem)))
      .slice(0, 3);

    return { totalAulas, completed, percentage, pendingAulas };
  }, [conteudos, selectedSemestre, completedItems]);

  // Check if a tema is completely finished
  const isTemaCompleted = (materia: Materia, tema: Tema) => {
    const allAulas: ConteudoData[] = [];
    
    tema.subtemas.forEach(subtema => {
      subtema.aulas.forEach(aula => {
        allAulas.push({
          semestre: selectedSemestre,
          materia: materia.materia,
          tema: tema.tema,
          subtema: subtema.subtema,
          aula: aula.aula,
          link_aula: aula.link_aula,
          link_pdf: aula.link_pdf,
          link_quiz: aula.link_quiz,
        });
      });
    });
    
    if (allAulas.length === 0) return false;
    
    return allAulas.every(aula => isCompleted(aula));
  };

  const isMateriaCompleted = (materia: Materia) => {
    const allAulas: ConteudoData[] = [];
    
    materia.temas.forEach(tema => {
      tema.subtemas.forEach(subtema => {
        subtema.aulas.forEach(aula => {
          allAulas.push({
            semestre: selectedSemestre,
            materia: materia.materia,
            tema: tema.tema,
            subtema: subtema.subtema,
            aula: aula.aula,
            link_aula: aula.link_aula,
            link_pdf: aula.link_pdf,
            link_quiz: aula.link_quiz,
          });
        });
      });
    });
    
    if (allAulas.length === 0) return false;
    
    return allAulas.every(aula => isCompleted(aula));
  };

  // Calculate materia progress percentage
  const getMateriaProgress = (materia: Materia) => {
    const allAulas: ConteudoData[] = [];
    
    materia.temas.forEach(tema => {
      tema.subtemas.forEach(subtema => {
        subtema.aulas.forEach(aula => {
          allAulas.push({
            semestre: selectedSemestre,
            materia: materia.materia,
            tema: tema.tema,
            subtema: subtema.subtema,
            aula: aula.aula,
            link_aula: aula.link_aula,
            link_pdf: aula.link_pdf,
            link_quiz: aula.link_quiz,
          });
        });
      });
    });
    
    if (allAulas.length === 0) return 0;
    
    const completedCount = allAulas.filter(aula => isCompleted(aula)).length;
    return Math.round((completedCount / allAulas.length) * 100);
  };

  // Get materia contents for sheet
  const selectedMateriaContents = useMemo(() => {
    if (!selectedEventMateria) return null;
    return groupedData.find(m => m.materia === selectedEventMateria);
  }, [selectedEventMateria, groupedData]);

  // Get unique semestres
  const semestres = useMemo(() => {
    if (!conteudos || conteudos.length === 0) return [];
    
    const semestreSet = new Set<string>();
    conteudos.forEach((conteudoItem) => {
      if (conteudoItem.semestre) {
        // Keep original format - clean up common variations
        let semestreValue = conteudoItem.semestre.toString().trim();
        
        // Remove "º Semestre" suffix if present
        semestreValue = semestreValue.replace(/º\s*Semestre/i, '').trim();
        
        // Normalize common variations
        if (semestreValue.match(/^internato$/i)) {
          semestreValue = 'INTERNATO';
        }
        
        semestreSet.add(semestreValue);
      }
    });
    
    // Sort: numbers first (1-12), then text (INTERNATO, etc.)
    return Array.from(semestreSet).sort((a, b) => {
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      
      // Both are numbers - sort numerically
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      
      // Numbers come before text
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      
      // Both are text - sort alphabetically
      return a.localeCompare(b);
    });
  }, [conteudos]);


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
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6 p-4 sm:p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl sm:text-2xl font-bold">Acesso Restrito</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Você precisa estar vinculado a uma instituição para acessar o guia de estudos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background container-compact">
      {/* Header - Modo Normal e Modo Edição */}
      {viewMode === 'calendar' && isEditMode ? (
        // Header Modo Premium - Edição do Calendário
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-md">
          <div className="w-full max-w-7xl mx-auto py-4 px-4 md:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsEditMode(false)}
                  className="gap-2"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Voltar
                </Button>
                <div className="flex items-center gap-3">
                  <Edit2 className="h-5 w-5 text-primary" />
                  <div>
                    <h1 className="text-xl font-bold">Editando Calendário</h1>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    Modo Premium
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsEditMode(false)}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={confirmEditMode}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Header Normal
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          <div className="w-full max-w-7xl mx-auto py-3 sm:py-4">
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Guia de Estudos</h1>
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
                    {semestres.map((sem) => {
                      // Display formatted name (add "º Semestre" only for numbers)
                      const isNumeric = !isNaN(parseInt(sem));
                      const displayName = isNumeric ? `${sem}º Semestre` : sem;
                      
                      return (
                        <SelectItem key={sem} value={sem}>
                          {displayName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-3 sm:space-y-4 md:space-y-6">
        {selectedSemestre && (
          <>
            {/* Dashboard Section */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {/* Progress Card */}

              {/* Today's Study */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="md:col-span-2"
              >
                <Card className="premium-card hover-lift shadow-lg border-primary/10">
                  <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      O Que Estudar Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {calendarEvents.filter(event => {
                      // Pegar eventos do dia atual (0-6, onde 0 é domingo)
                      const today = new Date().getDay();
                      return event.day === today;
                    }).length > 0 ? (
                      <div className="space-y-3">
                        {calendarEvents
                          .filter(event => {
                            const today = new Date().getDay();
                            return event.day === today;
                          })
                          .map((event, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-accent hover:shadow-md transition-all cursor-pointer"
                              onClick={() => {
                                setViewMode('list');
                                setSelectedMateria(event.materia);
                                setTimeout(() => scrollToMateria(event.materia), 100);
                              }}
                            >
                              <div 
                                className="h-8 w-8 rounded-full flex items-center justify-center text-white"
                                style={{ backgroundColor: event.color }}
                              >
                                {getMateriaIcon(event.materia)}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{event.title}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Badge variant="outline" className="text-xs py-0 h-5">
                                    {event.materia}
                                  </Badge>
                                  <span className="mx-1">•</span>
                                  <Clock3 className="h-3 w-3" />
                                  {event.startTime} - {event.endTime}
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeEventFromCalendar(event.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Dica: Estude em blocos de 25min para máxima retenção
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <Calendar className="h-12 w-12 text-muted-foreground opacity-50" />
                        <div className="text-center">
                          <p className="text-sm font-medium">Nenhuma matéria agendada para hoje</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Arraste matérias para o calendário para planejar seus estudos
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setViewMode('calendar')}
                        >
                          Ir para o calendário
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* View Mode Selector */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Seu Plano de Estudos</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant={viewMode === 'list' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setViewMode('list')}
                  className="gap-1"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button 
                  variant={viewMode === 'calendar' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setViewMode('calendar')}
                  className="gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  Calendário
                </Button>
              </div>
            </div>

            {/* Matéria Selector */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="border-primary/10 shadow-md">
                <CardContent className="pt-6 pb-4">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant={selectedMateria === '' ? 'default' : 'outline'}
                      onClick={() => setSelectedMateria('')}
                      className="gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                      Todas as Matérias
                    </Button>
                    {filteredMaterias.map((materia, idx) => (
                      <Button 
                        key={idx}
                        variant={selectedMateria === materia.materia ? 'default' : 'outline'}
                        onClick={() => setSelectedMateria(materia.materia)}
                        className="gap-2"
                      >
                        <span className="text-lg">{getMateriaIcon(materia.materia)}</span>
                        {materia.materia}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {viewMode === 'list' ? (
                <motion.div 
                  key="list-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
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
                      {filteredMaterias
                        .filter(materia => selectedMateria === '' || materia.materia === selectedMateria)
                        .map((materia, mIdx) => (
                          <motion.div
                            key={mIdx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: mIdx * 0.1 }}
                            ref={(el) => {
                              if (el) {
                                materiaRefs.current.set(materia.materia, el);
                              }
                            }}
                          >
                            {(() => {
                              const materiaCompleted = isMateriaCompleted(materia);
                              const progress = getMateriaProgress(materia);
                              const totalAulas = materia.temas.reduce(
                                (sum, t) => sum + t.subtemas.reduce((s, st) => s + st.aulas.length, 0),
                                0
                              );
                              
                              return (
                                <Card className={cn(
                                  "premium-card overflow-hidden shadow-lg transition-all duration-300",
                                  materiaCompleted 
                                    ? "border-green-500/50 bg-gradient-to-br from-green-50/50 via-background to-background dark:from-green-950/20 dark:via-background dark:to-background" 
                                    : "border-primary/10"
                                )}>
                                  <CardHeader className={cn(
                                    "relative",
                                    materiaCompleted 
                                      ? "bg-gradient-to-r from-green-500/10 to-transparent" 
                                      : "bg-gradient-to-r from-primary/10 to-transparent"
                                  )}>
                                    {materiaCompleted && (
                                      <div className="absolute top-4 right-4">
                                        <Badge className="bg-green-500 hover:bg-green-600 text-white border-green-500 gap-1.5 px-3 py-1">
                                          <Check className="h-3 w-3" />
                                          Concluída
                                        </Badge>
                                      </div>
                                    )}
                                    <CardTitle className="flex items-center gap-3 pr-24">
                                      <span className="text-2xl">{getMateriaIcon(materia.materia)}</span>
                                      <div className="flex-1 min-w-0">
                                        <h2 className={cn(
                                          "text-xl font-bold",
                                          materiaCompleted && "text-green-700 dark:text-green-400"
                                        )}>
                                          {materia.materia}
                                          {materiaCompleted && <span className="ml-2">🏆</span>}
                                        </h2>
                                        <p className="text-sm text-muted-foreground font-normal">
                                          {totalAulas} aulas disponíveis
                                        </p>
                                      </div>
                                    </CardTitle>
                                    
                                    {/* Progress Bar */}
                                    <div className="mt-3 space-y-1">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                          Progresso: {progress}%
                                        </span>
                                        {materiaCompleted && (
                                          <span className="text-green-600 dark:text-green-400 font-medium">
                                            ✓ Completa
                                          </span>
                                        )}
                                      </div>
                                      <Progress 
                                        value={progress} 
                                        className={cn(
                                          "h-2",
                                          materiaCompleted && "bg-green-200 dark:bg-green-900/30"
                                        )}
                                        style={materiaCompleted ? {
                                          '--progress-indicator': '142 71% 45%'
                                        } as React.CSSProperties : undefined}
                                      />
                                    </div>
                                  </CardHeader>

                              <CardContent className="pt-6">
                                <Accordion type="multiple" className="space-y-4">
                                  {materia.temas.map((tema, tIdx) => {
                                    const temaCompleted = isTemaCompleted(materia, tema);
                                    const temaAulasCount = tema.subtemas.reduce((s, st) => s + st.aulas.length, 0);
                                    
                                    return (
                                      <AccordionItem
                                        key={tIdx}
                                        value={`tema-${mIdx}-${tIdx}`}
                                        className={cn(
                                          "border rounded-lg px-4 shadow-sm transition-all",
                                          temaCompleted 
                                            ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" 
                                            : ""
                                        )}
                                      >
                                        <AccordionTrigger className="hover:no-underline">
                                          <div className="flex items-center gap-3 flex-1 text-left">
                                            <div className={cn(
                                              "flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all shrink-0",
                                              temaCompleted 
                                                ? "bg-green-500 border-green-500 text-white" 
                                                : "border-muted-foreground/30"
                                            )}>
                                              {temaCompleted && <Check className="h-3 w-3" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h3 className={cn(
                                                "font-semibold",
                                                temaCompleted && "text-green-700 dark:text-green-400"
                                              )}>
                                                {tema.tema}
                                                {temaCompleted && <span className="ml-2">✓</span>}
                                              </h3>
                                              <p className={cn(
                                                "text-xs",
                                                temaCompleted 
                                                  ? "text-green-600 dark:text-green-400" 
                                                  : "text-muted-foreground"
                                              )}>
                                                {temaAulasCount} aulas
                                                {temaCompleted && <span className="ml-2 font-medium">• Concluído</span>}
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
                                                  <motion.div
                                                    key={aIdx}
                                                    whileHover={{ scale: 1.01 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                                    className={cn(
                                                      'p-4 rounded-lg border transition-all shadow-sm',
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
                                                              className="gap-2 hover:bg-primary hover:text-white transition-colors"
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
                                                              className="gap-2 hover:bg-primary hover:text-white transition-colors"
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
                                                              className="gap-2 hover:bg-primary hover:text-white transition-colors"
                                                              onClick={() => window.open(aula.link_quiz!, '_blank')}
                                                            >
                                                              <Brain className="h-3 w-3" />
                                                              Fazer Quiz
                                                            </Button>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </motion.div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </AccordionContent>
                                    </AccordionItem>
                                    );
                                  })}
                                </Accordion>
                              </CardContent>
                            </Card>
                              );
                            })()}
                          </motion.div>
                        ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="calendar-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="shadow-lg border-primary/10 hover:shadow-xl transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Calendário de Estudos
                            {isEditMode && (
                              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-primary/20">
                                Modo Premium
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {isEditMode ? '✨ Arraste as matérias para reorganizar sua semana de estudos' : 'Clique nas matérias para ver os conteúdos'}
                          </CardDescription>
                        </div>
                        {!isEditMode && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setIsEditMode(true)}
                            className="gap-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            Editar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[600px] bg-accent/30 rounded-lg p-4 relative glass-effect">
                        <div className="grid grid-cols-7 gap-2 h-full">
                          {Array.from({ length: 7 }).map((_, dayIdx) => (
                            <div key={dayIdx} className="flex flex-col h-full">
                              <div className="text-center font-medium p-2 bg-primary/10 rounded-t-lg">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayIdx]}
                              </div>
                              <div 
                                className="flex-1 bg-background rounded-b-lg border border-border p-2 space-y-2 overflow-y-auto hover:bg-accent/10 transition-colors"
                              >
                                {/* Eventos do calendário */}
                                {calendarEvents
                                  .filter(event => event.day === dayIdx)
                                  .map((event) => (
                                    <motion.div
                                      key={event.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="p-2 rounded-md text-sm border premium-card overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ 
                                        backgroundColor: `${event.color}20`,
                                        borderColor: `${event.color}30`
                                      }}
                                      onClick={() => openMateriaSheet(event.materia)}
                                    >
                                      <div className="flex justify-between items-start gap-2 min-w-0">
                                        <div className="font-medium flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                                          <span className="flex-shrink-0">{getMateriaIcon(event.materia)}</span>
                                          <span className="truncate">{event.title}</span>
                                        </div>
                                      </div>
                                      <div className="text-xs flex items-center gap-1 mt-1 text-muted-foreground overflow-hidden">
                                        <Clock3 className="h-3 w-3 flex-shrink-0" />
                                        <span className="truncate">{event.startTime} - {event.endTime}</span>
                                      </div>
                                    </motion.div>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Modal de Tela Cheia para Modo de Edição */}
                  <AnimatePresence>
                    {isEditMode && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-background"
                      >
                        {/* Header */}
                        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-md">
                          <div className="w-full max-w-7xl mx-auto py-4 px-4 md:px-6 lg:px-8">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setIsEditMode(false)}
                                  className="gap-2"
                                >
                                  <ChevronRight className="h-4 w-4 rotate-180" />
                                  Voltar
                                </Button>
                                <div className="flex items-center gap-3">
                                  <Calendar className="h-5 w-5 text-primary" />
                                  <div>
                                    <h1 className="text-xl font-bold">Calendário de Estudos</h1>
                                  </div>
                                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                    Modo Premium
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setIsEditMode(false)}
                                  className="gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  Cancelar
                                </Button>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={confirmEditMode}
                                  className="gap-2 bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="h-4 w-4" />
                                  Salvar Alterações
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                              <Sparkles className="h-4 w-4" />
                              Arraste as matérias para reorganizar sua semana de estudos
                            </p>
                          </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
                          <div className="bg-accent/30 rounded-xl p-6 relative">
                            <div className="grid grid-cols-7 gap-3 mb-4">
                              {Array.from({ length: 7 }).map((_, dayIdx) => (
                                <div key={dayIdx} className="flex flex-col min-h-[500px]">
                                  <div className="text-center font-semibold p-3 bg-primary/10 rounded-t-lg text-sm">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayIdx]}
                                  </div>
                                  <div 
                                    className="flex-1 bg-background rounded-b-lg border-2 border-border p-3 space-y-2 overflow-y-auto hover:bg-accent/10 transition-colors"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      if (draggedItem) {
                                        addEventToCalendar(draggedItem, dayIdx);
                                        setDraggedItem(null);
                                      }
                                    }}
                                  >
                                    {calendarEvents
                                      .filter(event => event.day === dayIdx)
                                      .map((event) => (
                                        <motion.div
                                          key={event.id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="p-3 rounded-lg text-sm border-2 premium-card cursor-move hover-lift"
                                          style={{ 
                                            backgroundColor: `${event.color}20`,
                                            borderColor: `${event.color}`
                                          }}
                                          whileHover={{ scale: 1.02 }}
                                        >
                                          <div className="flex justify-between items-start gap-2 min-w-0">
                                            <div className="font-medium flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                              <span className="flex-shrink-0 text-base">{getMateriaIcon(event.materia)}</span>
                                              <span className="truncate font-semibold">{event.title}</span>
                                            </div>
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                removeEventFromCalendar(event.id);
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                          <div className="text-xs flex items-center gap-1 mt-2 text-muted-foreground overflow-hidden">
                                            <Clock3 className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate font-medium">{event.startTime} - {event.endTime}</span>
                                          </div>
                                        </motion.div>
                                      ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Matérias disponíveis */}
                            <motion.div 
                              className="bg-background p-4 rounded-xl border-2 border-primary/20 shadow-lg"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                            >
                              <h4 className="text-base font-semibold mb-3 flex items-center gap-2 text-primary">
                                <Plus className="h-5 w-5" />
                                Arraste para adicionar ao calendário:
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {filteredMaterias.map((materia, idx) => (
                                  <motion.div 
                                    key={idx} 
                                    className="bg-primary/10 px-4 py-2 rounded-full text-sm border-2 border-primary/20 cursor-move flex items-center gap-2 hover:bg-primary/20 hover:border-primary/40 transition-colors font-medium"
                                    draggable
                                    onDragStart={() => setDraggedItem(materia.materia)}
                                    onDragEnd={() => setDraggedItem(null)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <span className="text-base">{getMateriaIcon(materia.materia)}</span>
                                    {materia.materia}
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Sheet lateral com conteúdos da matéria */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedMateriaContents && getMateriaIcon(selectedMateriaContents.materia)}</span>
                {selectedMateriaContents?.materia}
              </SheetTitle>
              <SheetDescription>
                {selectedMateriaContents && 
                  `${selectedMateriaContents.temas.reduce(
                    (sum, t) => sum + t.subtemas.reduce((s, st) => s + st.aulas.length, 0),
                    0
                  )} aulas disponíveis`
                }
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              {selectedMateriaContents?.temas.map((tema, tIdx) => (
                <Accordion key={tIdx} type="multiple" className="space-y-2">
                  <AccordionItem
                    value={`tema-${tIdx}`}
                    className="border rounded-lg px-4 shadow-sm"
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
                                materia: selectedMateriaContents.materia,
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
                                    'p-3 rounded-lg border transition-all shadow-sm',
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
                                          'font-medium text-sm',
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
                                            className="gap-2 hover:bg-primary hover:text-white transition-colors"
                                            onClick={() => window.open(aula.link_aula!, '_blank')}
                                          >
                                            <Play className="h-3 w-3" />
                                            Aula
                                          </Button>
                                        )}
                                        {aula.link_pdf && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2 hover:bg-primary hover:text-white transition-colors"
                                            onClick={() => window.open(aula.link_pdf!, '_blank')}
                                          >
                                            <FileText className="h-3 w-3" />
                                            PDF
                                          </Button>
                                        )}
                                        {aula.link_quiz && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2 hover:bg-primary hover:text-white transition-colors"
                                            onClick={() => window.open(aula.link_quiz!, '_blank')}
                                          >
                                            <Brain className="h-3 w-3" />
                                            Quiz
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
                </Accordion>
              ))}
            </div>
          </SheetContent>
        </Sheet>

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
