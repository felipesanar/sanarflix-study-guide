import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { AdminSectionHeader } from '@/experiences/admin/ui/AdminSectionHeader';
import { AdminEmpty } from '@/experiences/admin/ui/AdminEmpty';
import { AuditoriaSection } from '@/components/admin/auditoria/AuditoriaSection';

/**
 * Seção Auditoria do Portal do Admin (`/admin/auditoria`) — NOVA, capability
 * `admin.tools`. A rota já é gateada por `admin.tools` na nav (item some para
 * quem não tem a capability), mas a página degrada por conta própria caso
 * seja acessada por URL direta.
 */
const AuditoriaPage: React.FC = () => {
  const { access } = useAuth();

  if (!can(access, 'admin.tools')) {
    return (
      <div className="space-y-6">
        <AdminSectionHeader
          title="Auditoria"
          subtitle="Quem fez o quê, quando. Trilha consultável de ações sensíveis a partir de admin_audit_log."
        />
        <AdminEmpty
          title="Requer admin.tools"
          description="Sua conta não tem a capability necessária para consultar a trilha de auditoria."
        />
      </div>
    );
  }

  return <AuditoriaSection />;
};

export default AuditoriaPage;
