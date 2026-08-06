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
   * §10.9 / docs/06-data-viz: as barras de grande área são o MESMO indicador,
   * não séries categóricas — nenhuma delas pode usar a cor de marca, que faria
   * a lista inteira parecer alarme e anularia o destaque da área crítica.
   *
   * E a cor também não pode afirmar RANKING. A RPC devolve as áreas em ordem
   * ALFABÉTICA; pintar por índice sobre uma rampa fazia o tom prometer um
   * ordenamento que o dado não tinha — e, com mais áreas que degraus, a rampa
   * ainda ciclava e dava o mesmo tom a desempenhos muito diferentes. Tom único
   * para todas as não-críticas: o comprimento da barra é o único canal de
   * comparação, porque é o único que carrega o número.
   */
  it('todas as barras não-críticas usam o MESMO tom — a cor não afirma ranking', () => {
    // Cinco áreas em ordem alfabética (como a RPC devolve), com o ranking de
    // acerto deliberadamente embaralhado em relação ao índice.
    const cinco: Dados = {
      ...DADOS,
      areas: [
        { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 41, critica: true },
        { id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false },
        { id: 'gineco', nome: 'Ginecologia e Obstetrícia', acertoPct: 55, critica: false },
        { id: 'pediatria', nome: 'Pediatria', acertoPct: 58, critica: false },
        { id: 'preventiva', nome: 'Medicina Preventiva', acertoPct: 66, critica: false },
      ],
    };
    render(<AcertoPorAreaESemestre dados={cinco} semestre="geral" />);

    const preenchimento = (testId: string) =>
      screen.getByTestId(testId).querySelector('[aria-hidden="true"]') as HTMLElement;

    const naoCriticas = ['clinica', 'gineco', 'pediatria', 'preventiva'].map(
      (id) => preenchimento(`area-${id}`).style.background,
    );

    // Um único tom entre todas: nenhuma posição da lista vale mais que outra.
    expect(new Set(naoCriticas).size).toBe(1);
    expect(naoCriticas[0]).toBe('var(--gp-text-1)');

    // Nenhuma barra não-crítica carrega a cor de marca.
    naoCriticas.forEach((_, i) => {
      const id = ['clinica', 'gineco', 'pediatria', 'preventiva'][i];
      expect(preenchimento(`area-${id}`).className).not.toContain('bg-primary');
    });

    // A crítica continua na família danger — é o único destaque cromático.
    expect(preenchimento('area-cirurgia').className).toContain('bg-destructive');
  });

  /**
   * A ordem alfabética que a RPC entrega é PRESERVADA. Ordenar por `acertoPct`
   * para justificar uma rampa seria pior: o recorte cruzado recalcula o
   * percentual de cada área a cada clique, e a lista se reembaralharia debaixo
   * do cursor.
   */
  it('mantém a ordem em que a RPC entregou as áreas, sem reordenar por desempenho', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="geral" />);

    const ids = screen
      .getAllByTestId(/^area-(?!valor)/)
      .map((li) => li.getAttribute('data-testid'));
    expect(ids).toEqual(['area-clinica', 'area-cirurgia', 'area-pediatria']);
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
