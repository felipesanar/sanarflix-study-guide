import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { cn } from '@/lib/utils';

export interface GestorV2NavItem {
  title: string;
  url: string;
  /**
   * Glifo do Fontello do Dendê — só o NOME. A variante não entra aqui de
   * propósito: ela é função do estado (`filled` no ativo, `outlined` em
   * repouso, handoff §3), e portanto pertence ao render, não ao catálogo.
   */
  icon: DendeIconName;
}

/** Navegação canônica do Portal do Gestor v2 — 3 itens, nada mais (spec §2.1, §8.3). */
export const GESTOR_V2_NAV: GestorV2NavItem[] = [
  { title: 'Início', url: '/gestor', icon: 'home' },
  { title: 'Visão Geral', url: '/gestor/visao-geral', icon: 'equalizer' },
  { title: 'Detalhamento por Simulados', url: '/gestor/detalhamento', icon: 'insights' },
];

/**
 * Overline estrutural da sidebar — 11px/600, tracking 0.1em, uppercase, em
 * `--gp-text-3`. Exportado porque a MESMA anatomia serve a dois lugares na
 * referência: "Portal do Gestor" sob o lockup (`GestorShell`) e o título de
 * grupo "Desempenho Institucional" aqui. Um só lugar para não divergirem.
 */
export const OVERLINE_SIDEBAR: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--gp-text-3)',
};

/**
 * Índice do primeiro item sob "Desempenho Institucional". O Início fica solto
 * acima do título de grupo — a referência separa a tela de entrada das duas
 * telas de análise.
 */
const PRIMEIRO_DO_GRUPO = 1;

/** Barra vertical de marca colada à esquerda do item ativo (referência: 3px). */
const BARRA_ATIVA: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 8,
  bottom: 8,
  width: 3,
  // Raio de "cápsula" da própria barra de 3px — é a terminação do traço, não
  // o raio de um container; por isso fica fora da escala de raios do handoff.
  borderRadius: '0 3px 3px 0',
  background: 'var(--gp-brand)',
};

/**
 * Navegação da sidebar. Cada link carrega a query string atual, para que o
 * recorte global (semestre/simulados/IES) sobreviva à troca de tela — caso de
 * teste 12 da spec §12.
 *
 * `end` no item raiz (`/gestor`) evita que o Início fique sempre ativo — mesmo
 * cuidado que o `isConsoleRoot` do ConsoleShell do admin.
 *
 * Anatomia do item ativo (handoff §4.1, conferida na referência): superfície de
 * marca em gradiente 92deg, raio 8px, anel interno de marca, peso 600, ícone
 * `-filled` na marca e a barra vertical de 3px. Inativo: text-2 com ícone
 * `-outlined` em text-3 e hover em surface-3 (`gp-hover-surface`, que já traz a
 * regra "no claro escurece, no escuro clareia" e a duração de 140ms do tema).
 */
export const SidebarNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav
      aria-label="Seções do portal do gestor"
      className="flex flex-col"
      style={{ padding: '16px 12px', gap: 2 }}
    >
      {GESTOR_V2_NAV.map(({ title, url, icon }, indice) => (
        <React.Fragment key={url}>
          {indice === PRIMEIRO_DO_GRUPO && (
            <div style={{ ...OVERLINE_SIDEBAR, padding: '18px 12px 8px' }}>
              Desempenho Institucional
            </div>
          )}
          <NavLink
            to={{ pathname: url, search: location.search }}
            end={url === '/gestor'}
            className={({ isActive }) =>
              cn(
                'relative flex items-center text-sm',
                isActive
                  ? 'font-semibold text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]'
                  : 'gp-hover-surface text-[color:var(--gp-text-2)]',
              )
            }
            style={({ isActive }) => ({
              gap: 12,
              padding: '10px 12px',
              borderRadius: 'var(--gp-radius-sm)',
              ...(isActive
                ? {
                    // Gradiente 92deg da referência. O segundo passo é a mesma
                    // superfície de marca diluída na superfície do painel —
                    // `color-mix` em vez de um token novo, para não inventar
                    // variável fora de `gestor-theme.css` (que não é deste
                    // lote). No escuro o resultado converge para a superfície
                    // chapada, que é o que a referência escura desenha.
                    background:
                      'linear-gradient(92deg, var(--gp-brand-surface), color-mix(in srgb, var(--gp-brand-surface) 70%, var(--gp-surface-1)))',
                    boxShadow: 'inset 0 0 0 1px var(--gp-brand-border)',
                  }
                : null),
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden="true" style={BARRA_ATIVA} />}
                <Icon
                  name={icon}
                  variant={isActive ? 'filled' : 'outlined'}
                  size={18}
                  box={20}
                  className={
                    isActive
                      ? 'text-[color:var(--gp-brand)]'
                      : 'text-[color:var(--gp-text-3)]'
                  }
                />
                {title}
              </>
            )}
          </NavLink>
        </React.Fragment>
      ))}
    </nav>
  );
};
