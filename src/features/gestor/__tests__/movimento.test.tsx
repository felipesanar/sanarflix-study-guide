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
// bloco acima é SUFICIENTE para tudo que anima dentro da subárvore do shell,
// e por que Sheet/Dialog/Select ficam de fora (NAO_CORRIGIDOS do relatório da
// Task 59b). Lê os arquivos-fonte envolvidos — não os edita; nenhum é um dos
// dois arquivos que esta tarefa pode alterar.

const lerFonte = (caminhoRelativoAoSrc: string) =>
  readFileSync(resolve(RAIZ, '../../', caminhoRelativoAoSrc), 'utf-8');

describe('alcance de .gestor-portal * — documentação viva do limite de Portal do Radix', () => {
  it('GestorSkeleton usa animate-pulse (loop infinito) e é um <div> comum — está DENTRO da subárvore, alcançável', () => {
    const src = readFileSync(resolve(RAIZ, 'components/GestorSkeleton.tsx'), 'utf-8');
    expect(src).toMatch(/animate-pulse/);
    expect(src).not.toMatch(/\.Portal\b/);
  });

  it('TooltipContent (components/ui/tooltip.tsx) NÃO embrulha o conteúdo em Portal — é o único Radix do portal alcançável por CSS escopado', () => {
    const src = lerFonte('components/ui/tooltip.tsx');
    expect(src).toMatch(/animate-in/); // confirma que de fato anima por padrão
    expect(src).not.toMatch(/TooltipPrimitive\.Portal/);
  });

  it('SheetContent (components/ui/sheet.tsx, usado pelos drawers do gestor) embrulha em Portal — conteúdo cai fora de .gestor-portal, fora de alcance', () => {
    const src = lerFonte('components/ui/sheet.tsx');
    expect(src).toMatch(/SheetPortal|SheetPrimitive\.Portal/);
    expect(src).toMatch(/animate-in/); // confirma que de fato anima por padrão
  });

  it('DialogContent (components/ui/dialog.tsx, usado por Glossario) também embrulha em Portal — mesma limitação', () => {
    const src = lerFonte('components/ui/dialog.tsx');
    expect(src).toMatch(/DialogPortal|DialogPrimitive\.Portal/);
  });

  it('SelectContent (components/ui/select.tsx, usado por SidebarIes/FiltroSemestre) também embrulha em Portal — mesma limitação', () => {
    const src = lerFonte('components/ui/select.tsx');
    expect(src).toMatch(/SelectPrimitive\.Portal/);
  });

  it('os drawers do gestor (DrawerAluno, DrawerTemas) de fato usam o Sheet baseado em Portal', () => {
    const drawerAluno = readFileSync(resolve(RAIZ, 'components/DrawerAluno.tsx'), 'utf-8');
    const drawerTemas = readFileSync(resolve(RAIZ, 'components/DrawerTemas.tsx'), 'utf-8');
    expect(drawerAluno).toMatch(/from '@\/components\/ui\/sheet'/);
    expect(drawerTemas).toMatch(/from '@\/components\/ui\/sheet'/);
  });
});
