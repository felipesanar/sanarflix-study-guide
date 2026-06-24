import * as React from 'react';
import { Suspense } from 'react';
import { useRoutes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import { PasswordChangeModal } from '@/components/PasswordChangeModal';
import { HomePageSkeleton } from '@/components/skeletons';

const RoutesLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

/**
 * Resolve a árvore de rotas autenticadas a partir da experiência do usuário.
 *
 * A composição das rotas por experiência vive em `buildAppRoutes`
 * (testável). Cada experiência (aluno, admin, gestor, atendimento) é uma
 * subárvore isolada por `ExperienceGuard`. A autenticação já é garantida em
 * `App.tsx`, que só monta este componente quando há `user`.
 */
export const DynamicRoutes: React.FC = () => {
  const { user, needsPasswordChange } = useAuth();
  const { accessRules, loading } = useAccessRules();
  const element = useRoutes(buildAppRoutes(user, accessRules));

  if (loading) return <RoutesLoading />;

  return (
    <>
      <PasswordChangeModal isOpen={needsPasswordChange} />
      <Suspense fallback={<HomePageSkeleton />}>{element}</Suspense>
    </>
  );
};
