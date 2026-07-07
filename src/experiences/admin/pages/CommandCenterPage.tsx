import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAttention } from '@/services/admin/useAdminAttention';
import { AdminLoading, AdminError } from '@/experiences/admin/ui';
import { CommandCenterHeader } from '@/components/admin/command-center/CommandCenterHeader';
import { AttentionQueue } from '@/components/admin/command-center/AttentionQueue';
import { PlatformHealthPanel } from '@/components/admin/command-center/PlatformHealthPanel';
import { RecentAuditPanel } from '@/components/admin/command-center/RecentAuditPanel';

/**
 * Command Center (`/admin` index) — home do Portal do Admin (contrato de
 * implementação §A).
 *
 * Header com saudação dinâmica + fila "Precisa da sua atenção" (as 4 filas de
 * `admin_command_center`, cards clicáveis só para contagem > 0 — todas zero
 * vira um único card positivo) + grid 2/3 "Saúde da plataforma" (KPIs reais) +
 * 1/3 "Auditoria recente" (últimos eventos humanizados). Dados via
 * `useAdminAttention`, o mesmo hook que alimenta os badges da sidebar.
 */
const CommandCenterPage: React.FC = () => {
  const { user } = useAuth();
  const { attention, attentionDetail, kpis, auditRecentes, isLoading, isError, refetch } = useAdminAttention();

  const firstName = user?.nome?.split(' ')[0] || 'Admin';
  const attentionTotal = attention
    ? attention.simuladosEncerrandoHoje +
      attention.importBatchesFalha7d +
      attention.feedbacksPendentes +
      attention.iesSemSimuladoAtivo
    : null;

  return (
    <div className="space-y-6">
      <CommandCenterHeader firstName={firstName} attentionTotal={attentionTotal} />

      {isLoading ? (
        <AdminLoading rows={6} />
      ) : isError || !attentionDetail || !kpis ? (
        <AdminError
          message="Não foi possível carregar os dados do Command Center."
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <>
          <AttentionQueue attention={attentionDetail} />

          <div className="grid gap-6 lg:grid-cols-3">
            <PlatformHealthPanel kpis={kpis} />
            <RecentAuditPanel auditRecentes={auditRecentes} />
          </div>
        </>
      )}
    </div>
  );
};

export default CommandCenterPage;
