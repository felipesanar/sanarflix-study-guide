import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';

const Sonda = () => <span data-testid="search">{useLocation().search}</span>;

const renderizar = (url = '/gestor/visao-geral') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FiltroSemestre />
      <Sonda />
    </MemoryRouter>,
  );

const indicador = () => screen.getByTestId('filtro-semestre-indicador');

describe('FiltroSemestre (spec §4.5)', () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('tem as 3 opções, seleção única, com 6º ano marcada por padrão', () => {
    renderizar();
    const grupo = screen.getByRole('radiogroup', { name: /semestre/i });
    const opcoes = screen.getAllByRole('radio');
    expect(grupo).toBeInTheDocument();
    expect(opcoes.map((o) => o.textContent)).toEqual([
      '6º ano (Padrão)',
      'Geral',
      'Por semestre',
    ]);
    expect(screen.getByRole('radio', { name: '6º ano (Padrão)' })).toHaveAttribute('aria-checked', 'true');
    expect(opcoes.filter((o) => o.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('o indicador DESLIZA por transform (não pisca): 0% → 100% → 200%', () => {
    renderizar();
    expect(indicador().style.transform).toBe('translateX(0%)');
    expect(indicador().className).toContain('transition-transform');

    fireEvent.click(screen.getByRole('radio', { name: 'Geral' }));
    expect(indicador().style.transform).toBe('translateX(100%)');

    fireEvent.click(screen.getByRole('radio', { name: 'Por semestre' }));
    expect(indicador().style.transform).toBe('translateX(200%)');
  });

  it('escreve a escolha na URL', () => {
    renderizar();
    fireEvent.click(screen.getByRole('radio', { name: 'Geral' }));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=geral');
    fireEvent.click(screen.getByRole('radio', { name: '6º ano (Padrão)' }));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=6ano');
  });

  it('"Por semestre" revela o dropdown 1º…12º e escolher escreve o número na URL', async () => {
    renderizar();
    expect(screen.queryByRole('combobox')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Por semestre' }));
    const combo = screen.getByRole('combobox', { name: /semestre específico/i });
    expect(combo).toBeInTheDocument();
    expect(screen.getByTestId('search').textContent).toBe('?semestre=1');

    fireEvent.click(combo);
    const opcao = await screen.findByText('3º', { selector: '[role="option"] *, [role="option"]' });
    fireEvent.click(opcao);
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?semestre=3');
    });
  });

  it('URL com semestre numérico já abre no 3º segmento com o dropdown visível', () => {
    renderizar('/gestor/visao-geral?semestre=11');
    expect(screen.getByRole('radio', { name: 'Por semestre' })).toHaveAttribute('aria-checked', 'true');
    expect(indicador().style.transform).toBe('translateX(200%)');
    expect(screen.getByRole('combobox', { name: /semestre específico/i })).toBeInTheDocument();
  });

  it('navegação por teclado: setas movem a seleção e o foco (roving tabIndex)', () => {
    renderizar();
    const seisAno = screen.getByRole('radio', { name: '6º ano (Padrão)' });
    expect(seisAno).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Geral' })).toHaveAttribute('tabindex', '-1');

    seisAno.focus();
    fireEvent.keyDown(seisAno, { key: 'ArrowRight' });
    const geral = screen.getByRole('radio', { name: 'Geral' });
    expect(geral).toHaveAttribute('aria-checked', 'true');
    expect(geral).toHaveFocus();
    expect(screen.getByTestId('search').textContent).toBe('?semestre=geral');

    fireEvent.keyDown(geral, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '6º ano (Padrão)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('search').textContent).toBe('?semestre=6ano');
  });

  it('disabled: nada é clicável e a URL não muda', () => {
    render(
      <MemoryRouter initialEntries={['/gestor/visao-geral']}>
        <FiltroSemestre disabled />
        <Sonda />
      </MemoryRouter>,
    );
    const geral = screen.getByRole('radio', { name: 'Geral' });
    expect(geral).toBeDisabled();
    fireEvent.click(geral);
    expect(screen.getByTestId('search').textContent).toBe('');
  });
});
