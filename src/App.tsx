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
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
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
const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes era cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
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
        <Route path="/cadastro-b2c" element={<SignupB2C />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Redirect authenticated users to home
  const getDefaultRoute = () => {
    return "/home";
  };

  return (
    <StudyProvider>
      <Suspense fallback={
        <Layout>
          <HomePageSkeleton />
        </Layout>
      }>
      <Routes>
        <Route path="/login" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Home Page - Always available for authenticated users */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Layout>
                <PageWrapper 
                  loadingMessage="Carregando início..." 
                  minLoadTime={600} 
                  waitForData={true}
                  enforceMinTime={true}
                  skeleton={<HomePageSkeleton />}
                >
                  <Home />
                </PageWrapper>
              </Layout>
            </ProtectedRoute>
          }
        />

        {accessRules.studyGuide && (
          <Route
            path="/guia-estudos"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando guia de estudos..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                    skeleton={<StudyGuideSkeleton />}
                  >
                    <StudyGuide />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        {accessRules.SimuladoDesempenho && (
          <Route
            path="/desempenho-simulado"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando desempenho..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                  >
                    <SimuladoDesempenho />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        {accessRules.dashboard && (
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando dashboard..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                    skeleton={<DashboardSkeleton />}
                  >
                    <Dashboard />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        {accessRules.enamed && (
          <Route
            path="/intensivao-enamed"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando intensivão..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                    skeleton={<IntensivaoSkeleton />}
                  >
                    <IntensivaoEnamed />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        {accessRules.cronogramaEnamed && (
          <Route
            path="/cronograma-enamed"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando cronograma..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                    skeleton={<IntensivaoSkeleton />}
                  >
                    <CronogramaEnamed />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        {accessRules.userManagement && (
          <Route
            path="/gestao-usuarios"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando gestão..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                  >
                    <UserManagement />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        {accessRules.intensivoUSCS && (
          <Route
            path="/intensivo-uscs"
            element={
              <ProtectedRoute>
                <Layout>
                  <PageWrapper 
                    loadingMessage="Carregando intensivo USCS..." 
                    minLoadTime={600} 
                    waitForData={true}
                    enforceMinTime={true}
                  >
                    <IntensivoEnamedUSCS />
                  </PageWrapper>
                </Layout>
              </ProtectedRoute>
            }
          />
        )}

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Layout>
                <PageWrapper 
                  loadingMessage="Carregando analytics..." 
                  minLoadTime={600} 
                  waitForData={true}
                  enforceMinTime={true}
                >
                  <Analytics />
                </PageWrapper>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </StudyProvider>
  );
};

const App = () => {
  // Monitorar Web Vitals
  useWebVitals();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <BrowserRouter>
              <ScrollManager />
              <AuthProvider>
                <AuthWrapper>
                  <AppContent />
                </AuthWrapper>
              </AuthProvider>
            </BrowserRouter>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
