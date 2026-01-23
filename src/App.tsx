import * as React from "react";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useWebVitals } from "@/hooks/usePerformance";
import { AppSidebar } from '@/components/AppSidebar';
import { Layout } from '@/components/Layout';
import { LoginForm } from '@/components/LoginForm';
import { AuthCallback } from '@/components/AuthCallback';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';
import { AuthWrapper } from '@/components/AuthWrapper';
import { getAccessRules } from '@/utils/accessRules';
import { useDataPrefetch } from '@/hooks/useDataPrefetch';
const StudyGuide = lazy(() => import("./pages/StudyGuide").then(m => ({ default: m.StudyGuide })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const IntensivaoEnamed = lazy(() => import("./pages/IntensivaoEnamed").then(m => ({ default: m.IntensivaoEnamed })));
const SimuladoDesempenho = lazy(() => import("./pages/SimuladoDesempenho").then(m => ({ default: m.SimuladoDesempenho })));
const Simulados = lazy(() => import("./pages/Simulados"));
const ModoProva = lazy(() => import("./pages/ModoProva"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SignupB2C = lazy(() => import("./pages/SignupB2C").then(m => ({ default: m.SignupB2C })));
const CronogramaEnamed = lazy(() => import("./pages/CronogramaEnamed").then(m => ({ default: m.CronogramaEnamed })));
import { ThemeProvider } from "next-themes";
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollManager } from '@/components/ScrollManager';
import { useIntelligentPrefetch } from '@/hooks/useIntelligentPrefetch';
import { PageTransition } from '@/components/PageTransition';
import { PageWrapper } from '@/components/PageWrapper';
import { PageLoader } from '@/components/PageLoader';
import { HomePageSkeleton, StudyGuideSkeleton, DashboardSkeleton, IntensivaoSkeleton } from '@/components/skeletons';
const IntensivoEnamedUSCS = lazy(() => import("./pages/IntensivoEnamedUSCS"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SanarClass = lazy(() => import("./pages/SanarClass"));
const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));

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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { user } = useAuth();
  const accessRules = getAccessRules(user);

  // Sistema de prefetch inteligente baseado em probabilidade
  useIntelligentPrefetch();

  // Prefetch de dados das rotas adjacentes
  useDataPrefetch();
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/update-password" element={<UpdatePassword />} />
        <Route path="/cadastro-b2c" element={<SignupB2C />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Redirect authenticated users to Simulados
  const getDefaultRoute = () => {
    return "/simulados";
  };

  return (
    <StudyProvider>
      <Layout>
        <Suspense fallback={<HomePageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Navigate to={getDefaultRoute()} replace />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Home Page - Redirect to Simulados */}
            <Route path="/home" element={<Navigate to="/simulados" replace />} />

            {accessRules.studyGuide && (
              <Route
                path="/guia-estudos"
                element={
                  <ProtectedRoute>
                    <PageWrapper
                      loadingMessage="Carregando guia de estudos..."
                      waitForData={true}
                      skeleton={<StudyGuideSkeleton />}
                    >
                      <StudyGuide />
                    </PageWrapper>
                  </ProtectedRoute>
                }
              />
            )}

            {/* Rota de Simulados */}
            <Route
              path="/simulados"
              element={
                <ProtectedRoute>
                  <PageWrapper
                    loadingMessage="Carregando simulados..."
                    waitForData={true}
                  >
                    <Simulados />
                  </PageWrapper>
                </ProtectedRoute>
              }
            />

            {/* Modo Prova - Sem Layout */}
            <Route
              path="/simulados/:id/prova"
              element={
                <ProtectedRoute>
                  <ModoProva />
                </ProtectedRoute>
              }
            />

            {accessRules.SimuladoDesempenho && (
              <Route
                path="/desempenho-simulado"
                element={
                  <ProtectedRoute>
                    <PageWrapper
                      loadingMessage="Carregando desempenho..."
                      waitForData={true}
                    >
                      <SimuladoDesempenho />
                    </PageWrapper>
                  </ProtectedRoute>
                }
              />
            )}

            {accessRules.dashboard && (
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <PageWrapper
                      loadingMessage="Carregando dashboard..."
                      waitForData={true}
                      skeleton={<DashboardSkeleton />}
                    >
                      <Dashboard />
                    </PageWrapper>
                  </ProtectedRoute>
                }
              />
            )}

            {/* Intensivão ENAMED - Temporariamente desabilitado */}

            {accessRules.cronogramaEnamed && (
              <Route
                path="/cronograma-enamed"
                element={
                  <ProtectedRoute>
                    <PageWrapper
                      loadingMessage="Carregando cronograma..."
                      waitForData={true}
                      skeleton={<IntensivaoSkeleton />}
                    >
                      <CronogramaEnamed />
                    </PageWrapper>
                  </ProtectedRoute>
                }
              />
            )}

            {accessRules.userManagement && (
              <Route
                path="/gestao-usuarios"
                element={
                  <ProtectedRoute>
                    <PageWrapper
                      loadingMessage="Carregando gestão..."
                      waitForData={true}
                    >
                      <UserManagement />
                    </PageWrapper>
                  </ProtectedRoute>
                }
              />
            )}

            {accessRules.intensivoUSCS && (
              <Route
                path="/intensivo-uscs"
                element={
                  <ProtectedRoute>
                    <PageWrapper
                      loadingMessage="Carregando intensivo USCS..."
                      waitForData={true}
                    >
                      <IntensivoEnamedUSCS />
                    </PageWrapper>
                  </ProtectedRoute>
                }
              />
            )}

            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <PageWrapper
                    loadingMessage="Carregando analytics..."
                    waitForData={true}
                  >
                    <Analytics />
                  </PageWrapper>
                </ProtectedRoute>
              }
            />

            {/* SanarClass - Available for all authenticated users */}
            <Route
              path="/sanarclass"
              element={
                <ProtectedRoute>
                  <PageWrapper
                    loadingMessage="Carregando SanarClass..."
                    waitForData={true}
                  >
                    <SanarClass />
                  </PageWrapper>
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </StudyProvider>
  );
};

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
                <AuthWrapper>
                  <AppContent />
                </AuthWrapper>
              </ErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
