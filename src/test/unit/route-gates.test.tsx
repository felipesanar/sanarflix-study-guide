import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { GESTOR_NAV } from '@/experiences/gestor/GestorNav';
import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
import { PortalV2Gate, LegacyGestorGate } from '@/features/gestor/portalV2Gates';
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

  // Duplica (intencionalmente) a asserção de featureKey já coberta em
  // gestorFeatureGate.test.tsx: este arquivo é a guarda canônica consolidada
  // de regressão de gates por rota (aluno + gestor) — mantém a checagem aqui
  // mesmo que redundante, para que toda a garantia viva num único lugar.
  it('todo item da nav do gestor declara featureKey gestao.*', () => {
    for (const item of GESTOR_NAV) {
      expect(item.featureKey, `item ${item.url} sem featureKey`).toMatch(/^gestao\./);
    }
  });
});

describe('guarda de regressão: rotas do portal do gestor v2', () => {
  const filhasDeGestor = () =>
    gestorV2Routes().find((rota) => rota.path === '/gestor')?.children ?? [];

  it('as 3 rotas do portal v2 existem e declaram gate de feature', () => {
    const filhas = filhasDeGestor();
    const novas = ['visao-geral', 'detalhamento'];
    for (const path of novas) {
      const rota = filhas.find((f) => f.path === path);
      expect(rota, `rota /gestor/${path} não montada`).toBeDefined();
      expect(
        (rota!.element as React.ReactElement).type,
        `rota /gestor/${path} sem PortalV2Gate`,
      ).toBe(PortalV2Gate);
    }
    // A index (/gestor) é gated pelo próprio switch de árvore.
    expect(filhas.some((f) => f.index)).toBe(true);
  });

  it('nenhuma filha de /gestor fica sem gate (nova ou legada)', () => {
    for (const filha of filhasDeGestor()) {
      if (filha.index) continue;
      const tipo = (filha.element as React.ReactElement).type;
      expect(
        [PortalV2Gate, LegacyGestorGate].includes(tipo as never),
        `rota /gestor/${filha.path} montada sem gate — adicione o gate`,
      ).toBe(true);
    }
  });
});
