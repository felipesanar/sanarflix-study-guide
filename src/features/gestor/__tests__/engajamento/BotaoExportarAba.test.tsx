import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockVisao = vi.fn();
const mockQuestoes = vi.fn();
const mockConteudos = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoVisaoGeral: (...a: unknown[]) => mockVisao(...a),
  useEngajamentoQuestoes: (...a: unknown[]) => mockQuestoes(...a),
  useEngajamentoConteudos: (...a: unknown[]) => mockConteudos(...a),
}));

const mockBaixar = vi.fn();
vi.mock('@/features/gestor/lib/exportarCsv', async () => ({
  ...(await vi.importActual<typeof import('@/features/gestor/lib/exportarCsv')>('@/features/gestor/lib/exportarCsv')),
  baixarCsvSecoes: (...a: unknown[]) => mockBaixar(...a),
}));

import { BotaoExportarAba } from '@/features/gestor/components/engajamento/BotaoExportarAba';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { conteudosParacatu } from '../fixtures/engajamento/conteudos';
import { questoesParacatu } from '../fixtures/engajamento/questoes';
import { resultadoGestor, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';

/** Botão "Exportar" do cabeçalho nas 3 abas (spec §10.7, P16). */

const filtros = (extra: Partial<FiltrosEngajamento> = {}): FiltrosEngajamento => ({
  iesId: 'ies-1',
  periodo: '6m',
  de: null,
  ate: null,
  inicio: '2026-05-01',
  fim: '2026-10-22',
  semestre: null,
  alunoId: null,
  tipo: 'todos',
  setPeriodo: vi.fn(),
  setSemestre: vi.fn(),
  setAluno: vi.fn(),
  setTipo: vi.fn(),
  limparFiltroPagina: vi.fn(),
  ...extra,
});

const montar = (url: string, props: Partial<React.ComponentProps<typeof BotaoExportarAba>> = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <BotaoExportarAba filtros={props.filtros ?? filtros()} iesNome="PARACATU" {...props} />
    </MemoryRouter>,
  );

describe('BotaoExportarAba', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisao.mockReturnValue(resultadoGestor(visaoGeralParacatu()));
    mockQuestoes.mockReturnValue(resultadoGestor(questoesParacatu()));
    mockConteudos.mockReturnValue(resultadoGestor(conteudosParacatu()));
  });

  it('Visão geral: baixa as 8 seções com o nome gestor-engajamento-visao-geral-paracatu-…', () => {
    montar('/gestor/engajamento?ies=ies-1');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(mockBaixar).toHaveBeenCalledTimes(1);
    const [nome, secoes] = mockBaixar.mock.calls[0];
    expect(nome).toMatch(/^gestor-engajamento-visao-geral-paracatu-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(secoes).toHaveLength(8);
    expect(mockQuestoes).not.toHaveBeenCalled();
    expect(mockConteudos).not.toHaveBeenCalled();
  });

  it('Questões: só consulta a aba de Questões e baixa as 4 seções', () => {
    montar('/gestor/engajamento/questoes?ies=ies-1');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const [nome, secoes] = mockBaixar.mock.calls[0];
    expect(nome).toMatch(/^gestor-engajamento-questoes-paracatu-/);
    expect(secoes).toHaveLength(4);
    expect(mockVisao).not.toHaveBeenCalled();
    expect(mockConteudos).not.toHaveBeenCalled();
  });

  it('Conteúdos: baixa as 4 seções, com o tipo do filtro no recorte', () => {
    montar('/gestor/engajamento/conteudos?ies=ies-1', { filtros: filtros({ tipo: 'video' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    const [nome, secoes] = mockBaixar.mock.calls[0];
    expect(nome).toMatch(/^gestor-engajamento-conteudos-paracatu-/);
    expect(secoes[0].titulo).toContain('Tipo: Vídeo');
  });

  it('o aluno filtrado entra na linha do recorte da Visão geral', () => {
    montar('/gestor/engajamento?ies=ies-1', { alunoNome: 'Ana Clara Ribeiro' });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(mockBaixar.mock.calls[0][1][0].titulo).toContain('Aluno: Ana Clara Ribeiro');
  });

  it('o semestre filtrado entra no recorte', () => {
    montar('/gestor/engajamento/questoes?ies=ies-1', { filtros: filtros({ semestre: 8 }) });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(mockBaixar.mock.calls[0][1][0].titulo).toContain('Semestre: 8º');
  });

  it('sem dado ainda da aba, o botão fica desabilitado', () => {
    mockQuestoes.mockReturnValue(resultadoGestor(undefined));
    montar('/gestor/engajamento/questoes?ies=ies-1');
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled();
  });

  it('sem o nome da IES (visão geral ainda não carregou), desabilitado', () => {
    montar('/gestor/engajamento?ies=ies-1', { iesNome: undefined });
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled();
  });

  it('não depende de podeExportar: nada no componente consulta o contexto', () => {
    montar('/gestor/engajamento?ies=ies-1');
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeEnabled();
  });
});
