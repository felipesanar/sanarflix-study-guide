import { Fragment, Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Sheet } from '@/components/ui/sheet';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { GestorPortalContainerContext } from '@/features/gestor/shell/GestorShell';
import type { TriboId } from '@/features/mentor/api/types';
import { useContagensNav, useMe } from '@/features/mentor/api/queries';
import { DrawerAlunoHost } from '@/features/mentor/components/aluno/DrawerAlunoHost';
import { identidadeTribo, temaIesPadrao, temaTribo } from '@/features/mentor/tema/contexto';
import { HeaderMobile } from './HeaderMobile';
import { SidebarDrawer } from './SidebarDrawer';
import { navMentor } from './navMentor';
import '@/features/gestor/gestor-theme.css';
import '@/features/gestor/dende-icons.css';
import './mentor-shell.css';

// Os assets oficiais já entregues no handoff entram no bundle, sem URLs de docs em produção.
const iconesTribo: Record<TriboId, string> = {
  carcara: new URL('../../../../docs/handoff/mentor/prototipos/brand/icone-carcara.png', import.meta.url).href,
  camaleao: new URL('../../../../docs/handoff/mentor/prototipos/brand/icone-camaleao.png', import.meta.url).href,
  colmeia: new URL('../../../../docs/handoff/mentor/prototipos/brand/icone-colmeia.png', import.meta.url).href,
  octopus: new URL('../../../../docs/handoff/mentor/prototipos/brand/icone-octopus.png', import.meta.url).href,
};

