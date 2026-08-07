import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { GestorShell } from '@/features/gestor/shell/GestorShell';
import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';

/**
 * Task 64 (cleanup, escopo definido pelo Felipe em 05/08): no merge, TODOS os
 * gestores de TODAS as IES passam a receber o portal novo — sem piloto, sem
 * GA por lotes. Isso elimina a própria razão de existir do gate por feature
 * (`gestao.portal_v2`).
 *
 * O que esta suíte testava antes (e não existe mais, por não ter mais
 * comportamento correspondente no produto):
 *  - `GestorPortalShell` escolhendo entre `GestorShell` (v2) e
 *    `GestorLayoutLegado` (= `GestorLayout`) pela flag — só havia UM shell
 *    daqui pra frente, então não há mais escolha a testar.
 *  - `PortalV2Gate`/`LegacyGestorGate` alternando as 3 rotas novas e as 5
 *    telas antigas conforme a flag — a experiência legada inteira
 *    (`src/experiences/gestor/**`) foi apagada (Task 64), não há mais um
 *    "outro lado" para o gate escolher.
 *  - A válvula de escape do admin (`?legado=1`, card 108) — existia só para
 *    o admin conseguir verificar a experiência legada sem editar
 *    `ies_features`; sem experiência legada, não há o que escapar para.
 *  - Preservação da query string no redirect dos gates (card 120) — não há
 *    mais redirect nenhum entre as rotas do portal (só os 2 compat estáticos
 *    de Desempenho Institucional, que nunca carregaram a query string).
 *
 * A chave `gestao.portal_v2` continua existindo em `ies_features` no banco
 * (dado morto agora — limpeza é outra tarefa, fora do escopo de frontend).
 *
 * O que continua valendo e é testado abaixo: `/gestor` monta o portal novo
 * direto, protegido SÓ pelo `ExperienceGuard` (separa a experiência de
 * gestão de aluno/admin/CX — nunca decidiu entre versões do portal, isso
 * era papel do gate que foi removido). Ver também
 * `src/test/components/ExperienceGuard.test.tsx` para o comportamento do
 * guard em si, e `src/test/unit/buildAppRoutes.test.ts` para a árvore
 * completa por perfil de usuário.
 */

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

const filhasDeGestor = (): RouteObject[] =>
  gestorV2Routes().find((rota) => rota.path === '/gestor')?.children ?? [];

describe('gestorV2Routes — GA total, sem gate por feature (Task 64)', () => {
  it('/gestor é protegido só pelo ExperienceGuard("gestao") envolvendo o GestorShell — nenhum gate por feature por cima', () => {
    const rotaGestor = gestorV2Routes().find((r) => r.path === '/gestor');
    expect(rotaGestor).toBeDefined();

    const el = rotaGestor!.element as React.ReactElement<{
      experience?: string;
      children?: React.ReactNode;
    }>;
    expect(el.type).toBe(ExperienceGuard);
    expect(el.props.experience).toBe('gestao');
    expect((el.props.children as React.ReactElement).type).toBe(GestorShell);
  });

  /**
   * As 5 URLs legadas continuam na árvore, mas como REDIRECT, não como tela:
   * a experiência que as servia foi apagada, e deixá-las cair no 404 faria o
   * gestor com link salvo descobrir a mudança batendo num erro exatamente no
   * dia do merge (decisão do Felipe, 05/08).
   */
  const TELAS_DO_PORTAL = ['index', 'visao-geral', 'detalhamento'];
  const URLS_LEGADAS = [
    'visao-institucional',
    'diagnostico-curricular',
    'alunos',
    'insights-pedagogicos',
    'inteligencia-decisoria',
  ];

  it('serve as 3 telas do portal e mais nada além dos redirects de compatibilidade', () => {
    const paths = filhasDeGestor().map((c) => (c.index ? 'index' : c.path));
    expect(paths).toEqual([...TELAS_DO_PORTAL, ...URLS_LEGADAS]);
  });

  it('as 3 telas renderizam conteúdo real, sem gate e sem redirect (PortalV2Gate/LegacyGestorGate não existem mais)', () => {
    const telas = filhasDeGestor().filter((c) => c.index || TELAS_DO_PORTAL.includes(c.path ?? ''));
    expect(telas).toHaveLength(TELAS_DO_PORTAL.length);
    for (const filha of telas) {
      const tipo = (filha.element as React.ReactElement).type;
      expect(tipo, `rota /gestor/${filha.path ?? '(index)'} deveria renderizar conteúdo real`).toBeDefined();
      expect(tipo).not.toBe(Navigate);
    }
  });

  it.each(URLS_LEGADAS)('a URL legada /gestor/%s desvia para o portal, nunca 404', (caminho) => {
    const filha = filhasDeGestor().find((c) => c.path === caminho);
    expect(filha, `/gestor/${caminho} sumiu da árvore`).toBeDefined();
    const elemento = filha!.element as React.ReactElement<{ to?: string }>;
    expect(elemento.type).toBe(Navigate);
    expect(elemento.props.to).toBe('/gestor');
  });

  it('preserva os redirects de compatibilidade do Desempenho Institucional (pré-existentes ao gate, nada a ver com ele)', () => {
    const rotas = gestorV2Routes();
    const alvo = (path: string) =>
      (rotas.find((r) => r.path === path)?.element as React.ReactElement<{ to?: string }>)?.props
        ?.to;
    expect(alvo('/desempenho-institucional')).toBe('/gestor');
    expect(alvo('/desempenho-institucional-v2')).toBe('/gestor');
  });

  it('regressão: o gate por feature e a experiência legada foram mesmo apagados, não só desligados', () => {
    // Trava contra reintrodução acidental (merge malfeito, cherry-pick etc.)
    // do mecanismo que esta própria tarefa removeu.
    expect(existsSync(resolve(REPO_ROOT, 'src/features/gestor/portalV2Gates.tsx'))).toBe(false);
    expect(existsSync(resolve(REPO_ROOT, 'src/experiences/gestor'))).toBe(false);
  });
});
