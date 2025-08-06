import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { StudyProvider } from "./contexts/StudyContext";
import { getAccessRules } from "./utils/accessRules";
import { AuthPage } from "./pages/AuthPage";
import { Layout } from "./components/Layout";
import { StudyGuide } from "./pages/StudyGuide";
import { Dashboard } from "./pages/Dashboard";
import { IntensivaoEnamed } from "./pages/IntensivaoEnamed";
import NotFound from "./pages/NotFound";

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
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { user } = useAuth();
  const accessRules = getAccessRules(user);

  // Determine default route based on user access
  const getDefaultRoute = () => {
    if (accessRules.studyGuide) return "/guia-estudos";
    if (accessRules.enamed) return "/intensivao-enamed";
    if (accessRules.dashboard) return "/dashboard";
    return "/guia-estudos"; // Fallback
  };

  return (
    <StudyProvider>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to={getDefaultRoute()} replace /> : <AuthPage />} />
        <Route path="/login" element={user ? <Navigate to={getDefaultRoute()} replace /> : <AuthPage />} />
        
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
        
        <Route path="/" element={user ? <Navigate to={getDefaultRoute()} replace /> : <AuthPage />} />
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
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;