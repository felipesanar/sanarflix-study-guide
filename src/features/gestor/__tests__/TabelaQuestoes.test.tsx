import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import {
  TabelaQuestoes,
  deveMostrarQuestoes,
  ORDENACOES_QUESTOES,
} from '@/features/gestor/components/TabelaQuestoes';
import { derivarDistratorDominante } from '@/features/gestor/charts/DistribuicaoAlternativas';
import type { Alternativa, Questao } from '@/features/gestor/api/types';

const alternativas = (): Alternativa[] => [
  { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: 42 },
  { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: 31 },
  { letra: 'C', texto: 'Alternativa C', correta: false, marcadaPct: 15 },
  { letra: 'D', texto: 'Alternativa D', correta: false, marcadaPct: 8 },
  { letra: 'E', texto: 'Alternativa E', correta: false, marcadaPct: 4 },
];

const questao = (over: Partial<Questao>): Questao => ({
  numero: 1,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  acertoPct: 42,
  enunciado: 'Paciente de 62 anos com dispneia progressiva…',
  alternativas: alternativas(),
  ...over,
});

const QUESTOES = [
  questao({ numero: 1 }),
  questao({ numero: 2, grandeArea: 'Cirurgia', especialidade: 'Cirurgia geral', tema: 'Abdome agudo', acertoPct: 28 }),
];

const props = (over: Partial<React.ComponentProps<typeof TabelaQuestoes>> = {}) => ({
  questoes: QUESTOES,
  total: 2,
  page: 1,
  pageSize: 20,
  onPageChange: vi.fn(),
  ordenacao: 'ordem_da_prova' as const,
  onOrdenacaoChange: vi.fn(),
  areas: ['Clínica Médica', 'Cirurgia'],
  areaSelecionada: null,
  onAreaChange: vi.fn(),
  ...over,
});

describe('deveMostrarQuestoes (§4.7.3-4, §12 caso 6)', () => {
  it('só com exatamente 1 simulado', () => {
    expect(deveMostrarQuestoes([])).toBe(false);
    expect(deveMostrarQuestoes(['s1'])).toBe(true);
    expect(deveMostrarQuestoes(['s1', 's2'])).toBe(false);
  });
});

describe('derivarDistratorDominante', () => {
  it('escolhe a incorreta mais marcada', () => {
    expect(derivarDistratorDominante(alternativas())).toBe('B');
  });

  it('devolve undefined quando ninguém marcou incorreta', () => {
    expect(
      derivarDistratorDominante([
        { letra: 'A', texto: 'a', correta: true, marcadaPct: 100 },
        { letra: 'B', texto: 'b', correta: false, marcadaPct: 0 },
      ]),
    ).toBeUndefined();
  });

  it('ignora null como se ninguém tivesse marcado (nunca vira 0 disfarçado)', () => {
    expect(
      derivarDistratorDominante([
        { letra: 'A', texto: 'a', correta: true, marcadaPct: null },
        { letra: 'B', texto: 'b', correta: false, marcadaPct: null },
      ]),
    ).toBeUndefined();
  });
});

describe('TabelaQuestoes', () => {
  it('mostra as 5 colunas do detalhamento das questões', () => {
    render(<TabelaQuestoes {...props()} />);

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Nº', 'Grande área', 'Especialidade', 'Tema', 'Índice de acerto']);
  });

  it('oferece as 3 ordenações decididas em 24/07 e nenhum slider', async () => {
    const user = userEvent.setup();
    const onOrdenacaoChange = vi.fn();
    render(<TabelaQuestoes {...props({ onOrdenacaoChange })} />);

    expect(ORDENACOES_QUESTOES.map((o) => o.rotulo)).toEqual(['Ordem da prova', 'Mais erradas', 'Mais acertadas']);
    // ToggleGroup type="single" (Radix) usa o padrão radiogroup — role="radio" + aria-checked, não button/aria-pressed.
    expect(screen.getByRole('radio', { name: 'Ordem da prova' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('slider')).toBeNull();

    await user.click(screen.getByRole('radio', { name: 'Mais erradas' }));
    expect(onOrdenacaoChange).toHaveBeenCalledWith('mais_erradas');
  });

  it('filtra por grande área pelo callback, sem filtrar no cliente', async () => {
    const user = userEvent.setup();
    const onAreaChange = vi.fn();
    render(<TabelaQuestoes {...props({ onAreaChange })} />);

    await user.click(screen.getByRole('radio', { name: 'Cirurgia' }));
    expect(onAreaChange).toHaveBeenCalledWith('Cirurgia');
    expect(screen.getAllByTestId(/^linha-questao-/)).toHaveLength(2);
  });

  it('expande a linha com enunciado, alternativas A-E e distribuição', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    const gatilho = screen.getByRole('button', { name: /Ver detalhe da questão 1/i });
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');

    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');

    const detalhe = screen.getByTestId('detalhe-questao-1');
    expect(within(detalhe).getByText(/dispneia progressiva/)).toBeInTheDocument();
    expect(within(detalhe).getAllByTestId(/^alternativa-/)).toHaveLength(5);
    expect(within(detalhe).getByTestId('alternativa-A')).toHaveAttribute('data-correta', 'true');
    expect(within(detalhe).getByTestId('alternativa-A')).toHaveTextContent('resposta correta');
    expect(within(detalhe).getByTestId('alternativa-B')).toHaveTextContent('distrator dominante');
    expect(within(detalhe).getByTestId('alternativa-B')).toHaveTextContent('31%');
  });

  it('respeita o distrator dominante vindo do servidor', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props({ questoes: [questao({ numero: 1, distratorDominante: 'C' })] })} />);

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));
    expect(screen.getByTestId('alternativa-C')).toHaveTextContent('distrator dominante');
    expect(screen.getByTestId('alternativa-B')).not.toHaveTextContent('distrator dominante');
  });

  it('alternativa com marcadaPct null mostra TRACO, não 0% (§4.10)', async () => {
    const user = userEvent.setup();
    render(
      <TabelaQuestoes
        {...props({
          questoes: [
            questao({
              numero: 1,
              alternativas: [
                { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: null },
                { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: null },
              ],
            }),
          ],
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));
    expect(screen.getByTestId('alternativa-A')).toHaveTextContent('—');
  });

  it('gabarito em processamento: mensagem, nenhuma linha e nenhum número (§4.10)', () => {
    render(<TabelaQuestoes {...props({ questoes: [], total: 0, processando: true })} />);

    expect(screen.getByTestId('questoes-processando')).toHaveTextContent('Gabarito em processamento');
    expect(screen.queryByTestId(/^linha-questao-/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
