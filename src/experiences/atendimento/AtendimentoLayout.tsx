import { NavLink, Outlet } from 'react-router-dom';
import { Headset } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Casca da experiência de Atendimento (CX): header + Outlet. */
export default function AtendimentoLayout() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Headset className="h-10 w-10 text-primary" /> Atendimento
          </h1>
        </header>
        <nav className="flex flex-wrap gap-2 border-b">
          <NavLink
            to="/atendimento/usuarios"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-4 py-2 rounded-t-md text-sm',
                isActive
                  ? 'bg-card border-b-2 border-primary font-medium'
                  : 'text-muted-foreground',
              )
            }
          >
            Usuários
          </NavLink>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
