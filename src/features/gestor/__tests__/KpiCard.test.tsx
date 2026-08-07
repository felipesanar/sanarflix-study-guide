import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, userEvent, within } from '@/test/utils';
import { KpiCard } from '@/features/gestor/components/KpiCard';
import { DURACAO_COUNT_UP_MS } from '@/features/gestor/hooks/useCountUp';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

const meta: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const serieCompleta: PontoSerie[] = [
  { rotulo: '1º simulado', valor: 51 },
  { rotulo: 'anterior', valor: 58 },
  { rotulo: 'atual', valor: 62 },
];

describe('KpiCard', () => {
  it('mostra título, valor e a régua com os três pontos, com "atual" como ponto corrente', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} serie={serieCompleta} delta={4} />);

    expect(screen.getByTestId('kpi-titulo')).toHaveTextContent('Alunos proficientes');
    expect(screen.getByTestId('kpi-valor')).toHaveTextContent('62%');

    const regua = screen.getByTestId('kpi-regua');
    expect(regua).toBeInTheDocument();
    expect(regua.querySelectorAll('li')).toHaveLength(3);
    expect(regua).toHaveTextContent('1º simulado');
    expect(regua).toHaveTextContent('anterior');
    expect(regua).toHaveTextContent('atual');
    expect(regua).not.toHaveTextContent('último');
  });

  it('SOME com a régua quando há apenas 1 simulado realizado (um ponto na série)', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="51%" meta={meta} serie={[{ rotulo: 'atual', valor: 51 }]} />);
    expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
  });

  it('mostra a régua com dois pontos quando há 2 simulados realizados', () => {
    render(
      <KpiCard
        titulo="Alunos proficientes"
        valor="58%"
        meta={meta}
        serie={[{ rotulo: '1º simulado', valor: 51 }, { rotulo: 'atual', valor: 58 }]}
      />
    );
    expect(screen.getByTestId('kpi-regua').querySelectorAll('li')).toHaveLength(2);
  });

  it('NÃO usa opacity para atenuar os rótulos/pontos não-correntes da régua (WCAG 1.4.3: opacity-60 sobre texto de 10px reprova contraste)', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} serie={serieCompleta} />);
    const itens = screen.getByTestId('kpi-regua').querySelectorAll('li');
    itens.forEach((item) => {
      expect(item.className).not.toMatch(/opacity-/);
    });
  });

  /**
   * A referência desenha a régua como UMA faixa emoldurada de células de
   * largura igual, com a célula corrente tintada de marca — não três itens
   * soltos separados por espaço. O peso da fonte sozinho não distinguia
   * "anterior" de "atual".
   */
  it('a régua é uma faixa emoldurada, com células de largura igual, divisores e a célula corrente destacada', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} serie={serieCompleta} />);
    const regua = screen.getByTestId('kpi-regua');

    expect(regua.style.border).toContain('var(--gp-border-subtle)');
    expect(regua.style.borderRadius).toBe('9px');

    const itens = Array.from(regua.querySelectorAll('li'));
    // `flex: 1` normaliza para a forma longa no CSSOM.
    itens.forEach((item) => expect(item.style.flex).toBe('1 1 0%'));
    // Divisor só entre células: o primeiro item não tem borda à esquerda.
    expect(itens[0].style.borderLeft).toBe('');
    expect(itens[1].style.borderLeft).toContain('var(--gp-border-subtle)');
    // Só a célula corrente é tintada.
    expect(itens[0].style.background).toBe('');
    expect(itens[2].style.background).toBe('var(--gp-brand-surface)');
  });

  it('o delta é uma pílula semântica com a base de comparação VISÍVEL, não só um texto colorido', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={-2} serie={serieCompleta} />);
    const delta = screen.getByTestId('kpi-delta');
    // U+2212 (minus real), não hífen — é o que TagDelta emite para tipografia tabular.
    expect(delta).toHaveTextContent('−2');
    expect(delta).toHaveTextContent('vs anterior');
    expect(delta.className).toContain('ml-auto');
  });

  it('delta ausente ou nulo NÃO renderiza pílula nenhuma — nunca um "0" de mentira (§10.5)', () => {
    const { rerender } = render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} />);
    expect(screen.queryByTestId('kpi-delta')).not.toBeInTheDocument();

    rerender(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={null} />);
    expect(screen.queryByTestId('kpi-delta')).not.toBeInTheDocument();

    rerender(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={0} />);
    expect(screen.getByTestId('kpi-delta')).toHaveTextContent('0');
  });

  it('mostra o número protagonista em 44px/800 com o tracking negativo da referência', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} />);
    const numero = screen.getByTestId('kpi-valor');
    expect(numero.style.fontSize).toBe('44px');
    expect(numero.style.fontWeight).toBe('800');
    expect(numero.style.letterSpacing).toBe('-0.035em');
  });

  it('mostra a linha de hint com o critério VISÍVEL sob o título, sem depender de hover', () => {
    render(
      <KpiCard titulo="Alunos proficientes" hint="acima de 60 de proficiência" valor="62%" meta={meta} />,
    );
    expect(screen.getByTestId('kpi-hint')).toHaveTextContent('acima de 60 de proficiência');
  });

  it('sem hint, nenhuma linha vazia é renderizada', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} />);
    expect(screen.queryByTestId('kpi-hint')).not.toBeInTheDocument();
  });

  it('o sufixo de escala é elemento próprio, subordinado ao número', () => {
    render(<KpiCard titulo="Conceito ENAMED" valor="4" sufixo="/ 5" meta={meta} />);
    expect(screen.getByTestId('kpi-valor')).toHaveTextContent('4');
    const sufixo = screen.getByTestId('kpi-sufixo');
    expect(sufixo).toHaveTextContent('/ 5');
    expect(sufixo.style.fontSize).toBe('13px');
  });

  it('no cartão de contrato o denominador ganha corpo (densidade "fracao")', () => {
    render(
      <KpiCard titulo="Simulados realizados" valor="3" sufixo="/ 7" densidadeSufixo="fracao" meta={meta} />,
    );
    expect(screen.getByTestId('kpi-sufixo').style.fontSize).toBe('20px');
  });

  it('mostra o badge "projetado" quando informado', () => {
    render(<KpiCard titulo="Conceito ENAMED" valor="3" meta={meta} badge="projetado" />);
    expect(screen.getByText('projetado')).toBeInTheDocument();
  });

  it('mostra o badge "cobertura parcial" quando meta.lowSample é true (spec §4.10)', () => {
    const metaLowSample: Meta = { ...meta, lowSample: true };
    render(<KpiCard titulo="Alunos proficientes" valor="17%" meta={metaLowSample} />);
    expect(screen.getByTestId('kpi-cobertura-parcial')).toHaveTextContent('cobertura parcial');
  });

  it('NÃO mostra o badge de cobertura parcial quando meta.lowSample é false', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} />);
    expect(screen.queryByTestId('kpi-cobertura-parcial')).not.toBeInTheDocument();
  });

  it('mostra a trilha e o rodapé quando informados', () => {
    render(
      <KpiCard
        titulo="Simulados realizados"
        valor="3"
        sufixo="/ 7"
        meta={meta}
        trilha={{ feitos: 3, total: 7 }}
        rodape={<a href="/gestor">Ver cronograma</a>}
      />
    );
    expect(screen.getByTestId('kpi-trilha')).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('link', { name: 'Ver cronograma' })).toBeInTheDocument();
  });

  /**
   * O gestor conta EVENTOS ("3 de 7 aplicados"), não percentual de conclusão:
   * a referência desenha um segmento por simulado contratado, não uma barra
   * contínua.
   */
  it('a trilha é segmentada — um pip por contratado — e diz quantos faltam', () => {
    render(
      <KpiCard
        titulo="Simulados realizados"
        valor="3"
        meta={meta}
        trilha={{ feitos: 3, total: 7 }}
      />
    );
    const trilha = screen.getByTestId('kpi-trilha');
    const pips = trilha.querySelectorAll('span');
    expect(pips).toHaveLength(7);
    expect(pips[2].getAttribute('style')).toContain('var(--gp-success)');
    expect(pips[3].getAttribute('style')).toContain('var(--gp-surface-3)');
    expect(screen.getByTestId('kpi-trilha-restantes')).toHaveTextContent('4 contratados ainda a realizar');
  });

  it('com o contrato inteiro cumprido, nenhuma linha de restantes é inventada', () => {
    render(<KpiCard titulo="Simulados realizados" valor="7" meta={meta} trilha={{ feitos: 7, total: 7 }} />);
    expect(screen.queryByTestId('kpi-trilha-restantes')).not.toBeInTheDocument();
  });

  it('o rodapé ganha o separador da referência (borda superior), não flutua colado ao conteúdo', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} rodape="56 de 104 alunos" />);
    const rodape = screen.getByTestId('kpi-rodape');
    expect(rodape).toHaveTextContent('56 de 104 alunos');
    expect(rodape.style.borderTop).toContain('var(--gp-border-subtle)');
  });

  it('expõe a rastreabilidade com Período, Fonte, Atualizado em e Critério', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} criterio="Critério do KPI" />);
    const texto = screen.getByTestId('rastreabilidade-texto');
    expect(texto).toHaveTextContent('Período: 2026.1');
    expect(texto).toHaveTextContent('Fonte: Simulados ENAMED SanarFlix');
    expect(texto).toHaveTextContent('Atualizado em: 20/07/2026');
    expect(texto).toHaveTextContent('Critério: Critério do KPI');
  });

  it('sem `criterio` próprio, o texto do tooltip vem de meta.criterio — nunca hardcoded (§10.5)', async () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} />);

    fireEvent.focus(screen.getByRole('button', { name: /rastreabilidade/i }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(meta.criterio);
  });

  it('o tooltip de rastreabilidade abre NO FOCO (não só no hover) e ESC fecha (§11)', async () => {
    const user = userEvent.setup();
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} />);

    const gatilho = screen.getByRole('button', { name: /rastreabilidade/i });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(gatilho);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('no estado loading mostra skeleton com altura reservada e nenhum valor', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} estado="loading" />);
    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-valor')).not.toBeInTheDocument();
  });

  it('no estado empty mostra o traço e não mostra régua', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="—" meta={meta} estado="empty" serie={serieCompleta} />);
    expect(screen.getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
  });

  it('no estado error oferece "Tentar novamente" que refaz só este bloco', async () => {
    const user = userEvent.setup();
    const onTentarNovamente = vi.fn();
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} estado="error" onTentarNovamente={onTentarNovamente} />);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onTentarNovamente).toHaveBeenCalledTimes(1);
  });

  /**
   * O Conceito ENAMED com 2+ simulados é comparativo por simulado, nunca
   * média (§4.1) — nesse caso o cartão não pode afirmar um valor único.
   */
  it('com `corpo`, o cartão não renderiza valor único algum', () => {
    render(
      <KpiCard
        testId="kpi-enamed"
        titulo="Conceito ENAMED"
        valor="4/5"
        meta={meta}
        corpo={<p>Simulado 1: 3/5 · Simulado 2: 4/5</p>}
      />
    );
    const card = screen.getByTestId('kpi-enamed');
    expect(within(card).queryByTestId('kpi-valor')).toBeNull();
    expect(card).toHaveTextContent('Simulado 1: 3/5');
  });

  /**
   * Item B1 do passe de conformidade — count-up de KPI (560ms, `--gp-ease`,
   * handoff `docs/07-motion.md`). `useCountUp.test.ts` prova a matemática da
   * curva e o hook isolado; aqui a prova é o TEXTO RENDERIZADO no `KpiCard`
   * real, com as duas props novas (`valorNumerico`/`formatarValor`) que os
   * consumidores passam de verdade.
   */
  describe('count-up (item B1)', () => {
    const formatarPercentual = (v: number) => `${Math.round(v)}%`;

    afterEach(() => {
      vi.useRealTimers();
    });

    it('(a) ao término da animação (560ms) o valor final aparece — e não antes disso', () => {
      vi.useFakeTimers();
      const { rerender } = render(
        <KpiCard
          titulo="Percentual de acerto"
          valor="50%"
          valorNumerico={50}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );
      expect(screen.getByTestId('kpi-valor')).toHaveTextContent('50%');

      rerender(
        <KpiCard
          titulo="Percentual de acerto"
          valor="80%"
          valorNumerico={80}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );
      // No meio do caminho, ainda não é o valor final.
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByTestId('kpi-valor')).not.toHaveTextContent('80%');

      // Passado o tempo total da animação (+ 1 quadro de sobra), é.
      act(() => {
        vi.advanceTimersByTime(DURACAO_COUNT_UP_MS);
      });
      expect(screen.getByTestId('kpi-valor')).toHaveTextContent('80%');
    });

    it('(b) sob prefers-reduced-motion, o valor final aparece direto — nunca um número intermediário', () => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      );

      const { rerender } = render(
        <KpiCard
          titulo="Percentual de acerto"
          valor="50%"
          valorNumerico={50}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );

      rerender(
        <KpiCard
          titulo="Percentual de acerto"
          valor="80%"
          valorNumerico={80}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );
      // Sem avançar timer nenhum: se tivesse agendado `requestAnimationFrame`,
      // o texto ainda mostraria "50%" neste ponto.
      expect(screen.getByTestId('kpi-valor')).toHaveTextContent('80%');

      // Devolve o mock ao default do setup global, para não vazar para os
      // testes seguintes deste arquivo.
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      );
    });

    it('(c) uma nova mudança de valor NO MEIO da animação reinicia a contagem para o novo alvo', () => {
      vi.useFakeTimers();
      const { rerender } = render(
        <KpiCard
          titulo="Percentual de acerto"
          valor="0%"
          valorNumerico={0}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );

      rerender(
        <KpiCard
          titulo="Percentual de acerto"
          valor="100%"
          valorNumerico={100}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(Math.round(DURACAO_COUNT_UP_MS / 2));
      });
      const textoNoMeio = screen.getByTestId('kpi-valor').textContent;
      expect(textoNoMeio).not.toBe('0%');
      expect(textoNoMeio).not.toBe('100%');

      rerender(
        <KpiCard
          titulo="Percentual de acerto"
          valor="20%"
          valorNumerico={20}
          formatarValor={formatarPercentual}
          meta={meta}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(DURACAO_COUNT_UP_MS);
      });
      expect(screen.getByTestId('kpi-valor')).toHaveTextContent('20%');
    });

    it('sem `valorNumerico`/`formatarValor`, cai no comportamento de hoje: imprime `valor` direto, sem animar', () => {
      render(<KpiCard titulo="Percentual de acerto" valor="80%" meta={meta} />);
      expect(screen.getByTestId('kpi-valor')).toHaveTextContent('80%');
    });

    it('estado `empty` continua imprimindo o traço, mesmo com `valorNumerico` informado — nunca anima', () => {
      render(
        <KpiCard
          titulo="Percentual de acerto"
          valor="—"
          valorNumerico={80}
          formatarValor={formatarPercentual}
          meta={meta}
          estado="empty"
        />,
      );
      expect(screen.getByTestId('kpi-valor')).toHaveTextContent('—');
    });
  });
});
