import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
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
});