export function MentorShell() {
  const me = useMe();
  const contagens = useContagensNav();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setMenuAberto(false); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 980px)');
    const fecharNoDesktop = () => { if (desktop.matches) setMenuAberto(false); };
    desktop.addEventListener('change', fecharNoDesktop);
    return () => desktop.removeEventListener('change', fecharNoDesktop);
  }, []);

  const data = me.data;
  if (!data) return null; // GuardPortalMentor é dono do carregamento e da autorização.
  const { mentor } = data;
  const b2c = mentor.modalidade === 'b2c';
  const tribos = data.tribos.filter((tribo) => tribo.modalidade === mentor.modalidade);
  const tribo = tribos.find((item) => item.papel === 'titular') ?? tribos[0];
  const slug = tribo?.slug;
  const triboId = slug && Object.prototype.hasOwnProperty.call(iconesTribo, slug) ? slug as TriboId : null;
  const cadastro = { lema: tribo?.lema ?? undefined, cores: tribo?.cores ?? undefined };
  const identidade = b2c && triboId ? identidadeTribo(triboId, cadastro) : null;
  const tema = b2c && triboId ? temaTribo(triboId, cadastro) : temaIesPadrao;
  const nomeContexto = tribo ? (b2c ? `Tribo ${tribo.nome}` : (tribo.iesNome ?? tribo.nome)) : 'Sua mentoria';
  const tituloContexto = !b2c && tribo?.campus ? `${nomeContexto} · ${tribo.campus}` : nomeContexto;
  const totalAlunos = tribo?.totalAlunos;
  const alunosTexto = totalAlunos == null ? null : `${totalAlunos} alunos`;
  const contextoMobile = !b2c && alunosTexto ? `${nomeContexto} · ${alunosTexto}` : nomeContexto;
  const lema = tribo?.lema ?? identidade?.lema;
  const iniciais = mentor.nome.trim().split(/\s+/).filter(Boolean).map((parte) => parte[0]).filter((_, i, partes) => i === 0 || i === partes.length - 1).join('').toUpperCase();
  const icone = tribo?.iconeUrl ?? (b2c && triboId ? iconesTribo[triboId] : null);
  const erroGlobal = me.isError || contagens.isError;

  function sidebar(aoNavegar?: () => void) {
    return (
      <>
        <div className="mentor-sidebar-topo">
          <img className="mentor-lockup" src="/sanarflix-academy-lockup.svg" alt="SanarFlix Academy" />
          <div
            className="mentor-cartao-contexto" data-testid="cartao-contexto"
            style={{
              background: b2c ? (tribo?.cores?.shadow ?? tema.cartaoSidebar) : 'var(--gp-surface-1)',
              color: b2c ? tema.cartaoSidebarTexto : 'var(--gp-text-1)',
            }}
          >
            {icone ? <img src={icone} alt={`Ícone da ${b2c ? 'tribo' : 'IES'} ${tribo?.iesNome ?? tribo?.nome}`} className="mentor-contexto-icone" /> : (
              <Icon name={b2c ? 'groups' : 'school'} size={30} box={36} />
            )}
            <div className="mentor-contexto-texto">
              <strong>{tituloContexto}</strong>
              {b2c ? lema && <span>{lema}</span> : <span>Sua turma{alunosTexto && ` · ${alunosTexto}`}</span>}
            </div>
          </div>
        </div>
        <nav className="mentor-nav" aria-label="Portal do Mentor">
          {navMentor[mentor.modalidade].map((item, indice) => {
            const badge = !contagens.isError && item.badge ? contagens.data?.[item.badge] : null;
            return (
              <Fragment key={item.to}>
                {indice === 1 && <span className="mentor-nav-grupo">Minha mentoria</span>}
                <NavLink to={item.to} end={item.to === '/mentor'} className="mentor-nav-link" onClick={aoNavegar}>
                  {({ isActive }) => <>
                    <Icon name={item.icone} size={17} box={20} variant={item.icone === 'calendar_month' || isActive ? 'filled' : 'outlined'} />
                    <span className="mentor-nav-rotulo">{item.rotulo}</span>
                    {badge != null && badge > 0 && <span className="mentor-nav-badge" data-testid={`badge-${item.badge}`}>{badge}</span>}
                  </>}
                </NavLink>
              </Fragment>
            );
          })}
        </nav>
        <footer className="mentor-sidebar-rodape">
          {b2c && mentor.fotoUrl ? (
            <img src={mentor.fotoUrl} alt={mentor.nome} className="mentor-avatar" style={{ boxShadow: `0 0 0 2px ${tribo?.cores?.sig ?? identidade?.cores.sig ?? 'var(--gp-brand)'}` }} />
          ) : <span className="mentor-avatar mentor-avatar-iniciais" aria-label={mentor.nome}>{iniciais}</span>}
          <div className="mentor-perfil"><strong>{mentor.nome}</strong><span>Mentor {b2c ? 'B2C' : 'B2B'}</span></div>
          <button type="button" className="mentor-notificacoes" aria-label="Notificações" disabled title="Notificações indisponíveis">
            <Icon name="notifications" size={17} />
          </button>
        </footer>
      </>
    );
  }

  return (
    <GestorPortalContainerContext.Provider value={portalContainer}>
      <div className="gestor-portal mentor-portal" ref={setPortalContainer}>
        <aside className="mentor-sidebar" data-testid="mentor-sidebar">{sidebar()}</aside>
        <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
          <HeaderMobile contexto={contextoMobile} />
          <SidebarDrawer>{sidebar(() => setMenuAberto(false))}</SidebarDrawer>
        </Sheet>
        <div className="mentor-conteudo">
          <main className="mentor-main" id="mentor-conteudo">
            {erroGlobal && (
              <EstadoErro
                className="mentor-erro-global"
                titulo={b2c ? 'Não foi possível carregar os dados da turma.' : 'Não foi possível carregar os indicadores.'}
                descricao=""
                tentandoNovamente={(me.isError && me.isFetching) || (contagens.isError && contagens.isFetching)}
                onRetry={() => {
                  if (me.isError) void me.refetch();
                  if (contagens.isError) void contagens.refetch();
                }}
              />
            )}
            <Suspense fallback={<GestorSkeleton altura={280} rotulo="Carregando a tela" />}><Outlet /></Suspense>
          </main>
        </div>
        <DrawerAlunoHost />
      </div>
    </GestorPortalContainerContext.Provider>
  );
}
