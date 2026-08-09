import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { cn } from '@/lib/utils';
import { prefetchVisaoGeral } from '@/features/gestor/api/prefetch';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { usePrefersReducedMotion } from '@/features/gestor/hooks/usePrefersReducedMotion';

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
 * `--gp-text-3`. Hoje serve a UM lugar: "Portal do Gestor" sob o lockup
 * (`GestorShell`). Continua exportado por isso. O título de grupo da nav
 * ganhou anatomia própria — ver {@link TITULO_GRUPO_NAV}.
 */
export const OVERLINE_SIDEBAR: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--gp-text-3)',
};

/**
 * Título de GRUPO da nav — um degrau abaixo de {@link OVERLINE_SIDEBAR}.
 *
 * "Portal do Gestor" (sob o lockup) é rótulo do produto e pode ocupar a
 * largura toda; "Desempenho Institucional" é só uma etiqueta de seção e, nos
 * 11px/0.1em do overline, não cabia na coluna de 240px — quebrava em duas
 * linhas e competia em peso com os próprios itens de nav que rotula. Em
 * 10px/0.06em cabe numa linha e volta a ser fundo de tela.
 */
const TITULO_GRUPO_NAV: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
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
 * `layoutId` compartilhado da barra ativa entre os 3 itens (plano de motion,
 * Onda 2/B1: "indicador de página ativa que DESLIZA entre itens ao navegar",
 * mesmo pedido que o segmentado de `FiltroSemestre.tsx` resolve com
 * `transform`/`getBoundingClientRect`).
 *
 * Aqui a geometria é vertical (itens em coluna, com o overline "Desempenho
 * Institucional" alterando o espaçamento entre o 1º e o 2º item) — medir com
 * `ref`+`getBoundingClientRect` exigiria reproduzir esse layout à mão. A
 * própria spec já lista a alternativa aceitável para este caso: `layoutId`
 * do Framer Motion (já instalado no repo) num elemento absoluto que só
 * existe no item ativo — quando `isActive` migra de um `NavLink` pro outro
 * NA MESMA atualização de `location`, o Framer detecta a barra antiga saindo
 * e a nova entrando com o MESMO `layoutId` e anima a transição de posição
 * (FLIP) entre as duas, em vez de cada uma aparecer/desaparecer sozinha.
 */
const LAYOUT_ID_BARRA_ATIVA = 'gestor-sidebar-nav-barra-ativa';

/**
 * Curva/duração do deslize da barra: os MESMOS números de `--gp-motion-3`
 * (200ms) e `--gp-ease` (`cubic-bezier(0.2,0,0,1)`) de `gestor-theme.css` —
 * a prop `transition` do Framer Motion não lê variável CSS, só valor
 * literal, por isso os números entram crus aqui (mesmo padrão de
 * `DirecionadoresGestor.tsx`, que hardcoda o mesmo cubic-bezier em Tailwind
 * arbitrário pelo mesmo motivo).
 */
const TRANSICAO_BARRA_ATIVA = { duration: 0.2, ease: [0.2, 0, 0, 1] as [number, number, number, number] };

/** Sem movimento algum quando a pessoa pede `prefers-reduced-motion: reduce`
 *  — a barra ainda troca de item, só que sem a animação de deslize. */
const TRANSICAO_BARRA_SEM_MOVIMENTO = { duration: 0 };

/**
 * Transição de `color` do ícone (80ms = `--gp-motion-1`, `--gp-ease`) — sem
 * isto a troca entre `text-3`/outlined (repouso) e `brand`/filled (ativo) era
 * instantânea. Sintaxe de propriedade explícita (`[transition-duration:...]`,
 * `[transition-timing-function:...]`), não a classe abreviada `duration-[…]`/
 * `ease-[…]` do Tailwind — essas duas são ambíguas pro Tailwind (não sabe se
 * são de `transition-*` ou `animation-*`) e o guard estático de
 * `tema.test.tsx` reprova exatamente essa forma.
 */
const TRANSICAO_COR_ICONE =
  'transition-[color] [transition-duration:80ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]';

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { iesId, semestre } = useFiltrosGestor();
  const reduzido = usePrefersReducedMotion();

  /**
   * Prefetch no hover/foco de cada item (Parte VIII/§22 do handoff): só a
   * Visão Geral tem função de prefetch pronta na Onda 1
   * (`prefetchVisaoGeral`, o MESMO gatilho que já aquece
   * `DirecionadoresGestor.tsx` no cartão equivalente da Início). `iesId`
   * ainda pode ser `null` no primeiro acesso (antes de `SidebarIes` semear a
   * URL) — sem seleção de IES não há o que aquecer.
   *
   * Início não entra aqui de propósito: não tem dado próprio pra aquecer, só
   * os dois direcionadores que já fazem o próprio prefetch.
   *
   * TODO: prefetch de Detalhamento pendente de função dedicada — Onda 1 só
   * criou prefetch de aluno/nível da cascata/próxima página (`prefetch.ts`),
   * nenhuma para a tela de Detalhamento em si (que depende dos simulados
   * selecionados, algo que a sidebar não conhece). Inventar uma chave aqui
   * aqueceria um cache que nenhum hook de Detalhamento chega a observar.
   */
  const aquecerVisaoGeral = React.useCallback(() => {
    if (iesId === null) return;
    void prefetchVisaoGeral(queryClient, user?.id, iesId, semestre);
  }, [queryClient, user?.id, iesId, semestre]);

  /**
   * Prefetch do CHUNK da rota (não do dado) no hover/foco — as três telas são
   * `lazy()` em `gestorV2Routes.tsx`, e o download do bundle só começava no
   * clique. É a parte da espera que o gestor sentia como "travado" ao ir de
   * Visão Geral para Detalhamento na primeira vez da sessão; baixando durante
   * o hover, na hora do clique o módulo já está no cache do Vite/navegador e a
   * tela troca sem passar pelo esqueleto.
   *
   * Falha de rede aqui é silenciosa de propósito: é otimização, e o clique
   * real continua tendo o seu próprio carregamento com esqueleto.
   */
  const aquecerChunk = React.useCallback((url: string) => {
    if (url === '/gestor/visao-geral') void import('@/features/gestor/routes/VisaoGeral').catch(() => undefined);
    if (url === '/gestor/detalhamento') void import('@/features/gestor/routes/Detalhamento').catch(() => undefined);
  }, []);

  return (
    <nav
      aria-label="Seções do portal do gestor"
      className="flex flex-col"
      style={{ padding: '16px 12px', gap: 2 }}
    >
      {GESTOR_V2_NAV.map(({ title, url, icon }, indice) => {
        const aoPassarMouse = () => {
          aquecerChunk(url);
          if (url === '/gestor/visao-geral') aquecerVisaoGeral();
        };


        return (
        <React.Fragment key={url}>
          {indice === PRIMEIRO_DO_GRUPO && (
            <div style={{ ...TITULO_GRUPO_NAV, padding: '18px 12px 8px' }}>
              Desempenho Institucional
            </div>
          )}
          <NavLink
            to={{ pathname: url, search: location.search }}
            end={url === '/gestor'}
            onMouseEnter={aoPassarMouse}
            onFocus={aoPassarMouse}
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
                {isActive && (
                  <motion.span
                    aria-hidden="true"
                    layoutId={LAYOUT_ID_BARRA_ATIVA}
                    style={BARRA_ATIVA}
                    transition={reduzido ? TRANSICAO_BARRA_SEM_MOVIMENTO : TRANSICAO_BARRA_ATIVA}
                  />
                )}
                <Icon
                  name={icon}
                  variant={isActive ? 'filled' : 'outlined'}
                  size={18}
                  box={20}
                  className={cn(
                    TRANSICAO_COR_ICONE,
                    isActive
                      ? 'text-[color:var(--gp-brand)]'
                      : 'text-[color:var(--gp-text-3)]',
                  )}
                />
                {title}
              </>
            )}
          </NavLink>
        </React.Fragment>
        );
      })}
    </nav>
  );
};
