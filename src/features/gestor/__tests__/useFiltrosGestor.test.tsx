import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, renderHook, act, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { SidebarNav } from '@/features/gestor/shell/SidebarNav';

const Sonda = () => {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <span data-testid="search">{search}</span>
    </>
  );
};

const comUrl = (url: string) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      {children}
      <Sonda />
    </MemoryRouter>
  );
  return renderHook(() => useFiltrosGestor(), { wrapper });
};

describe('useFiltrosGestor (spec §4.5, §8.2)', () => {
  it('semestre default é 6ano quando a URL não diz nada', () => {
    const { result } = comUrl('/gestor/visao-geral');
    expect(result.current.semestre).toBe('6ano');
    expect(result.current.simulados).toEqual([]);
    expect(result.current.iesId).toBeNull();
  });

  it('lê uma URL preexistente', () => {
    const { result } = comUrl('/gestor/detalhamento?semestre=11&simulados=s1,s2&ies=ies-9');
    expect(result.current.semestre).toBe('11');
    expect(result.current.simulados).toEqual(['s1', 's2']);
    expect(result.current.iesId).toBe('ies-9');
  });

  it('valor inválido de semestre cai no default, sem quebrar', () => {
    const { result } = comUrl('/gestor?semestre=13');
    expect(result.current.semestre).toBe('6ano');
  });

  it('setSemestre reflete na URL', () => {
    const { result } = comUrl('/gestor/visao-geral');
    act(() => result.current.setSemestre('geral'));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=geral');
    act(() => result.current.setSemestre('7'));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=7');
    expect(result.current.semestre).toBe('7');
  });

  it('simulados vão e voltam como csv; lista vazia remove a chave', () => {
    const { result } = comUrl('/gestor/detalhamento');
    act(() => result.current.setSimulados(['s1', 's2', 's3']));
    expect(screen.getByTestId('search').textContent).toBe('?simulados=s1%2Cs2%2Cs3');
    expect(result.current.simulados).toEqual(['s1', 's2', 's3']);

    act(() => result.current.setSimulados([]));
    expect(screen.getByTestId('search').textContent).toBe('');
    expect(result.current.simulados).toEqual([]);
  });

  it('setIesId preserva os outros filtros', () => {
    const { result } = comUrl('/gestor/visao-geral?semestre=geral');
    act(() => result.current.setIesId('ies-2'));
    expect(result.current.semestre).toBe('geral');
    expect(result.current.iesId).toBe('ies-2');
  });

  it('trocar de rota pela nav preserva os filtros (caso de teste 12 da spec §12)', () => {
    const Tela = () => {
      const { semestre, simulados } = useFiltrosGestor();
      return <span data-testid="filtros">{`${semestre}|${simulados.join('+')}`}</span>;
    };

    render(
      <MemoryRouter initialEntries={['/gestor/visao-geral?semestre=11&simulados=s1,s2']}>
        <SidebarNav />
        <Routes>
          <Route path="/gestor/visao-geral" element={<Tela />} />
          <Route path="/gestor/detalhamento" element={<Tela />} />
        </Routes>
        <Sonda />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('filtros').textContent).toBe('11|s1+s2');
    fireEvent.click(screen.getByRole('link', { name: 'Detalhamento' }));
    expect(screen.getByTestId('path').textContent).toBe('/gestor/detalhamento');
    expect(screen.getByTestId('filtros').textContent).toBe('11|s1+s2');
  });
});
