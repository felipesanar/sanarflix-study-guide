import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Import real (não só leitura de texto) — força o transform do vitest a
// resolver a árvore de imports do componente, inclusive os novos imports
// cross-feature para `@/features/gestor/lib/regras` e `.../formatters`.
// Sem isto, os testes abaixo só fazem regex sobre texto e não pegariam um
// alias de import errado ou um nome de export trocado (o teste-guarda não
// substitui `npm run type-check`, que esta tarefa proíbe rodar).
import { AiChatDrawer } from '@/components/analytics/v2/shared/AiChatDrawer';

/**
 * Teste-guarda da Task 64b (spec §4.4, §7.3): trava que o produto tem UMA
 * régua de desempenho — não cinco, como já aconteceu neste projeto.
 *
 * CONTEXTO DA DECISÃO (registrado aqui para quem ler depois — o caminho
 * seguido diverge do que o plano previa): o plano
 * (docs/superpowers/plans/2026-07-25-portal-gestor-v2.md, Task 64b) assumia
 * que a Task 64 já tinha removido `src/experiences/gestor/GestorLayout.tsx`
 * e que, por isso, o único consumidor restante do `AiChatDrawer` seria a
 * página órfã `DesempenhoInstitucionalV2.tsx` — nesse cenário o caminho
 * seria apagar os dois arquivos (Caminho A).
 *
 * Isso NÃO é verdade nesta árvore: a Task 64 não foi executada.
 * `GestorLayout` continua de pé e é alcançável em produção —
 * `buildAppRoutes` → `gestorV2Routes()` (quando `access.experiences` inclui
 * `gestao`) monta `/gestor` com `GestorPortalShell`, que renderiza
 * `GestorLayoutLegado` (= `GestorLayout`) sempre que a feature
 * `gestao.portal_v2` está desligada para a IES
 * (src/features/gestor/portalV2Gates.tsx) — e o Portal v2 ainda não está em
 * produção, ou seja, é isso que a maioria dos gestores reais vê hoje.
 * `GestorLayout` importa e renderiza `AiChatDrawer` atrás da feature
 * `gestao.ia`. Consumidor alcançável em produção → Caminho B (trocar os
 * números pela régua única), não Caminho A (apagar). Por isso este arquivo,
 * ao contrário do sugerido no plano (que testava
 * `existsSync(...) === false`), afirma o oposto: os arquivos CONTINUAM
 * existindo e não devem reimplementar corte de classificação fora de
 * `features/gestor/lib/regras.ts`.
 *
 * SOBRE O REGEX: `/[><]=?\s*(30|45|55|60|80)\b/` casa um `<`/`>` literal
 * (opcionalmente `<=`/`>=`) imediatamente seguido de um dos cortes da régua
 * — ou seja, comparações de código ("percentual < 45", "s.percentual >= 60"),
 * não menções em prosa ("abaixo de 45%", "PROFICIENCIA_MINIMA", "45/55/60"
 * em comentário). Validado rodando este regex contra o AiChatDrawer.tsx já
 * corrigido e contra as ~43 fontes restantes de src/features/gestor (fora
 * de lib/regras.ts e __tests__/): zero falsos positivos hoje. O texto do
 * drawer foi escrito de propósito em prosa ("abaixo de
 * ${NIVEL_CRITICO_MAX}%") ou citando os números antigos separados por barra
 * em comentário ("45/55/60"), nunca com o número cru colado a um operador
 * de comparação — por isso o regex não precisou ser estreitado. Se um novo
 * falso positivo aparecer (ex.: um "<50%" de outra métrica, ou um número da
 * lista dentro de uma classe Tailwind), estreite o regex e explique aqui —
 * um teste que passa por vacuidade ou tranca comportamento errado é pior
 * que nenhum teste.
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
 * manual (mesmo padrão já usado e validado em `tema.test.tsx`, não
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

describe('régua única de desempenho no produto (spec §4.4, §7.3 — Task 64b)', () => {
  it('AiChatDrawer.tsx resolve e transpila (import real do componente e da régua)', () => {
    expect(typeof AiChatDrawer).toBe('function');
  });

  it('AiChatDrawer usa a régua única de features/gestor/lib/regras (não reimplementa)', () => {
    const src = readFileSync(AI_CHAT_DRAWER, 'utf-8');
    expect(src).toMatch(/from ['"]@\/features\/gestor\/lib\/regras['"]/);
    expect(src).toMatch(/\bnivelDesempenho\(/);
    expect(src).toMatch(/\behProficiente\(/);
  });

  it('AiChatDrawer.tsx não contém literal de corte de classificação fora de regras.ts', () => {
    const src = readFileSync(AI_CHAT_DRAWER, 'utf-8');
    expect(CORTE_CLASSIFICACAO.test(src)).toBe(false);
  });

  it('DesempenhoInstitucionalV2.tsx não contém literal de corte de classificação fora de regras.ts', () => {
    const src = readFileSync(DESEMPENHO_V2_PAGE, 'utf-8');
    expect(CORTE_CLASSIFICACAO.test(src)).toBe(false);
  });

  it('nenhum outro arquivo de src/features/gestor reimplementa corte de nível', () => {
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
