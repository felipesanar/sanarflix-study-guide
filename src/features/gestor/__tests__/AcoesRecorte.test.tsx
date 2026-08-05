import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcoesRecorte } from '../components/AcoesRecorte';
import { useGestorContexto } from '../api/queries';
import { useFiltrosGestor } from '../hooks/useFiltrosGestor';

vi.mock('../api/queries', () => ({ useGestorContexto: vi.fn() }));
vi.mock('../hooks/useFiltrosGestor', () => ({ useFiltrosGestor: vi.fn() }));

const contexto = (podeExportar: boolean) => ({
  data: {
    usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' as const },
    iesDisponiveis: [{ id: 'i1', nome: 'IES Teste' }],
    iesAtual: { id: 'i1', nome: 'IES Teste' },
    contrato: null,
    podeTrocarIes: false,
    podeExportar,
  },
  meta: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

/** Contexto com DUAS IES — reproduz o cenário em que `iesAtual` diverge do recorte. */
const contextoMultiIes = () => ({
  data: {
    usuario: { id: 'u1', nome: 'Ana', papel: 'gestor_grupo' as const },
    iesDisponiveis: [
      { id: 'ies-fmu', nome: 'FMU' },
      { id: 'ies-univille', nome: 'UNIVILLE' },
    ],
    iesAtual: { id: 'ies-fmu', nome: 'FMU' },
    contrato: null,
    podeTrocarIes: true,
    podeExportar: true,
  },
  meta: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const filtros = (iesId: string | null) => ({
  semestre: '6ano' as const,
  setSemestre: vi.fn(),
  simulados: [],
  setSimulados: vi.fn(),
  iesId,
  setIesId: vi.fn(),
});

describe('AcoesRecorte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFiltrosGestor).mockReturnValue(filtros(null));
  });

  it('renderiza as duas acoes quando podeExportar e true', () => {
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    render(
      <AcoesRecorte escopo="Pediatria · 6º ano" resumoTexto="resumo" onExportar={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Exportar recorte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar resumo' })).toBeInTheDocument();
  });

  it('nao renderiza NADA quando podeExportar e false — ausente, nao desabilitado', () => {
    vi.mocked(useGestorContexto).mockReturnValue(contexto(false) as never);
    const { container } = render(
      <AcoesRecorte escopo="Pediatria" resumoTexto="resumo" onExportar={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('chama onExportar com o escopo ao clicar em Exportar recorte', async () => {
    const user = userEvent.setup();
    const onExportar = vi.fn();
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    render(
      <AcoesRecorte escopo="Pediatria" resumoTexto="resumo" onExportar={onExportar} />,
    );

    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));
    expect(onExportar).toHaveBeenCalledTimes(1);
  });

  it('copia o resumo agregado, com cabecalho de escopo', async () => {
    const user = userEvent.setup();
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    render(
      <AcoesRecorte
        escopo="Pediatria · 6º ano"
        resumoTexto="Acerto medio 61%. 3 temas com cobertura parcial."
        onExportar={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    // `userEvent.setup()` já instala o stub real de Clipboard do jsdom (a API
    // não existe nativamente lá) — ler de volta via `readText()` em vez de
    // tentar substituir `navigator.clipboard` na mão, que o próprio setup do
    // user-event sobrescreve com um getter (`attachClipboardStubToView`).
    const copiado = await navigator.clipboard.readText();
    expect(copiado).toContain('IES Teste');
    expect(copiado).toContain('Pediatria · 6º ano');
    expect(copiado).toContain('Acerto medio 61%');
  });

  it('nao vaza nome de aluno: o texto copiado e exatamente o resumo agregado recebido', async () => {
    const user = userEvent.setup();
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    const resumoAgregado = '54% dos alunos proficientes (56 de 104).';
    render(
      <AcoesRecorte escopo="6º ano" resumoTexto={resumoAgregado} onExportar={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    const copiado = await navigator.clipboard.readText();
    // O componente nao tem acesso a lista nominal — so ao texto agregado.
    expect(copiado).toContain(resumoAgregado);
    expect(copiado).not.toMatch(/@/); // nenhum e-mail
    expect(copiado.split('\n').length).toBeLessThanOrEqual(6); // nao e um dump de linhas
  });

  describe('cabecalho de IES acompanha o recorte, nao contexto.iesAtual (achados 1 e 2 — 04/08)', () => {
    it('usa a IES SELECIONADA na URL, nao a IES de cadastro do usuario', async () => {
      const user = userEvent.setup();
      vi.mocked(useGestorContexto).mockReturnValue(contextoMultiIes() as never);
      // Gestor com IES de cadastro FMU troca para UNIVILLE no seletor (?ies=ies-univille).
      vi.mocked(useFiltrosGestor).mockReturnValue(filtros('ies-univille'));

      render(
        <AcoesRecorte
          escopo="Pediatria"
          resumoTexto="Insuficiência cardíaca: 24% (amostra: 63)."
          onExportar={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));
      const copiado = await navigator.clipboard.readText();

      // O cabecalho tem que citar a IES cujos numeros estao no resumo (UNIVILLE),
      // nunca a IES de cadastro do usuario (FMU) — sem isso o texto atribui os
      // dados de uma instituicao a outra.
      expect(copiado.split('\n')[0]).toContain('UNIVILLE');
      expect(copiado.split('\n')[0]).not.toContain('FMU');
    });

    it('sem IES na URL (drawer aberto sem troca), cai em contexto.iesAtual', async () => {
      const user = userEvent.setup();
      vi.mocked(useGestorContexto).mockReturnValue(contextoMultiIes() as never);
      vi.mocked(useFiltrosGestor).mockReturnValue(filtros(null));

      render(
        <AcoesRecorte escopo="Pediatria" resumoTexto="resumo" onExportar={vi.fn()} />,
      );

      await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));
      const copiado = await navigator.clipboard.readText();

      expect(copiado.split('\n')[0]).toContain('FMU');
    });
  });
});
