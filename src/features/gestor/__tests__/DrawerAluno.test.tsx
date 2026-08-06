import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { useAluno, useAlunoContato } from '@/features/gestor/api/queries';
import { TRACO } from '@/features/gestor/lib/formatters';
import type { AlunoContato, AlunoSimuladoEntry, Meta } from '@/features/gestor/api/types';

vi.mock('@/features/gestor/api/queries', () => ({ useAluno: vi.fn(), useAlunoContato: vi.fn() }));

const mockUseAluno = vi.mocked(useAluno);
const mockUseAlunoContato = vi.mocked(useAlunoContato);

const META: Meta = {
  periodo: '2026',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-08-04T10:00:00Z',
  criterio: 'aluno no recorte da IES',
  partial: false,
  lowSample: false,
};

/**
 * `get_gestor_aluno` devolve UMA ENTRADA POR SIMULADO — nunca um objeto
 * singular. Esta é a forma real de `useAluno(...).data` (ver api/types.ts,
 * `AlunoSimuladoEntry`, e o comentário do achado 19/card 106).
 */
const ENTRADA_S1: AlunoSimuladoEntry = {
  id: 'a1',
  nome: 'Ana Prado',
  semestre: 11,
  participou: true,
  acertos: 71,
  proficiencia: 71,
  situacao: 'proficiente',
  posicao: { lugar: 12, total: 118, percentil: 90 },
  acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 42, critica: true }],
  variacao: 3,
  simuladoId: 's1',
  simuladoNome: 'Simulado 1',
  simuladoData: '2026-03-10T12:00:00Z',
};

const ENTRADA_S2: AlunoSimuladoEntry = {
  id: 'a1',
  nome: 'Ana Prado',
  semestre: 11,
  participou: true,
  acertos: 78,
  proficiencia: 78,
  situacao: 'proficiente',
  posicao: { lugar: 8, total: 120, percentil: 93 },
  acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 55, critica: false }],
  variacao: 7,
  simuladoId: 's2',
  simuladoNome: 'Simulado 2',
  simuladoData: '2026-05-12T12:00:00Z',
};

const resultado = (over: Record<string, unknown> = {}) => ({
  data: undefined,
  meta: META,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});

function montar(props?: Partial<React.ComponentProps<typeof DrawerAluno>>) {
  const onFechar = vi.fn();
  const utils = render(
    <DrawerAluno alunoId="a1" nome="Ana Prado" simulados={['s1', 's2']} onFechar={onFechar} {...props} />,
  );
  return { ...utils, onFechar };
}

/** Telefone default para os testes que não são sobre telefone — número plausível, sem relevância própria. */
const CONTATO_PADRAO: AlunoContato = { id: 'a1', telefone: '11988887777' };

beforeEach(() => {
  mockUseAluno.mockReturnValue(resultado({ data: [ENTRADA_S1] }) as unknown as ReturnType<typeof useAluno>);
  mockUseAlunoContato.mockReturnValue(
    resultado({ data: CONTATO_PADRAO }) as unknown as ReturnType<typeof useAlunoContato>,
  );
});

