import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import { deriveAccessFromRoles } from '@/experiences/access';
import type { Access } from '@/experiences/access';

const gestorAccess: Access = {
  experiences: ['aluno', 'gestao'],
  capabilities: ['institutional.view', 'alunos.view'],
} as Access;

describe('GestorNav sem gate por feature (removido em 06/08 — ver GestorIndexRedirect)', () => {
  it('filterGestorNav filtra só por capability, não por feature da IES', () => {
    const items = filterGestorNav(GESTOR_NAV, gestorAccess);
    expect(items.map((i) => i.url)).toEqual(GESTOR_NAV.map((i) => i.url));
  });

  it('gestor (institutional.view + alunos.view) vê todos os módulos', () => {
    const access = deriveAccessFromRoles(['gestor']);
    expect(filterGestorNav(GESTOR_NAV, access)).toHaveLength(GESTOR_NAV.length);
  });
});

describe('GestorIndexRedirect', () => {
  it('sempre redireciona para /gestor/visao-institucional, preservando a querystring', () => {
    render(
      <MemoryRouter initialEntries={['/gestor?iesId=abc']}>
        <Routes>
          <Route path="/gestor" element={<GestorIndexRedirect />} />
          <Route path="/gestor/visao-institucional" element={<div>visão institucional</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('visão institucional')).toBeInTheDocument();
  });
});
