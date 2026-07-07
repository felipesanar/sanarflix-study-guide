import * as React from 'react';

/**
 * Seção Feedbacks do Portal do Admin (`/admin/feedbacks`) — reusada pelo
 * Atendimento (CX) em `/atendimento/feedbacks` (mesma página, capability
 * `feedbacks.moderate` OU `feedbacks.support`).
 *
 * Placeholder da reescrita do shell (contrato §F — Feedbacks): cabeçalho
 * definitivo, conteúdo pendente (StatCards por categoria, lista → Sheet de
 * detalhe/resposta com `admin_log_action`).
 */
const FeedbacksPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Feedbacks</h1>
    <p className="text-sm text-muted-foreground">Feedbacks enviados pelos alunos da plataforma.</p>
    <div />
  </div>
);

export default FeedbacksPage;
