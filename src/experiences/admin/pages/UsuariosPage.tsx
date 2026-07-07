import * as React from 'react';

/**
 * Seção Usuários do Portal do Admin (`/admin/usuarios`) — reusada pelo
 * Atendimento (CX) em `/atendimento/usuarios` (mesma página, capability
 * `users.manage` OU `users.support` controla os recursos de massa).
 *
 * Placeholder da reescrita do shell (contrato §B — Usuários): cabeçalho
 * definitivo, conteúdo pendente (reapresenta `UsersTab`/`BulkEmailUpdateTab`
 * no vocabulário novo — StatCards, AdminTable, BulkRunner de cadastro/e-mail
 * em massa, DangerZone para exclusão).
 */
const UsuariosPage: React.FC = () => (
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
    <p className="text-sm text-muted-foreground">Cadastro, suporte e acesso dos usuários da plataforma.</p>
    <div />
  </div>
);

export default UsuariosPage;
