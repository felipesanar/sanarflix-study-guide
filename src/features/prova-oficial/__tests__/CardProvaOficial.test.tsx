import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { CardsProvaOficial } from '../components/CardProvaOficial';
import type { ProvaOficialResumo } from '../types';

const mockUseProvasOficiaisAluno = vi.fn();
vi.mock('../api', () => ({
  useProvasOficiaisAluno: () => mockUseProvasOficiaisAluno(),
}));

const RESUMO: ProvaOficialResumo = {
  simuladoId: 'sim-1',
  nome: 'ENAMED 2026 · Prova oficial (13/09/26)',
  dataRealizacao: '2026-09-13T00:00:00Z',
  caderno: 2,
  acertos: 75,
  totalValidas: 100,
};

// `render` de `@/test/utils` embrulha em `ThemeProvider` (next-themes), que
// injeta um <script> de inicialização de tema como filho direto do container
// — presente mesmo quando o componente sob teste retorna null. Por isso não
// dá para usar `toBeEmptyDOMElement()` puro aqui: filtramos esse script antes
// de checar "nada foi renderizado".
const semScriptDeTema = (container: HTMLElement) =>
  Array.from(container.children).filter((el) => el.tagName !== 'SCRIPT');

describe('CardsProvaOficial', () => {
  it('renderiza null enquanto carrega', () => {
    mockUseProvasOficiaisAluno.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<CardsProvaOficial />);
    expect(semScriptDeTema(container)).toHaveLength(0);
  });

  it('renderiza null em erro', () => {
    mockUseProvasOficiaisAluno.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { container } = render(<CardsProvaOficial />);
    expect(semScriptDeTema(container)).toHaveLength(0);
  });

  it('lista vazia não renderiza nada', () => {
    mockUseProvasOficiaisAluno.mockReturnValue({ data: [], isLoading: false, isError: false });
    const { container } = render(<CardsProvaOficial />);
    expect(semScriptDeTema(container)).toHaveLength(0);
  });

  it('renderiza um card por prova, com link para o resultado e sem TRI/nota', () => {
    mockUseProvasOficiaisAluno.mockReturnValue({ data: [RESUMO], isLoading: false, isError: false });
    render(<CardsProvaOficial />);

    expect(screen.getByText(/ENAMED 2026/)).toBeInTheDocument();
    expect(screen.getByText(/75 de 100/)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Ver meu resultado' });
    expect(link).toHaveAttribute('href', '/simulados/sim-1/prova-oficial');

    expect(document.body.textContent).not.toMatch(/TRI/);
    expect(document.body.textContent).not.toMatch(/nota/i);
  });
});
