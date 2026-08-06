import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { SeletorSimulados } from '@/features/gestor/components/SeletorSimulados';
import type { ItemCronograma } from '@/features/gestor/api/types';

const item = (over: Partial<ItemCronograma>): ItemCronograma => ({
  id: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  status: 'realizado',
  modalidade: 'online',
  participantes: 40,
  ...over,
});

const REALIZADOS: ItemCronograma[] = [
  item({ id: 's1', nome: 'Simulado 1' }),
  item({ id: 's2', nome: 'Simulado 2' }),
  item({ id: 's3', nome: 'Simulado 3' }),
  item({ id: 's4', nome: 'Simulado 4' }),
  item({ id: 's5', nome: 'Simulado 5' }),
  item({ id: 's6', nome: 'Simulado 6' }),
];

/** O painel de checkboxes nasce fechado (referência §10.4: "Simulados: … ▾"). */
const abrirPainel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Escolher simulados' }));
};

describe('SeletorSimulados', () => {
  it('não oferece nenhuma opção "todos" — a seleção é sempre explícita (§4.7.1)', async () => {
    const user = userEvent.setup();
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 2)} selecionados={['s1']} onChange={vi.fn()} />);
    await abrirPainel(user);

    expect(screen.queryByRole('checkbox', { name: /todos/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /todos/i })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('a lista é de CHECKBOX, com nome · data · modalidade em cada linha (§10.4)', async () => {
    const user = userEvent.setup();
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 2)} selecionados={['s1']} onChange={vi.fn()} />);
    await abrirPainel(user);

    // Só o nome deixaria dois simulados parecidos indistinguíveis; `data` e
    // `modalidade` já vêm no ItemCronograma e antes eram ignorados.
    expect(screen.getByRole('checkbox', { name: 'Simulado 1 · 10/03 · online' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Simulado 2 · 10/03 · online' })).not.toBeChecked();
  });

  it('desabilita simulado previsto e em processamento, mostrando o motivo (§4.7.1, §4.10)', async () => {
    const user = userEvent.setup();
    render(
      <SeletorSimulados
        itens={[
          item({ id: 's1', nome: 'Simulado 1' }),
          item({ id: 's2', nome: 'Simulado 2', status: 'processing' }),
          item({ id: 's3', nome: 'Simulado 3', status: 'previsto', data: null }),
          item({ id: 's4', nome: 'Simulado 4', status: 'agendado' }),
        ]}
        selecionados={['s1']}
        onChange={vi.fn()}
      />,
    );
    await abrirPainel(user);

    expect(screen.getByRole('checkbox', { name: 'Simulado 1 · 10/03 · online' })).toBeEnabled();
    expect(
      screen.getByRole('checkbox', { name: 'Simulado 2 · 10/03 · online — Gabarito em processamento' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'Simulado 3 · online — Simulado previsto, sem data definida' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'Simulado 4 · 10/03 · online — Simulado ainda não realizado' }),
    ).toBeDisabled();
    expect(screen.getByText('Gabarito em processamento')).toBeInTheDocument();
  });

  it('soma o id ao marcar um simulado não selecionado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1']} onChange={onChange} />);
    await abrirPainel(user);

    await user.click(screen.getByRole('checkbox', { name: 'Simulado 2 · 10/03 · online' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('permite chegar a zero e então cobra a seleção mínima — nunca cai em "todos"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1']} onChange={onChange} />,
    );
    await abrirPainel(user);

    await user.click(screen.getByRole('checkbox', { name: 'Simulado 1 · 10/03 · online' }));
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(<SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={[]} onChange={onChange} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha ao menos um simulado');
  });

  describe('chip removível — o caminho de saída que faltava', () => {
    it('cada selecionado vira chip com "×" que o tira do recorte', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1', 's2']} onChange={onChange} />,
      );

      // Sem abrir o painel: o chip vive no campo, sempre visível.
      await user.click(screen.getByRole('button', { name: 'Remover Simulado 2 do recorte' }));
      expect(onChange).toHaveBeenCalledWith(['s1']);
    });

    it('remove também um simulado que ficou INDISPONÍVEL depois de selecionado', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      // Cenário real: o gabarito de um simulado já escolhido volta para
      // processamento. Na lista ele fica desabilitado — sem o chip, o recorte
      // ficaria preso nele para sempre.
      render(
        <SeletorSimulados
          itens={[item({ id: 's1', nome: 'Simulado 1' }), item({ id: 's2', nome: 'Simulado 2', status: 'processing' })]}
          selecionados={['s1', 's2']}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Remover Simulado 2 do recorte' }));
      expect(onChange).toHaveBeenCalledWith(['s1']);
    });
  });

  it('acima de 5 simulados avisa sobre legibilidade sem bloquear (§4.7.2, caso 5)', async () => {
    const user = userEvent.setup();
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5', 's6']} onChange={vi.fn()} />);

    const aviso = screen.getByTestId('aviso-legibilidade');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent('6 selecionados');
    expect(screen.queryByRole('alert')).toBeNull();

    // Aviso, nunca bloqueio: todas as linhas seguem marcáveis.
    await abrirPainel(user);
    REALIZADOS.forEach((s) =>
      expect(screen.getByRole('checkbox', { name: `${s.nome} · 10/03 · online` })).toBeEnabled(),
    );
  });

  it('o aviso é um callout de atenção com o glifo Dendê error_outline, não texto cinza', () => {
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5', 's6']} onChange={vi.fn()} />);

    const aviso = screen.getByTestId('aviso-legibilidade');
    expect(aviso.style.background).toBe('var(--gp-warning-surface)');
    expect(aviso.querySelector('.icon-dende-icons-error_outline-outlined')).not.toBeNull();
  });

  it('não avisa com exatamente 5 selecionados (o limiar é "acima de 5")', () => {
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5']} onChange={vi.fn()} />);
    expect(screen.queryByTestId('aviso-legibilidade')).toBeNull();
  });

  it('o erro de seleção vazia usa error_outline — `info` é reservado a informação (§3)', () => {
    const { container } = render(
      <SeletorSimulados itens={REALIZADOS.slice(0, 2)} selecionados={[]} onChange={vi.fn()} />,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta.querySelector('.icon-dende-icons-error_outline-outlined')).not.toBeNull();
    expect(container.querySelector('.icon-dende-icons-info-outlined')).toBeNull();
  });

  it('a nota de escopo fica sempre visível, não só no estado vazio', () => {
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 2)} selecionados={['s1']} onChange={vi.fn()} />);
    expect(
      screen.getByText(/Não existe "todos" — o agregado do período é a Visão Geral/),
    ).toBeInTheDocument();
  });
});
