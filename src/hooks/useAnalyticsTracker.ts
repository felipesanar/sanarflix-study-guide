import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

type EventCategory = 'navigation' | 'simulado' | 'content' | 'sanarclass' | 'interaction' | 'error' | 'performance';

interface TrackEventParams {
  eventName: string;
  category: EventCategory;
  data?: Record<string, Json>;
  pagePath?: string;
}

/**
 * Hook para tracking de eventos de analytics
 * Persiste eventos no banco de dados para análise posterior
 */
export const useAnalyticsTracker = () => {
  const { user } = useAuth();
  const sessionIdRef = useRef<string>(getOrCreateSessionId());

  // Função principal de tracking
  const trackEvent = useCallback(async ({
    eventName,
    category,
    data = {},
    pagePath
  }: TrackEventParams) => {
    try {
      const eventData = {
        user_id: user?.id || null,
        event_name: eventName,
        event_category: category,
        event_data: data,
        page_path: pagePath || window.location.pathname,
        session_id: sessionIdRef.current,
        ies_id: user?.id_ies || null
      };

      const { error } = await supabase
        .from('analytics_events')
        .insert([eventData]);

      if (error) {
        console.error('[AnalyticsCapture] Error:', error);
      }
    } catch (err) {
      // Falha silenciosa - tracking não deve quebrar a aplicação
      console.error('[AnalyticsCapture] Exception:', err);
    }
  }, [user?.id, user?.id_ies]);

  // Helpers para eventos comuns
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

    // Registrar na tabela específica de simulados iniciados
    try {
      await supabase
        .from('simulados_iniciados')
        .upsert({
          user_id: user.id,
          simulado_id: simuladoId
        }, { onConflict: 'user_id,simulado_id' });
    } catch (err) {
      console.error('[AnalyticsCapture] Error tracking simulado start:', err);
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

    // Registrar na tabela específica
    try {
      await supabase
        .from('sanarclass_views')
        .insert({
          user_id: user.id,
          lesson_id: lessonId,
          action_type: actionType
        });
    } catch (err) {
      console.error('[AnalyticsCapture] Error tracking sanarclass:', err);
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
      data: { errorType, errorMessage, ...context }
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
    trackEvent,
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
      // Verificar se a sessão ainda é válida
      if (Date.now() - timestamp < SESSION_DURATION) {
        // Atualizar timestamp
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, timestamp: Date.now() }));
        return id;
      }
    }
  } catch {
    // Ignore errors
  }

  // Gerar novo session ID
  const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: newId, timestamp: Date.now() }));
  return newId;
}

export default useAnalyticsTracker;
