import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FiltroTipoConteudo } from '@/features/gestor/components/engajamento/FiltroTipoConteudo';

/** Spec 2026-10-22-engajamento §12.4: filtro "Tipo de conteúdo" da aba Conteúdos. */
describe('FiltroTipoConteudo', () => {
  it('grupo rotulado "Tipo de conteúdo" com Todos, Vídeo e Documento, nessa ordem', () => {
    render(<FiltroTipoConteudo tipo="todos" setTipo={vi.fn()} />);
    const grupo = screen.getByRole('group', { name: 'Tipo de conteúdo' });
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Todos', 'Vídeo', 'Documento']);
  });

  it('só o tipo atual fica com aria-pressed', () => {
    const { rerender } = render(<FiltroTipoConteudo tipo="todos" setTipo={vi.fn()} />);
    const estado = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-pressed'));
    expect(estado()).toEqual(['true', 'false', 'false']);
    rerender(<FiltroTipoConteudo tipo="video" setTipo={vi.fn()} />);
    expect(estado()).toEqual(['false', 'true', 'false']);
    rerender(<FiltroTipoConteudo tipo="document" setTipo={vi.fn()} />);
    expect(estado()).toEqual(['false', 'false', 'true']);
  });

  it('Vídeo e Documento levam o ícone do tipo (play_circle e documents); Todos não', () => {
    render(<FiltroTipoConteudo tipo="todos" setTipo={vi.fn()} />);
    const [todos, video, documento] = screen.getAllByRole('button');
    expect(todos.querySelector('i')).toBeNull();
    expect(video.querySelector('i')?.className).toMatch(/play_circle/);
    expect(documento.querySelector('i')?.className).toMatch(/documents/);
  });

  it('clicar chama setTipo com o valor do banco (todos | video | document), que é o p_tipo da RPC', () => {
    const setTipo = vi.fn();
    render(<FiltroTipoConteudo tipo="todos" setTipo={setTipo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vídeo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Documento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(setTipo.mock.calls.map((c) => c[0])).toEqual(['video', 'document', 'todos']);
  });
});
