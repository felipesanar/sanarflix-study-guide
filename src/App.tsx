
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
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
const IntensivoEnamedUSCS = lazy(() => import("./pages/IntensivoEnamedUSCS"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Home = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando...</p>
          </div>
        </div>
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
                <Home />
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
                  <StudyGuide />
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
                  <SimuladoDesempenho />
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
                  <Dashboard />
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
                  <IntensivaoEnamed />
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
                  <CronogramaEnamed />
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
                  <UserManagement />
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
                  <IntensivoEnamedUSCS />
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
                <Analytics />
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
