import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useWebVitals } from "@/hooks/usePerformance";
import { LoginForm } from '@/components/LoginForm';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { ScrollManager } from '@/components/ScrollManager';
import { useIntelligentPrefetch } from '@/hooks/useIntelligentPrefetch';
import { DynamicRoutes } from '@/components/DynamicRoutes';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import { FeedbackDock } from '@/components/feedback/FeedbackDock';
import { useFeedbackShortcut } from '@/hooks/useFeedbackShortcut';
import { useFeedbackResponseToast } from '@/components/feedback/useFeedbackResponseToast';

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const SignupB2C = lazy(() => import("./pages/SignupB2C").then(m => ({ default: m.SignupB2C })));
const ResendWelcome = lazy(() => import("./pages/ResendWelcome"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutos - dados são considerados "fresh"
      gcTime: 60 * 60 * 1000, // 1 hora - mantém em cache mesmo inativo
      refetchOnWindowFocus: false,
      refetchOnReconnect: false, // Não revalidar em reconexão
      refetchOnMount: false, // Não revalidar ao montar se há cache
      retry: 1,
    },
  },
});

const AppContent = () => {
  const { user, isLoading } = useAuth();

  // Sistema de prefetch inteligente baseado em probabilidade
  useIntelligentPrefetch();

  // Prefetch de dados das rotas adjacentes
  useDataPrefetch();

  // Keep password recovery routes accessible even if a session is auto-created
  // while processing recovery tokens.
  const isUpdatePasswordPage = window.location.pathname === '/auth/update-password';
  const isResetPasswordPage = window.location.pathname === '/reset-password';

  // Enquanto a sessão restaura (cold load), não renderizar a árvore pública:
  // o catch-all dela redirecionaria para '/' e perderia a URL de entrada
  // (ex.: usuário digitando /gestor direto). O splash preserva a rota até o
  // auth resolver.
  if (isLoading && !user && !isUpdatePasswordPage && !isResetPasswordPage) {
    return <div className="min-h-screen bg-background" />;
  }

  // Rotas públicas (usuário não autenticado OR recovery flow pages)
  if (!user || isUpdatePasswordPage || isResetPasswordPage) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          {/* Raiz serve o login para não autenticados (a Home autenticada
              também vive em '/'). A rota legada '/login' redireciona para '/'. */}
          <Route path="/" element={<LoginForm />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/auth/resend" element={<ResendWelcome />} />
          <Route path="/cadastro-b2c" element={<SignupB2C />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Rotas protegidas (usuário autenticado)
  // DynamicRoutes usa useAccessRules para controle dinâmico baseado em ies_features.
  // ImpersonationBanner e FeedbackFab vivem aqui (fora de qualquer shell de
  // experiência) para persistirem em TODAS as experiências (aluno/admin/gestão/
  // atendimento) — cada portal tem seu próprio shell full-page independente,
  // montado dentro de DynamicRoutes (ver buildAppRoutes).
  return (
    <StudyProvider>
      <FeedbackProvider>
        <FeedbackShortcutBridge />
        <FeedbackResponseToastBridge />
        <ImpersonationBanner />
        <DynamicRoutes />
        <FeedbackDock />
      </FeedbackProvider>
    </StudyProvider>
  );
};

function FeedbackShortcutBridge() {
  useFeedbackShortcut();
  return null;
}

function FeedbackResponseToastBridge() {
  useFeedbackResponseToast();
  return null;
}

const App = () => {
  // Monitorar Web Vitals
  useWebVitals();

  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has('reset-cache')) {
      (async () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          if ((indexedDB as any)?.databases) {
            const dbs = await (indexedDB as any).databases();
            await Promise.all((dbs || []).map((db: any) => db?.name && indexedDB.deleteDatabase(db.name)));
          }
          if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
          }
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
        } finally {
          const url = new URL(window.location.href);
          sp.delete('reset-cache');
          url.search = sp.toString();
          window.location.replace(url.toString());
        }
      })();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollManager />
            <AuthProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
