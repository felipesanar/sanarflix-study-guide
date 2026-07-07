import * as React from 'react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Headset, Users, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import type { NavItem } from '@/experiences/types';
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';
import { getPortalEntries } from '@/experiences/shared/globalNav';

/** Sub-navegação do Atendimento (CX): seções da experiência como rota. */
const ATENDIMENTO_NAV: NavItem[] = [
  { title: 'Usuários', url: '/atendimento/usuarios', icon: Users, capability: 'users.support' },
  { title: 'Feedbacks', url: '/atendimento/feedbacks', icon: MessageSquare, capability: 'feedbacks.support' },
];

/**
 * Layout da experiência Atendimento / CX (`/atendimento/*`) — shell full-page
 * independente.
 *
 * Cabeçalho + sub-nav (Usuários, Feedbacks, filtradas por capability) +
 * Outlet, além dos links para os outros portais que o usuário tenha. Usuários
 * reaproveita a página do admin (que oculta a edição de e-mails em massa para
 * não-admins); Feedbacks reaproveita a página de feedbacks do admin (CX tem
 * leitura + moderação do feedback da plataforma na v0).
 */
export const AtendimentoLayout: React.FC = () => {
  const { access } = useAuth();
  const navItems = ATENDIMENTO_NAV.filter(
    (item) => item.capability == null || can(access, item.capability),
  );
  // Outros portais do usuário, exceto o Atendimento (já estamos nele).
  const otherPortals = getPortalEntries(access).filter(
    (entry) => entry.url !== '/atendimento/usuarios',
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Headset className="h-10 w-10 text-primary" />
              Atendimento
            </h1>
            <p className="text-muted-foreground">
              Gestão de usuários e feedback da plataforma para o time de Atendimento (CX).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {otherPortals.map(({ title, url, icon: Icon }) => (
              <NavLink
                key={url}
                to={url}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                {title}
              </NavLink>
            ))}
            <GoToStudentButton />
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 border-b">
          {navItems.map(({ title, url, icon: Icon }) => (
            <NavLink
              key={url}
              to={url}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-t-md text-sm ${
                  isActive
                    ? 'bg-card border-b-2 border-primary font-medium'
                    : 'text-muted-foreground'
                }`
              }
            >
              {Icon && <Icon className="h-4 w-4" />}
              {title}
            </NavLink>
          ))}
        </nav>

        <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
};
