// src/features/gestor/__tests__/contrasteNomeSelecionado.test.tsx
//
// Achado F1 da revisão final do Portal do Gestor v2 (o único que bloqueava o
// merge): interação entre dois lotes paralelos, nenhum dos dois revisado
// isoladamente pegaria.
//
//   - Item C4 atenuou nome e semestre do aluno que NÃO participou para
//     `--gp-text-3` (`TabelaAlunosSimulado.tsx`).
//   - Item A4 trocou `--gp-brand-surface` de alfa 8% sobre o vinho para o
//     literal OPACO `hsl(0 80.6% 93.9%)` (claro) / `hsl(355 35.4% 12.7%)`
//     (escuro).
//   - Quando a linha do não participante está SELECIONADA
//     (`TabelaGestor.tsx`, `LinhaTabela`), o fundo passa a ser exatamente
//     `--gp-brand-surface`. O par `--gp-text-3` sobre essa superfície mede
//     3,98:1 — abaixo do mínimo AA de 4,5:1, num NOME PRÓPRIO (conteúdo
//     primário, não decoração).
//
// CORREÇÃO: a linha selecionada usa `--gp-text-2` em vez de `--gp-text-3`
// para o não participante (`TabelaAlunosSimulado.tsx`, `corAtenuada`).
// `--gp-text-2` é `hsl(var(--foreground) / 0.78)` — TEM ALFA. Por isso o que
// importa não é o token isolado, é o valor COMPOSTO sobre a superfície de
// marca (mesma matemática de `compositar()` que `contrasteDestructive.test.tsx`
// já usa para `bg-destructive/10` etc.).
//
// Mesma metodologia das outras suítes de contraste deste diretório: (1) render
// prova que o nó certo troca de cor na seleção — já cobre
// `TabelaAlunosSimulado.test.tsx` ("na linha selecionada..."); (2) aqui, só a
// matemática WCAG 2.1 a partir dos valores REAIS de `gestor-theme.css` e
// `src/index.css` nesse exato momento — nunca `toBe(numero)` cego.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..');
const CSS_TEMA = readFileSync(resolve(RAIZ, 'gestor-theme.css'), 'utf-8');
const INDEX_CSS = readFileSync(resolve(RAIZ, '../../index.css'), 'utf-8');

type RGB = [number, number, number];

function hslParaRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function parseHslTripla(tripla: string): RGB {
  const [h, s, l] = tripla.trim().split(/\s+/);
  return hslParaRgb(parseFloat(h), parseFloat(s) / 100, parseFloat(l) / 100);
}

