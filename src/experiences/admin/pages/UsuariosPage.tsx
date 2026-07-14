/**
 * Seção Usuários do Portal do Admin (`/admin/usuarios`) — reusada pelo
 * Atendimento (CX) em `/atendimento/usuarios` (mesma página, sempre; o
 * recorte é por capability via `can()`, NUNCA por rota/role).
 *
 * Dono do header, dos 2 StatCards, dos diálogos de massa (criar/lote/
 * trocar e-mail) e do card final — a lista propriamente dita mora em
 * `UsersListTable`.
 */
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Upload, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminSectionHeader, MonoValue, StatCard } from '@/experiences/admin/ui';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { supabase } from '@/integrations/supabase/client';
import { iesService, type Ies } from '@/services/iesService';
import { Logger } from '@/utils/logger';
import { UsersListTable } from '@/components/admin/UsersListTable';
import { CreateUserDialog } from '@/components/admin/usuarios/CreateUserDialog';
import { BulkCreateUsersDialog } from '@/components/admin/usuarios/BulkCreateUsersDialog';
import BulkEmailUpdateTab from '@/components/admin/BulkEmailUpdateTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Stats {
  totalUsers: number | null;
  totalAdmins: number | null;
}

const UsuariosPage: React.FC = () => {
  const { access } = useAuth();
  const canManage = can(access, 'users.manage');
  const canEdit = can(access, 'users.edit');
  const [searchParams, setSearchParams] = useSearchParams();

  const [iesList, setIesList] = useState<Ies[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: null, totalAdmins: null });
  const [refreshKey, setRefreshKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const fetchStats = useCallback(async () => {
    try {
      const [{ count: totalUsers }, { count: totalAdmins }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      setStats({ totalUsers: totalUsers ?? 0, totalAdmins: totalAdmins ?? 0 });
    } catch (err) {
      Logger.error('[UsuariosPage] falha ao carregar stats:', err);
    }
  }, []);

  useEffect(() => {
    iesService.list().then(setIesList);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  // Abre "Novo usuário" automaticamente quando a URL tem ?new=1 (deep-link
  // do Command Center). O parâmetro é limpo ao fechar o diálogo — isso evita
  // loop mesmo com `searchParams` nas deps (precisa estar aqui: sem ele, o
  // efeito só rodava no mount e um deep-link chegando depois — ex.: troca de
  // rota sem remount — nunca abria o diálogo).
  useEffect(() => {
    if (canEdit && searchParams.get('new') === '1') {
      setCreateOpen(true);
    }
  }, [canEdit, searchParams]);

  const clearNewParam = useCallback(() => {
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) clearNewParam();
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Usuários"
        subtitle="Gestão de contas por IES, roles, convites e operações em massa."
        actions={
          canEdit && (
            <>
              <Button variant="outline" onClick={() => setBulkCreateOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Cadastro em lote
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Novo usuário
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total de usuários" value={stats.totalUsers ?? '—'} />
        <StatCard label="Administradores" value={stats.totalAdmins ?? '—'} accent="violet" />
      </div>

      <UsersListTable
        iesList={iesList}
        canManage={canManage}
        canEdit={canEdit}
        canSupport={can(access, 'users.support')}
        refreshKey={refreshKey}
        onOpenBulkEmail={() => setBulkEmailOpen(true)}
      />

      <div className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4 ${canManage ? '' : 'border-dashed'}`}>
        {canManage ? (
          <>
            <div>
              <p className="text-sm font-medium">Precisa atualizar e-mails de login em massa?</p>
              <p className="text-sm text-muted-foreground">
                Importe um CSV com <MonoValue>email_antigo</MonoValue>/<MonoValue>email_novo</MonoValue> e atualize alunos em lote.
              </p>
            </div>
            <Button variant="outline" onClick={() => setBulkEmailOpen(true)}>
              <Mail className="h-4 w-4 mr-2" /> Trocar e-mail em massa
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Troca de e-mail em massa e exclusão não estão disponíveis no Atendimento — requerem <MonoValue>users.manage</MonoValue>.
          </p>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        iesList={iesList}
        onCreated={bumpRefresh}
      />

      <BulkCreateUsersDialog
        open={bulkCreateOpen}
        onOpenChange={setBulkCreateOpen}
        iesList={iesList}
        onDone={bumpRefresh}
      />

      <Dialog open={bulkEmailOpen} onOpenChange={setBulkEmailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trocar e-mail em massa</DialogTitle>
            <DialogDescription>Atualize o e-mail de login de alunos a partir de um CSV.</DialogDescription>
          </DialogHeader>
          <BulkEmailUpdateTab />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsuariosPage;
