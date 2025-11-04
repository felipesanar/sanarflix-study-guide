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
const IntensivoEnamedUSCS = lazy(() => import("./pages/IntensivoEnamedUSCS"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));

const queryClient = new QueryClient();

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
          <PageTransition>
            <div className="p-4 md:p-6 animate-fade-in">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Header skeleton */}
                <div className="space-y-3">
                  <Skeleton className="h-8 w-48 rounded-lg" />
                  <Skeleton className="h-4 w-72 rounded-lg" />
                </div>
                
                {/* Cards grid skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="space-y-3 p-4 border border-border rounded-lg bg-card">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <Skeleton className="h-6 w-full rounded-lg" />
                      <Skeleton className="h-4 w-3/4 rounded-lg" />
                    </div>
                  ))}
                </div>
                
                {/* Content skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-[200px] w-full rounded-lg" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-[160px] rounded-lg" />
                    <Skeleton className="h-[160px] rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </PageTransition>
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
                <PageTransition>
                  <Home />
                </PageTransition>
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
                  <PageTransition>
                    <StudyGuide />
                  </PageTransition>
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
                  <PageTransition>
                    <SimuladoDesempenho />
                  </PageTransition>
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
                  <PageTransition>
                    <Dashboard />
                  </PageTransition>
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
                  <PageTransition>
                    <IntensivaoEnamed />
                  </PageTransition>
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
                  <PageTransition>
                    <CronogramaEnamed />
                  </PageTransition>
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
                  <PageTransition>
                    <UserManagement />
                  </PageTransition>
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
                  <PageTransition>
                    <IntensivoEnamedUSCS />
                  </PageTransition>
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
                <PageTransition>
                  <Analytics />
                </PageTransition>
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
