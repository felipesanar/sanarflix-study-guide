import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

const RAIZ = resolve(__dirname, '..');
const CSS = readFileSync(join(RAIZ, 'gestor-theme.css'), 'utf-8');

function arquivosFonte(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') arquivosFonte(p, acc); }
    else if (/\.(ts|tsx|css)$/.test(e.name) && e.name !== 'gestor-theme.css') acc.push(p);
  }
  return acc;
}
const FONTES = arquivosFonte(RAIZ).map((p) => ({ p, src: readFileSync(p, 'utf-8') }));

const declarados = (bloco: string) =>
  new Set([...bloco.matchAll(/(--gp-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const blocoDe = (seletor: string) => {
  const i = CSS.indexOf(`${seletor} {`);
  return i < 0 ? '' : CSS.slice(i, CSS.indexOf('\n}', i));
};

/**
 * Remove comentários de bloco (`/* ... *\/`, inclusive JSDoc `/** ... *\/`)
 * antes de qualquer checagem de "nunca contém X". Sem isso, os testes de
 * higiene abaixo dão falso positivo contra a própria documentação: o
 * cabeçalho de `gestor-theme.css` e o docblock de `GestorShell.tsx` CITAM
 * `filter: invert()` e `[data-theme="dark"]` em prosa, exatamente para
 * explicar por que o código nunca deve fazer isso — testado, achado real
 * (ver relatório final).
 */
const semComentariosDeBloco = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '');

describe('tema do portal do gestor — análise estática do CSS (§Tema escuro)', () => {
  it('todo token --gp-* usado no código está declarado no tema claro', () => {
    const claro = declarados(blocoDe('.gestor-portal'));
    const usados = new Set<string>();
    FONTES.forEach(({ src }) => {
      for (const m of src.matchAll(/var\((--gp-[a-z0-9-]+)/g)) usados.add(m[1]);
    });
    const faltando = [...usados].filter((t) => !claro.has(t)).sort();
    expect(faltando, `tokens usados sem declaração em .gestor-portal: ${faltando.join(', ')}`).toEqual([]);
  });

  it('todo token que muda de valor no escuro está declarado sob .dark .gestor-portal', () => {
    const escuro = declarados(blocoDe('.dark .gestor-portal'));
    // Os que NÃO derivam de variável do repo precisam de par explícito no escuro.
    const literaisClaro = [...blocoDe('.gestor-portal').matchAll(/(--gp-[a-z0-9-]+)\s*:\s*([^;]+);/g)]
      .filter(([, , v]) => !v.includes('var(--'))
      .map(([, t]) => t);
    /**
     * A regra vale para COR: um literal de cor calibrado para fundo claro quase
     * nunca serve no escuro, e esquecer o par é como o tema quebra na prática.
     * Forma, tempo, curva e família de fonte não são função do tema — um raio de
     * 8px, 140ms, `cubic-bezier(0.2,0,0,1)` e Roboto Mono são os mesmos nos dois,
     * e exigir uma duplicata idêntica no bloco escuro só criaria duas fontes de
     * verdade para o mesmo valor.
     */
    const INVARIANTE_DE_TEMA = /^--gp-(radius|motion|ease|font)/;
    const semPar = literaisClaro.filter((t) => !escuro.has(t) && !INVARIANTE_DE_TEMA.test(t));
    expect(semPar, `tokens literais sem calibração no escuro: ${semPar.join(', ')}`).toEqual([]);
  });

  it('nunca redefine uma variável de src/index.css (aluno e admin ficam intocados)', () => {
    // As variáveis do repo consumidas pelo tema só podem aparecer como
    // `var(--x)` (leitura) dentro de .gestor-portal/.dark .gestor-portal,
    // nunca como declaração `--x:` (escrita) — isso reescreveria o tema do
    // aluno/admin, que consomem essas mesmas variáveis em src/index.css.
    const VARIAVEIS_DO_REPO = [
      'background', 'card', 'foreground', 'muted', 'muted-foreground', 'border',
      'primary', 'primary-foreground', 'primary-dark', 'input', 'ring',
      'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'radius', 'accent',
    ];
    const claro = blocoDe('.gestor-portal');
    const escuro = blocoDe('.dark .gestor-portal');
    const redefinicoes: string[] = [];
    VARIAVEIS_DO_REPO.forEach((nome) => {
      const re = new RegExp(`(^|[^-])--${nome}\\s*:`, 'm');
      if (re.test(claro)) redefinicoes.push(`--${nome} (claro)`);
      if (re.test(escuro)) redefinicoes.push(`--${nome} (escuro)`);
    });
    expect(redefinicoes, `gestor-theme.css redefine variável(is) do repo: ${redefinicoes.join(', ')}`).toEqual([]);
  });

  it('toda variável do repo referenciada via var(--x) em gestor-theme.css existe de fato em src/index.css', () => {
    // Rede de segurança contra digitação errada de nome de variável (ex.:
    // var(--inptu) por --input) — o tipo de erro que nem o TypeScript nem o
    // build acusam em CSS puro, e que só apareceria visualmente no navegador.
    const indexCss = readFileSync(resolve(RAIZ, '../../index.css'), 'utf-8');
    const referenciadas = new Set(
      [...CSS.matchAll(/var\(--([a-z0-9-]+)(?:,|\))/g)]
        .map((m) => m[1])
        .filter((nome) => !nome.startsWith('gp-')),
    );
    expect(referenciadas.size).toBeGreaterThan(0); // salvaguarda: a regex não pode ficar muda
    const inexistentes = [...referenciadas].filter((nome) => !new RegExp(`(^|[^-])--${nome}\\s*:`).test(indexCss));
    expect(inexistentes, `gestor-theme.css referencia variável ausente em src/index.css: ${inexistentes.join(', ')}`).toEqual([]);
  });

  it('não usa [data-theme] como seletor — o app é next-themes por classe .dark', () => {
    // Fora de comentário: o próprio cabeçalho explica, em prosa, por que
    // `[data-theme="dark"]` do handoff não se aplica aqui — citar isso como
    // documentação é esperado; usá-lo como seletor de verdade não é.
    expect(semComentariosDeBloco(CSS)).not.toContain('data-theme');
  });

  it('nunca inverte filtro e nunca usa #B81414 como cor de texto', () => {
    expect(semComentariosDeBloco(CSS)).not.toMatch(/filter:\s*invert/i);
    FONTES.forEach(({ p, src }) => {
      const semComentarios = semComentariosDeBloco(src);
      expect(semComentarios, `${p} usa filter: invert()`).not.toMatch(/invert\(/);
      expect(semComentarios, `${p} usa #B81414 literal — use var(--gp-brand)/var(--gp-brand-on-dark)`)
        .not.toMatch(/#B81414/i);
    });
  });

  it('nenhum hex, rgb()/rgba() ou classe Tailwind branca/cinza solta no código do portal (§11)', () => {
    FONTES.filter(({ p }) => /\.tsx?$/.test(p)).forEach(({ p, src }) => {
      const semComentarios = semComentariosDeBloco(src);
      expect(semComentarios, `${p} tem hex literal`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(semComentarios, `${p} tem rgb()/rgba() literal`).not.toMatch(/\brgba?\(/);
      expect(semComentarios, `${p} tem classe Tailwind bg-white/text-white/border-white solta`)
        .not.toMatch(/\b(?:bg|text|border)-white\b/);
      expect(semComentarios, `${p} tem classe Tailwind bg-gray-*/text-gray-*/border-gray-* solta`)
        .not.toMatch(/\b(?:bg|text|border)-gray-\d+\b/);
    });
  });

  /**
   * Classe utilitária ambígua do Tailwind não vira o CSS que se espera — e o
   * teste unitário nunca pega, porque jsdom não roda o Tailwind.
   *
   * Achado no navegador: `shadow-[var(--gp-shadow-card)]` foi resolvido como
   * `--tw-shadow-color`, e não como a sombra. O cartão de direcionamento ficou
   * com `box-shadow: none` em produção, e o hover — que sobe um degrau de
   * sombra — não tinha de onde subir. O `duration-[140ms]` é a mesma família:
   * o Tailwind não sabe se é `transition-duration` ou `animation-duration`, e
   * avisa "ambiguous" no build.
   *
   * A sintaxe de propriedade explícita (`[box-shadow:...]`,
   * `[transition-duration:...]`) não tem ambiguidade.
   */
  it('nenhuma classe arbitrária ambígua do Tailwind (shadow-[var(…)], duration-[Nms])', () => {
    FONTES.filter(({ p }) => /\.tsx?$/.test(p)).forEach(({ p, src }) => {
      const semComentarios = semComentariosDeBloco(src);
      expect(semComentarios, `${p}: shadow-[var(…)] cai em --tw-shadow-color; use [box-shadow:var(…)]`)
        .not.toMatch(/\bshadow-\[var\(/);
      expect(semComentarios, `${p}: duration-[Nms] é ambíguo; use [transition-duration:…] ou [animation-duration:…]`)
        .not.toMatch(/\bduration-\[\d/);
    });
  });

  it('skeleton do escuro é mais claro que o card, sem clarão branco', () => {
    const escuro = blocoDe('.dark .gestor-portal');
    const m = escuro.match(/--gp-skeleton:\s*hsl\(220 13% (\d+)%\)/);
    expect(m, '--gp-skeleton precisa de valor hsl explícito no escuro').not.toBeNull();
    const luz = Number(m![1]);
    expect(luz).toBeGreaterThan(10); // card do repo no escuro: 220 13% 10%
    expect(luz).toBeLessThan(30);    // acima disso é clarão
  });

  it('hover no escuro clareia a superfície', () => {
    const i = CSS.indexOf('.dark .gestor-portal .gp-hover-surface:hover');
    expect(i).toBeGreaterThan(-1);
    const regra = CSS.slice(i, CSS.indexOf('}', i));
    const luz = Number(regra.match(/hsl\(220 13% (\d+)%\)/)![1]);
    expect(luz).toBeGreaterThan(10); // maior que o card ⇒ clareia
  });
});

// ---------------------------------------------------------------------------
// Render: a classe `gestor-portal` chega no nó raiz do shell, nos dois temas,
// e as variáveis --gp-* resolvem de verdade via getComputedStyle.
//
// Nota sobre o Step 4 do plano original: ele renderizava `VisaoGeral` (via um
// `fixturesRegrasCriticas`/`criarRpcMock` que este repo NÃO tem — só é citado
// dentro do próprio texto do plano, não existe em __tests__/) e verificava
// ausência de `style` inline com cor. Isso não teria provado "a classe chega
// ao nó raiz": quem aplica `gestor-portal` é o `GestorShell`, não
// `VisaoGeral` — que naquele teste era renderizado solto, fora do shell.
// Por isso este bloco renderiza `GestorShell` de verdade (único componente
// que aplica a classe), com o MESMO mock de
// `useAuth`/`useGestorContexto`/`SidebarIes` já provado em
// `GestorShell.test.tsx`.
//
// Nota sobre jsdom e custom properties (testado empiricamente, não assumido):
// `getComputedStyle(el).getPropertyValue('--gp-x')` FUNCIONA em jsdom para
// tokens com valor LITERAL (ex.: `--gp-surface-3: hsl(220 14% 93%)`) — o
// experimento abaixo mediu `hsl(220 14% 93%)` no claro e `hsl(220 13% 16%)`
// no escuro, exatamente os valores do CSS. Mas jsdom NÃO substitui `var()`
// aninhado dentro do valor de uma custom property: para um token DERIVADO
// como `--gp-bg-app: hsl(var(--background))`, `getPropertyValue` devolveu a
// string CRUA `"hsl(var(--background))"` nos dois temas (idêntica), porque o
// texto declarado de `--gp-bg-app` em si nunca muda — quem muda é
// `--background`, e jsdom não resolve essa segunda camada. Por isso os
// testes de computed style abaixo usam só tokens de valor literal (onde
// jsdom realmente resolve e realmente difere por tema); a resolução dos
// tokens DERIVADOS nos dois temas é provada estaticamente acima (todo
// `--gp-*` declarado + toda variável do repo referenciada existe de fato em
// src/index.css), não por computed style. Ver relatório final para o comando
// e a saída reais desse experimento.

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockUseGestorContexto = vi.hoisted(() => vi.fn());
vi.mock('@/features/gestor/api/queries', () => ({ useGestorContexto: () => mockUseGestorContexto() }));

// O shell não busca dado de IES — o SidebarIes busca. Neutralizado, como em
// GestorShell.test.tsx, para este teste ficar restrito a tema/classe.
vi.mock('@/features/gestor/shell/SidebarIes', () => ({
  SidebarIes: () => <div>IES Alfa</div>,
}));

// `src/test/setup.ts` mocka react-router-dom globalmente (useNavigate etc.);
// GestorShell precisa do NavLink/useLocation reais para a nav e o `Outlet`.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

// Import após os vi.mock (hoisted) acima, mesmo padrão de GestorShell.test.tsx.
import { GestorShell } from '@/features/gestor/shell/GestorShell';

describe('classe gestor-portal e tokens --gp-* no GestorShell, claro e escuro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', nome: 'Ana Gestora', email: 'ana@ies.edu.br' },
      logout: vi.fn(),
    });
    mockUseGestorContexto.mockReturnValue({
      data: { usuario: { id: 'u1', nome: 'Ana Gestora', papel: 'gestor' } },
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  const renderShell = (tema: 'light' | 'dark') => {
    if (tema === 'dark') document.documentElement.classList.add('dark');
    return render(
      <ThemeProvider attribute="class" defaultTheme={tema} enableSystem={false} forcedTheme={tema}>
        <MemoryRouter initialEntries={['/gestor']}>
          <Routes>
            <Route path="/gestor" element={<GestorShell />}>
              <Route index element={<div>conteúdo do início</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
  };

  it.each(['light', 'dark'] as const)('a classe gestor-portal chega ao nó raiz do shell — tema %s', (tema) => {
    const { container } = renderShell(tema);
    const raiz = container.querySelector('.gestor-portal');
    expect(raiz).not.toBeNull();
    // Prova estrutural de que é o PRÓPRIO nó raiz do shell (o `<div>` que
    // envolve `<aside>` + `<main>`), não um descendente qualquer que por
    // acaso carregasse a classe. Não comparamos com `container.firstElementChild`:
    // testado empiricamente, o `ThemeProvider` do next-themes injeta um
    // `<script>` anti-FOUC como irmão ANTERIOR ao nosso `<div>` dentro do
    // container (`container.children` = `['SCRIPT', 'DIV']`) — a raiz real do
    // shell é sempre o segundo filho, nunca o primeiro.
    expect(raiz?.tagName).toBe('DIV');
    expect(raiz?.children[0]?.tagName).toBe('ASIDE');
    expect(raiz?.children[1]?.tagName).toBe('MAIN');
  });

  it('o tema escuro ativa via classe .dark no <html>, nunca via [data-theme]', () => {
    renderShell('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('--gp-surface-3 (3º degrau de superfície, literal — o repo não tem equivalente) resolve DIFERENTE em cada tema', () => {
    const claro = renderShell('light');
    const raizClara = claro.container.querySelector('.gestor-portal') as HTMLElement;
    const valorClaro = getComputedStyle(raizClara).getPropertyValue('--gp-surface-3').trim();
    claro.unmount();

    const escuro = renderShell('dark');
    const raizEscura = escuro.container.querySelector('.gestor-portal') as HTMLElement;
    const valorEscuro = getComputedStyle(raizEscura).getPropertyValue('--gp-surface-3').trim();

    expect(valorClaro).toBe('hsl(220 14% 93%)');
    expect(valorEscuro).toBe('hsl(220 13% 16%)');
    expect(valorEscuro).not.toBe(valorClaro);
  });

  it('--gp-brand-on-dark resolve para o token de AA (7,08:1) no escuro — nunca #B81414 (2,73:1, reprova AA)', () => {
    const escuro = renderShell('dark');
    const raizEscura = escuro.container.querySelector('.gestor-portal') as HTMLElement;
    const valorEscuro = getComputedStyle(raizEscura).getPropertyValue('--gp-brand-on-dark').trim();
    expect(valorEscuro).toBe('hsl(2 76% 72%)');
  });

  it('tokens semânticos (success/warning/danger/info) resolvem valores distintos entre claro e escuro', () => {
    const claro = renderShell('light');
    const raizClara = claro.container.querySelector('.gestor-portal') as HTMLElement;
    const semanticosClaro = ['--gp-success', '--gp-warning', '--gp-danger', '--gp-info'].map((t) =>
      getComputedStyle(raizClara).getPropertyValue(t).trim(),
    );
    claro.unmount();

    const escuro = renderShell('dark');
    const raizEscura = escuro.container.querySelector('.gestor-portal') as HTMLElement;
    const semanticosEscuro = ['--gp-success', '--gp-warning', '--gp-danger', '--gp-info'].map((t) =>
      getComputedStyle(raizEscura).getPropertyValue(t).trim(),
    );

    semanticosClaro.forEach((valor) => expect(valor).not.toBe(''));
    semanticosEscuro.forEach((valor) => expect(valor).not.toBe(''));
    semanticosClaro.forEach((valorClaro, indice) => expect(semanticosEscuro[indice]).not.toBe(valorClaro));
  });
});
