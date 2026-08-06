import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Task 59b — `prefers-reduced-motion` na camada de tema do Portal do Gestor v2.
 *
 * Mesmo estilo de `tema.test.tsx`: análise ESTÁTICA do texto de
 * `gestor-theme.css`, não render. Motivo (testado, não suposto, ver relatório
 * da Task 59b): jsdom não implementa a media feature `prefers-reduced-motion`
 * — mockar `window.matchMedia` não muda o resultado de um `@media` real no
 * CSSOM, então um teste de render+getComputedStyle daria falso-positivo ou
 * falso-negativo sem provar nada sobre o navegador real. A verificação em
 * navegador (DevTools → Rendering → "Emulate CSS prefers-reduced-motion")
 * fica fora deste arquivo, registrada no relatório.
 */

const RAIZ = resolve(__dirname, '..');
const CSS = readFileSync(join(RAIZ, 'gestor-theme.css'), 'utf-8');

/** Extrai o texto de um bloco `@media <query> { ... }`, contando chaves (o
 * bloco contém uma regra aninhada com suas próprias chaves — o `blocoDe`
 * simples de `tema.test.tsx`, que para no primeiro `\n}`, cortaria no meio). */
function blocoMedia(query: string): string {
  const marca = `@media ${query} {`;
  const inicio = CSS.indexOf(marca);
  if (inicio < 0) return '';
  let i = inicio + marca.length;
  let profundidade = 1;
  while (i < CSS.length && profundidade > 0) {
    if (CSS[i] === '{') profundidade++;
    else if (CSS[i] === '}') profundidade--;
    i++;
  }
  return CSS.slice(inicio, i);
}

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const MEDIA_REDUCE = blocoMedia(REDUCE_QUERY);

