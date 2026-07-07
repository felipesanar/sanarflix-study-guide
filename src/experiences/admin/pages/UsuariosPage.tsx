import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { UsersTab } from '@/components/admin/UsersTab';
import { BulkEmailUpdateTab } from '@/components/admin/BulkEmailUpdateTab';

/**
 * Seção Usuários do Portal do Admin (`/admin/usuarios`).
 *
 * Página fina: reusa `UsersTab`; a atualização de e-mails em massa
 * (`BulkEmailUpdateTab`) fica restrita ao admin (Atendimento não a vê).
 */
const UsuariosPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <UsersTab />
      {isAdmin(user) && <BulkEmailUpdateTab />}
    </div>
  );
};

export default UsuariosPage;
