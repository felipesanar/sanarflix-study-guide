import * as React from 'react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Headset } from 'lucide-react';

/**
 * Layout da experiência Atendimento / CX (`/atendimento/*`).
 *
 * O Atendimento tem acesso apenas à gestão de Usuários — por isso o layout é
 * enxuto (cabeçalho + Outlet). A página de Usuários é reaproveitada do admin
 * (`UsuariosPage`), que já oculta a edição de e-mails em massa para não-admins.
 */
export const AtendimentoLayout: React.FC = () => (
  <div className="min-h-screen bg-background p-4 md:p-8">
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <Headset className="h-10 w-10 text-primary" />
          Atendimento
        </h1>
        <p className="text-muted-foreground">
          Gestão de usuários para o time de Atendimento (CX).
        </p>
      </div>

      <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
        <Outlet />
      </Suspense>
    </div>
  </div>
);
