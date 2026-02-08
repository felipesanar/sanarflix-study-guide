import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { PasswordChangeModal } from '@/components/PasswordChangeModal';
import { PageWrapper } from '@/components/PageWrapper';
import { HomePageSkeleton, StudyGuideSkeleton, DashboardSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy imports
const StudyGuide = lazy(() => import("@/pages/StudyGuide").then(m => ({ default: m.StudyGuide })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })));
const SimuladoDesempenho = lazy(() => import("@/pages/SimuladoDesempenho").then(m => ({ default: m.SimuladoDesempenho })));
const Simulados = lazy(() => import("@/pages/Simulados"));
const ModoProva = lazy(() => import("@/pages/ModoProva"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallback"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const SanarClass = lazy(() => import("@/pages/SanarClass"));
const Home = lazy(() => import("@/pages/Home").then(m => ({ default: m.Home })));


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

/**
 * Componente de rotas dinâmicas que usa useAccessRules
 * para controlar acesso baseado em ies_features do banco de dados.
 * 
 * Hierarquia de permissões:
 * 1. Admin → acesso total (não usa ies_features)
 * 2. Professor → regras de professor (não usa ies_features)
 * 3. Aluno B2B → features dinâmicas da tabela ies_features
 */
export const DynamicRoutes: React.FC = () => {
  const { needsPasswordChange } = useAuth();
  const { accessRules, loading } = useAccessRules();

  // Mostrar skeleton enquanto carrega as features do banco
  // Isso evita "flash" de redirecionamento incorreto
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48 mx-auto" />
            <Skeleton className="h-3 w-32 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Rota padrão baseada nas permissões dinâmicas
  const getDefaultRoute = () => {
    return accessRules.home ? "/home" : "/simulados";
  };

  return (
    <>
      <PasswordChangeModal isOpen={needsPasswordChange} />
      <Suspense fallback={<HomePageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Navigate to={getDefaultRoute()} replace />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Home Page - Controlado dinamicamente por ies_features */}
          {accessRules.home ? (
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <PageWrapper
                    loadingMessage="Carregando início..."
                    waitForData={true}
                    skeleton={<HomePageSkeleton />}
                  >
                    <Home />
                  </PageWrapper>
                </ProtectedRoute>
              }
            />
          ) : (
            <Route path="/home" element={<Navigate to="/simulados" replace />} />
          )}

          {/* Study Guide - Controlado dinamicamente por ies_features */}
          {accessRules.studyGuide ? (
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
          ) : (
            <Route path="/guia-estudos" element={<Navigate to="/simulados" replace />} />
          )}

          {/* Rota de Simulados - Sempre disponível para usuários autenticados */}
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

          {/* Desempenho Simulado - Controlado dinamicamente */}
          {accessRules.SimuladoDesempenho ? (
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
          ) : (
            <Route path="/desempenho-simulado" element={<Navigate to="/simulados" replace />} />
          )}

          {/* Dashboard - Controlado dinamicamente */}
          {accessRules.dashboard ? (
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
          ) : (
            <Route path="/dashboard" element={<Navigate to="/simulados" replace />} />
          )}

          {/* User Management - Controlado dinamicamente (somente admin) */}
          {accessRules.userManagement ? (
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
          ) : (
            <Route path="/gestao-usuarios" element={<Navigate to="/simulados" replace />} />
          )}

          {/* Analytics - Controlado dinamicamente */}
          {accessRules.analytics ? (
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
          ) : (
            <Route path="/analytics" element={<Navigate to="/simulados" replace />} />
          )}

          {/* SanarClass - Controlado dinamicamente */}
          {accessRules.sanarclass ? (
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
          ) : (
            <Route path="/sanarclass" element={<Navigate to="/simulados" replace />} />
          )}


          <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};