describe('prefers-reduced-motion no tema do portal do gestor (Task 59b)', () => {
  it('declara exatamente um bloco @media (prefers-reduced-motion: reduce)', () => {
    expect(MEDIA_REDUCE, 'bloco @media (prefers-reduced-motion: reduce) não encontrado em gestor-theme.css').not.toBe('');
    const ocorrencias = CSS.split(`@media ${REDUCE_QUERY}`).length - 1;
    expect(ocorrencias).toBe(1);
  });

  it('todo seletor do bloco reduced-motion é escopado em .gestor-portal — nunca solto no documento', () => {
    // Sem isso o reset vazaria para aluno/admin, que também importam
    // src/components/ui/* — a mesma invariante de "escopado" que
    // tema.test.tsx já cobra para as variáveis --gp-*.
    const m = MEDIA_REDUCE.match(/\{\s*([\s\S]*?)\{/);
    expect(m, 'não achei a lista de seletores dentro do @media').not.toBeNull();
    const seletores = m![1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(seletores.length).toBeGreaterThan(0);
    seletores.forEach((seletor) => {
      expect(seletor.startsWith('.gestor-portal'), `seletor "${seletor}" não começa com .gestor-portal`).toBe(true);
    });
  });

  it('zera animation-duration e transition-duration com !important', () => {
    expect(MEDIA_REDUCE).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(MEDIA_REDUCE).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('usa 0.01ms, nunca 0s/none — duração zero pode não disparar transitionend/animationend', () => {
    expect(MEDIA_REDUCE).not.toMatch(/animation-duration:\s*0s/);
    expect(MEDIA_REDUCE).not.toMatch(/transition-duration:\s*0s/);
    expect(MEDIA_REDUCE).not.toMatch(/animation:\s*none/);
  });

  it('zera animation-iteration-count — sem isso um animate-pulse (loop infinito) nunca para', () => {
    expect(MEDIA_REDUCE).toMatch(/animation-iteration-count:\s*1\s*!important/);
  });

  it('não redefine nenhum token --gp-* dentro do bloco de movimento (responsabilidade separada dos blocos de tema)', () => {
    expect(MEDIA_REDUCE).not.toMatch(/--gp-[a-z0-9-]+\s*:/);
  });
});

// ---------------------------------------------------------------------------
// Documentação executável do alcance real de `.gestor-portal *`: por que o
// bloco acima alcança tudo que anima dentro do shell.
//
// ATENÇÃO AO HISTÓRICO — este bloco já afirmou o contrário. Até o commit
// `4786362b`, Sheet/Dialog/Select do Radix despachavam para `document.body`,
// FORA de `.gestor-portal`, e três casos aqui documentavam essa limitação
// ("fora de alcance") como um NAO_CORRIGIDO da Task 59b. A Task 65 fechou o
// buraco: os SEIS usos do gestor passam `container={useGestorPortalContainer()}`
// e o conteúdo monta DENTRO do shell. Os casos seguiram verdes afirmando o
// mundo antigo, porque só olhavam para `components/ui/*` — onde o Portal
// continua existindo, como tem de continuar (aluno/admin dependem do padrão do
// Radix). Reescritos: o que estes casos guardam agora é o CONTRATO que torna o
// bloco de CSS suficiente — a primitiva expõe `container`, e todo uso do gestor
// o passa. A prova de DOM (`closest('.gestor-portal')` sobre o diálogo aberto
// de verdade) mora em `portalContainer.test.tsx`; aqui é só análise estática.

const lerFonte = (caminhoRelativoAoSrc: string) =>
  readFileSync(resolve(RAIZ, '../../', caminhoRelativoAoSrc), 'utf-8');

describe('alcance de .gestor-portal * — o contrato do container do Portal (Task 65)', () => {
  it('GestorSkeleton usa animação em loop e é um <div> comum — está DENTRO da subárvore, alcançável', () => {
    // O handoff §9 pede shimmer discreto, não pulse; o skeleton migrou de
    // `animate-pulse` para `animate-shimmer`. O que este caso guarda não é a
    // classe, é a propriedade que importa para o bloco reduced-motion: continua
    // sendo animação em LOOP dentro da subárvore, alcançável por CSS escopado
    // (por isso o `animation-iteration-count: 1` do caso acima).
    const src = readFileSync(resolve(RAIZ, 'components/GestorSkeleton.tsx'), 'utf-8');
    expect(src).toMatch(/animate-(?:pulse|shimmer)/);
    expect(src).not.toMatch(/\.Portal\b/);
  });

  it('TooltipContent (components/ui/tooltip.tsx) NÃO embrulha o conteúdo em Portal — é o único Radix do portal alcançável por CSS escopado', () => {
    const src = lerFonte('components/ui/tooltip.tsx');
    expect(src).toMatch(/animate-in/); // confirma que de fato anima por padrão
    expect(src).not.toMatch(/TooltipPrimitive\.Portal/);
  });

  // Os três a seguir cobrem a MESMA invariante nas três primitivas que o
  // gestor usa: continuam embrulhando em Portal (o padrão do Radix, que
  // aluno/admin herdam intacto) E repassam `container` para ele. É o "E" que
  // importa: um Portal sem `container` repassado despacha para document.body
  // e leva o conteúdo para fora do alcance de `gestor-theme.css`.

  it('SheetContent (components/ui/sheet.tsx, usado pelos drawers do gestor) embrulha em Portal e REPASSA container para ele', () => {
    const src = lerFonte('components/ui/sheet.tsx');
    expect(src).toMatch(/animate-in/); // confirma que de fato anima por padrão
    expect(src).toMatch(/container\?:\s*HTMLElement \| null/);
    expect(src).toMatch(/<SheetPortal container=\{container\}>/);
  });

  it('DialogContent (components/ui/dialog.tsx, usado por Glossario) embrulha em Portal e REPASSA container para ele', () => {
    const src = lerFonte('components/ui/dialog.tsx');
    expect(src).toMatch(/container\?:\s*HTMLElement \| null/);
    expect(src).toMatch(/<DialogPortal container=\{container\}>/);
  });

  it('SelectContent (components/ui/select.tsx, usado por SidebarIes/FiltroSemestre) embrulha em Portal e REPASSA container para ele', () => {
    const src = lerFonte('components/ui/select.tsx');
    expect(src).toMatch(/container\?:\s*HTMLElement \| null/);
    expect(src).toMatch(/<SelectPrimitive\.Portal container=\{container\}>/);
  });

  it('os SEIS usos do gestor passam o container do shell — nenhum aceita o document.body do Radix', () => {
    // Se um uso novo aparecer sem `container`, o conteúdo dele fica fora de
    // `.gestor-portal` e este bloco de CSS deixa de alcançá-lo em silêncio:
    // nada quebra, o movimento só volta a rodar com reduced-motion ligado.
    // A lista é explícita de propósito — é o inventário que a Task 65 fechou.
    const usos: Array<[string, string]> = [
      ['DrawerAluno', 'features/gestor/components/DrawerAluno.tsx'],
      ['DrawerTemas', 'features/gestor/components/DrawerTemas.tsx'],
      ['Glossario', 'features/gestor/components/Glossario.tsx'],
      ['FiltroSemestre', 'features/gestor/components/FiltroSemestre.tsx'],
      ['SidebarIes', 'features/gestor/shell/SidebarIes.tsx'],
      ['Sheet de cronograma (Detalhamento)', 'features/gestor/routes/Detalhamento.tsx'],
    ];

    const semContainer = usos.filter(([, caminho]) => {
      const src = lerFonte(caminho);
      return !/useGestorPortalContainer\(\)/.test(src) || !/container=\{\w+\}/.test(src);
    });

    expect(
      semContainer.map(([nome]) => nome),
      'estes usos do gestor não passam container e cairiam em document.body, fora de .gestor-portal',
    ).toEqual([]);
  });
});
