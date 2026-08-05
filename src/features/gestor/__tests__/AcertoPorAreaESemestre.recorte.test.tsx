import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { AcertoPorAreaESemestre } from '@/features/gestor/components/AcertoPorAreaESemestre';
import { recalcularAreas, recalcularSemestres } from '@/features/gestor/lib/agregarDetalhamento';
import type { CelulaAreaSemestre } from '@/features/gestor/api/detalhamentoExtras';
import type { AcertoPorAreaESemestre as Dados } from '@/features/gestor/api/types';

const DADOS: Dados = {
  areas: [
    { id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false },
    { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 41, critica: true },
  ],
  semestres: [
    { semestre: 11, acertoPct: 63, emEvidencia: true },
    { semestre: 12, acertoPct: 68, emEvidencia: true },
  ],
};

const MATRIZ: CelulaAreaSemestre[] = [
  { areaId: 'clinica', semestre: 11, acertoPct: 66, amostra: 120 },
  { areaId: 'clinica', semestre: 12, acertoPct: 78, amostra: 110 },
  { areaId: 'cirurgia', semestre: 11, acertoPct: 35, amostra: 118 },
  { areaId: 'cirurgia', semestre: 12, acertoPct: 47, amostra: 109 },
];

describe('recalculo cruzado (funções puras)', () => {
  it('recalcularAreas devolve as áreas do semestre pedido, preservando nome e criticidade', () => {
    expect(recalcularAreas(DADOS.areas, MATRIZ, 11)).toEqual([
      { id: 'clinica', nome: 'Clínica Médica', acertoPct: 66, critica: false },
      { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 35, critica: true },
    ]);
  });

  it('recalcularSemestres devolve os semestres da área pedida', () => {
    expect(recalcularSemestres(DADOS.semestres, MATRIZ, 'cirurgia')).toEqual([
      { semestre: 11, acertoPct: 35, emEvidencia: true },
      { semestre: 12, acertoPct: 47, emEvidencia: true },
    ]);
  });

  it('célula com acertoPct null sai do recorte em vez de virar zero (§4.10)', () => {
    const matriz: CelulaAreaSemestre[] = [
      { areaId: 'clinica', semestre: 11, acertoPct: null, amostra: 0 },
      { areaId: 'cirurgia', semestre: 11, acertoPct: 35, amostra: 118 },
    ];
    expect(recalcularAreas(DADOS.areas, matriz, 11)).toEqual([
      { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 35, critica: true },
    ]);
  });
});

describe('AcertoPorAreaESemestre — clique cruzado (§12 caso 11)', () => {
  it('clicar num semestre recalcula as áreas para aquele semestre', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    const { rerender } = render(
      <AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} recorte={null} onRecorteChange={onRecorteChange} />,
    );

    await user.click(screen.getByRole('button', { name: /12º semestre/i }));
    expect(onRecorteChange).toHaveBeenCalledWith({ tipo: 'semestre', id: '12' });

    rerender(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="6ano"
        matriz={MATRIZ}
        recorte={{ tipo: 'semestre', id: '12' }}
        onRecorteChange={onRecorteChange}
      />,
    );

    expect(screen.getByTestId('area-clinica')).toHaveTextContent('78%');
    expect(screen.getByTestId('area-cirurgia')).toHaveTextContent('47%');
    expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-recorte', 'ativo');
    expect(screen.getByTestId('recorte-ativo')).toHaveTextContent('12º semestre');
  });

  it('clicar numa área recalcula os semestres para aquela área', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    const { rerender } = render(
      <AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} recorte={null} onRecorteChange={onRecorteChange} />,
    );

    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    expect(onRecorteChange).toHaveBeenCalledWith({ tipo: 'area', id: 'cirurgia' });

    rerender(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="6ano"
        matriz={MATRIZ}
        recorte={{ tipo: 'area', id: 'cirurgia' }}
        onRecorteChange={onRecorteChange}
      />,
    );

    expect(screen.getByTestId('semestre-11')).toHaveTextContent('35%');
    expect(screen.getByTestId('semestre-12')).toHaveTextContent('47%');
    expect(screen.getByTestId('area-cirurgia')).toHaveAttribute('data-recorte', 'ativo');
  });

  it('segundo clique no mesmo item limpa o recorte', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    render(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="6ano"
        matriz={MATRIZ}
        recorte={{ tipo: 'semestre', id: '12' }}
        onRecorteChange={onRecorteChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /12º semestre/i }));
    expect(onRecorteChange).toHaveBeenCalledWith(null);
  });

  it('sem matriz o cruzamento fica desabilitado e a tela segue utilizável', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" recorte={null} onRecorteChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Cirurgia/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /12º semestre/i })).toHaveAttribute(
      'title',
      'Recorte cruzado indisponível para esta seleção',
    );
    expect(screen.getByTestId('area-clinica')).toHaveTextContent('72%');
  });

  it('sem os callbacks o bloco continua sendo só leitura (Task 51 intacta)', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('area-clinica')).toHaveTextContent('72%');
  });
});
