import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { KpiCard } from '@/features/gestor/components/KpiCard';
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

  it('formata o delta com sinal explícito', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={-2} serie={serieCompleta} />);
    expect(screen.getByTestId('kpi-delta')).toHaveTextContent('-2');
  });

  it('mostra o badge "projetado" quando informado', () => {
    render(<KpiCard titulo="Conceito ENAMED projetado" valor="3/5" meta={meta} badge="projetado" />);
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
        valor="3 de 7"
        meta={meta}
        trilha={{ feitos: 3, total: 7 }}
        rodape={<a href="/gestor">Ver cronograma</a>}
      />
    );
    expect(screen.getByTestId('kpi-trilha')).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('link', { name: 'Ver cronograma' })).toBeInTheDocument();
  });

  it('expõe a rastreabilidade com Período, Fonte, Atualizado em e Critério', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} criterio="Critério do KPI" />);
    const texto = screen.getByTestId('rastreabilidade-texto');
    expect(texto).toHaveTextContent('Período: 2026.1');
    expect(texto).toHaveTextContent('Fonte: Simulados ENAMED SanarFlix');
    expect(texto).toHaveTextContent('Atualizado em: 20/07/2026');
    expect(texto).toHaveTextContent('Critério: Critério do KPI');
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
});