function luminanciaRelativa([r, g, b]: RGB): number {
  const canal = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function razaoDeContraste(fg: RGB, bg: RGB): number {
  const l1 = luminanciaRelativa(fg);
  const l2 = luminanciaRelativa(bg);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Alpha-composite de fg (com opacidade) sobre bg opaco — mesma matemática do
 * navegador para `hsl(var(--foreground) / 0.78)` etc. */
function compositar(fg: RGB, alpha: number, bg: RGB): RGB {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as RGB;
}

function blocoDe(css: string, seletor: string): string {
  const inicioSeletor = css.indexOf(`${seletor} {`);
  if (inicioSeletor < 0) throw new Error(`seletor não encontrado: ${seletor}`);
  const inicioChave = css.indexOf('{', inicioSeletor);
  let profundidade = 0;
  for (let i = inicioChave; i < css.length; i += 1) {
    if (css[i] === '{') profundidade += 1;
    else if (css[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return css.slice(inicioChave + 1, i);
    }
  }
  throw new Error(`chave de fechamento não encontrada para: ${seletor}`);
}

function valorTripla(bloco: string, token: string): string {
  const m = bloco.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ausente no bloco: ${token}`);
  const valor = m[1].trim();
  const comHsl = valor.match(/^hsl\(([^)]+)\)$/);
  return comHsl ? comHsl[1] : valor;
}

const claroTema = blocoDe(CSS_TEMA, '.gestor-portal');
const escuroTema = blocoDe(CSS_TEMA, '.dark .gestor-portal');
const claroIndex = blocoDe(INDEX_CSS, ':root');
const escuroIndex = blocoDe(INDEX_CSS, '.dark');

const foregroundClaro = parseHslTripla(valorTripla(claroIndex, '--foreground'));
const foregroundEscuro = parseHslTripla(valorTripla(escuroIndex, '--foreground'));
const mutedForegroundClaro = parseHslTripla(valorTripla(claroIndex, '--muted-foreground'));
const mutedForegroundEscuro = parseHslTripla(valorTripla(escuroIndex, '--muted-foreground'));
const brandSurfaceClaro = parseHslTripla(valorTripla(claroTema, '--gp-brand-surface'));
const brandSurfaceEscuro = parseHslTripla(valorTripla(escuroTema, '--gp-brand-surface'));

// --gp-text-2 = hsl(var(--foreground) / 0.78) — o alfa está hardcoded na
// declaração do token em gestor-theme.css (não é uma variável própria), então
// aqui ele é o mesmo 0.78 documentado no comentário de `corAtenuada()` em
// TabelaAlunosSimulado.tsx. Se algum dia esse alfa mudar em gestor-theme.css
// sem atualizar aqui, o teste ainda reprova sozinho: a asserção do bloco 1
// confere o texto-fonte do arquivo.
const ALFA_TEXT_2 = 0.78;

describe('fonte — --gp-text-2 continua declarado como hsl(var(--foreground) / 0.78)', () => {
  it('gestor-theme.css não mudou o alfa sem atualizar esta suíte', () => {
    const regra = /--gp-text-2:\s*hsl\(var\(--foreground\)\s*\/\s*([\d.]+)\);/;
    const mClaro = claroTema.match(regra);
    expect(mClaro, '--gp-text-2 não encontrado (ou fora do formato esperado) em .gestor-portal').not.toBeNull();
    expect(parseFloat(mClaro![1])).toBeCloseTo(ALFA_TEXT_2, 5);
  });
});

describe('matemática WCAG 2.1 — achado F1: nome/semestre do não participante, linha SELECIONADA', () => {
  it('o valor OLD (--gp-text-3 sobre --gp-brand-surface) reprova AA nos dois temas — documentação executável do achado', () => {
    const claro = razaoDeContraste(mutedForegroundClaro, brandSurfaceClaro);
    const escuro = razaoDeContraste(mutedForegroundEscuro, brandSurfaceEscuro);

    expect(claro).toBeLessThan(4.5);
    expect(Math.round(claro * 100) / 100).toBeCloseTo(3.98, 1);
    // No escuro o par nem chega a ser o achado (a opacidade nova do fundo
    // ainda dá corpo suficiente) — registrado por completude, não é o que o
    // F1 corrige.
    expect(escuro).toBeGreaterThanOrEqual(4.5);
  });

  it('a correção (--gp-text-2 COMPOSTO sobre --gp-brand-surface) passa AA (>=4,5:1) nos dois temas', () => {
    const compostoClaro = compositar(foregroundClaro, ALFA_TEXT_2, brandSurfaceClaro);
    const compostoEscuro = compositar(foregroundEscuro, ALFA_TEXT_2, brandSurfaceEscuro);

    const claro = razaoDeContraste(compostoClaro, brandSurfaceClaro);
    const escuro = razaoDeContraste(compostoEscuro, brandSurfaceEscuro);

    expect(claro).toBeGreaterThanOrEqual(4.5);
    expect(escuro).toBeGreaterThanOrEqual(4.5);
    // Números do relatório da revisão final (recalculados aqui, não copiados
    // às cegas): 7,97:1 no claro, 8,81:1 no escuro.
    expect(Math.round(claro * 100) / 100).toBeCloseTo(7.97, 1);
    expect(Math.round(escuro * 100) / 100).toBeCloseTo(8.81, 1);
  });

  it('--gp-text-2 composto fica ABAIXO de --gp-text-1 (opaco) — mantém alguma atenuação em relação ao participante', () => {
    const compostoClaro = compositar(foregroundClaro, ALFA_TEXT_2, brandSurfaceClaro);
    const compostoEscuro = compositar(foregroundEscuro, ALFA_TEXT_2, brandSurfaceEscuro);

    const contrasteText1Claro = razaoDeContraste(foregroundClaro, brandSurfaceClaro);
    const contrasteText1Escuro = razaoDeContraste(foregroundEscuro, brandSurfaceEscuro);
    const contrasteText2Claro = razaoDeContraste(compostoClaro, brandSurfaceClaro);
    const contrasteText2Escuro = razaoDeContraste(compostoEscuro, brandSurfaceEscuro);

    expect(contrasteText2Claro).toBeLessThan(contrasteText1Claro);
    expect(contrasteText2Escuro).toBeLessThan(contrasteText1Escuro);
  });
});
