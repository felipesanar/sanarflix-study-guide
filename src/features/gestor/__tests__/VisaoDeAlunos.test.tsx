// src/features/gestor/__tests__/VisaoDeAlunos.test.tsx
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { CascataDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { VisaoDeAlunos } from '@/features/gestor/components/VisaoDeAlunos';
import { visaoGeralFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({
  useDiagnostico: vi.fn(() => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() })),
}));

describe('VisaoDeAlunos', () => {
  it('mostra a distribuição pelos 3 grupos de evolução com quantidade e percentual', () => {
    render(<VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />);

    const proficiente = screen.getByTestId('grupo-consistentemente_proficiente');
    expect(proficiente).toHaveTextContent('Consistentemente proficiente');
    expect(proficiente).toHaveTextContent('48');
    expect(proficiente).toHaveTextContent('42%');

    expect(screen.getByTestId('grupo-em_variacao')).toHaveTextContent('Em variação');
    expect(screen.getByTestId('grupo-consistentemente_nao_proficiente')).toHaveTextContent(
      'Consistentemente não proficiente',
    );
  });

  it('mostra a dispersão dentro do bloco, abaixo da distribuição', () => {
    render(<VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />);
    const bloco = screen.getByTestId('bloco-visao-alunos');
    const distribuicao = screen.getByTestId('distribuicao-alunos');
    const dispersao = screen.getByTestId('dispersao-alunos');

    expect(bloco).toContainElement(dispersao);
    expect(distribuicao.compareDocumentPosition(dispersao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /**
   * A ordem entre este bloco e o Diagnóstico é decidida pela ROTA (a referência
   * promove o Diagnóstico para cima), e está provada em `VisaoGeral.test.tsx`.
   * Aqui só resta o que é responsabilidade DESTE componente: o CTA que leva à
   * tabela de alunos. A copy é fechada no handoff — "Ver visão detalhada",
   * nunca "drill-down".
   */
  it('oferece o CTA "Ver visão detalhada" apontando para a tabela de alunos', () => {
    render(
      <>
        <CascataDiagnostico
          resumo={visaoGeralFake.diagnosticoResumo}
          recorte={{ iesId: 'ies-1', semestre: '6ano' }}
          onAbrirTemas={vi.fn()}
        />
        <VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />
      </>,
    );

    const cta = screen.getByTestId('link-visao-detalhada');
    expect(cta).toHaveTextContent('Ver visão detalhada');
    expect(cta).toHaveAttribute('href', '#alunos-detalhe');
    expect(screen.getByTestId('bloco-visao-alunos').textContent).not.toMatch(/drill/i);
  });

  it('o semáforo dos grupos vem de token do tema, nunca de paleta crua do Tailwind', () => {
    const { container } = render(
      <VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />,
    );
    expect(container.innerHTML).toContain('var(--gp-success)');
    expect(container.innerHTML).not.toMatch(/bg-(emerald|amber|red|slate)-\d{3}/);
  });

  it('mostra estado vazio de distribuição sem alunos', () => {
    render(<VisaoDeAlunos distribuicao={[]} dispersao={[]} />);
    expect(screen.getByTestId('distribuicao-vazia')).toHaveTextContent('Sem alunos com resultado neste recorte');
  });

  it('renderiza a quantidade 0 legitimamente (grupo vazio de verdade) sem confundir com percentual ausente', () => {
    render(
      <VisaoDeAlunos
        distribuicao={[
          { grupo: 'consistentemente_proficiente', quantidade: 0, percentual: null },
          { grupo: 'em_variacao', quantidade: 5, percentual: 100 },
          { grupo: 'consistentemente_nao_proficiente', quantidade: 0, percentual: null },
        ]}
        dispersao={[]}
      />,
    );
    const proficiente = screen.getByTestId('grupo-consistentemente_proficiente');
    // quantidade 0 é dado real (spec §4.10) — não pode virar TRACO.
    expect(proficiente).toHaveTextContent('0');
    // percentual null é ausência — TRACO, nunca '0%'.
    expect(proficiente).toHaveTextContent('—');
    expect(proficiente).not.toHaveTextContent('0%');
  });

  /**
   * Task 46.5 (QA de fim de fase): o rótulo VISÍVEL já dizia TRACO para
   * `percentual: null`, mas a barra anunciava `aria-valuenow="0"` — leitor de
   * tela ouvia "0 por cento" onde ninguém mediu nada. Zero afirma "medimos e
   * deu zero"; ausência tem que continuar ausência nos dois canais (spec
   * §4.10). WAI-ARIA: progressbar sem `aria-valuenow` é indeterminada — é
   * exatamente o estado deste dado.
   */
  it('percentual ausente não anuncia 0% na barra: aria-valuenow fica indeterminado', () => {
    render(
      <VisaoDeAlunos
        distribuicao={[
          { grupo: 'consistentemente_proficiente', quantidade: 0, percentual: null },
          { grupo: 'em_variacao', quantidade: 5, percentual: 100 },
          { grupo: 'consistentemente_nao_proficiente', quantidade: 3, percentual: 60 },
        ]}
        dispersao={[]}
      />,
    );

    const semDado = screen
      .getByTestId('grupo-consistentemente_proficiente')
      .querySelector('[role="progressbar"]');
    expect(semDado).not.toBeNull();
    expect(semDado).not.toHaveAttribute('aria-valuenow');

    // Com dado real, o valor continua sendo anunciado.
    const comDado = screen.getByTestId('grupo-em_variacao').querySelector('[role="progressbar"]');
    expect(comDado).toHaveAttribute('aria-valuenow', '100');
  });
});
