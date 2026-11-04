/** Utilitários dos testes do drawer do aluno (fonte mock dos protótipos, sem latência). */
import * as React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { DrawerAlunoHost } from './DrawerAlunoHost';

export const EMAIL = {
  marina: 'marina.albuquerque@exemplo.com',
  caio: 'caio.menezes@exemplo.com',
  beatriz: 'beatriz.sampaio@exemplo.com',
  bruno: 'bruno.teles@exemplo.com',
  davi: 'davi.santana@exemplo.com',
};

function Localizacao() {
  const loc = useLocation();
  return <output data-testid="localizacao">{`${loc.pathname}${loc.search}`}</output>;
}

/** Gatilho fora do drawer: abre o aluno pela URL (como faz a tabela da Turma). */
function Gatilho({ email }: { email: string }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(`/mentor/turma?aluno=${encodeURIComponent(email)}`)}>Abrir aluno</button>;
}

export function renderDrawer(caminho: string, opcoes: { gatilho?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route path="*" element={<>{opcoes.gatilho && <Gatilho email={opcoes.gatilho} />}<DrawerAlunoHost /><Localizacao /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, qc };
}

export const urlAluno = (email: string) => `/mentor/turma?aluno=${encodeURIComponent(email)}`;
