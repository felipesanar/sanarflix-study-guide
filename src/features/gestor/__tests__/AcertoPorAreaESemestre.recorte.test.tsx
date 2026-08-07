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

/**
 * Com UM semestre a seção inteira some: a barra sozinha repete o número do
 * recorte e o clique cruzado que ela oferece é um no-op — recortar as áreas
 * "pelo 11º" quando só existe o 11º devolve as mesmas áreas.
 */
describe('AcertoPorAreaESemestre — seção de semestre com um semestre só', () => {
  const UM_SEMESTRE = {
    ...DADOS,
    semestres: [{ semestre: 11, acertoPct: 61, emEvidencia: true }],
  };

  it('não exibe "Acerto por semestre" quando há apenas um', () => {
    render(<AcertoPorAreaESemestre dados={UM_SEMESTRE} semestre="6ano" matriz={MATRIZ} onRecorteChange={vi.fn()} />);

    expect(screen.queryByText('Acerto por semestre')).toBeNull();
    expect(screen.queryByTestId('semestre-11')).toBeNull();
    // A leitura por área continua — ela é o assunto do bloco.
    expect(screen.getByText('Acerto por grande área')).toBeInTheDocument();
  });

  it('com dois ou mais semestres, a seção volta', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} onRecorteChange={vi.fn()} />);
    expect(screen.getByText('Acerto por semestre')).toBeInTheDocument();
  });

  /** Zero semestres é ausência, não redundância — e ausência o portal diz. */
  it('com nenhum semestre, continua dizendo que não há dado', () => {
    render(
      <AcertoPorAreaESemestre dados={{ ...DADOS, semestres: [] }} semestre="6ano" matriz={MATRIZ} onRecorteChange={vi.fn()} />,
    );
    expect(screen.getByText('Sem dado de semestre neste recorte')).toBeInTheDocument();
  });
});

describe('AcertoPorAreaESemestre — afordância do clique cruzado', () => {
  /**
   * O cruzamento área × semestre é a funcionalidade central deste bloco e era
   * invisível: as linhas eram `<button>` sem cursor de mão, sem hover e sem
   * uma palavra dizendo que dava para clicar — só achava quem tropeçasse.
   */
  it('diz, em texto, que dá para clicar — nas duas leituras', () => {
    render(
      <AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} recorte={null} onRecorteChange={vi.fn()} />,
    );

    expect(screen.getByText(/Clique numa área para recortar os semestres/i)).toBeInTheDocument();
    expect(screen.getByText(/Clique num semestre para recortar as grandes áreas/i)).toBeInTheDocument();
  });

  it('sem cruzamento disponível, não promete clique nenhum', () => {
    render(
      <AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={[]} recorte={null} onRecorteChange={vi.fn()} />,
    );

    expect(screen.queryByText(/Clique numa área/i)).toBeNull();
    expect(screen.getByTestId('motivo-sem-cruzamento')).toBeInTheDocument();
  });

  /** Sem consumidor de recorte, o bloco é leitura pura — nada de "clique". */
  it('em modo não interativo, nenhuma dica de clique', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} />);
    expect(screen.queryByText(/Clique num/i)).toBeNull();
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

  /**
   * §11: indisponível não pode significar inalcançável. `disabled` tirava as
   * 17 barras da ordem de tabulação e deixava o motivo só no `title` (hover
   * do mouse) — o clique cruzado inteiro sumia para quem usa teclado ou
   * leitor de tela. `aria-disabled` mantém o foco e o motivo vira texto na
   * tela, ligado por `aria-describedby`.
   */
  it('sem matriz o cruzamento fica indisponível — mas focável, com o motivo perceptível sem mouse', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" recorte={null} onRecorteChange={onRecorteChange} />);

    const cirurgia = screen.getByRole('button', { name: /Cirurgia/ });
    expect(cirurgia).toHaveAttribute('aria-disabled', 'true');
    expect(cirurgia).not.toBeDisabled();

    cirurgia.focus();
    expect(cirurgia).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRecorteChange).not.toHaveBeenCalled();

    const motivo = screen.getByTestId('motivo-sem-cruzamento');
    expect(motivo).toHaveTextContent('Recorte cruzado indisponível para esta seleção');
    expect(cirurgia).toHaveAttribute('aria-describedby', motivo.id);
    expect(screen.getByRole('button', { name: /12º semestre/i })).toHaveAttribute(
      'title',
      'Recorte cruzado indisponível para esta seleção',
    );
    expect(screen.getByTestId('area-clinica')).toHaveTextContent('72%');
  });

  /**
   * docs/06-data-viz §4: "o item selecionado recebe contorno **e o restante
   * esmaece**". Sem o esmaecimento, um contorno de 1px era o único sinal de
   * que havia recorte ativo.
   */
  it('com recorte ativo, os itens não selecionados do mesmo eixo esmaecem', () => {
    render(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="geral"
        matriz={MATRIZ}
        recorte={{ tipo: 'area', id: 'cirurgia' }}
        onRecorteChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('area-cirurgia').className).toContain('opacity-100');
    expect(screen.getByTestId('area-clinica').className).toContain('opacity-40');
  });

  /** §07-motion, regra de ouro nº1: animar só `transform` e `opacity`. */
  it('as barras animam transform, nunca width/height', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="geral" />);

    const barraArea = screen.getByTestId('area-clinica').querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(barraArea.style.transform).toContain('scaleX');
    expect(barraArea.style.transition).toContain('transform');
    expect(barraArea.style.width).not.toMatch(/\d+%/);

    const barraSemestre = screen.getByTestId('semestre-11').querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(barraSemestre.style.transform).toContain('scaleY');
    expect(barraSemestre.style.height).not.toMatch(/\d+%/);
  });

  it('sem os callbacks o bloco continua sendo só leitura (Task 51 intacta)', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('area-clinica')).toHaveTextContent('72%');
  });
});
