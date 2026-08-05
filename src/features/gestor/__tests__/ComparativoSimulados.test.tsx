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
  });

  it('cada card traz % de acerto, ENAMED e proficiência média, e nenhuma média única (§12 caso 3)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s1 = screen.getByTestId('card-simulado-s1');
    expect(within(s1).getByTestId('card-acerto')).toHaveTextContent('60%');
    expect(within(s1).getByTestId('card-enamed')).toHaveTextContent('3/5');
    expect(within(s1).getByTestId('card-proficiencia')).toHaveTextContent('55');
    expect(screen.queryByText(/média dos simulados|conceito médio/i)).toBeNull();
  });

  it('o simulado atual fica em destaque e traz o delta contra o anterior', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s2 = screen.getByTestId('card-simulado-s2');
    expect(s2).toHaveAttribute('data-atual', 'true');
    expect(within(s2).getByText('atual')).toBeInTheDocument();
    expect(within(s2).getByTestId('card-delta-acerto')).toHaveTextContent('+8');
    expect(within(s2).getByTestId('card-delta-proficiencia')).toHaveTextContent('+7');

    const s1 = screen.getByTestId('card-simulado-s1');
    expect(s1).toHaveAttribute('data-atual', 'false');
    expect(within(s1).getByTestId('card-delta-acerto')).toHaveTextContent('—');
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

  it('sem comparativo por tema o expandido diz que não há dado, sem inventar número (§4.10)', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));
    expect(screen.getByTestId('comparativo-temas-vazio')).toHaveTextContent('Sem tema comparável entre estes simulados');
  });
});
