import * as React from 'react';
import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { SidebarNav } from '@/features/gestor/shell/SidebarNav';
import '@/features/gestor/gestor-theme.css';

/** Iniciais do nome (até 2), para o avatar do rodapé. */
const iniciaisDe = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

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
 * Sidebar fixa de 240px (`w-60`), SEM header no topo do conteúdo. De cima para
 * baixo: lockup SanarFlix Academy (48px) → instituição → nav de 3 itens →
 * rodapé com tema, perfil, "Portal do Admin" (só para quem é admin — ver
 * abaixo), "Ir para versão aluno" e sair. A área de conteúdo é a única que
 * rola.
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
 * Reusa o padrão de encaixe do {@link GoToStudentButton} no rodapé (mesmo
 * `Button` ghost/sm, `onClick` + `navigate`) e o rótulo/ícone (`UserCog`) já
 * estabelecidos em `getPortalEntries` (`globalNav.ts`) para "Portal do
 * Admin" nos outros pontos do app — mesmo destino, mesma copy.
 *
 * Marca: duas `<img>` (clara/branca) alternadas por `dark:` — nunca
 * `filter: invert()`, nunca redesenho, nunca sombra colorida.
 */
export const GestorShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: contexto } = useGestorContexto();
  const ehAdmin = contexto?.usuario.papel === 'admin';

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
      <div ref={setPortalContainer} className="gestor-portal flex h-screen overflow-hidden bg-background">
        <aside className="flex h-full w-60 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground">
          <div className="flex min-h-[3.5rem] items-center px-4">
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

          <div className="px-3">
            <SidebarIes />
          </div>

          <SidebarNav />

          <div className="mt-auto space-y-2 border-t border-sidebar-border px-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                >
                  {iniciaisDe(user?.nome)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium">{user?.nome ?? '—'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email ?? ''}</p>
                </div>
              </div>
              <ThemeToggle />
            </div>
            {ehAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground"
                onClick={() => navigate('/admin')}
              >
                <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                Portal do Admin
              </Button>
            )}
            <GoToStudentButton
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground"
              onClick={() => logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </aside>

        <main className="h-full flex-1 overflow-y-auto">
          <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </GestorPortalContainerContext.Provider>
  );
};
