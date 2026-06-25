import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getExperience } from '@/utils/experiences';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';

const NotFound = lazy(() => import('@/pages/NotFound'));

/**
 * Monta a lista de rotas (RouteObject[]) da aplicação para o usuário atual.
 *
 * Função pura de `(user, accessRules)`: resolve a experiência do usuário
 * ({@link getExperience}) e delega ao módulo de rotas da experiência. Sempre
 * encerra com o catch-all (`*`) que renderiza o NotFound.
 *
 * Nesta fase apenas a experiência Aluno + Professor possui módulo de rotas
 * próprio; as demais (admin, atendimento, gestão) recebem seus módulos em
 * tasks subsequentes do F1 e, por ora, contam apenas com o catch-all.
 */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
): RouteObject[] => {
  const experience = getExperience(user);

  const experienceRoutes: RouteObject[] =
    experience === 'aluno_professor' ? alunoRoutes(user, accessRules) : [];

  return [
    ...experienceRoutes,
    {
      path: '*',
      element: (
        <ExperiencePage waitForData={false}>
          <NotFound />
        </ExperiencePage>
      ),
    },
  ];
};
