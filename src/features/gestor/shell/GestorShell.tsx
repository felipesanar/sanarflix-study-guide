import * as React from 'react';
import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { ExperienceSwitcher } from '@/experiences/shared/ExperienceSwitcher';
import { useGestorContexto } from '@/features/gestor/api/queries';
import type { ContextoGestor } from '@/features/gestor/api/types';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';

import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { OVERLINE_SIDEBAR, SidebarNav } from '@/features/gestor/shell/SidebarNav';
import '@/features/gestor/gestor-theme.css';
// Fonte de ícones do Dendê. Precisa vir junto do tema: sem este import o
// @font-face não entra no bundle e todo `<Icon>` renderiza tofu.
import '@/features/gestor/dende-icons.css';

/** Iniciais do nome (até 2), para o avatar do rodapé. */
const iniciaisDe = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Segunda linha do rodapé: o PAPEL da pessoa, como na referência ("Gestora
 * acadêmica"), não o e-mail. Rótulos sem marca de gênero — a mesma conta serve
 * a qualquer pessoa. O e-mail continua alcançável, no `title` do bloco.
 */
const ROTULO_PAPEL: Record<ContextoGestor['usuario']['papel'], string> = {
  admin: 'Administração',
  gestor_grupo: 'Gestão do grupo',
  gestor: 'Gestão acadêmica',
};

/** Divisor entre os blocos da sidebar (lockup · IES · nav · rodapé). */
const DIVISOR = '1px solid var(--gp-border-subtle)';

/**
 * Carregamento da TELA (não de um bloco): é o que aparece no lugar do
 * conteúdo no instante do clique na navegação, enquanto o chunk da rota e a
 * primeira consulta dela chegam.
 *
 * Silhueta genérica de propósito — título, faixa de KPIs e um bloco alto —,
 * porque é a mesma para as três telas: reserva altura suficiente para não
 * haver salto quando o conteúdo real entra, sem prometer um layout que
 * aquela rota específica pode não ter.
 */
const EsqueletoDeRota: React.FC = () => (
  <div className="mx-auto w-full max-w-[1120px] px-6 py-8" role="status" aria-busy="true">
    <span className="sr-only">Carregando a tela</span>
    <GestorSkeleton altura={20} rotulo="Carregando o título" className="max-w-[260px]" />
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((indice) => (
        <GestorSkeleton key={indice} altura={104} forma="cartao" rotulo="Carregando indicador" />
      ))}
    </div>
    <div className="mt-6">
      <GestorSkeleton altura={280} forma="cartao" rotulo="Carregando o conteúdo" />
    </div>
  </div>
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
 * Sidebar fixa de 240px (`w-60`), SEM header no topo do conteúdo. Quatro
 * blocos separados por divisor, como na referência: lockup SanarFlix Academy
 * (48px) + overline "Portal do Gestor" → cartão da instituição → nav de 3
 * itens → rodapé com perfil e avisos, e abaixo as ações do portal. A área de
 * conteúdo é a única que rola.
 *
 * "Ir para versão aluno" reusa {@link GoToStudentButton} (mesmo componente do
 * portal legado e do Admin) — apenas com `variant="ghost"` para caber no
 * rodapé compacto (Task 25, decisão do Felipe de 03/08).
 *
 * "Portal do Admin" (achado 108 da revisão de 03/08): sem ele, uma conta
 * `admin` que entra no portal v2 — o que SEMPRE acontece, porque
 * `get_effective_features` devolve todas as features como `true` para quem
 * tem bypass de papel (admin/atendimento) — não tinha nenhum caminho de UI de
 * volta ao `/admin`; precisava digitar a URL ou colar `?legado=1`, exatamente
 * a edição manual de URL que o rollback da spec §9 devia evitar. Visível
 * SÓ para quem `get_gestor_contexto()` (a MESMA RPC que resolve
 * `podeTrocarIes` em {@link SidebarIes}) devolve `usuario.papel === 'admin'`
 * — decisão de papel vinda do servidor, nunca de role lida no cliente
 * (`useAuth().access`/`user.roles` são espelho client-side, não a fonte).
 *
 * Marca: duas `<img>` (clara/branca) alternadas por `dark:` — nunca
 * `filter: invert()`, nunca redesenho, nunca sombra colorida.
 */
export const GestorShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: contexto } = useGestorContexto();

  const papel = contexto?.usuario.papel;
  const ehAdmin = papel === 'admin';

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
        style={{ background: 'var(--gp-bg-app)' }}
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
                className="h-12 w-auto dark:hidden"
              />
              <img
                src="/sanarflix-academy-lockup-white.svg"
                alt=""
                aria-hidden="true"
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
