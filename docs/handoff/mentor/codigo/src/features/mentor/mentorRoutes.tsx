/**
 * Rotas do Portal do Mentor — mesmo padrão de `features/gestor/gestorV2Routes.tsx`.
 *
 * Um `/mentor` protegido por ExperienceGuard; o MENU muda por modalidade
 * (pendência P8: confirmar que o mentor B2B tem menu próprio e não entra no
 * /gestor). Rotas que não existem na modalidade redirecionam para o Início.
 */
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { MentorShell } from '@/features/mentor/shell/MentorShell';
import { SoModalidade } from '@/features/mentor/shell/SoModalidade';

const Inicio = lazy(() => import('@/features/mentor/routes/Inicio'));
const MinhaTurma = lazy(() => import('@/features/mentor/routes/MinhaTurma')); // B2C
const VisaoGeral = lazy(() => import('@/features/mentor/routes/VisaoGeral')); // B2B
const Detalhamento = lazy(() => import('@/features/mentor/routes/Detalhamento'));
const Mural = lazy(() => import('@/features/mentor/routes/Mural')); // B2C (no B2B vive em Canais)
const Sessoes = lazy(() => import('@/features/mentor/routes/Sessoes'));
const Canais = lazy(() => import('@/features/mentor/routes/Canais')); // B2B
const Intervencoes = lazy(() => import('@/features/mentor/routes/Intervencoes'));

export const mentorRoutes = (): RouteObject[] => [
  {
    path: '/mentor',
    element: (
      // TODO: confirmar o nome da experiência no ExperienceGuard ('mentoria'?).
      <ExperienceGuard experience="mentoria">
        <MentorShell />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Inicio /> },
      { path: 'turma', element: <SoModalidade b2c><MinhaTurma /></SoModalidade> },
      { path: 'visao-geral', element: <SoModalidade b2b><VisaoGeral /></SoModalidade> },
      { path: 'detalhamento', element: <Detalhamento /> },
      { path: 'mural', element: <SoModalidade b2c><Mural /></SoModalidade> },
      { path: 'sessoes', element: <Sessoes /> },
      { path: 'canais', element: <SoModalidade b2b><Canais /></SoModalidade> },
      { path: 'intervencoes', element: <Intervencoes /> },
      { path: '*', element: <Navigate to="/mentor" replace /> },
    ],
  },
];

/**
 * Itens de menu por modalidade (capturas/b2c/01, capturas/b2b/01).
 * `badge` só com pendência real (docs/01 §Shell).
 */
export const MENU_MENTOR = {
  b2c: [
    { to: '/mentor', rotulo: 'Início', icone: 'home' },
    { grupo: 'Minha mentoria' },
    { to: '/mentor/turma', rotulo: 'Minha Turma', icone: 'group' },
    { to: '/mentor/detalhamento', rotulo: 'Detalhamento por Simulados', icone: 'bar_chart' },
    { to: '/mentor/mural', rotulo: 'Mural', icone: 'campaign' },
    { to: '/mentor/sessoes', rotulo: 'Sessões', icone: 'calendar_month' },
    { to: '/mentor/intervencoes', rotulo: 'Intervenções', icone: 'view_kanban', badge: 'intervencoesAFazer' },
  ],
  b2b: [
    { to: '/mentor', rotulo: 'Início', icone: 'home' },
    { grupo: 'Minha mentoria' },
    { to: '/mentor/visao-geral', rotulo: 'Visão Geral', icone: 'bar_chart' },
    { to: '/mentor/detalhamento', rotulo: 'Detalhamento por Simulados', icone: 'assignment' },
    { to: '/mentor/sessoes', rotulo: 'Sessões', icone: 'calendar_month' },
    { to: '/mentor/canais', rotulo: 'Canais', icone: 'chat', badge: 'rotinaPendenteHoje' },
    { to: '/mentor/intervencoes', rotulo: 'Intervenções', icone: 'view_kanban', badge: 'intervencoesAFazer' },
  ],
} as const;
// Nomes de ícone: conferir em features/gestor/components/icon-names.ts (dende-icons).
