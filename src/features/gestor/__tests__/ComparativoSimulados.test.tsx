import { describe, it, expect } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import { ComparativoSimulados } from '@/features/gestor/components/ComparativoSimulados';
import type { MetricasSimulado } from '@/features/gestor/api/types';

const metrica = (over: Partial<MetricasSimulado>): MetricasSimulado => ({
  simuladoId: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  participantes: 100,
  acertoMedioPct: 60,
  enamedProjetado: 3,
  proficienciaMedia: 55,
  ...over,
});

const DUAS = [
  metrica({ simuladoId: 's1', nome: 'Simulado 1', acertoMedioPct: 60, proficienciaMedia: 55, enamedProjetado: 3 }),
  metrica({
    simuladoId: 's2',
    nome: 'Simulado 2',
    data: '2026-05-12T13:00:00Z',
    participantes: 98,
    acertoMedioPct: 68,
    proficienciaMedia: 62,
    enamedProjetado: 4,
  }),
];

const TEMAS = [
  {
    tema: 'Abdome agudo',
    porSimulado: [
      { simuladoId: 's1', acertoPct: 38 },
      { simuladoId: 's2', acertoPct: 52 },
    ],
  },
];

describe('ComparativoSimulados', () => {
  it('não existe com menos de 2 simulados', () => {
    // `render` do @/test/utils envolve em ThemeProvider (next-themes), que injeta um
    // <script> de anti-flash no container — por isso não dá pra checar o container
    // inteiro vazio; confirmamos que a section do componente não existe.
    const { container } = render(<ComparativoSimulados metricas={[DUAS[0]]} />);
    expect(container.querySelector('section')).toBeNull();
  });

  it('abre colapsado, com um card por simulado (§4.7.4)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    expect(screen.getByRole('button', { name: /ver comparativo completo/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('card-simulado-s1')).toBeInTheDocument();
    expect(screen.getByTestId('card-simulado-s2')).toBeInTheDocument();
    expect(screen.queryByTestId('comparativo-temas')).toBeNull();
    expect(screen.queryByTestId('comparativo-metricas')).toBeNull();
  });

  it('cada card traz % de acerto, ENAMED e proficiência média, e nenhuma média única (§12 caso 3)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s1 = screen.getByTestId('card-simulado-s1');
    expect(within(s1).getByTestId('card-acerto')).toHaveTextContent('60%');
    expect(within(s1).getByTestId('card-enamed')).toHaveTextContent('3/5');
    expect(within(s1).getByTestId('card-proficiencia')).toHaveTextContent('55');
    expect(screen.queryByText(/média dos simulados|conceito médio/i)).toBeNull();
  });

  it('o cabeçalho do card traz data curta e participantes — o n que sustenta o percentual', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    expect(screen.getByTestId('card-simulado-s1')).toHaveTextContent('10/03 · 100 part.');
    expect(screen.getByTestId('card-simulado-s2')).toHaveTextContent('12/05 · 98 part.');
  });

  it('o Conceito ENAMED nunca aparece sem o qualificador "proj." (§4.1)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s1 = screen.getByTestId('card-simulado-s1');
    const rotulo = within(s1).getByText('Conceito ENAMED');
    expect(rotulo).toHaveTextContent('proj.');
  });

  it('o simulado atual fica em destaque e traz o delta contra o anterior nas TRÊS métricas', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s2 = screen.getByTestId('card-simulado-s2');
    expect(s2).toHaveAttribute('data-atual', 'true');
    expect(within(s2).getByText('atual')).toBeInTheDocument();
    expect(within(s2).getByTestId('card-delta-acerto')).toHaveTextContent('+8');
    expect(within(s2).getByTestId('card-delta-enamed')).toHaveTextContent('+1');
    expect(within(s2).getByTestId('card-delta-proficiencia')).toHaveTextContent('+7');
  });

  it('o primeiro card não tem pílula de delta — não há variação contra nada (§4.10)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s1 = screen.getByTestId('card-simulado-s1');
    expect(s1).toHaveAttribute('data-atual', 'false');
    expect(within(s1).queryByTestId('card-delta-acerto')).toBeNull();
    expect(within(s1).queryByTestId('card-delta-enamed')).toBeNull();
    expect(within(s1).queryByTestId('card-delta-proficiencia')).toBeNull();
  });

  it('expande sob demanda e mostra as métricas lado a lado, uma coluna por simulado', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));

    const metricas = screen.getByTestId('comparativo-metricas');
    expect(within(metricas).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Indicador',
      'Simulado 110/03 · 100 part.',
      'Simulado 212/05 · 98 part.',
    ]);
    const linhaAcerto = within(metricas).getByRole('row', { name: /Percentual de acerto médio/ });
    expect(linhaAcerto).toHaveTextContent('60%');
    expect(linhaAcerto).toHaveTextContent('68%');
    expect(linhaAcerto).toHaveTextContent('+8');
  });

  it('expande sob demanda e mostra o comparativo por tema, uma coluna por simulado', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));

    const tabela = screen.getByTestId('comparativo-temas');
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Tema',
      'Simulado 1',
      'Simulado 2',
    ]);
    const linha = within(tabela).getByRole('row', { name: /Abdome agudo/ });
    expect(within(linha).getByTestId('tema-s1')).toHaveTextContent('38%');
    expect(within(linha).getByTestId('tema-s2')).toHaveTextContent('52%');
  });

  it('o bloco de temas explica por que a comparação é por tema, não por questão', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));

    expect(screen.getByText('Questões — acerto por tema')).toBeInTheDocument();
    expect(
      screen.getByText('provas têm questões distintas — a linha comparável é o tema'),
    ).toBeInTheDocument();
  });

  it('sem comparativo por tema o expandido diz que não há dado, sem inventar número (§4.10)', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));
    expect(screen.getByTestId('comparativo-temas-vazio')).toHaveTextContent('Sem tema comparável entre estes simulados');
  });
});
