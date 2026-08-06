import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

const Inicio = lazy(() => import('@/features/gestor/routes/Inicio'));
const VisaoGeral = lazy(() => import('@/features/gestor/routes/VisaoGeral'));
const Detalhamento = lazy(() => import('@/features/gestor/routes/Detalhamento'));

/**
 * Árvore de rotas da experiência Gestão (spec §7.5, §9 — GA total, Task 64).
 *
 * Um único `/gestor`, protegido por {@link ExperienceGuard} (esse continua
 * sendo o único gate: separa a experiência de gestão de aluno/admin/CX). Não
 * há mais gate por feature aqui dentro — `gestao.portal_v2` decidia entre o
 * portal novo (`GestorShell`) e a experiência legada (`GestorLayout`, 5 telas
 * antigas), e deixou de existir: no merge desta tarefa, TODOS os gestores de
 * TODAS as IES passam a receber só o portal novo, sem piloto e sem GA por
 * lotes. A experiência legada (`src/experiences/gestor/**`) e o mecanismo de
 * gate (`portalV2Gates.tsx`) foram apagados — não há para onde "cair" mais.
 *
 * A chave `gestao.portal_v2` continua existindo em `ies_features` no banco
 * (dado morto agora) — limpeza de banco é responsabilidade de outra tarefa,
 * não desta (fora do escopo de um agente que só mexe em frontend).
 *
 * Mantém os redirects de compatibilidade das URLs antigas do Desempenho
 * Institucional (pré-existentes a este portal, nada a ver com o gate).
 */
export const gestorV2Routes = (): RouteObject[] => [
  {
    path: '/gestor',
    element: (
      <ExperienceGuard experience="gestao">
        <GestorShell />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Inicio /> },
      { path: 'visao-geral', element: <VisaoGeral /> },
      { path: 'detalhamento', element: <Detalhamento /> },

      /*
       * As 5 URLs das telas antigas, mantidas como redirect e não deixadas
       * cair no 404 (decisão do Felipe, 05/08). Elas foram servidas em
       * produção enquanto o console legado existiu: gestor com link salvo,
       * e-mail antigo ou aba fixada bateria numa tela de erro exatamente no
       * dia do merge, que é o pior momento possível para ele descobrir que a
       * experiência mudou. Vão para o Início, que é a porta do portal novo.
       *
       * Não são permanentes: saem quando o acesso a elas zerar na telemetria.
       */
      { path: 'visao-institucional', element: <Navigate to="/gestor" replace /> },
      { path: 'diagnostico-curricular', element: <Navigate to="/gestor" replace /> },
      { path: 'alunos', element: <Navigate to="/gestor" replace /> },
      { path: 'insights-pedagogicos', element: <Navigate to="/gestor" replace /> },
      { path: 'inteligencia-decisoria', element: <Navigate to="/gestor" replace /> },
    ],
  },

  // Redirects de compatibilidade (Desempenho Institucional → experiência Gestão).
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
];
