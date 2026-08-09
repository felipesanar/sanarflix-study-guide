import * as React from 'react';
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ContainerRota } from '@/features/gestor/components/CabecalhoTela';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';

import { Icon } from '@/features/gestor/components/Icon';

import { ConteudoSidebar } from '@/features/gestor/shell/ConteudoSidebar';
import { OVERLINE_SIDEBAR } from '@/features/gestor/shell/SidebarNav';
import '@/features/gestor/gestor-theme.css';
// Fonte de ícones do Dendê. Precisa vir junto do tema: sem este import o
// @font-face não entra no bundle e todo `<Icon>` renderiza tofu.
import '@/features/gestor/dende-icons.css';


/**
 * Carregamento da TELA (não de um bloco): é o que aparece no lugar do
 * conteúdo no instante do clique na navegação, enquanto o chunk da rota e a
 * primeira consulta dela chegam.
 *
 * Silhueta genérica de propósito — título, faixa de KPIs e um bloco alto —,
 * porque é a mesma para as três telas: reserva altura suficiente para não
 * haver salto quando o conteúdo real entra, sem prometer um layout que
 * aquela rota específica pode não ter.
 *
 * A moldura é a MESMA das rotas (`ContainerRota`, auditoria de 09/08): este
 * esqueleto usava `mx-auto max-w-[1120px] px-6 py-8`, largura e padding que
 * nenhuma tela replicava — o conteúdo real "saltava" de largura no instante
 * em que o fallback saía.
 */
const EsqueletoDeRota: React.FC = () => (
  <ContainerRota role="status" aria-busy="true">
    <span className="sr-only">Carregando a tela</span>
    <GestorSkeleton altura={20} rotulo="Carregando o título" className="max-w-[260px]" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((indice) => (
        <GestorSkeleton key={indice} altura={104} forma="cartao" rotulo="Carregando indicador" />
      ))}
    </div>
    <GestorSkeleton altura={280} forma="cartao" rotulo="Carregando o conteúdo" />
  </ContainerRota>
);



/**
 * Container do Portal do Radix para quem vive dentro do shell (Task 65,
 * decisão do Felipe de 05/08).
 *
 * `Sheet`/`Dialog`/`Select` (`src/components/ui/{sheet,dialog,select}.tsx`)
 * embrulham o conteúdo em `<Primitive.Portal>`, que por padrão despacha para
 * `document.body` — FORA de qualquer nó com a classe `gestor-portal`, e
 * portanto fora do alcance de `gestor-theme.css` (nem os tokens `--gp-*` nem
 * `@media (prefers-reduced-motion: reduce)` alcançam esse conteúdo). Este
 * Context expõe o nó raiz do PRÓPRIO shell (o `<div class="gestor-portal">`
 * logo abaixo) como `container` daqueles Portals, para os seis usos do
 * gestor (`DrawerAluno`, `DrawerTemas`, o Sheet de cronograma em
 * `Detalhamento.tsx`, `Glossario`, `SidebarIes`, `FiltroSemestre`) — nunca
 * para aluno/admin, que não têm este Provider na árvore e portanto continuam
 * caindo no padrão do Radix (`document.body`), sem nenhuma mudança.
 *
 * `null` por padrão (fora do Provider, ou antes do shell montar): Radix trata
 * `container` `null`/`undefined` de forma IDÊNTICA (cai em
 * `mounted && document.body`, ver `node_modules/@radix-ui/react-portal`) —
 * por isso não há necessidade de nenhum fallback especial aqui além do valor
 * inicial do Context, nem de esconder consumidores enquanto o ref ainda não
 * resolveu.
 */
const GestorPortalContainerContext = React.createContext<HTMLDivElement | null>(null);

/**
 * Container do Portal do Radix ancorado dentro de `.gestor-portal` — ver
 * {@link GestorPortalContainerContext}. Devolve `null` (padrão do Radix,
 * `document.body`) para quem chama fora do `GestorShell`, o que inclui
 * TODO teste unitário existente de `DrawerAluno`/`DrawerTemas`/`Glossario`/
 * `FiltroSemestre`/`SidebarIes` (nenhum deles monta o shell ao redor, de
 * propósito) — o comportamento desses testes não muda por isto.
 */
export function useGestorPortalContainer(): HTMLDivElement | null {
  return React.useContext(GestorPortalContainerContext);
}

