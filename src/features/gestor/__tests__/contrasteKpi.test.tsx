// src/features/gestor/__tests__/contrasteKpi.test.tsx
//
// ACHADO (medido no navegador real, getComputedStyle, sessão de gestor real
// — IES B2B, http://localhost:8080/gestor/visao-geral): a legenda de variação
// dos KPIs na Visão Geral — o delta negativo do KpiCard, span
// `data-testid="kpi-delta"` — usava a classe `text-destructive`
// (`var(--destructive)` de `src/index.css`), que reprova WCAG AA nos DOIS
// temas contra o fundo real do card:
//   claro:  rgb(239,67,67)  sobre rgb(255,255,255)     → 3,78:1  (mín. 4,5:1)
//   escuro: rgb(207,48,48)  sobre rgb(22,24,29)         → 3,48:1  (mín. 4,5:1)
// e o pior: no escuro a cor ESCURECE (L 60%→50%) em vez de clarear — o
// oposto da regra do próprio tema do portal (`gestor-theme.css`, §Tema
// escuro: "hover no escuro CLAREIA... nunca o contrário").
//
// CORREÇÃO: a classe do delta negativo trocou de `text-destructive` para
// `gp-text-danger` (nova, `gestor-theme.css`), que resolve para
// `--gp-danger-on` — token que já existia no arquivo, nunca consumido até
// agora. Contra o mesmo fundo real do card:
//   claro:  rgb(120,18,18)   sobre rgb(255,255,255)    → 11,09:1
//   escuro: rgb(241,134,126) sobre rgb(22,24,29)        →  7,15:1
// Os dois acima do mínimo AA (4,5:1), com folga, e o escuro agora CLAREIA
// (L 27%→72%). Confirmado com um nó temporário injetado dentro de um
// `[data-testid="kpi-card"]` real (mesma sessão acima), lido via
// `getComputedStyle` e removido em seguida — script e saída completos no
// relatório final, não reproduzidos aqui.
//
// O QUE ESTA SUÍTE PROVA, E O QUE JSDOM NÃO CONSEGUE PROVAR AQUI
// (documentado, não escondido — mesma limitação já registrada em
// `a11y.test.tsx`, que por isso desliga a regra `color-contrast` do axe:
// "jsdom não calcula layout nem cor computada"):
//
//   1) RENDER (jsdom É confiável aqui): o nó `kpi-delta` troca de classe de
//      verdade quando delta < 0 — via Testing Library, DOM real.
//   2) ANÁLISE ESTÁTICA DE TEXTO-FONTE (independe de jsdom): a regra CSS
//      existe em `gestor-theme.css` e referencia o TOKEN (`var(--gp-danger-on)`),
//      nunca um literal solto — mesmo padrão que `tema.test.tsx` já usa para
//      o resto do arquivo.
//   3) MATEMÁTICA DE CONTRASTE (independe de jsdom): WCAG 2.1 (luminância
//      relativa + razão de contraste) calculado a partir dos valores LITERAIS
//      lidos de `gestor-theme.css` e `src/index.css` nesse exato momento —
//      não uma alegação fixa (`toBe(11.09)` cego), mas um cálculo executável
//      sobre o texto real dos dois arquivos, que reprova sozinho se alguém
//      mudar `--gp-danger-on` ou `--card` sem recalcular.
//
//   O que NENHUM dos três prova, e que só o navegador real prova: que o
//   NAVEGADOR de fato aplica essa regra a ESTE nó depois de toda a cascata
//   real (especificidade, ordem de import, Tailwind JIT, etc.) — jsdom não
//   tem motor de layout/pintura, então `getComputedStyle(span).color` aqui
//   não resolve `color: var(--gp-danger-on)` vindo de um CSS importado de
//   arquivo (jsdom só resolve valor LITERAL de custom property lida no
//   PRÓPRIO nó que a declara — é por isso que `tema.test.tsx` restringe seus
//   testes de computed style à raiz `.gestor-portal`, nunca a um descendente).
//   Essa prova final foi feita manualmente no navegador (ver relatório).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@/test/utils';
import { KpiCard } from '@/features/gestor/components/KpiCard';
import type { Meta } from '@/features/gestor/api/types';

