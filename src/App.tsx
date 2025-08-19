
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppSidebar } from '@/components/AppSidebar';
import { Layout } from '@/components/Layout';
import { LoginForm } from '@/components/LoginForm';
import { AuthCallback } from '@/components/AuthCallback';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { StudyProvider } from '@/contexts/StudyContext';
import { AuthWrapper } from '@/components/AuthWrapper';
import { getAccessRules } from '@/utils/accessRules';
import { StudyGuide } from "./pages/StudyGuide";
import { Dashboard } from "./pages/Dashboard";
import { IntensivaoEnamed } from "./pages/IntensivaoEnamed";
import { SimuladoDesempenho } from "./pages/SimuladoDesempenho";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  console.log('ProtectedRoute: isLoading:', isLoading, 'user:', user ? user.email : 'No user');

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

  console.log('AppContent: User state:', user ? user.email : 'No user');
  console.log('AppContent: Access rules:', accessRules);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Determine default route for launch: only Intensivão ENAMED
  const getDefaultRoute = () => "/intensivao-enamed";

  return (
    <StudyProvider>
      <Routes>
        <Route path="/login" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

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

        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StudyProvider>
  );
};

const App = () => (
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
);

export default App;