/**
 * Shell do Portal do Gestor v2 (spec §8.3).
 *
 * Sidebar de 240px (`w-60`) com quatro blocos separados por divisor, como na
 * referência: lockup SanarFlix Academy (48px) + overline "Portal do Gestor" →
 * cartão da instituição → nav de 3 itens → rodapé com perfil e avisos, e
 * abaixo as ações do portal (ver {@link ConteudoSidebar}). A área de conteúdo
 * é a única que rola.
 *
 * RESPONSIVIDADE (auditoria de 09/08, item B7 — o pior nota do portal, 3/10):
 * a partir de `lg` (1024px) a sidebar é a coluna fixa de sempre; abaixo disso
 * ela sai do fluxo e o MESMO conteúdo passa a viver num drawer, aberto por uma
 * barra superior com o lockup e o botão "Menu". Antes deste passe não havia uma
 * única classe responsiva no shell: em notebook estreito e tablet os 240px
 * comiam a área útil das tabelas densas, e não havia rota de fuga além do
 * `overflow-x-auto` de cada tabela.
 *
 * O drawer é o `Sheet` do repositório com o `container` do próprio portal (ver
 * {@link GestorPortalContainerContext}) — sem isso o menu abriria fora do
 * alcance de `gestor-theme.css`, sem nenhum token `--gp-*`.
 *
 * A troca de portal (aluno / admin / atendimento) vive no `ExperienceSwitcher`
 * do rodapé — os antigos botões avulsos "Portal do Admin" e "Ir para versão
 * aluno" saíram: portal não é item de navegação, é troca de experiência, e o
 * alternador é o mesmo controle em todos os portais. Quais experiências ele
 * oferece vem de `access.experiences` (RPC `get_access`), e cada uma continua
 * protegida pelo `ExperienceGuard`.
 */
