import { describe, it, expect, vi } from 'vitest';
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

  /**
   * Handoff §3: 100% dos ícones vêm do Fontello do Dendê. O "x" do recorte é o
   * mesmo `close-outlined` que remove chip de simulado — nunca um SVG do
   * Lucide, e nunca um botão "limpar recorte" fora da pílula.
   */
  it('o "x" do recorte usa o glifo close do Dendê, dentro da própria pílula', () => {
    const { container } = render(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="geral"
        recorte={{ tipo: 'semestre', id: '12' }}
        onRecorteChange={vi.fn()}
      />,
    );

    const limpar = screen.getByRole('button', { name: 'Limpar recorte' });
    expect(limpar.querySelector('.icon-dende-icons-close-outlined')).not.toBeNull();
    expect(screen.getByTestId('recorte-ativo')).toContainElement(limpar);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('a barra da área usa trilho e raio de token, com o % impresso no fim', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="geral" />);

    const clinica = screen.getByTestId('area-clinica');
    const trilho = within(clinica).getByTestId('area-valor').previousElementSibling as HTMLElement;
    expect(trilho.style.background).toBe('var(--gp-border-subtle)');
    expect(trilho.style.borderRadius).toBe('var(--gp-radius-pill)');
    expect(within(clinica).getByTestId('area-valor')).toHaveTextContent('72%');
  });

  /**
   * §10.9 / docs/06-data-viz: as barras de grande área são o MESMO indicador
   * ordenado, não séries categóricas — a cor codifica posição no ranking, numa
   * rampa neutra. Antes saíam todas em `bg-primary` (o vermelho da marca), o
   * que fazia a lista inteira parecer alarme e anulava o destaque da área
   * crítica, o único que deve chamar atenção.
   */
  it('as barras de área seguem a rampa neutra por posição, e só a crítica destoa', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="geral" />);

    const preenchimento = (testId: string) =>
      screen.getByTestId(testId).querySelector('[aria-hidden="true"]') as HTMLElement;

    // Posição 0 e 2 da rampa (clinica e pediatria; cirurgia, no meio, é crítica).
    expect(preenchimento('area-clinica').style.background).toBe('var(--gp-text-1)');
    expect(preenchimento('area-pediatria').style.background).toBe('var(--gp-text-3)');

    // Nenhuma barra não-crítica carrega a cor de marca.
    expect(preenchimento('area-clinica').className).not.toContain('bg-primary');
    expect(preenchimento('area-pediatria').className).not.toContain('bg-primary');

    // A crítica continua na família danger — é o destaque da lista.
    expect(preenchimento('area-cirurgia').className).toContain('bg-destructive');
  });

  /**
   * A evidência do filtro global é TONAL, não só opacidade: com "6º ano", 11º
   * e 12º vêm no neutro escuro e os demais no neutro claro. Opacidade sozinha
   * quase some em tela clara.
   */
  it('a evidência do semestre é tonal, e nenhuma coluna usa a cor de marca', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    const coluna = (s: number) =>
      screen.getByTestId(`semestre-${s}`).querySelector('[aria-hidden="true"]') as HTMLElement;

    expect(coluna(11).style.background).toBe('var(--gp-text-1)');
    expect(coluna(12).style.background).toBe('var(--gp-text-1)');
    expect(coluna(10).style.background).toBe('var(--gp-border-input)');
    expect(coluna(10).className).not.toContain('bg-primary');
  });
});
