import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Teste-guarda da Task 64b (spec §4.4, §7.3): trava que o produto tem UMA
 * régua de desempenho — não cinco, como já aconteceu neste projeto.
 *
 * CONTEXTO DA DECISÃO (registrado aqui para quem ler depois — o caminho
 * seguido divergiu do que o plano previa, e depois convergiu de novo):
 *
 * 1. O plano (docs/superpowers/plans/2026-07-25-portal-gestor-v2.md, Task
 *    64b) assumia que a Task 64 já tinha removido
 *    `src/experiences/gestor/GestorLayout.tsx` e que, por isso, o único
 *    consumidor restante do `AiChatDrawer` seria a página órfã
 *    `DesempenhoInstitucionalV2.tsx` — nesse cenário o caminho seria apagar
 *    os dois arquivos (Caminho A: `existsSync(...) === false`).
 *
 * 2. Isso NÃO era verdade quando este arquivo foi escrito pela primeira vez
 *    (Task 64b): a Task 64 ainda não tinha sido executada, `GestorLayout`
 *    continuava de pé e alcançável em produção, e o teste tomou o Caminho B
 *    (trocar os números pela régua única em `AiChatDrawer.tsx`, sem apagar).
 *
 * 3. Esta versão do arquivo é a PRÓPRIA Task 64 (cleanup): com o escopo novo
 *    definido pelo Felipe — 100% dos gestores de todas as IES recebem o
 *    portal novo no merge, sem piloto — a experiência legada inteira
 *    (`src/experiences/gestor/**`, incluindo `GestorLayout.tsx`) foi apagada.
 *    Isso deixou `src/components/analytics/v2/shared/AiChatDrawer.tsx` e
 *    `src/pages/DesempenhoInstitucionalV2.tsx` SEM NENHUM consumidor
 *    alcançável (confirmado por grep pelo caminho de import — nenhum arquivo
 *    fora dos dois se referenciava um ao outro), e ambos foram apagados
 *    junto. Agora sim é o Caminho A do plano original: o teste afirma a
 *    AUSÊNCIA dos dois arquivos, em vez de inspecionar o conteúdo deles.
 *
 * O que continua vivo e testado abaixo: a régua única em
 * `features/gestor/lib/regras.ts` continua sendo a ÚNICA fonte de corte de
 * classificação dentro de `src/features/gestor` (o portal novo, que é tudo
 * que resta). Esse invariante não dependia dos arquivos apagados e continua
 * valendo para o código que sobrevive.
 *
 * SOBRE O REGEX: `/[><]=?\s*(30|45|55|60|80)\b/` casa um `<`/`>` literal
 * (opcionalmente `<=`/`>=`) imediatamente seguido de um dos cortes da régua
 * — ou seja, comparações de código ("percentual < 45", "s.percentual >= 60"),
 * não menções em prosa ("abaixo de 45%", "PROFICIENCIA_MINIMA", "45/55/60"
 * em comentário).
 *
 * ARMADILHA JÁ PISADA AO ESCREVER ESTE TESTE (documentando para não
 * repetir): a opção `exclude` de `globSync` de `node:fs` NÃO filtra por
 * arquivo final — ela é chamada com segmentos parciais de caminho durante a
 * travessia do diretório (ex.: "src", "src\\features", em vez do caminho
 * completo do arquivo casado), então um predicado como
 * `p.includes('/lib/regras.ts')` (o que o plano original sugeria) nunca dá
 * `true` e NADA é excluído — nem regras.ts, nem __tests__/. Confirmado
 * empiricamente neste projeto (Windows, Node v24.16.0) antes de escrever
 * este arquivo. Por isso este teste usa `readdirSync` recursivo com filtro
 * manual (mesmo padrão já usado e validado em `tema.test.tsx`), não
 * `globSync` com `exclude`.
 */
const CORTE_CLASSIFICACAO = /[><]=?\s*(30|45|55|60|80)\b/;

// __dirname aqui é .../src/features/gestor/__tests__.
const GESTOR_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const REGRAS_TS = resolve(GESTOR_ROOT, 'lib', 'regras.ts');

const AI_CHAT_DRAWER = join(REPO_ROOT, 'src/components/analytics/v2/shared/AiChatDrawer.tsx');
const DESEMPENHO_V2_PAGE = join(REPO_ROOT, 'src/pages/DesempenhoInstitucionalV2.tsx');

/** Recursivo; pula `__tests__` — mesmo padrão de `tema.test.tsx`. */
function arquivosFonte(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') arquivosFonte(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('régua única de desempenho no produto (spec §4.4, §7.3 — Task 64b + Task 64)', () => {
  it('AiChatDrawer.tsx (components/analytics/v2) e DesempenhoInstitucionalV2.tsx NÃO existem mais (Task 64 apagou a experiência legada e seus órfãos)', () => {
    expect(existsSync(AI_CHAT_DRAWER)).toBe(false);
    expect(existsSync(DESEMPENHO_V2_PAGE)).toBe(false);
  });

  it('nenhum arquivo de src/features/gestor reimplementa corte de nível fora de regras.ts', () => {
    const arquivos = arquivosFonte(GESTOR_ROOT).filter((p) => resolve(p) !== REGRAS_TS);

    // Sanity: se a travessia devolvesse vazio, o teste abaixo passaria por
    // vacuidade (o mesmo risco que este comentário adverte a não repetir).
    expect(arquivos.length).toBeGreaterThan(0);

    const ofensores = arquivos
      .filter((p) => CORTE_CLASSIFICACAO.test(readFileSync(p, 'utf-8')))
      .map((p) => resolve(p).slice(REPO_ROOT.length + 1));
    expect(ofensores).toEqual([]);
  });
});