describe('DrawerAluno — fechado', () => {
  it('alunoId nulo não renderiza o dialog', () => {
    render(<DrawerAluno alunoId={null} nome="" simulados={[]} onFechar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/**
 * Telefone do aluno (05/08). Ele shipou para produção em 31/07 pelo
 * `StudentAnalyticsDrawer` do console antigo — decisão do Felipe: qualquer
 * gestor pode ver, e o admin também. Com o console apagado, sumiria de
 * produção; foi trazido para cá.
 *
 * A busca é própria (`useAlunoContato`), independente da de simulados: a RPC
 * `get_gestor_aluno_contato` devolve UM aluno por chamada, deliberadamente —
 * somar telefone a uma RPC de turma despejaria o telefone de todos os alunos
 * a cada load.
 */
describe('DrawerAluno — telefone do aluno', () => {
  it('com telefone cadastrado, mostra o número', () => {
    montar();
    expect(screen.getByTestId('drawer-telefone')).toHaveTextContent('11988887777');
  });

  it('sem telefone cadastrado, mostra TRAÇO — nunca vazio, nunca texto inventado', () => {
    mockUseAlunoContato.mockReturnValue(
      resultado({ data: { id: 'a1', telefone: null } }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    const celula = screen.getByTestId('drawer-telefone');
    expect(celula).toHaveTextContent(TRACO);
    // Ausência não pode virar afirmação: nem dígito, nem "não informado".
    expect(celula.textContent ?? '').not.toMatch(/\d/);
    expect(celula.textContent ?? '').not.toMatch(/informad/i);
  });

  it('erro na busca do contato cai no mesmo TRAÇO e não derruba o resto do drawer', () => {
    mockUseAlunoContato.mockReturnValue(
      resultado({ data: undefined, isError: true }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    expect(screen.getByTestId('drawer-telefone')).toHaveTextContent(TRACO);
    // O drawer continua servindo o que ele sabe: a métrica do simulado.
    expect(screen.getByText('Proficiência')).toBeInTheDocument();
  });

  it('enquanto carrega, não mostra número nem finge ausência', () => {
    mockUseAlunoContato.mockReturnValue(
      resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAlunoContato>,
    );
    montar();
    expect(screen.getByTestId('drawer-telefone').textContent ?? '').not.toMatch(/\d/);
  });
});

describe('DrawerAluno — carregando e erro', () => {
  it('loading: skeleton acessível, sem número ainda', () => {
    mockUseAluno.mockReturnValue(resultado({ data: undefined, isLoading: true }) as unknown as ReturnType<typeof useAluno>);
    montar();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Ana Prado/);
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByText('Proficiência')).not.toBeInTheDocument();
  });

  it('erro: mensagem + Tentar novamente refaz só esta consulta', async () => {
    const refetch = vi.fn();
    mockUseAluno.mockReturnValue(
      resultado({ data: undefined, isError: true, refetch }) as unknown as ReturnType<typeof useAluno>,
    );
    const user = userEvent.setup();
    montar();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('DrawerAluno — visão detalhada de um simulado (§4.8)', () => {
  it('mostra Proficiência, posição e % de acerto por área — sem "Nota TRI"', () => {
    montar();
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAccessibleName(/Ana Prado/);
    expect(dialogo).toHaveTextContent('Proficiência');
    expect(dialogo).toHaveTextContent('71');
    expect(dialogo).toHaveTextContent('12º de 118');
    expect(dialogo).toHaveTextContent('42%');
    expect(dialogo.textContent).not.toMatch(/Nota TRI/i);
  });

  it('marca a área crítica', () => {
    montar();
    expect(screen.getByText('área crítica')).toBeInTheDocument();
  });
});

describe('DrawerAluno — DOIS OU MAIS simulados: nunca funde nem tira média (§4.8, regra de agregação honesta)', () => {
  beforeEach(() => {
    mockUseAluno.mockReturnValue(
      resultado({ data: [ENTRADA_S1, ENTRADA_S2] }) as unknown as ReturnType<typeof useAluno>,
    );
  });

  it('renderiza uma seção por simulado, com o nome de cada um', () => {
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('Simulado 1');
    expect(dialogo).toHaveTextContent('Simulado 2');
  });

  it('mantém os dois valores de proficiência distintos — nenhuma média (71 e 78, nunca 74,5)', () => {
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('71');
    expect(dialogo).toHaveTextContent('78');
    expect(dialogo.textContent).not.toMatch(/74[.,]5/);
  });

  it('mantém as duas posições distintas', () => {
    montar();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('12º de 118');
    expect(dialogo).toHaveTextContent('8º de 120');
  });
});

describe('DrawerAluno — aguardando_resultado não é abaixo_do_limiar (achado 03/08)', () => {
  it('proficiência TRACO (nunca 0) e rótulo "Aguardando resultado"', () => {
    const entradaAguardando: AlunoSimuladoEntry = {
      ...ENTRADA_S1,
      participou: true,
      proficiencia: null,
      acertos: null,
      situacao: 'aguardando_resultado',
      posicao: undefined,
      variacao: undefined,
      acertoPorArea: undefined,
    };
    mockUseAluno.mockReturnValue(
      resultado({ data: [entradaAguardando] }) as unknown as ReturnType<typeof useAluno>,
    );
    montar();
    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveTextContent('Aguardando resultado');
    expect(dialogo).not.toHaveTextContent('Abaixo do limiar');
    expect(screen.getByTestId('drawer-proficiencia-s1')).toHaveTextContent('—');
    expect(screen.getByTestId('drawer-proficiencia-s1')).not.toHaveTextContent('0');
  });
});

describe('DrawerAluno — sem nenhum simulado no recorte pedido', () => {
  it('mostra estado vazio, não quebra', () => {
    mockUseAluno.mockReturnValue(resultado({ data: [] }) as unknown as ReturnType<typeof useAluno>);
    montar();
    expect(screen.getByRole('dialog')).toHaveTextContent(/nenhum simulado/i);
  });
});

describe('DrawerAluno — fechar', () => {
  it('onOpenChange(false) (ESC, clique fora, botão fechar) chama onFechar', async () => {
    const user = userEvent.setup();
    const { onFechar } = montar();

    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
