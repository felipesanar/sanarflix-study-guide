import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { UsersTab } from '@/components/admin/UsersTab';
import { BulkEmailUpdateTab } from '@/components/admin/BulkEmailUpdateTab';

/**
 * Seção Usuários do Portal do Admin (`/admin/usuarios`).
 *
 * Página fina: reusa `UsersTab`; a atualização de e-mails em massa
 * (`BulkEmailUpdateTab`) fica restrita a quem tem `users.manage`
 * (Atendimento, sem essa capability, não a vê).
 */
const UsuariosPage: React.FC = () => {
  const { access } = useAuth();
  return (
    <div className="space-y-8">
      <UsersTab />
      {can(access, 'users.manage') && <BulkEmailUpdateTab />}
    </div>
  );
};

export default UsuariosPage;
