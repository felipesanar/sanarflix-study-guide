import { useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

type EventCategory = 'navigation' | 'simulado' | 'content' | 'sanarclass' | 'interaction' | 'error' | 'performance' | 'funnel';

interface TrackEventParams {
  eventName: string;
  category: EventCategory;
  data?: Record<string, Json>;
  pagePath?: string;
}

interface QueuedEvent extends TrackEventParams {
  timestamp: number;
  retries: number;
}

// Validation schema for common event data
const MAX_EVENTS_PER_MINUTE = 60;
const DEDUPE_WINDOW_MS = 1000; // 1 second
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1000;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Hash function for query privacy
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

// Get device info
const getDeviceInfo = (): { device: 'mobile' | 'tablet' | 'desktop'; viewport: string } => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  let device: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (width < 768) device = 'mobile';
  else if (width < 1024) device = 'tablet';
  return { device, viewport: `${width}x${height}` };
};

// Get scroll depth bucket
const getScrollDepthBucket = (): string => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return '100';
  const percent = Math.round((scrollTop / docHeight) * 100);
  if (percent <= 25) return '0-25';
  if (percent <= 50) return '25-50';
  if (percent <= 75) return '50-75';
  return '75-100';
};

/**
 * Hook para tracking de eventos de analytics com recursos avançados:
 * - Validação de payload
 * - Deduplicação de eventos
 * - Rate limiting
 * - Queue com retry e backoff
 * - Contexto automático (user_id, device, etc.)
 * - Proteção contra PII
 */