const RAIZ = resolve(__dirname, '..');
const CSS_TEMA = readFileSync(resolve(RAIZ, 'gestor-theme.css'), 'utf-8');
const INDEX_CSS = readFileSync(resolve(RAIZ, '../../index.css'), 'utf-8');
const KPI_CARD_SRC = readFileSync(resolve(RAIZ, 'components/KpiCard.tsx'), 'utf-8');

const meta: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const classesDe = (elemento: Element) => new Set(elemento.className.split(/\s+/).filter(Boolean));

/* ---------------------------------------------------------------------- */
/* 1) Render: o nó certo troca de classe — DOM real via Testing Library.  */
/* ---------------------------------------------------------------------- */

/**
 * ATUALIZADO no passe de conformidade: o delta deixou de ser texto solto com
 * classe Tailwind e passou a ser a **pílula `<TagDelta>`** da anatomia §5 do
 * handoff (par `on`/`surface`, raio pill, seta Fontello). O achado original
 * continua valendo e a matemática abaixo continua provando o mesmo — o que
 * mudou é o VEÍCULO da cor: antes classe utilitária, agora token inline.
 *
 * A troca também resolveu, de lado, uma segunda divergência que este arquivo
 * documentava sem tratar: o delta POSITIVO usava `text-emerald-600`, uma cor
 * da paleta crua do Tailwind, fora do sistema de tokens do portal. Hoje é
 * `--gp-success-on` sobre `--gp-success-surface`, e o bloco 3 mede o contraste
 * dele também.
 */
const estiloDe = (elemento: Element) => (elemento as HTMLElement).getAttribute('style') ?? '';
const pilulaDeltaDe = (raiz: HTMLElement) => raiz.querySelector('span[style]') as HTMLElement;

describe('KpiCard — a pílula de delta usa o par semântico (render real, jsdom confiável aqui)', () => {
  it('delta negativo usa --gp-danger-on sobre --gp-danger-surface, e NUNCA text-destructive', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={-2} />);
    const estilo = estiloDe(pilulaDeltaDe(screen.getByTestId('kpi-delta')));
    expect(estilo).toContain('--gp-danger-on');
    expect(estilo).toContain('--gp-danger-surface');
    expect(classesDe(screen.getByTestId('kpi-delta')).has('text-destructive')).toBe(false);
  });

  it('delta positivo usa --gp-success-on — nunca mais a paleta crua do Tailwind', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="61%" meta={meta} delta={4} />);
    const delta = screen.getByTestId('kpi-delta');
    const estilo = estiloDe(pilulaDeltaDe(delta));
    expect(estilo).toContain('--gp-success-on');
    expect(estilo).toContain('--gp-success-surface');
    expect(delta.innerHTML).not.toMatch(/emerald/);
  });

  it('delta zero é estabilidade medida: tom neutro, sem cor semântica e sem seta', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={0} />);
    const delta = screen.getByTestId('kpi-delta');
    const estilo = estiloDe(pilulaDeltaDe(delta));
    expect(estilo).toContain('--gp-text-2');
    expect(estilo).not.toContain('--gp-danger');
    expect(estilo).not.toContain('--gp-success');
    expect(delta.querySelector('i')).toBeNull();
  });

  it('o delta diz contra o que está comparando — agora em texto visível, como na referência', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={-2} />);
    // A referência imprime "+1 vs anterior" dentro da própria pílula. Texto
    // visível serve a todo mundo; o `sr-only` de antes só servia a leitor de tela.
    expect(screen.getByTestId('kpi-delta')).toHaveTextContent('vs anterior');
  });

  it('a seta é a do Fontello e é decorativa — o número já carrega a direção', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={-2} />);
    const seta = screen.getByTestId('kpi-delta').querySelector('i');
    expect(seta).toHaveClass('icon-dende-icons-arrow_downward-filled');
    expect(seta).toHaveAttribute('aria-hidden', 'true');
  });
});

