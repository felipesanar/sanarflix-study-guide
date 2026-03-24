import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SESSION_STORAGE_KEY = 'user_session_tracker';
const PAGE_VIEW_DEBOUNCE = 1000; // 1 segundo de debounce entre page views

interface SessionData {
  sessionId: string;
  dbSessionId: string | null;
  startedAt: number;
  pagesVisited: number;
}

/**
 * Hook para tracking automático de sessões e page views
 * Deve ser usado no componente raiz da aplicação
 */
export const useSessionTracker = () => {
  const { user, isImpersonating } = useAuth();
  const location = useLocation();
  const sessionRef = useRef<SessionData | null>(null);
  const lastPageRef = useRef<string>('');
  const pageEnterTimeRef = useRef<number>(Date.now());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar ou recuperar sessão
  const initSession = useCallback(async () => {
    if (!user?.id || isImpersonating) return;

    let session = sessionRef.current;

    // Tentar recuperar sessão existente do sessionStorage
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionData;
        // Verificar se a sessão é recente (menos de 30 min)
        if (Date.now() - parsed.startedAt < 30 * 60 * 1000) {
          session = parsed;
          sessionRef.current = session;
        }
      }
    } catch {
      // Ignore
    }

    // Criar nova sessão se necessário
    if (!session) {
      const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // Persistir no banco
      const { data, error } = await supabase
        .from('user_sessions')
        .insert([{
          user_id: user.id,
          session_id: sessionId,
          ies_id: user.id_ies,
          user_agent: navigator.userAgent.substring(0, 500),
          is_mobile: isMobile,
          pages_visited: 0
        }])
        .select('id')
        .single();

      if (error) {
        console.error('[SessionTracker] Error creating session:', error);
      }

      session = {
        sessionId,
        dbSessionId: data?.id || null,
        startedAt: Date.now(),
        pagesVisited: 0
      };

      sessionRef.current = session;
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  }, [user?.id, user?.id_ies, isImpersonating]);

  // Registrar page view
  const trackPageView = useCallback(async (path: string) => {
    if (!user?.id || !sessionRef.current || isImpersonating) return;

    const session = sessionRef.current;
    
    // Calcular tempo na página anterior
    const timeOnPreviousPage = lastPageRef.current 
      ? Math.round((Date.now() - pageEnterTimeRef.current) / 1000)
      : null;

    // Atualizar referências
    pageEnterTimeRef.current = Date.now();
    lastPageRef.current = path;

    // Incrementar contador de páginas
    session.pagesVisited += 1;
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    // Registrar page view no banco
    try {
      await supabase
        .from('page_views')
        .insert([{
          user_id: user.id,
          page_path: path,
          page_title: document.title,
          referrer: document.referrer || null,
          session_id: session.sessionId,
          time_on_page_seconds: timeOnPreviousPage,
          ies_id: user.id_ies
        }]);

      // Atualizar contador na sessão do banco
      if (session.dbSessionId) {
        await supabase
          .from('user_sessions')
          .update({ pages_visited: session.pagesVisited })
          .eq('id', session.dbSessionId);
      }
    } catch (err) {
      console.error('[SessionTracker] Error tracking page view:', err);
    }
  }, [user?.id, user?.id_ies, isImpersonating]);

  // Finalizar sessão (ao sair da página)
  const endSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.dbSessionId) return;

    const duration = Math.round((Date.now() - session.startedAt) / 1000);

    try {
      await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
          pages_visited: session.pagesVisited
        })
        .eq('id', session.dbSessionId);
    } catch (err) {
      console.error('[SessionTracker] Error ending session:', err);
    }

    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionRef.current = null;
  }, []);

  // Inicializar sessão quando usuário loga
  useEffect(() => {
    if (user?.id) {
      initSession();
    }
  }, [user?.id, initSession]);

  // Rastrear mudanças de rota com debounce
  useEffect(() => {
    if (!user?.id) return;

    // Debounce para evitar múltiplos registros em navegação rápida
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      trackPageView(location.pathname);
    }, PAGE_VIEW_DEBOUNCE);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [location.pathname, user?.id, trackPageView]);

  // Finalizar sessão ao fechar a página
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Usar sendBeacon para garantir envio mesmo ao fechar
      if (sessionRef.current?.dbSessionId) {
        const duration = Math.round((Date.now() - sessionRef.current.startedAt) / 1000);
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://gvqvrmkizemwsasmupmo.supabase.co'}/rest/v1/user_sessions?id=eq.${sessionRef.current.dbSessionId}`,
          JSON.stringify({
            ended_at: new Date().toISOString(),
            duration_seconds: duration
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [endSession]);

  return {
    sessionId: sessionRef.current?.sessionId,
    pagesVisited: sessionRef.current?.pagesVisited || 0,
    trackPageView,
    endSession
  };
};

export default useSessionTracker;
