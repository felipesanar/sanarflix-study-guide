import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/**
 * Página full-page exibida quando o usuário está autenticado mas não tem
 * NENHUMA tela liberada (`getDefaultRouteForUser` caiu no fallback `/home`).
 *
 * Sem isso, `/home` redirecionaria para si mesmo (loop infinito) — ver
 * `buildAppRoutes`, que renderiza esta página no lugar do `<Navigate>`
 * quando `defaultRoute === '/home'`.
 */
export const NoAccessPage: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-xl font-semibold">Nenhuma área liberada</h1>
        <p className="text-muted-foreground">
          Seu acesso ainda não está configurado. Fale com sua instituição ou
          com o suporte Sanar.
        </p>
        <Button variant="outline" onClick={logout}>
          Sair
        </Button>
      </div>
    </div>
  );
};
