import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Guarda de uma DECISÃO, não de um comportamento derivado.
 *
 * Os três gráficos Recharts do portal nunca animam: `isAnimationActive={false}`
 * está cravado desde a Fase 4. A Task 59b previa trocar isso por
 * `isAnimationActive={!prefereMovimentoReduzido}`, partindo da premissa de que
 * a animação estava LIGADA e precisava ser suprimida sob
 * `prefers-reduced-motion`. **A premissa estava errada** — ela já estava
 * suprimida para todo mundo, e a troca teria LIGADO movimento novo para quem
 * não pediu redução nenhuma.
 *
 * Decisão do Felipe em 05/08: fica estático para todos. Animação que não
 * existe não precisa ser suprimida, a conformidade com `prefers-reduced-motion`
 * segue satisfeita, e estrear movimento na véspera do piloto seria mudança
 * visual que ninguém validou em navegador.
 *
 * Este teste existe porque a troca já foi feita uma vez, de boa-fé, seguindo o
 * plano ao pé da letra. Sem ele, a próxima leitura do plano refaz.
 *
 * Análise estática de propósito: provar a prop por render exigiria mockar o
 * Recharts inteiro, e o que se quer travar aqui é a decisão escrita no código,
 * não o efeito visual — que o jsdom não desenha de qualquer forma.
 */

const CHARTS = resolve(__dirname, '..', 'charts');

const ARQUIVOS = ['EvolucaoChart.tsx', 'AreasChart.tsx', 'DispersaoChart.tsx'] as const;

describe('gráficos do gestor: animação desligada por decisão (spec §11)', () => {
  it.each(ARQUIVOS)('%s mantém isAnimationActive={false} em todo componente Recharts', (arquivo) => {
    const src = readFileSync(join(CHARTS, arquivo), 'utf-8').replace(/\r\n/g, '\n');

    const ocorrencias = src.match(/isAnimationActive=\{[^}]*\}/g) ?? [];
    expect(ocorrencias.length, `${arquivo} não declara isAnimationActive`).toBeGreaterThan(0);
    ocorrencias.forEach((oc) => {
      expect(oc, `${arquivo}: animação virou condicional — ver cabeçalho deste teste`).toBe(
        'isAnimationActive={false}',
      );
    });

    // `animationDuration` só faz sentido com animação ligada; se aparecer,
    // alguém religou por outro caminho.
    expect(src, `${arquivo} declara animationDuration com a animação desligada`).not.toMatch(
      /animationDuration/,
    );
  });

  it('DistribuicaoAlternativas não usa Recharts — a barra é CSS e já cai no bloco reduced-motion', () => {
    const src = readFileSync(join(CHARTS, 'DistribuicaoAlternativas.tsx'), 'utf-8');
    // O plano, e o comentário que a Task 59b deixou no `gestor-theme.css`,
    // falam em "os 4 gráficos". São 3: este componente é `<ul>`/`<li>` com
    // transição em Tailwind, já coberta pelo
    // `@media (prefers-reduced-motion: reduce)` escopado em `.gestor-portal`.
    //
    // A barra passou a animar `transform` (scaleX de origem à esquerda) em vez
    // de `width`: o handoff §8 é explícito em animar **só** transform e
    // opacity, que são as duas propriedades que o compositor resolve sem
    // recalcular layout — animar `width` força reflow a cada quadro.
    expect(src).not.toMatch(/from 'recharts'/);
    expect(src).toMatch(/transition-transform/);
    expect(src).not.toMatch(/transition-\[width\]/);
  });
});
