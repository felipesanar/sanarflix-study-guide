import { UsersTab } from '@/components/admin/UsersTab';
import { BulkEmailUpdateTab } from '@/components/admin/BulkEmailUpdateTab';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';

export default function UsuariosPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <UsersTab />
      {isAdmin(user) && <BulkEmailUpdateTab />}
    </div>
  );
}