export const GestorShell: React.FC = () => {
  const { pathname } = useLocation();

  /**
   * Drawer da navegação abaixo de `lg`. Fecha ao trocar de rota: o `NavLink`
   * já avisa via `aoNavegar`, e este efeito cobre o resto (voltar do
   * navegador, redirecionos do `GestorFeatureGate`, links dentro do
   * conteúdo) — um menu aberto sobre a tela nova seria um estado morto.
   */
  const [menuAberto, setMenuAberto] = React.useState(false);
  React.useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);


  /**
   * `useState`, não `useRef`: só uma mudança de STATE re-renderiza os
   * consumidores do Context com o nó real (um `ref.current` mutado por fora
   * não notifica ninguém). `ref={setPortalContainer}` (callback ref, não
   * `useEffect` lendo um `useRef`) porque dispara no COMMIT, antes da
   * pintura — o container fica disponível um tick mais cedo, e nenhum drawer
   * consegue abrir antes desse commit acontecer (é a mesma função que
   * desenha o próprio botão que abriria um).
   *
   * `null` no primeiro render (o nó ainda não existe) nunca quebra nada: os
   * seis consumidores (`useGestorPortalContainer`) tratam `null` como "sem
   * container ainda", e o próprio Radix trata `container` `null`/`undefined`
   * de forma idêntica (cai em `document.body`) — ver comentário no Context
   * acima.
   */
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);

  return (
    <GestorPortalContainerContext.Provider value={portalContainer}>
      <div
        ref={setPortalContainer}
        /* `h-dvh`, não `h-screen`: `100vh` ignora a barra de UI do navegador e o
           shell fica mais alto que a área visível, sobrando faixa sem pintura no
           fim da página. `overscroll-none` impede que o scroll do conteúdo
           "vaze" e role o documento junto — a origem do scroll duplo. */
        className="gestor-portal flex h-dvh overflow-hidden overscroll-none"
        /* `--gp-bg-app`, não `bg-background`: no tema claro `--background` é o
           MESMO branco de `--card`, então a área de conteúdo e os cards ficavam
           indistinguíveis (a separação figura/fundo da referência só existia
           pela borda de 1px). O token é declarado na própria classe
           `.gestor-portal` deste nó — CSS resolve `var()` no elemento que
           declara sem problema. */
        /* Cor base sólida + gradiente por cima: se `background-image` não
           resolver (fallback), o fundo continua sendo o cinza chapado do token. */
        style={{
          backgroundColor: 'var(--gp-bg-app)',
          backgroundImage: 'var(--gp-bg-app-gradient)',
        }}

      >
        <aside
          /* `overflow-y-auto`: o conteúdo da sidebar (lockup + IES + nav +
             perfil + ações + tema) passa de 650px, e sem scroll próprio ele
             era cortado em janela baixa — o rodapé com "Sair" ficava
             inalcançável. `min-h-0` porque um filho de flex não encolhe abaixo
             do conteúdo sem isso, e o `overflow` nunca chegaria a valer. */
          className="relative flex h-full min-h-0 w-60 shrink-0 flex-col overflow-y-auto overscroll-contain border-r"
          style={{
            background: 'var(--gp-surface-1)',
            borderColor: 'var(--gp-border-subtle)',
            color: 'var(--gp-text-2)',
          }}
        >
          <div
            className="flex flex-col"
            style={{ padding: '22px 20px 18px', gap: 14, borderBottom: DIVISOR }}
          >
            <div className="flex items-center">
              <img
                src="/sanarflix-academy-lockup.svg"
                alt="SanarFlix Academy"
                width={533}
                height={138}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className="h-12 w-auto dark:hidden"
              />
              <img
                src="/sanarflix-academy-lockup-white.svg"
                alt=""
                aria-hidden="true"
                width={533}
                height={138}
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className="hidden h-12 w-auto dark:block"
              />

            </div>
            <span style={OVERLINE_SIDEBAR}>Portal do Gestor</span>
          </div>

          <div style={{ padding: '14px 16px', borderBottom: DIVISOR }}>
            <SidebarIes />
          </div>

          <SidebarNav />

          <div className="mt-auto" style={{ borderTop: DIVISOR }}>
            <div className="flex items-center" style={{ padding: '14px 16px', gap: 10 }}>
              <span
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 34,
                  height: 34,
                  fontSize: 12,
                  fontWeight: 700,
                  // `lineHeight: 1` — ver TileIes em SidebarIes.tsx: com o
                  // `normal` (≈1.21em na Inter) a caixa de linha não é
                  // simétrica em torno das maiúsculas e a sigla assenta fora
                  // do centro vertical do tile.
                  lineHeight: 1,
                  background: 'var(--gp-brand-surface)',
                  // No claro este token É a marca; no escuro ele vira o tom
                  // clareado que passa AA sobre superfície escura — nunca a
                  // marca crua como cor de texto ali.
                  color: 'var(--gp-brand-on-dark)',
                }}
              >
                {iniciaisDe(user?.nome)}
              </span>
              <div className="min-w-0 flex-1" title={user?.email ?? undefined}>
                <p
                  className="truncate"
                  style={{ fontSize: 13, fontWeight: 600, lineHeight: '16px', color: 'var(--gp-text-1)' }}
                >
                  {user?.nome ?? '—'}
                </p>
                {/* `minHeight` reserva a linha antes de o papel chegar do
                    servidor — senão o rodapé cresce 14px no meio do carregamento. */}
                <p
                  className="truncate"
                  style={{ fontSize: 11, lineHeight: '14px', minHeight: 14, color: 'var(--gp-text-3)' }}
                >
                  {papel ? ROTULO_PAPEL[papel] : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label="Avisos da Sanar"
                onClick={() => navigate('/gestor')}
                className="gp-hover-surface flex shrink-0 items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--gp-radius-sm)',
                  color: 'var(--gp-text-2)',
                }}
              >
                <Icon name="notifications" size={18} />
              </button>
            </div>

            <div className="space-y-1" style={{ padding: '10px 12px 12px', borderTop: DIVISOR }}>
              {/* Troca de experiência: substitui os antigos botões avulsos
                  ("Portal do Admin", "Ir para versão aluno"). Aluno/Admin/CX
                  são experiências, não itens de navegação. */}
              <div className="pb-1">
                <ExperienceSwitcher variant="compact" />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs text-[color:var(--gp-text-3)]"
                onClick={() => logout()}
              >
                <Icon name="logout" size={16} />
                Sair
              </Button>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>Tema</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>

        {/* `relative` não é decoração: é o que impede o conteúdo rolável de
            esticar o DOCUMENTO.

            Sem um ancestral posicionado, todo descendente `position:absolute`
            resolve contra o viewport inicial, não contra este `main`. O
            `.sr-only` do Tailwind é justamente `position:absolute`, e a posição
            estática dele fica onde ele aparece no fluxo — lá embaixo, num
            conteúdo de 3400px. Resultado: o `<html>` crescia para 2486px num
            viewport de 891, o documento ganhava barra de rolagem própria e
            sobrava uma faixa vazia (preta) abaixo do app. Só acontecia no
            Detalhamento porque é a tela cujo conteúdo passa da altura da
            janela por margem suficiente.

            Medido no navegador: com `relative`, `documentElement.scrollHeight`
            cai de 2486 para 891 — exatamente o viewport. */}
        <main className="relative h-full min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/*
            `key={pathname}` no Suspense não é detalhe: é o que faz a troca de
            tela ser INSTANTÂNEA (achado 09/08).

            O router roda com `v7_startTransition`, então navegar é um update
            em transição — e o React, por definição, MANTÉM o conteúdo antigo
            na tela enquanto uma boundary já montada suspende, em vez de trocar
            pelo fallback. Com o chunk da rota destino ainda por baixar (lazy),
            isso prendia o gestor na tela atual por segundos, sem nenhum sinal
            de que o clique tinha valido — a sensação de travado que ele
            relatou ao ir de Visão geral para Detalhamento na primeira vez da
            sessão.

            Trocando a `key` a cada rota, a boundary do destino é uma boundary
            NOVA: não tem conteúdo anterior para preservar, então o fallback
            aparece de imediato. A navegação acontece no clique e o
            carregamento passa a ser mostrado na tela de destino, que é a
            ordem certa.
          */}
          <Suspense key={pathname} fallback={<EsqueletoDeRota />}>
            <Outlet />
          </Suspense>
        </main>

      </div>
    </GestorPortalContainerContext.Provider>
  );
};
