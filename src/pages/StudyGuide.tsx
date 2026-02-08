import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { swrFetch } from '@/utils/performanceCache';
import { toast } from '@/hooks/use-toast';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/hooks/useStudyProgress';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { usePageTimeTracking } from '@/hooks/usePageTimeTracking';
import { useWebVitals } from '@/hooks/useWebVitals';
import { getBrazilDayOfWeek } from '@/utils/timezone';

// Premium Components
import {
  GuideHeader,
  GuideToolbar,
  SubjectChips,
  TodayStudyCard,
  SubjectCard,
  GuideSearchBar,
  GuideSkeletons,
  GuideEmptyStates,
} from '@/components/guia-estudos';

// Calendar Components
import { 
  CalendarEditorDesktop, 
  CalendarEditorMobile,
  CalendarViewDesktop,
  CalendarViewMobile,
  CalendarEvent as CalendarEventType,
  SyncStatus,
} from '@/components/calendar';

// UI Components
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ChevronRight, Brain, CheckCircle2, Play, FileText } from 'lucide-react';

// Types
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

// Cache reader
const readStudyGuideCache = (iesId: string, semestre: number | undefined): ConteudoData[] | null => {
  try {
    const cacheKey = `perf_study_contents_${iesId}_${semestre}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.data && parsed?.timestamp && (Date.now() - parsed.timestamp) < 2 * 60 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[StudyGuide] Falha ao ler cache:', e);
    }
  }
  return null;
};

// Subject icon helper
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
  if (lower.includes('saúde') || lower.includes('social')) return '🏥';
  if (lower.includes('política') || lower.includes('pública')) return '📋';
  return '📚';
};

// Color generator
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

export const StudyGuide: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subjects, addSubject, removeSubject, loading: syncLoading } = useCalendarSync();
  const { progress, loading: progressLoading, toggleContentCompletion, loadAllProgress, isCompleted: isProgressCompleted } = useStudyProgress();
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const location = useLocation();
  
  // Analytics
  const analytics = useAnalyticsTracker();
  const hasTrackedViewRef = useRef(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track page time on exit
  usePageTimeTracking({ pageName: 'study_guide', enabled: true });
  
  // Track web vitals
  useWebVitals();

  // Cache-first loading
  const cachedContents = useMemo(() => {
    if (!user?.id_ies) return null;
    return readStudyGuideCache(user.id_ies, user.semestre);
  }, [user?.id_ies, user?.semestre]);

  // State
  const [conteudos, setConteudos] = useState<ConteudoData[]>(cachedContents || []);
  const [isLoading, setIsLoading] = useState(!cachedContents);
  const [selectedSemestre, setSelectedSemestre] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchTerm, setLastSearchTerm] = useState<string>('');
  const [selectedMateria, setSelectedMateria] = useState<string>('');
  const [deepLinkAula, setDeepLinkAula] = useState<string | null>(null);
  const [deepLinkTema, setDeepLinkTema] = useState<string | null>(null);
  const [deepLinkSubtema, setDeepLinkSubtema] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isEditMode, setIsEditMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEventMateria, setSelectedEventMateria] = useState<string | null>(null);
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<SyncStatus>('idle');
  const [undoStack, setUndoStack] = useState<CalendarEventType[][]>([]);

  // Refs
  const aulaRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const materiaRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasLoadedData = useRef(false);

  const calendarVariant = theme === 'dark' ? 'dark' : 'light';

  // Calendar events from Supabase sync
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventType[]>([]);

  useEffect(() => {
    const events: CalendarEventType[] = subjects.map(s => ({
      id: s.id || `temp-${s.dayOfWeek}-${s.name}`,
      title: s.name,
      materia: s.name,
      day: s.dayOfWeek,
      color: s.color
    }));
    setCalendarEvents(events);
  }, [subjects]);

  // Deep link handling with analytics
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('materia');
    const aula = params.get('aula');
    const tema = params.get('tema');
    const subtema = params.get('subtema');
    
    if (m) setSelectedMateria(m);
    if (aula) setDeepLinkAula(aula);
    if (tema) setDeepLinkTema(tema);
    if (subtema) setDeepLinkSubtema(subtema);
    
    // Track deep link if any param exists
    if (m || aula || tema || subtema) {
      analytics.trackStudyGuideDeepLinkOpened({ materia: m, tema, aula, subtema });
    }
  }, [location.search, analytics]);

  // Load last search
  useEffect(() => {
    const saved = localStorage.getItem('studyguide:lastSearch');
    if (saved) setLastSearchTerm(saved);
  }, []);

  // Load progress from Supabase when semester changes
  useEffect(() => {
    if (user?.ies_nome && selectedSemestre) {
      const semestre = parseInt(selectedSemestre) || user.semestre || 1;
      loadAllProgress(semestre, user.ies_nome);
    }
  }, [selectedSemestre, user?.ies_nome, user?.semestre, loadAllProgress]);

  // Track page view once data is loaded
  useEffect(() => {
    if (!isLoading && conteudos.length > 0 && selectedSemestre && !hasTrackedViewRef.current) {
      hasTrackedViewRef.current = true;
      analytics.trackStudyGuideView({
        semestre: selectedSemestre,
        viewMode,
        hasCache: !!cachedContents
      });
      analytics.trackCacheHit('localStorage', 'study_guide', !!cachedContents);
      
      if (import.meta.env.DEV) {
        console.log('[StudyGuide] Page view tracked', { semestre: selectedSemestre, viewMode, hasCache: !!cachedContents });
      }
    }
  }, [isLoading, conteudos.length, selectedSemestre, viewMode, cachedContents, analytics]);

  // Fetch contents with latency tracking
  useEffect(() => {
    const fetchConteudos = async () => {
      if (!user?.id_ies) {
        setIsLoading(false);
        return;
      }

      if (hasLoadedData.current && conteudos.length > 0) return;

      const startTime = Date.now();

      try {
        setIsLoading(true);
        const cacheKey = `study_contents_${user.id_ies}_${user.semestre}`;

        const cached = await swrFetch<ConteudoData[]>(
          cacheKey,
          async () => {
            const { data: response, error } = await supabase.functions.invoke('get-study-contents');
            
            const latency = Date.now() - startTime;
            analytics.trackEdgeLatency('get-study-contents', latency, !error);
            
            if (error) throw error;
            if (!response?.data) throw new Error('Invalid response');
            return (response.data || []).map((item: any) => ({
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
          },
          {
            ttl: 2 * 60 * 60 * 1000,
            onUpdate: (fresh) => {
              setConteudos(fresh);
              hasLoadedData.current = true;
              if (fresh.length > 0) {
                const firstSemestre = fresh[0].semestre.replace('º Semestre', '').trim();
                if (typeof user.semestre === 'number') {
                  const userSem = user.semestre.toString();
                  const hasIt = fresh.some(c => 
                    c.semestre === userSem || c.semestre === `${userSem}º Semestre`
                  );
                  setSelectedSemestre(hasIt ? userSem : firstSemestre);
                } else {
                  setSelectedSemestre(firstSemestre);
                }
              }
            }
          }
        );

        if (cached && cached.length > 0) {
          setConteudos(cached);
          hasLoadedData.current = true;
          const firstSemestre = cached[0].semestre.replace('º Semestre', '').trim();
          if (typeof user.semestre === 'number') {
            const userSem = user.semestre.toString();
            const hasIt = cached.some(c => 
              c.semestre === userSem || c.semestre === `${userSem}º Semestre`
            );
            setSelectedSemestre(hasIt ? userSem : firstSemestre);
          } else {
            setSelectedSemestre(firstSemestre);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        analytics.trackStudyGuideError({
          errorType: 'edge_invoke',
          messageSanitized: errorMessage,
          context: 'fetchConteudos'
        });
        
        if (import.meta.env.DEV) {
          console.error('[StudyGuide] Error fetching contents:', error);
        }
        
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
  }, [user?.id_ies, user?.semestre, analytics, conteudos.length]);

  // Deep link scroll
  useEffect(() => {
    if (!isLoading && deepLinkAula && deepLinkTema && selectedMateria) {
      const timer = setTimeout(() => {
        const temaElements = document.querySelectorAll(`[data-tema]`);
        temaElements.forEach((el) => {
          if (el.getAttribute('data-tema') === deepLinkTema) {
            (el as HTMLElement).click();
            setTimeout(() => {
              const aulaElement = aulaRefs.current.get(deepLinkAula);
              if (aulaElement) {
                aulaElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                aulaElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                setTimeout(() => {
                  aulaElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                }, 2000);
              }
              setDeepLinkAula(null);
              setDeepLinkTema(null);
              setDeepLinkSubtema(null);
            }, 200);
          }
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, deepLinkAula, deepLinkTema, selectedMateria]);

  // Helpers
  const getAulaId = (item: ConteudoData) => 
    `${item.semestre}-${item.materia}-${item.tema}-${item.subtema}-${item.aula}`;

  const isCompleted = (item: ConteudoData) => isProgressCompleted(getAulaId(item));

  const toggleCompletion = useCallback(async (item: ConteudoData) => {
    const id = getAulaId(item);
    const semestre = parseInt(item.semestre) || parseInt(selectedSemestre) || user?.semestre || 1;
    const wasCompleted = !isProgressCompleted(id);
    const startTime = Date.now();
    
    try {
      await toggleContentCompletion(
        'aula',
        id,
        item.materia,
        semestre,
        user?.ies_nome || ''
      );
      
      const latency = Date.now() - startTime;
      
      analytics.trackStudyGuideLessonCompletion({
        semestre,
        materia: item.materia,
        tema: item.tema,
        subtema: item.subtema,
        aula: item.aula,
        wasCompleted,
        source: 'checkbox',
        latencyMs: latency,
        success: true
      });
      
      // Track funnel event
      if (wasCompleted) {
        analytics.trackFunnelGuideToCompletion(item.materia, 1);
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      analytics.trackStudyGuideLessonCompletion({
        semestre,
        materia: item.materia,
        tema: item.tema,
        subtema: item.subtema,
        aula: item.aula,
        wasCompleted,
        source: 'checkbox',
        latencyMs: latency,
        success: false
      });
    }
  }, [selectedSemestre, user?.semestre, user?.ies_nome, toggleContentCompletion, isProgressCompleted, analytics]);

  // Grouped data
  const groupedData = useMemo(() => {
    if (!selectedSemestre || !conteudos?.length) return [];

    const filtered = conteudos.filter((c) => {
      if (!c.semestre) return false;
      const semestreStr = c.semestre.toString().toLowerCase();
      const selectedStr = selectedSemestre.toLowerCase();
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

  // Filtered by search with debounced tracking
  const filteredMaterias = useMemo(() => {
    if (!searchQuery.trim()) return groupedData;
    const query = searchQuery.toLowerCase();
    
    // Track search with debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const results = groupedData
        .map((m) => {
          const filteredTemas = m.temas
            .map((t) => {
              const filteredSubtemas = t.subtemas
                .map((st) => ({
                  ...st,
                  aulas: st.aulas.filter((a) =>
                    m.materia.toLowerCase().includes(query) ||
                    t.tema.toLowerCase().includes(query) ||
                    st.subtema.toLowerCase().includes(query) ||
                    a.aula.toLowerCase().includes(query)
                  )
                }))
                .filter((st) => st.aulas.length > 0);
              return { ...t, subtemas: filteredSubtemas };
            })
            .filter((t) => t.subtemas.length > 0);
          return { ...m, temas: filteredTemas };
        })
        .filter((m) => m.temas.length > 0);
      
      const totalResults = results.reduce((sum, m) => 
        sum + m.temas.reduce((tSum, t) => 
          tSum + t.subtemas.reduce((stSum, st) => stSum + st.aulas.length, 0), 0), 0);
      
      analytics.trackStudyGuideSearch({
        query: searchQuery,
        resultsCount: totalResults,
        source: 'input'
      });
    }, 400);
    
    return groupedData
      .map((m) => {
        const filteredTemas = m.temas
          .map((t) => {
            const filteredSubtemas = t.subtemas
              .map((st) => ({
                ...st,
                aulas: st.aulas.filter((a) =>
                  m.materia.toLowerCase().includes(query) ||
                  t.tema.toLowerCase().includes(query) ||
                  st.subtema.toLowerCase().includes(query) ||
                  a.aula.toLowerCase().includes(query)
                )
              }))
              .filter((st) => st.aulas.length > 0);
            return { ...t, subtemas: filteredSubtemas };
          })
          .filter((t) => t.subtemas.length > 0);
        return { ...m, temas: filteredTemas };
      })
      .filter((m) => m.temas.length > 0);
  }, [groupedData, searchQuery, analytics]);

  const availableSubjectNames = useMemo(() => 
    filteredMaterias.map(m => m.materia), [filteredMaterias]);

  const semestres = useMemo(() => {
    if (!conteudos?.length) return [];
    const semestreSet = new Set<string>();
    conteudos.forEach((c) => {
      if (c.semestre) {
        let val = c.semestre.toString().trim().replace(/º\s*Semestre/i, '').trim();
        if (val.match(/^internato$/i)) val = 'INTERNATO';
        semestreSet.add(val);
      }
    });
    return Array.from(semestreSet).sort((a, b) => {
      const aNum = parseInt(a), bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      return a.localeCompare(b);
    });
  }, [conteudos]);

  // Subject helpers
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
          });
        });
      });
    });
    if (!allAulas.length) return 0;
    const completedCount = allAulas.filter(a => isCompleted(a)).length;
    return Math.round((completedCount / allAulas.length) * 100);
  };

  const isMateriaCompleted = (materia: Materia) => getMateriaProgress(materia) === 100;

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
        });
      });
    });
    if (!allAulas.length) return false;
    return allAulas.every(a => isCompleted(a));
  };

  // Calendar handlers with analytics
  const addEventToCalendar = useCallback(async (materia: string, day: number) => {
    await addSubject({
      name: materia,
      dayOfWeek: day,
      color: getMateriaColor(materia)
    });
    analytics.trackStudyGuideCalendarSubjectAdded(materia, day);
  }, [addSubject, analytics]);

  const removeEventFromCalendar = useCallback(async (id: string) => {
    const event = calendarEvents.find(e => e.id === id);
    if (!event) return;
    await removeSubject(event.day, event.materia);
    analytics.trackStudyGuideCalendarSubjectRemoved(event.materia, event.day);
    toast({ title: "Matéria removida", description: "Matéria removida do calendário" });
  }, [calendarEvents, removeSubject, analytics]);

  const openMateriaSheet = useCallback((materia: string) => {
    setSelectedEventMateria(materia);
    setSheetOpen(true);
    analytics.trackStudyGuideTodayCardClicked(materia, getBrazilDayOfWeek(), 'subject');
  }, [analytics]);

  const confirmEditMode = useCallback(() => {
    setCalendarSyncStatus('syncing');
    setTimeout(() => {
      setCalendarSyncStatus('saved');
      setTimeout(() => setCalendarSyncStatus('idle'), 2000);
    }, 500);
    setIsEditMode(false);
    toast({ title: "Alterações salvas", description: "Seu calendário foi atualizado" });
  }, []);

  const handleCalendarUndo = useCallback(() => {
    if (undoStack.length > 0) {
      setUndoStack(prev => prev.slice(0, -1));
      toast({ title: "Desfeito", description: "Última alteração desfeita" });
    }
  }, [undoStack]);

  const handleCalendarReset = useCallback(() => {
    toast({ title: "Semana resetada", description: "Todas as matérias foram removidas" });
  }, []);

  // Handle view mode change with analytics
  const handleViewModeChange = useCallback((mode: 'list' | 'calendar') => {
    setViewMode(mode);
    if (mode === 'calendar') {
      analytics.trackStudyGuideCalendarOpened('view', isMobile ? 'mobile' : 'desktop');
    }
  }, [analytics, isMobile]);

  // Handle edit mode with analytics
  const handleEnterEditMode = useCallback(() => {
    setIsEditMode(true);
    analytics.trackStudyGuideCalendarOpened('edit', isMobile ? 'mobile' : 'desktop');
  }, [analytics, isMobile]);

  // Handle subject chip click with analytics
  const handleSubjectChipClick = useCallback((materia: string) => {
    setSelectedMateria(materia);
    analytics.trackStudyGuideSubjectChipClicked(materia, 'chips');
  }, [analytics]);

  // Handle content action (video, pdf, quiz) with analytics
  const handleContentAction = useCallback((item: ConteudoData, actionType: 'video' | 'pdf' | 'quiz', url: string) => {
    analytics.trackStudyGuideContentAction({
      actionType,
      materia: item.materia,
      tema: item.tema,
      subtema: item.subtema,
      aula: item.aula,
      provider: 'sanarclass'
    });
    analytics.trackFunnelGuideToContentAction(actionType, item.materia);
    window.open(url, '_blank');
  }, [analytics]);

  // Handle search suggestion click with analytics
  const handleSearchSuggestionClick = useCallback((text: string) => {
    setSearchQuery(text);
    analytics.trackStudyGuideSearch({
      query: text,
      resultsCount: -1, // Will be tracked on actual filter
      source: lastSearchTerm === text ? 'history' : 'suggestion'
    });
  }, [analytics, lastSearchTerm]);

  // Today's subjects
  const todaySubjects = useMemo(() => {
    const today = getBrazilDayOfWeek();
    return calendarEvents
      .filter(e => e.day === today)
      .map(e => ({
        id: e.id,
        title: e.title,
        materia: e.materia,
        color: e.color,
        icon: getMateriaIcon(e.materia)
      }));
  }, [calendarEvents]);

  // Selected materia contents for sheet
  const selectedMateriaContents = useMemo(() => {
    if (!selectedEventMateria) return null;
    return groupedData.find(m => m.materia === selectedEventMateria);
  }, [selectedEventMateria, groupedData]);

  // Subject chips data
  const subjectChipsData = useMemo(() => {
    return filteredMaterias.map(m => ({
      name: m.materia,
      icon: getMateriaIcon(m.materia),
      color: getMateriaColor(m.materia)
    }));
  }, [filteredMaterias]);

  // Suggestions for search
  const suggestions = useMemo(() => {
    const allAulas = conteudos.map(c => c.aula).filter(Boolean);
    const unique = Array.from(new Set(allAulas));
    const q = searchQuery.trim().toLowerCase();
    if (!q) return unique.slice(0, 4).map(text => ({ text, type: 'aula' as const }));
    const starts = unique.filter(s => s.toLowerCase().startsWith(q));
    const contains = unique.filter(s => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 6).map(text => ({ text, type: 'aula' as const }));
  }, [conteudos, searchQuery]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen min-w-0 w-full bg-background overflow-x-clip">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <GuideSkeletons.Page />
        </div>
      </div>
    );
  }

  // No IES access
  if (!user?.id_ies) {
    return <GuideEmptyStates.NoAccess />;
  }

  return (
    <div className="min-h-screen min-w-0 w-full bg-background overflow-x-clip">
      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 min-w-0">
        
        {/* Header with Search */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <GuideHeader />
          <div className="w-full lg:w-96 xl:w-[28rem]">
            <GuideSearchBar
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                if (val.trim()) {
                  localStorage.setItem('studyguide:lastSearch', val);
                  setLastSearchTerm(val);
                }
              }}
              suggestions={suggestions}
              lastSearch={lastSearchTerm}
              placeholder="O que você quer aprender hoje?"
              onSuggestionClick={handleSearchSuggestionClick}
            />
          </div>
        </div>

        {selectedSemestre && (
          <>
            {/* Hero Section - Today's Study */}
            <TodayStudyCard
              subjects={todaySubjects}
              onSubjectClick={openMateriaSheet}
              onRemoveSubject={(id) => removeEventFromCalendar(id)}
              onGoToCalendar={() => handleViewModeChange('calendar')}
              isHero
            />

            {/* Toolbar */}
            <GuideToolbar
              selectedSemestre={selectedSemestre}
              semestres={semestres}
              viewMode={viewMode}
              onSemestreChange={setSelectedSemestre}
              onViewModeChange={handleViewModeChange}
            />

            {/* Subject Chips - Only in list mode */}
            {viewMode === 'list' && (
              <SubjectChips
                subjects={subjectChipsData}
                selectedSubject={selectedMateria}
                onSelectSubject={handleSubjectChipClick}
              />
            )}

            {/* Content Area */}
            <AnimatePresence mode="wait">
              {viewMode === 'list' ? (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {filteredMaterias.length === 0 ? (
                    searchQuery ? (
                      <GuideEmptyStates.NoSearch onAction={() => setSearchQuery('')} />
                    ) : (
                      <GuideEmptyStates.NoContent />
                    )
                  ) : (
                    filteredMaterias
                      .filter(m => selectedMateria === '' || m.materia === selectedMateria)
                      .map((materia, mIdx) => {
                        const progress = getMateriaProgress(materia);
                        const totalAulas = materia.temas.reduce(
                          (sum, t) => sum + t.subtemas.reduce((s, st) => s + st.aulas.length, 0),
                          0
                        );
                        const completed = isMateriaCompleted(materia);

                        return (
                          <SubjectCard
                            key={mIdx}
                            materia={materia.materia}
                            icon={getMateriaIcon(materia.materia)}
                            temas={materia.temas.map(t => ({
                              tema: t.tema,
                              subtemas: t.subtemas,
                              isCompleted: isTemaCompleted(materia, t),
                              aulasCount: t.subtemas.reduce((s, st) => s + st.aulas.length, 0)
                            }))}
                            progress={progress}
                            totalAulas={totalAulas}
                            isCompleted={completed}
                            selectedSemestre={selectedSemestre}
                            highlightedAula={deepLinkAula}
                            highlightedTema={deepLinkTema}
                            isAulaCompleted={(aulaId) => isProgressCompleted(aulaId)}
                            onAulaToggle={async (aulaId) => {
                              const semestre = parseInt(selectedSemestre) || user?.semestre || 1;
                              const startTime = Date.now();
                              const wasCompleted = !isProgressCompleted(aulaId);
                              
                              try {
                                await toggleContentCompletion(
                                  'aula',
                                  aulaId,
                                  materia.materia,
                                  semestre,
                                  user?.ies_nome || ''
                                );
                                
                                // Parse aulaId to get details
                                const parts = aulaId.split('-');
                                analytics.trackStudyGuideLessonCompletion({
                                  semestre,
                                  materia: materia.materia,
                                  tema: parts[2] || '',
                                  subtema: parts[3] || '',
                                  aula: parts.slice(4).join('-') || '',
                                  wasCompleted,
                                  source: 'checkbox',
                                  latencyMs: Date.now() - startTime,
                                  success: true
                                });
                                
                                if (wasCompleted) {
                                  analytics.trackFunnelGuideToCompletion(materia.materia, 1);
                                }
                              } catch (error) {
                                analytics.trackStudyGuideError({
                                  errorType: 'supabase_query',
                                  messageSanitized: 'Failed to toggle completion',
                                  context: 'onAulaToggle'
                                });
                              }
                            }}
                            aulaRefs={aulaRefs}
                          />
                        );
                      })
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="calendar-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Mobile Calendar */}
                  <div className="md:hidden">
                    <CalendarViewMobile
                      events={calendarEvents}
                      onEdit={handleEnterEditMode}
                      onEventClick={(event) => openMateriaSheet(event.materia)}
                      variant={calendarVariant}
                    />
                  </div>
                  
                  {/* Desktop Calendar */}
                  <div className="hidden md:block">
                    <CalendarViewDesktop
                      events={calendarEvents}
                      onEdit={handleEnterEditMode}
                      onEventClick={(event) => openMateriaSheet(event.materia)}
                      variant={calendarVariant}
                    />
                  </div>

                  {/* Calendar Editor Modal */}
                  <AnimatePresence>
                    {isEditMode && (
                      isMobile ? (
                        <CalendarEditorMobile
                          events={calendarEvents}
                          availableSubjects={availableSubjectNames}
                          onAddEvent={addEventToCalendar}
                          onRemoveEvent={removeEventFromCalendar}
                          onSave={confirmEditMode}
                          onClose={() => setIsEditMode(false)}
                          onUndo={handleCalendarUndo}
                          onEventClick={(event) => openMateriaSheet(event.materia)}
                          syncStatus={calendarSyncStatus}
                          isSaving={syncLoading}
                          canUndo={undoStack.length > 0}
                          variant={calendarVariant}
                        />
                      ) : (
                        <CalendarEditorDesktop
                          events={calendarEvents}
                          availableSubjects={availableSubjectNames}
                          onAddEvent={addEventToCalendar}
                          onRemoveEvent={removeEventFromCalendar}
                          onSave={confirmEditMode}
                          onClose={() => setIsEditMode(false)}
                          onUndo={handleCalendarUndo}
                          onReset={handleCalendarReset}
                          onEventClick={(event) => openMateriaSheet(event.materia)}
                          syncStatus={calendarSyncStatus}
                          isSaving={syncLoading}
                          canUndo={undoStack.length > 0}
                          variant={calendarVariant}
                        />
                      )
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Sheet for materia details */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="text-xl">{selectedMateriaContents && getMateriaIcon(selectedMateriaContents.materia)}</span>
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
                  className="border rounded-xl px-4 shadow-sm border-border/40 dark:border-white/5"
                >
                  <AccordionTrigger 
                    className="hover:no-underline py-4"
                    onClick={() => analytics.trackStudyGuideThemeToggled(
                      selectedMateriaContents.materia, 
                      tema.tema, 
                      true
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <Brain className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{tema.tema}</h3>
                        <p className="text-xs text-muted-foreground">
                          {tema.subtemas.reduce((s, st) => s + st.aulas.length, 0)} aulas
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2 pb-4 space-y-3">
                    {tema.subtemas.map((subtema, stIdx) => (
                      <div key={stIdx} className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2 px-1">
                          <ChevronRight className="h-3.5 w-3.5" />
                          {subtema.subtema}
                        </h4>

                        <div className="space-y-2 pl-4 border-l-2 border-border/30">
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
                                  'p-3 rounded-xl border transition-all shadow-sm',
                                  completed
                                    ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/30'
                                    : 'bg-card border-border/40 hover:border-primary/20'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => toggleCompletion(aulaData)}
                                    className="shrink-0 mt-0.5"
                                  >
                                    {completed ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary" />
                                    )}
                                  </button>

                                  <div className="flex-1 min-w-0 space-y-2">
                                    <h5 className={cn(
                                      'font-medium text-sm',
                                      completed && 'line-through text-muted-foreground'
                                    )}>
                                      {aula.aula}
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                      {aula.link_aula && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 gap-1.5 rounded-lg text-xs hover:bg-primary hover:text-primary-foreground"
                                          onClick={() => handleContentAction(aulaData, 'video', aula.link_aula!)}
                                        >
                                          <Play className="h-3 w-3" />
                                          Assistir
                                        </Button>
                                      )}
                                      {aula.link_pdf && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 gap-1.5 rounded-lg text-xs hover:bg-primary hover:text-primary-foreground"
                                          onClick={() => handleContentAction(aulaData, 'pdf', aula.link_pdf!)}
                                        >
                                          <FileText className="h-3 w-3" />
                                          PDF
                                        </Button>
                                      )}
                                      {aula.link_quiz && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 gap-1.5 rounded-lg text-xs hover:bg-primary hover:text-primary-foreground"
                                          onClick={() => handleContentAction(aulaData, 'quiz', aula.link_quiz!)}
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
    </div>
  );
};
