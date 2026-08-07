import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import type { AccessRules, User } from '@/types';

const ALL_OFF: AccessRules = {
  home: false, studyGuide: false, dashboard: false, SimuladoDesempenho: false,
  userManagement: false, sanarclass: false, simulados: false,
  desempenhoInstitucional: false, errorNotebook: false,
};

const aluno: User = {
  id: 'u1', email: 'a@a.com', nome: 'Aluno', id_ies: 'ies1', ies_nome: 'IES', roles: [],
};

/** Rotas do aluno deliberadamente SEM gate por feature (decisão documentada na spec). */
const ALUNO_UNGATED_ALLOWLIST = ['/meus-feedbacks'];

describe('guarda de regressão: toda rota nova precisa declarar gate', () => {
  it('com todas as features off, toda rota do aluno (fora da allowlist) redireciona', () => {
    const routes = alunoRoutes(aluno, ALL_OFF, { experiences: ['aluno'], capabilities: [] } as never);
    for (const route of routes) {
      if (ALUNO_UNGATED_ALLOWLIST.includes(route.path ?? '')) continue;
      const el = route.element as React.ReactElement;
      expect(el.type, `rota ${route.path} montada sem gate — adicione o gate ou inclua na allowlist`).toBe(Navigate);
    }
  });

  // Task 64 (cleanup, 05/08): removida a checagem "todo item da nav do
  // gestor declara featureKey gestao.*" — testava `GESTOR_NAV`/
  // `filterGestorNav` da experiência legada (`experiences/gestor/GestorNav.ts`),
  // apagada nesta mesma tarefa junto com toda a experiência legada (GA total
  // no merge, sem piloto — não sobrou "outro lado" para o gate escolher). O
  // portal novo (`features/gestor/shell/SidebarNav.tsx`, `GESTOR_V2_NAV`) não
  // faz gate por feature por item de nav; o teste abaixo cobre o gate que
  // sobrou (`ExperienceGuard`, um só, para a árvore inteira de `/gestor`).
});

describe('guarda de regressão: rota do portal do gestor v2', () => {
  it('/gestor é montada com ExperienceGuard — único gate que resta na árvore (o gate por feature gestao.portal_v2 foi removido na Task 64)', () => {
    const rotaGestor = gestorV2Routes().find((rota) => rota.path === '/gestor');
    expect(rotaGestor, 'rota /gestor não montada').toBeDefined();
    const el = rotaGestor!.element as React.ReactElement<{ experience?: string }>;
    expect(el.type, 'rota /gestor montada sem ExperienceGuard').toBe(ExperienceGuard);
    expect(el.props.experience).toBe('gestao');
  });

  // A forma detalhada da árvore (3 rotas-filha, ausência de gate por rota,
  // redirects de compatibilidade) tem suíte própria e mais completa em
  // src/features/gestor/__tests__/gestorV2Routes.test.tsx — não duplicada
  // aqui para não manter dois lugares divergindo quando a árvore mudar de novo.
});
