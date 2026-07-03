import * as React from 'react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Headset, Users, MessageSquare } from 'lucide-react';
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';

/** Sub-navegação do Atendimento (CX): seções da experiência como rota. */
const atendimentoNav = [
  { title: 'Usuários', url: '/atendimento/usuarios', icon: Users },
  { title: 'Feedbacks', url: '/atendimento/feedbacks', icon: MessageSquare },
];

/**
 * Layout da experiência Atendimento / CX (`/atendimento/*`).
 *
 * Cabeçalho + sub-nav (Usuários, Feedbacks) + Outlet. Usuários reaproveita a
 * página do admin (que oculta a edição de e-mails em massa para não-admins);
 * Feedbacks reaproveita a página de feedbacks do admin (CX tem leitura +
 * moderação do feedback da plataforma na v0).
 */
export const AtendimentoLayout: React.FC = () => (
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
        <GoToStudentButton />
      </div>

      <nav className="flex flex-wrap gap-2 border-b">
        {atendimentoNav.map(({ title, url, icon: Icon }) => (
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
            <Icon className="h-4 w-4" />
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