/* ---------------------------------------------------------------------- */
/* 2) Análise estática de texto-fonte — independe de jsdom.               */
/* ---------------------------------------------------------------------- */

const semComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '');

describe('fonte — a regra CSS existe e referencia o token, o componente não usa mais o literal', () => {
  it('KpiCard.tsx não usa mais "text-destructive" como classe ativa (só pode sobrar em comentário)', () => {
    expect(semComentarios(KPI_CARD_SRC)).not.toMatch(/text-destructive/);
  });

  it('KpiCard.tsx não usa nenhuma cor da paleta crua do Tailwind', () => {
    // O `text-emerald-600` do delta positivo era o último resquício de cor
    // fora do sistema de tokens neste arquivo.
    expect(semComentarios(KPI_CARD_SRC)).not.toMatch(
      /\b(?:text|bg|border)-(?:emerald|slate|amber|rose|sky|zinc|gray|red|green|blue|yellow)-\d{2,3}\b/,
    );
  });

  it('gestor-theme.css declara .gestor-portal .gp-text-danger { color: var(--gp-danger-on) }', () => {
    const m = semComentarios(CSS_TEMA).match(/\.gestor-portal \.gp-text-danger\s*\{\s*color:\s*([^;]+);/);
    expect(m, 'regra .gp-text-danger não encontrada em gestor-theme.css').not.toBeNull();
    expect(m![1].trim()).toBe('var(--gp-danger-on)');
  });

  it('a regra .gp-text-danger não hardcoda hsl()/rgb() literal — só o token', () => {
    const i = semComentarios(CSS_TEMA).indexOf('.gestor-portal .gp-text-danger');
    const regra = semComentarios(CSS_TEMA).slice(i, semComentarios(CSS_TEMA).indexOf('}', i) + 1);
    expect(regra).not.toMatch(/:\s*hsl\(/);
    expect(regra).not.toMatch(/:\s*rgba?\(/);
  });
});

/* ---------------------------------------------------------------------- */
/* 3) Matemática de contraste — WCAG 2.1, a partir dos valores REAIS dos   */
/*    dois arquivos-fonte (nunca hardcoded às cegas: se o valor do token   */
/*    mudar sem recalcular, este bloco reprova sozinho).                  */
/* ---------------------------------------------------------------------- */

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

/** Converte a tripla "H S% L%" (formato usado em toda variável hsl(...) deste repo) em RGB. */
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

/** Razão de contraste WCAG 2.1 (a mesma fórmula de qualquer checador real). */
function razaoDeContraste(fg: RGB, bg: RGB): number {
  const l1 = luminanciaRelativa(fg);
  const l2 = luminanciaRelativa(bg);
  const claro = Math.max(l1, l2);
  const escuro = Math.min(l1, l2);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Extrai o bloco `{ ... }` de um seletor por contagem de chaves — robusto a
 * indentação (tema.test.tsx usa `indexOf('\n}')`, que funciona para
 * gestor-theme.css mas NÃO para src/index.css: lá `:root`/`.dark` vivem
 * dentro de `@layer base` e fecham com `}` indentado, não em coluna 0). */
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

/**
 * Extrai a tripla "H S% L%" de um token, nos DOIS formatos que este repo usa
 * (testado empiricamente, não assumido — a primeira tentativa aqui exigia
 * sempre `hsl(...)` e quebrava contra src/index.css):
 *   - gestor-theme.css declara o valor JÁ envolto em hsl(): `--gp-danger-on: hsl(0 74% 27%);`
 *   - src/index.css declara a tripla NUA, sem hsl(): `--card: 0 0% 100%;`
 *     (o wrapper hsl() só aparece no PONTO DE USO, ex.: tailwind.config.ts
 *     `card: { DEFAULT: 'hsl(var(--card))' }` — nunca na própria declaração).
 */
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

const gpDangerOnClaro = valorTripla(claroTema, '--gp-danger-on');
const gpDangerOnEscuro = valorTripla(escuroTema, '--gp-danger-on');
const cardClaro = valorTripla(claroIndex, '--card');
const cardEscuro = valorTripla(escuroIndex, '--card');
const destructiveClaro = valorTripla(claroIndex, '--destructive');
const destructiveEscuro = valorTripla(escuroIndex, '--destructive');

describe('matemática WCAG 2.1 — calculada a partir dos valores reais de gestor-theme.css e src/index.css', () => {
  it('documentação executável do ACHADO original: --destructive reprova AA nos dois temas', () => {
    const claro = razaoDeContraste(parseHslTripla(destructiveClaro), parseHslTripla(cardClaro));
    const escuro = razaoDeContraste(parseHslTripla(destructiveEscuro), parseHslTripla(cardEscuro));

    // Medido no navegador real pelo autor do achado: rgb(239,67,67) e
    // rgb(207,48,48) — confere com o HSL de src/index.css usado aqui.
    expect(parseHslTripla(destructiveClaro)).toEqual([239, 67, 67]);
    expect(parseHslTripla(destructiveEscuro)).toEqual([207, 48, 48]);

    expect(claro).toBeLessThan(4.5);
    expect(escuro).toBeLessThan(4.5);
    expect(Math.round(claro * 100) / 100).toBeCloseTo(3.78, 1);
    expect(Math.round(escuro * 100) / 100).toBeCloseTo(3.48, 1);
  });

  it('--gp-danger-on (a correção) passa AA (>= 4,5:1) contra o card real, nos dois temas', () => {
    const claro = razaoDeContraste(parseHslTripla(gpDangerOnClaro), parseHslTripla(cardClaro));
    const escuro = razaoDeContraste(parseHslTripla(gpDangerOnEscuro), parseHslTripla(cardEscuro));

    expect(claro).toBeGreaterThanOrEqual(4.5);
    expect(escuro).toBeGreaterThanOrEqual(4.5);
    // Números do relatório (e confirmados manualmente no navegador real): 11,09:1 e 7,15:1.
    expect(Math.round(claro * 100) / 100).toBeCloseTo(11.09, 1);
    expect(Math.round(escuro * 100) / 100).toBeCloseTo(7.15, 1);
  });

  /**
   * O delta positivo agora também é token. Aqui o fundo NÃO é o card: a pílula
   * pinta `--gp-*-surface` por baixo do texto, então o par a medir é
   * `on` sobre `surface` — que é justamente o que a anatomia §5 garante.
   */
  it('os pares on/surface das pílulas de delta passam AA nos dois temas', () => {
    const pares: [string, string][] = [
      ['--gp-success-on', '--gp-success-surface'],
      ['--gp-danger-on', '--gp-danger-surface'],
    ];
    for (const [frente, fundo] of pares) {
      for (const [nome, bloco] of [['claro', claroTema], ['escuro', escuroTema]] as const) {
        const razao = razaoDeContraste(
          parseHslTripla(valorTripla(bloco, frente)),
          parseHslTripla(valorTripla(bloco, fundo)),
        );
        expect(razao, `${frente} sobre ${fundo} no tema ${nome}: ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('a correção CLAREIA no escuro (nunca escureça) — regra do §Tema escuro, mesmo espírito do teste de hover/skeleton em tema.test.tsx', () => {
    const lClaro = parseFloat(gpDangerOnClaro.trim().split(/\s+/)[2]);
    const lEscuro = parseFloat(gpDangerOnEscuro.trim().split(/\s+/)[2]);
    expect(lEscuro).toBeGreaterThan(lClaro);
  });

  it('(contraste) o --destructive antigo ia na direção ERRADA: escurecia no escuro — por isso não bastava trocar de tema, tinha que trocar de token', () => {
    const lClaro = parseFloat(destructiveClaro.trim().split(/\s+/)[2]);
    const lEscuro = parseFloat(destructiveEscuro.trim().split(/\s+/)[2]);
    expect(lEscuro).toBeLessThan(lClaro);
  });
});
