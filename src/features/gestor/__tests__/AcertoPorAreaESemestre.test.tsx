import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@/test/utils';
import {
  AcertoPorAreaESemestre,
  semestresEmEvidencia,
} from '@/features/gestor/components/AcertoPorAreaESemestre';
import type { AcertoPorAreaESemestre as Dados } from '@/features/gestor/api/types';

const DADOS: Dados = {
  areas: [
    { id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false },
    { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 41, critica: true },
    { id: 'pediatria', nome: 'Pediatria', acertoPct: 58, critica: false },
  ],
  semestres: [
    { semestre: 10, acertoPct: 51, emEvidencia: false },
    { semestre: 11, acertoPct: 63, emEvidencia: true },
    { semestre: 12, acertoPct: 68, emEvidencia: true },
  ],
};

describe('semestresEmEvidencia', () => {
  it('6º ano põe 11 e 12 em evidência (§4.5, §12 caso 10)', () => {
    expect(semestresEmEvidencia('6ano', [9, 10, 11, 12])).toEqual([11, 12]);
  });

  it('geral trata todos igualmente', () => {
    expect(semestresEmEvidencia('geral', [9, 10, 11, 12])).toEqual([9, 10, 11, 12]);
  });

  it('por semestre destaca só o filtrado', () => {
    expect(semestresEmEvidencia('7', [6, 7, 8])).toEqual([7]);
  });
});

describe('AcertoPorAreaESemestre', () => {
  it('renderiza uma barra horizontal por grande área com nome e % no fim', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    const clinica = screen.getByTestId('area-clinica');
    expect(within(clinica).getByText('Clínica Médica')).toBeInTheDocument();
    expect(within(clinica).getByTestId('area-valor')).toHaveTextContent('72%');
    expect(screen.getAllByTestId(/^area-(?!valor)/)).toHaveLength(3);
  });

  it('marca a grande área crítica', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);
    expect(screen.getByTestId('area-cirurgia')).toHaveAttribute('data-critica', 'true');
    expect(screen.getByTestId('area-clinica')).toHaveAttribute('data-critica', 'false');
  });

  it('renderiza as colunas de semestre no MESMO bloco das áreas', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    const bloco = screen.getByRole('region', { name: 'Acerto por grande área e por semestre' });
    expect(within(bloco).getByTestId('area-clinica')).toBeInTheDocument();
    expect(within(bloco).getByTestId('semestre-11')).toBeInTheDocument();
    expect(within(bloco).getByTestId('semestre-11')).toHaveTextContent('63%');
    expect(within(bloco).getAllByTestId(/^semestre-\d+$/)).toHaveLength(3);
  });

  it('com 6º ano só 11 e 12 ficam em evidência', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    expect(screen.getByTestId('semestre-10')).toHaveAttribute('data-evidencia', 'false');
    expect(screen.getByTestId('semestre-11')).toHaveAttribute('data-evidencia', 'true');
    expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-evidencia', 'true');
  });

  it('com geral todos ficam iguais', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="geral" />);

    [10, 11, 12].forEach((s) =>
      expect(screen.getByTestId(`semestre-${s}`)).toHaveAttribute('data-evidencia', 'true'),
    );
  });

  it('com filtro num semestre específico só ele fica em evidência e não existe controle próprio "Por semestre"', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="12" />);

    expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-evidencia', 'true');
    expect(screen.getByTestId('semestre-10')).toHaveAttribute('data-evidencia', 'false');
    expect(screen.getByTestId('semestre-11')).toHaveAttribute('data-evidencia', 'false');
    expect(screen.queryByRole('button', { name: /por semestre/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /por área/i })).toBeNull();
  });
});
