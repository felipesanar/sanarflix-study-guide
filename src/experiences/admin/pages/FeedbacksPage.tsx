import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { AdminSectionHeader } from '@/experiences/admin/ui/AdminSectionHeader';
import { AdminEmpty } from '@/experiences/admin/ui/AdminEmpty';
import { FeedbacksSection } from '@/components/admin/feedbacks/FeedbacksSection';

/**
 * Seção Feedbacks do Portal do Admin (`/admin/feedbacks`) — reusada pelo
 * Atendimento (CX) em `/atendimento/feedbacks` (mesma página, capability
 * `feedbacks.moderate` OU `feedbacks.support`; a RLS de `user_feedback` já
 * recorta o que cada portal vê).
 */
const FeedbacksPage: React.FC = () => {
  const { access } = useAuth();
  const allowed = can(access, 'feedbacks.moderate') || can(access, 'feedbacks.support');

  if (!allowed) {
    return (
      <div className="space-y-6">
        <AdminSectionHeader
          title="Feedbacks"
          subtitle="Triagem do feedback dos alunos: bug, sugestão, funcionalidade e elogio."
        />
        <AdminEmpty
          title="Requer feedbacks.moderate ou feedbacks.support"
          description="Sua conta não tem a capability necessária para ver os feedbacks dos alunos."
        />
      </div>
    );
  }

  return <FeedbacksSection />;
};

export default FeedbacksPage;