export const useAnalyticsTracker = () => {
  const { user, isImpersonating } = useAuth();
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const eventQueueRef = useRef<QueuedEvent[]>([]);
  const lastEventsRef = useRef<Map<string, number>>(new Map());
  const eventCountRef = useRef<{ count: number; windowStart: number }>({ count: 0, windowStart: Date.now() });
  const processingRef = useRef(false);

  // Memoize base context
  const baseContext = useMemo(() => ({
    session_id: sessionIdRef.current,
    ...getDeviceInfo(),
    app_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  }), []);

  // Process queue with retry logic
  const processQueue = useCallback(async () => {
    if (processingRef.current || eventQueueRef.current.length === 0) return;
    processingRef.current = true;

    const batch = eventQueueRef.current.splice(0, 10); // Process 10 at a time
    const failedEvents: QueuedEvent[] = [];

    for (const event of batch) {
      try {
        const { error } = await supabase
          .from('analytics_events')
          .insert([{
            user_id: user?.id || null,
            event_name: event.eventName,
            event_category: event.category,
            event_data: {
              ...baseContext,
              ...event.data,
              semestre: user?.semestre || null,
            },
            page_path: event.pagePath || window.location.pathname,
            session_id: sessionIdRef.current,
            ies_id: user?.id_ies || null
          }]);

        if (error) {
          if (import.meta.env.DEV) {
            console.error('[Analytics] Insert error:', error.message);
          }
          if (event.retries < MAX_RETRY_ATTEMPTS) {
            failedEvents.push({ ...event, retries: event.retries + 1 });
          }
        } else if (import.meta.env.DEV) {
          console.log('[Analytics]', event.eventName, event.data);
        }
      } catch (err) {
        if (event.retries < MAX_RETRY_ATTEMPTS) {
          failedEvents.push({ ...event, retries: event.retries + 1 });
        }
        if (import.meta.env.DEV) {
          console.error('[Analytics] Exception:', err);
        }
      }
    }

    // Re-queue failed events with backoff
    if (failedEvents.length > 0) {
      setTimeout(() => {
        eventQueueRef.current.push(...failedEvents);
        processQueue();
      }, RETRY_BACKOFF_MS * (failedEvents[0]?.retries || 1));
    }

    processingRef.current = false;

    // Continue processing if more events in queue
    if (eventQueueRef.current.length > 0) {
      setTimeout(processQueue, 100);
    }
  }, [user?.id, user?.id_ies, user?.semestre, baseContext]);

  // Main track function with validation, dedupe, and rate limiting
  const trackEvent = useCallback(async ({
    eventName,
    category,
    data = {},
    pagePath
  }: TrackEventParams) => {
    // Rate limiting check
    const now = Date.now();
    if (now - eventCountRef.current.windowStart > RATE_LIMIT_WINDOW_MS) {
      eventCountRef.current = { count: 0, windowStart: now };
    }
    if (eventCountRef.current.count >= MAX_EVENTS_PER_MINUTE) {
      if (import.meta.env.DEV) {
        console.warn('[Analytics] Rate limit exceeded, dropping event:', eventName);
      }
      return;
    }

    // Deduplication check (same event + stable context within window)
    const dedupeKey = `${eventName}:${JSON.stringify(data)}`;
    const lastTime = lastEventsRef.current.get(dedupeKey);
    if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
      if (import.meta.env.DEV) {
        console.log('[Analytics] Dedupe: skipping duplicate event:', eventName);
      }
      return;
    }
    lastEventsRef.current.set(dedupeKey, now);

    // Clean old dedupe entries
    if (lastEventsRef.current.size > 100) {
      const cutoff = now - DEDUPE_WINDOW_MS * 10;
      for (const [key, time] of lastEventsRef.current.entries()) {
        if (time < cutoff) lastEventsRef.current.delete(key);
      }
    }

    // Increment rate limit counter
    eventCountRef.current.count++;

    // Add to queue
    eventQueueRef.current.push({
      eventName,
      category,
      data,
      pagePath,
      timestamp: now,
      retries: 0
    });

    // Process queue
    processQueue();
  }, [processQueue]);

  // ===== STUDY GUIDE SPECIFIC EVENTS =====
  
  const trackStudyGuideView = useCallback((options: {
    semestre: string | number;
    viewMode: 'list' | 'calendar';
    hasCache: boolean;
  }) => {
    trackEvent({
      eventName: 'study_guide_view',
      category: 'navigation',
      data: {
        semestre: String(options.semestre),
        view_mode: options.viewMode,
        has_cache: options.hasCache,
      }
    });
  }, [trackEvent]);

  const trackStudyGuideTimeOnPage = useCallback((durationMs: number) => {
    trackEvent({
      eventName: 'study_guide_time_on_page',
      category: 'navigation',
      data: {
        duration_ms: durationMs,
        scroll_depth_bucket: getScrollDepthBucket(),
      }
    });
  }, [trackEvent]);

  const trackStudyGuideSearch = useCallback((options: {
    query: string;
    resultsCount: number;
    source: 'input' | 'suggestion' | 'history';
  }) => {
    // Privacy: hash query, only store length
    trackEvent({
      eventName: options.resultsCount === 0 ? 'study_guide_search_no_results' : 'study_guide_search_performed',
      category: 'interaction',
      data: {
        query_hash: hashString(options.query),
        query_length: options.query.length,
        results_count: options.resultsCount,
        source: options.source,
      }
    });
  }, [trackEvent]);

  const trackStudyGuideSubjectChipClicked = useCallback((materia: string, from: 'chips' | 'toolbar') => {
    trackEvent({
      eventName: 'study_guide_subject_chip_clicked',
      category: 'interaction',
      data: { materia, from }
    });
  }, [trackEvent]);

  const trackStudyGuideSubjectCardToggled = useCallback((materia: string, expanded: boolean) => {
    trackEvent({
      eventName: 'study_guide_subject_card_toggled',
      category: 'interaction',
      data: { materia, expanded }
    });
  }, [trackEvent]);

  const trackStudyGuideThemeToggled = useCallback((materia: string, tema: string, expanded: boolean) => {
    trackEvent({
      eventName: 'study_guide_theme_toggled',
      category: 'interaction',
      data: { materia, tema, expanded }
    });
  }, [trackEvent]);

  const trackStudyGuideDeepLinkOpened = useCallback((params: {
    materia?: string | null;
    tema?: string | null;
    aula?: string | null;
    subtema?: string | null;
  }) => {
    trackEvent({
      eventName: 'study_guide_deep_link_opened',
      category: 'navigation',
      data: {
        has_materia: !!params.materia,
        has_tema: !!params.tema,
        has_aula: !!params.aula,
        has_subtema: !!params.subtema,
      }
    });
  }, [trackEvent]);

  const trackStudyGuideLessonCompletion = useCallback((options: {
    semestre: string | number;
    materia: string;
    tema: string;
    subtema: string;
    aula: string;
    wasCompleted: boolean;
    source: 'checkbox' | 'auto' | 'migration';
    latencyMs: number;
    success: boolean;
  }) => {
    trackEvent({
      eventName: 'study_guide_lesson_completion_toggled',
      category: 'interaction',
      data: {
        semestre: String(options.semestre),
        materia: options.materia,
        tema: options.tema,
        subtema: options.subtema,
        aula: options.aula,
        was_completed: options.wasCompleted,
        source: options.source,
        latency_ms: options.latencyMs,
        success: options.success,
      }
    });
  }, [trackEvent]);

  const trackStudyGuideContentAction = useCallback((options: {
    actionType: 'video' | 'pdf' | 'quiz';
    materia: string;
    tema: string;
    subtema: string;
    aula: string;
    provider?: string;
  }) => {
    trackEvent({
      eventName: 'study_guide_content_action',
      category: 'content',
      data: {
        action_type: options.actionType,
        materia: options.materia,
        tema: options.tema,
        subtema: options.subtema,
        aula: options.aula,
        provider: options.provider || 'unknown',
      }
    });
  }, [trackEvent]);

  const trackStudyGuideCalendarOpened = useCallback((mode: 'view' | 'edit', device: 'mobile' | 'desktop') => {
    trackEvent({
      eventName: 'study_guide_calendar_opened',
      category: 'interaction',
      data: { mode, device }
    });
  }, [trackEvent]);

  const trackStudyGuideCalendarSubjectAdded = useCallback((materia: string, dayOfWeek: number) => {
    trackEvent({
      eventName: 'study_guide_calendar_subject_added',
      category: 'interaction',
      data: { materia, day_of_week: dayOfWeek }
    });
  }, [trackEvent]);

  const trackStudyGuideCalendarSubjectRemoved = useCallback((materia: string, dayOfWeek: number) => {
    trackEvent({
      eventName: 'study_guide_calendar_subject_removed',
      category: 'interaction',
      data: { materia, day_of_week: dayOfWeek }
    });
  }, [trackEvent]);

  const trackStudyGuideTodayCardClicked = useCallback((materia: string, dayOfWeek: number, ctaType: 'subject' | 'calendar') => {
    trackEvent({
      eventName: 'study_guide_today_card_clicked',
      category: 'interaction',
      data: { materia, day_of_week: dayOfWeek, cta_type: ctaType }
    });
  }, [trackEvent]);

  const trackStudyGuideError = useCallback((options: {
    errorType: 'edge_invoke' | 'supabase_query' | 'render' | 'unknown';
    errorCode?: string;
    messageSanitized: string;
    context?: string;
  }) => {
    trackEvent({
      eventName: 'study_guide_error',
      category: 'error',
      data: {
        error_type: options.errorType,
        error_code: options.errorCode || 'unknown',
        message_sanitized: options.messageSanitized.substring(0, 100),
        context: options.context || 'unknown',
      }
    });
  }, [trackEvent]);

  // ===== PROGRESS HUB SPECIFIC EVENTS =====

  const trackProgressHubExamAdded = useCallback((options: {
    examType: string;
    daysUntilExam: number;
    materia?: string;
    success: boolean;
    latencyMs: number;
  }) => {
    trackEvent({
      eventName: 'progress_hub_exam_added',
      category: 'interaction',
      data: {
        exam_type: options.examType,
        days_until_exam: options.daysUntilExam,
        materia: options.materia || null,
        success: options.success,
        latency_ms: options.latencyMs,
      }
    });
  }, [trackEvent]);

  const trackProgressHubExamRemoved = useCallback((examIdHash: string, daysUntilExam: number) => {
    trackEvent({
      eventName: 'progress_hub_exam_removed',
      category: 'interaction',
      data: { exam_id_hash: examIdHash, days_until_exam: daysUntilExam }
    });
  }, [trackEvent]);

  const trackProgressHubExamClicked = useCallback((examIdHash: string, source: 'carousel' | 'card') => {
    trackEvent({
      eventName: 'progress_hub_exam_clicked',
      category: 'interaction',
      data: { exam_id_hash: examIdHash, source }
    });
  }, [trackEvent]);

  const trackProgressHubDiagnosticClicked = useCallback((options: {
    insightType: 'backlog' | 'neglected' | 'advanced' | 'quick_win';
    materia: string;
    tema?: string;
    sourceCard: string;
  }) => {
    trackEvent({
      eventName: 'progress_hub_diagnostic_clicked',
      category: 'interaction',
      data: {
        insight_type: options.insightType,
        materia: options.materia,
        tema: options.tema || null,
        source_card: options.sourceCard,
      }
    });
  }, [trackEvent]);

  const trackProgressHubCoverageRankingClicked = useCallback((materia: string, rankPosition: number, direction: 'low' | 'high') => {
    trackEvent({
      eventName: 'progress_hub_coverage_ranking_clicked',
      category: 'interaction',
      data: { materia, rank_position: rankPosition, direction }
    });
  }, [trackEvent]);

  const trackProgressHubSemesterMapToggled = useCallback((level: 'materia' | 'tema' | 'subtema', expanded: boolean) => {
    trackEvent({
      eventName: 'progress_hub_semester_map_toggled',
      category: 'interaction',
      data: { level, expanded }
    });
  }, [trackEvent]);

  const trackProgressHubWeeklyChartInteracted = useCallback((weekIndex: number, metric: 'aulas' | 'percentage') => {
    trackEvent({
      eventName: 'progress_hub_weekly_chart_interacted',
      category: 'interaction',
      data: { week_index: weekIndex, metric }
    });
  }, [trackEvent]);

  const trackProgressHubUndoCompletion = useCallback((materia: string, tema?: string, aula?: string) => {
    trackEvent({
      eventName: 'progress_hub_undo_completion',
      category: 'interaction',
      data: { materia, tema: tema || null, aula: aula || null }
    });
  }, [trackEvent]);

  // ===== FUNNEL EVENTS =====

  const trackFunnelOpenGuideFromHub = useCallback((source: string, materia?: string, tema?: string) => {
    trackEvent({
      eventName: 'funnel_open_guide_from_hub',
      category: 'funnel',
      data: { source, materia: materia || null, tema: tema || null }
    });
  }, [trackEvent]);

  const trackFunnelOpenHubFromHome = useCallback((source: string) => {
    trackEvent({
      eventName: 'funnel_open_hub_from_home',
      category: 'funnel',
      data: { source }
    });
  }, [trackEvent]);

  const trackFunnelGuideToContentAction = useCallback((contentType: 'video' | 'pdf' | 'quiz', materia: string) => {
    trackEvent({
      eventName: 'funnel_guide_to_content_action',
      category: 'funnel',
      data: { content_type: contentType, materia }
    });
  }, [trackEvent]);

  const trackFunnelGuideToCompletion = useCallback((materia: string, lessonCount: number) => {
    trackEvent({
      eventName: 'funnel_guide_to_completion',
      category: 'funnel',
      data: { materia, lesson_count: lessonCount }
    });
  }, [trackEvent]);

  // ===== PERFORMANCE EVENTS =====

  const trackWebVitals = useCallback((metrics: {
    lcp?: number;
    cls?: number;
    inp?: number;
    fcp?: number;
    ttfb?: number;
  }) => {
    // Sample 20% of sessions
    if (Math.random() > 0.2) return;
    
    trackEvent({
      eventName: 'perf_web_vitals',
      category: 'performance',
      data: {
        lcp_ms: metrics.lcp || null,
        cls: metrics.cls || null,
        inp_ms: metrics.inp || null,
        fcp_ms: metrics.fcp || null,
        ttfb_ms: metrics.ttfb || null,
      }
    });
  }, [trackEvent]);

  const trackEdgeLatency = useCallback((functionName: string, latencyMs: number, success: boolean) => {
    trackEvent({
      eventName: 'perf_edge_latency',
      category: 'performance',
      data: {
        function_name: functionName,
        latency_ms: latencyMs,
        success,
      }
    });
  }, [trackEvent]);

  const trackCacheHit = useCallback((cacheType: 'localStorage' | 'swr' | 'memory', pageName: string, wasHit: boolean) => {
    trackEvent({
      eventName: 'perf_cache_hit',
      category: 'performance',
      data: {
        cache_type: cacheType,
        page_name: pageName,
        was_hit: wasHit,
      }
    });
  }, [trackEvent]);

  // ===== LEGACY HELPERS (backward compatibility) =====

  const trackPageView = useCallback((pagePath: string, pageTitle?: string) => {
    trackEvent({
      eventName: 'page_view',
      category: 'navigation',
      data: { title: pageTitle },
      pagePath
    });
  }, [trackEvent]);

  const trackSimuladoStart = useCallback(async (simuladoId: string, simuladoNome: string) => {
    if (!user?.id) return;

    try {
      const { data: finalizacao } = await supabase
        .from('simulados_finalizados')
        .select('id, liberado_novamente')
        .eq('user_id', user.id)
        .eq('simulado_id', simuladoId)
        .order('tentativa_numero', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (finalizacao && !finalizacao.liberado_novamente) {
        if (import.meta.env.DEV) {
          console.log('[Analytics] Simulado já finalizado e não liberado, ignorando tracking de início');
        }
        return;
      }

      await supabase
        .from('simulados_iniciados')
        .upsert({
          user_id: user.id,
          simulado_id: simuladoId
        }, { onConflict: 'user_id,simulado_id' });
    } catch (err) {
      console.error('[Analytics] Error tracking simulado start:', err);
    }

    trackEvent({
      eventName: 'simulado_start',
      category: 'simulado',
      data: { simuladoId, simuladoNome }
    });
  }, [user?.id, trackEvent]);

  const trackSimuladoComplete = useCallback((simuladoId: string, data: {
    tempoTotalSegundos: number;
    saidasDeAba: number;
    saidasDeFullscreen?: number;
    totalQuestoes: number;
    totalRespondidas: number;
  }) => {
    trackEvent({
      eventName: 'simulado_complete',
      category: 'simulado',
      data: { simuladoId, ...data }
    });
  }, [trackEvent]);

  const trackContentView = useCallback((contentType: 'aula' | 'pdf' | 'quiz', contentId: string, contentName: string) => {
    trackEvent({
      eventName: 'content_view',
      category: 'content',
      data: { contentType, contentId, contentName }
    });
  }, [trackEvent]);

  const trackSanarClassAction = useCallback(async (
    lessonId: string, 
    actionType: 'view' | 'download',
    lessonTitle: string
  ) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('sanarclass_views')
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          action_type: actionType
        });
    } catch (err) {
      console.error('[Analytics] Error tracking sanarclass:', err);
    }

    trackEvent({
      eventName: `sanarclass_${actionType}`,
      category: 'sanarclass',
      data: { lessonId, lessonTitle }
    });
  }, [user?.id, trackEvent]);

  const trackError = useCallback((errorType: string, errorMessage: string, context?: Record<string, Json>) => {
    trackEvent({
      eventName: 'error_occurred',
      category: 'error',
      data: { errorType, errorMessage: errorMessage.substring(0, 200), ...context }
    });
  }, [trackEvent]);

  const trackInteraction = useCallback((action: string, target: string, value?: Json) => {
    trackEvent({
      eventName: action,
      category: 'interaction',
      data: { target, value }
    });
  }, [trackEvent]);

  return {
    // Core
    trackEvent,
    
    // Study Guide specific
    trackStudyGuideView,
    trackStudyGuideTimeOnPage,
    trackStudyGuideSearch,
    trackStudyGuideSubjectChipClicked,
    trackStudyGuideSubjectCardToggled,
    trackStudyGuideThemeToggled,
    trackStudyGuideDeepLinkOpened,
    trackStudyGuideLessonCompletion,
    trackStudyGuideContentAction,
    trackStudyGuideCalendarOpened,
    trackStudyGuideCalendarSubjectAdded,
    trackStudyGuideCalendarSubjectRemoved,
    trackStudyGuideTodayCardClicked,
    trackStudyGuideError,
    
    // Progress Hub specific
    trackProgressHubExamAdded,
    trackProgressHubExamRemoved,
    trackProgressHubExamClicked,
    trackProgressHubDiagnosticClicked,
    trackProgressHubCoverageRankingClicked,
    trackProgressHubSemesterMapToggled,
    trackProgressHubWeeklyChartInteracted,
    trackProgressHubUndoCompletion,
    
    // Funnel
    trackFunnelOpenGuideFromHub,
    trackFunnelOpenHubFromHome,
    trackFunnelGuideToContentAction,
    trackFunnelGuideToCompletion,
    
    // Performance
    trackWebVitals,
    trackEdgeLatency,
    trackCacheHit,
    
    // Legacy (backward compatible)
    trackPageView,
    trackSimuladoStart,
    trackSimuladoComplete,
    trackContentView,
    trackSanarClassAction,
    trackError,
    trackInteraction
  };
};

// Helper para gerar/recuperar session ID
function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'analytics_session_id';
  const SESSION_DURATION = 30 * 60 * 1000; // 30 minutos

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { id, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < SESSION_DURATION) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, timestamp: Date.now() }));
        return id;
      }
    }
  } catch {
    // Ignore errors
  }

  const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: newId, timestamp: Date.now() }));
  return newId;
}

export default useAnalyticsTracker;

// Export hash utility for external use
export { hashString };
