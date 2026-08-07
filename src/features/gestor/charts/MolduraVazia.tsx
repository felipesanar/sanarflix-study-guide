// src/features/gestor/charts/MolduraVazia.tsx
import * as React from 'react';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';

/**
 * Ticks do eixo Y. O valor da meta NÃO entra na lista: a linha tracejada de
 * meta ocupa essa faixa e traz o próprio rótulo, então repetir o número aqui
 * desenharia duas linhas e dois rótulos na mesma altura (handoff §7).
 */
const TICKS_Y = [100, 80, 40, 20, 0];

/** Só a dispersão tem grade vertical (handoff §7, princípio 1). */
const COLUNAS_VERTICAIS = [25, 50, 75];

export interface MolduraVaziaProps {
  /** Frase que substitui a série. Nunca um número — ausência não vira zero. */
  mensagem: string;
  altura?: number;
  /** Rótulo da linha de meta, à direita, dentro do plot. */
  rotuloMeta?: string;
  comGradeVertical?: boolean;
  testId?: string;
}

/**
 * Estado vazio DESENHADO dos gráficos (handoff docs/06, princípio 7): o card
 * mantém eixos, grade e linha de meta, e a mensagem fica por cima — o gestor
 * continua enxergando a escala em que o dado apareceria, em vez de receber um
 * retângulo em branco com uma frase solta.
 *
 * A moldura inteira é `aria-hidden`: sem série não há gráfico, logo não há
 * `role="img"` nem alternativa tabular a oferecer (o contrato de §11 vale para
 * gráfico desenhado — ver `__tests__/a11y.test.tsx`, que exige tabela dentro
 * de todo `figure` com `role="img"`). Quem lê por leitor de tela recebe a
 * mensagem, que é a informação inteira deste estado.
 */
export function MolduraVazia({
  mensagem,
  altura = 300,
  rotuloMeta = `meta de proficiência · ${PROFICIENCIA_MINIMA}`,
  comGradeVertical = false,
  testId,
}: MolduraVaziaProps) {
  return (
    <div data-testid={testId} className="relative w-full" style={{ height: altura }}>
      <div aria-hidden="true" className="absolute inset-x-0 inset-y-4">
        {comGradeVertical
          ? COLUNAS_VERTICAIS.map((posicao) => (
              <span
                key={posicao}
                className="absolute bottom-0 top-0 w-px"
                style={{
                  left: `calc(2rem + (100% - 2rem) * ${posicao / 100})`,
                  background: 'var(--gp-border-subtle)',
                }}
              />
            ))
          : null}

        {TICKS_Y.map((valor) => (
          <div
            key={valor}
            className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
            style={{ top: `${100 - valor}%` }}
          >
            <span
              className="w-8 shrink-0 text-right text-[11px] tabular-nums"
              style={{ color: 'var(--gp-axis)' }}
            >
              {valor}
            </span>
            {/* A base do plot é mais densa que as demais gridlines (handoff §7). */}
            <span
              className="h-px flex-1"
              style={{
                background: valor === 0 ? 'var(--gp-border-strong)' : 'var(--gp-border-subtle)',
              }}
            />
          </div>
        ))}

        <div
          className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
          style={{ top: `${100 - PROFICIENCIA_MINIMA}%` }}
        >
          <span className="w-8 shrink-0" />
          <span className="flex-1" style={{ borderTop: '1.5px dashed var(--gp-border-input)' }} />
          <span className="whitespace-nowrap text-[11px]" style={{ color: 'var(--gp-text-3)' }}>
            {rotuloMeta}
          </span>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-8">
        <p
          className="rounded-xl px-4 py-2 text-center text-sm"
          style={{ background: 'var(--gp-surface-1)', color: 'var(--gp-text-3)' }}
        >
          {mensagem}
        </p>
      </div>
    </div>
  );
}
