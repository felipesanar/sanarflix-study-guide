import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  MoreHorizontal,
  Pencil,
  Check,
  X,
  Shield,
  ShieldOff,
  RefreshCw,
  Mail,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Trash2,
  Eye,
  UserCheck,
} from 'lucide-react';
import { UserSupportPanel } from './UserSupportPanel';
import { useAuth } from '@/contexts/AuthContext';

interface IES {
  id: string;
  nome: string;
}

interface UserRow {
  id: string;
  nome: string;
  email: string;
  id_ies: string | null;
  ies_nome: string | null;
  semestre: number | null;
  roles: string[];
}

interface EditingState {
  userId: string | null;
  nome: string;
  id_ies: string;
  semestre: string;
}

interface UsersListTableProps {
  iesList: IES[];
  onStatsUpdate?: (totalUsers: number, totalAdmins: number) => void;
}

interface FailedUser {
  id: string;
  nome: string;
  email: string;
  error: string;
}

interface BatchProgress {
  total: number;
  completed: number;
  deleted: number;
  failed: number;
  active: boolean;
  failedUsers: FailedUser[];
}

interface EmailProgress {
  total: number;
  completed: number;
  sent: number;
  failed: number;
  active: boolean;
  failedUsers: FailedUser[];
}

const ITEMS_PER_PAGE = 25;
const BATCH_CHUNK_SIZE = 3; // Must match edge function MAX_BATCH_SIZE

export const UsersListTable: React.FC<UsersListTableProps> = ({ iesList, onStatsUpdate }) => {
  const { startImpersonation } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIes, setFilterIes] = useState<string>('all');
  const [filterSemestre, setFilterSemestre] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  const [editing, setEditing] = useState<EditingState>({
    userId: null,
    nome: '',
    id_ies: '',
    semestre: '',
  });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [iesDeleteOpen, setIesDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Batch progress state
  const EMPTY_PROGRESS: BatchProgress = { total: 0, completed: 0, deleted: 0, failed: 0, active: false, failedUsers: [] };
  const [batchProgress, setBatchProgress] = useState<BatchProgress>(EMPTY_PROGRESS);
  const cancelRef = useRef(false);

  // Support panel state
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const [supportUserName, setSupportUserName] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);

  // Clear selection on page/filter change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchTerm, filterIes, filterSemestre]);

  const selectableUsers = useMemo(
    () => users.filter(u => !u.roles.includes('admin')),
    [users],
  );

  const allPageSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableUsers.forEach(u => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableUsers.forEach(u => next.add(u.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('users')
        .select(`
          id,
          nome,
          email,
          id_ies,
          semestre,
          ies:ies!fk_ies(nome)
        `, { count: 'exact' });

      if (filterIes !== 'all') {
        query = query.eq('id_ies', filterIes);
      }

      if (filterSemestre !== 'all') {
        query = query.eq('semestre', parseInt(filterSemestre));
      }

      if (searchTerm.trim()) {
        query = query.or(`nome.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data: usersData, count, error } = await query
        .order('nome')
        .range(from, to);

      if (error) throw error;

      const userIds = usersData?.map(u => u.id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map<string, string[]>();
      rolesData?.forEach(r => {
        const existing = rolesMap.get(r.user_id) || [];
        rolesMap.set(r.user_id, [...existing, r.role]);
      });

      const mappedUsers: UserRow[] = (usersData || []).map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        id_ies: u.id_ies,
        ies_nome: (u.ies as { nome: string } | null)?.nome || null,
        semestre: u.semestre,
        roles: rolesMap.get(u.id) || [],
      }));

      setUsers(mappedUsers);
      setTotalCount(count || 0);

      const { count: adminCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      onStatsUpdate?.(count || 0, adminCount || 0);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterIes, filterSemestre, onStatsUpdate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterIes, filterSemestre]);

  // ──── Chunked batch deletion with progress ────
  const executeChunkedDelete = async (idsToDelete: string[]) => {
    cancelRef.current = false;
    const total = idsToDelete.length;

    setBatchProgress({ total, completed: 0, deleted: 0, failed: 0, active: true, failedUsers: [] });
    setBatchDeleteOpen(false);
    setIesDeleteOpen(false);
    setConfirmText('');

    let totalDeleted = 0;
    let totalFailed = 0;
    const allFailedUsers: FailedUser[] = [];

    for (let i = 0; i < total; i += BATCH_CHUNK_SIZE) {
      if (cancelRef.current) {
        toast.info('Exclusão cancelada pelo usuário');
        break;
      }

      const chunk = idsToDelete.slice(i, i + BATCH_CHUNK_SIZE);

      try {
        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: { user_ids: chunk },
        });

        if (error) throw error;

        const chunkDeleted = data?.results?.deleted?.length || 0;
        const chunkFailedItems: FailedUser[] = (data?.results?.failed || []).map((f: { id: string; nome?: string; email?: string; error: string }) => ({
          id: f.id,
          nome: f.nome || '',
          email: f.email || '',
          error: f.error,
        }));
        totalDeleted += chunkDeleted;
        totalFailed += chunkFailedItems.length;
        allFailedUsers.push(...chunkFailedItems);

        // Remove deleted users from local state immediately
        if (chunkDeleted > 0) {
          const deletedSet = new Set(data.results.deleted as string[]);
          setUsers(prev => prev.filter(u => !deletedSet.has(u.id)));
          setSelectedIds(prev => {
            const next = new Set(prev);
            deletedSet.forEach(id => next.delete(id));
            return next;
          });
        }
      } catch (err) {
        console.error('[BatchDelete] Chunk error:', err);
        totalFailed += chunk.length;
      }

      const completed = Math.min(i + BATCH_CHUNK_SIZE, total);
      setBatchProgress({ total, completed, deleted: totalDeleted, failed: totalFailed, active: true, failedUsers: allFailedUsers });
    }

    // Final state
    setBatchProgress(prev => ({ ...prev, active: false }));
    setTotalCount(prev => Math.max(0, prev - totalDeleted));

    if (totalFailed > 0) {
      toast.warning(`${totalDeleted} removidos, ${totalFailed} falharam`);
    } else if (totalDeleted > 0) {
      toast.success(`${totalDeleted} usuários removidos com sucesso`);
    } else {
      toast.info('Nenhum usuário foi removido');
    }

    fetchUsers();
  };

  // ──── Batch delete selected ────
  const handleBatchDelete = () => {
    executeChunkedDelete(Array.from(selectedIds));
  };

  // ──── Delete all from IES (paginated resolve → chunked delete) ────
  const handleIesDelete = async () => {
    if (filterIes === 'all') return;

    cancelRef.current = false;
    setBatchProgress({ total: 0, completed: 0, deleted: 0, failed: 0, active: true, failedUsers: [] });
    setIesDeleteOpen(false);
    setConfirmText('');

    try {
      // Step 1: Resolve all deletable IDs via paginated calls
      const allIds: string[] = [];
      let cursor: number | null = 0;

      while (cursor !== null) {
        if (cancelRef.current) {
          toast.info('Exclusão cancelada pelo usuário');
          setBatchProgress(prev => ({ ...prev, active: false }));
          return;
        }

        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: {
            ies_id: filterIes,
            resolve_only: true,
            cursor,
            page_size: 500,
            ...(filterSemestre !== 'all' ? { semestre: filterSemestre } : {}),
          },
        });

        if (error) throw error;

        const pageIds: string[] = data?.user_ids || [];
        allIds.push(...pageIds);
        cursor = data?.has_more ? data.next_cursor : null;
      }

      if (allIds.length === 0) {
        setBatchProgress(prev => ({ ...prev, active: false }));
        toast.info('Nenhum usuário encontrado para remoção nesta IES');
        return;
      }

      // Step 2: Delete in chunks
      await executeChunkedDelete(allIds);
    } catch (err) {
      setBatchProgress(prev => ({ ...prev, active: false }));
      toast.error(err instanceof Error ? err.message : 'Erro ao resolver usuários da IES');
    }
  };

  const cancelBatchDelete = () => {
    cancelRef.current = true;
  };

  // ──── Existing single-user actions (unchanged) ────
  const startEditing = (user: UserRow) => {
    setEditing({
      userId: user.id,
      nome: user.nome,
      id_ies: user.id_ies || '',
      semestre: user.semestre?.toString() || '',
    });
  };

  const cancelEditing = () => {
    setEditing({ userId: null, nome: '', id_ies: '', semestre: '' });
  };

  const saveEditing = async () => {
    if (!editing.userId) return;
    const user = users.find(u => u.id === editing.userId);
    if (!user) return;

    if (!editing.nome.trim() || editing.nome.trim().length < 2) {
      toast.error('Nome deve ter pelo menos 2 caracteres');
      return;
    }
    if (!editing.id_ies) {
      toast.error('Selecione uma IES');
      return;
    }
    const semestre = parseInt(editing.semestre);
    if (isNaN(semestre) || semestre < 1 || semestre > 12) {
      toast.error('Semestre deve ser um número entre 1 e 12');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('b2b-create-user', {
        body: { nome: editing.nome.trim(), email: user.email, id_ies: editing.id_ies, semestre },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro ao atualizar');
      toast.success('Usuário atualizado com sucesso');
      cancelEditing();
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const toggleAdminRole = async (user: UserRow) => {
    const isAdmin = user.roles.includes('admin');
    setActionLoading(user.id);
    try {
      if (isAdmin) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role', 'admin');
        if (error) throw error;
        toast.success(`${user.nome} não é mais administrador`);
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' });
        if (error) throw error;
        toast.success(`${user.nome} agora é administrador`);
      }
      fetchUsers();
    } catch {
      toast.error('Erro ao alterar permissão');
    } finally {
      setActionLoading(null);
    }
  };

  const syncUserAuth = async (email: string) => {
    setActionLoading(email);
    try {
      const { data, error } = await supabase.functions.invoke('sync-user-auth', { body: { email } });
      if (error) throw error;
      if (data?.success) toast.success(data.message || 'Autenticação sincronizada');
      else toast.info(data?.error || 'Nenhuma ação necessária');
    } catch {
      toast.error('Erro ao sincronizar');
    } finally {
      setActionLoading(null);
    }
  };

  const resendInvite = async (user: UserRow) => {
    setActionLoading(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('b2b-create-user', {
        body: { nome: user.nome, email: user.email, id_ies: user.id_ies, semestre: user.semestre || 1, resend_email: true },
      });
      if (error) throw error;
      if (data?.success) toast.success('Email de convite reenviado');
      else toast.info(data?.message || 'Usuário já confirmado');
    } catch {
      toast.error('Erro ao reenviar convite');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async () => {
    if (!deleteConfirm) return;
    const userToDelete = deleteConfirm;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userToDelete.id },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro ao remover usuário');
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      setTotalCount(prev => Math.max(0, prev - 1));
      setDeleteConfirm(null);
      toast.success(`${userToDelete.nome} foi removido com sucesso`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover usuário');
    } finally {
      setDeleting(false);
    }
  };

  const selectedIesName = useMemo(
    () => iesList.find(i => i.id === filterIes)?.nome || '',
    [iesList, filterIes],
  );

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const showingFrom = page * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min((page + 1) * ITEMS_PER_PAGE, totalCount);
  const progressPercent = batchProgress.total > 0
    ? Math.round((batchProgress.completed / batchProgress.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lista de Usuários
        </CardTitle>
        <CardDescription>
          Visualize e edite os dados de todos os usuários cadastrados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch progress overlay */}
        {(batchProgress.active || batchProgress.completed > 0) && batchProgress.total > 0 && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {batchProgress.active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <span className="text-sm font-medium">
                  {batchProgress.active
                    ? `Excluindo usuários... ${batchProgress.completed}/${batchProgress.total}`
                    : `Exclusão concluída: ${batchProgress.deleted} removidos`
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                {batchProgress.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {batchProgress.failed} falha{batchProgress.failed > 1 ? 's' : ''}
                  </Badge>
                )}
                {batchProgress.active ? (
                  <Button variant="outline" size="sm" onClick={cancelBatchDelete}>
                    Cancelar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBatchProgress(EMPTY_PROGRESS)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {batchProgress.deleted} removidos • {batchProgress.failed} falhas • {progressPercent}% concluído
            </p>

            {/* Failure report */}
            {!batchProgress.active && batchProgress.failedUsers.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Usuários que falharam ({batchProgress.failedUsers.length}):
                </p>
                <div className="max-h-48 overflow-y-auto rounded border bg-muted/30">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1.5">Nome</TableHead>
                        <TableHead className="text-xs py-1.5">Email</TableHead>
                        <TableHead className="text-xs py-1.5">Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchProgress.failedUsers.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-xs py-1.5">{f.nome || f.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs py-1.5">{f.email || '-'}</TableCell>
                          <TableCell className="text-xs py-1.5 text-destructive">{f.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              disabled={batchProgress.active}
            />
          </div>
          <Select value={filterIes} onValueChange={(v) => { setFilterIes(v); if (v === 'all') setFilterSemestre('all'); }} disabled={batchProgress.active}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por IES" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as IES</SelectItem>
              {iesList.map((ies) => (
                <SelectItem key={ies.id} value={ies.id}>
                  {ies.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterIes !== 'all' && (
            <Select value={filterSemestre} onValueChange={setFilterSemestre} disabled={batchProgress.active}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Semestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os semestres</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                  <SelectItem key={s} value={s.toString()}>
                    {s}º semestre
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filterIes !== 'all' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setConfirmText(''); setIesDeleteOpen(true); }}
              className="whitespace-nowrap"
              disabled={batchProgress.active}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {filterSemestre !== 'all' ? `Excluir ${filterSemestre}º sem.` : 'Excluir todos da IES'}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading || batchProgress.active}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Batch action bar */}
        {selectedIds.size > 0 && !batchProgress.active && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setConfirmText(''); setBatchDeleteOpen(true); }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir selecionados
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar seleção
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={allPageSelected && selectableUsers.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                    disabled={batchProgress.active}
                  />
                </TableHead>
                <TableHead className="min-w-[200px]">Nome</TableHead>
                <TableHead className="min-w-[220px]">Email</TableHead>
                <TableHead className="min-w-[150px]">IES</TableHead>
                <TableHead className="w-[80px] text-center">Sem.</TableHead>
                <TableHead className="w-[100px]">Papel</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-8 w-8" />
                      <p>Nenhum usuário encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isEditing = editing.userId === user.id;
                  const isAdmin = user.roles.includes('admin');
                  const isLoading = actionLoading === user.id || actionLoading === user.email;
                  const isSelected = selectedIds.has(user.id);

                  return (
                    <TableRow key={user.id} className={isEditing ? 'bg-muted/50' : isSelected ? 'bg-primary/5' : ''}>
                      <TableCell>
                        {isAdmin ? (
                          <Checkbox disabled checked={false} aria-label="Admin não selecionável" />
                        ) : (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(user.id)}
                            aria-label={`Selecionar ${user.nome}`}
                            disabled={batchProgress.active}
                          />
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editing.nome}
                            onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                            className="h-8"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{user.nome}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editing.id_ies}
                            onValueChange={(v) => setEditing({ ...editing, id_ies: v })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {iesList.map((ies) => (
                                <SelectItem key={ies.id} value={ies.id}>
                                  {ies.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{user.ies_nome || '-'}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={1}
                            max={12}
                            value={editing.semestre}
                            onChange={(e) => setEditing({ ...editing, semestre: e.target.value })}
                            className="h-8 w-16 mx-auto text-center"
                          />
                        ) : (
                          <span>{user.semestre || '-'}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {isAdmin ? (
                          <Badge variant="default" className="bg-primary">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Aluno</Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={saveEditing} disabled={saving} className="h-8 w-8 p-0">
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving} className="h-8 w-8 p-0">
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSupportUserId(user.id);
                                setSupportUserName(user.nome);
                                setSupportOpen(true);
                              }}
                              className="h-8 w-8 p-0"
                              disabled={batchProgress.active}
                              title="Ver Detalhes"
                            >
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEditing(user)} className="h-8 w-8 p-0" disabled={batchProgress.active}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={isLoading || batchProgress.active}>
                                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!isAdmin && (
                                  <DropdownMenuItem onClick={() => startImpersonation(user.id)}>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Acessar como Aluno
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => resendInvite(user)}>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Reenviar Convite
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => syncUserAuth(user.email)}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Sincronizar Auth
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleAdminRole(user)}>
                                  {isAdmin ? (
                                    <>
                                      <ShieldOff className="h-4 w-4 mr-2 text-destructive" />
                                      <span className="text-destructive">Remover Admin</span>
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4 mr-2" />
                                      Promover a Admin
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteConfirm(user)}>
                                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                                  <span className="text-destructive">Remover Usuário</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalCount > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {showingFrom}-{showingTo} de {totalCount} usuários
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading || batchProgress.active}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[100px] text-center">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading || batchProgress.active}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Single Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover <strong>{deleteConfirm?.nome}</strong> ({deleteConfirm?.email})?
                Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={deleteUser} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remover
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Delete Confirmation */}
        <AlertDialog open={batchDeleteOpen} onOpenChange={(open) => { if (!open) { setBatchDeleteOpen(false); setConfirmText(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedIds.size} usuário{selectedIds.size > 1 ? 's' : ''}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Esta ação é <strong>irreversível</strong>. Todos os dados dos usuários selecionados serão permanentemente removidos.
                  </p>
                  <p>Digite <strong>EXCLUIR</strong> para confirmar:</p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="EXCLUIR"
                    autoFocus
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={handleBatchDelete} disabled={confirmText !== 'EXCLUIR'}>
                <Trash2 className="h-4 w-4 mr-2" />
                Confirmar Exclusão
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* IES Delete Confirmation */}
        <AlertDialog open={iesDeleteOpen} onOpenChange={(open) => { if (!open) { setIesDeleteOpen(false); setConfirmText(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {filterSemestre !== 'all'
                  ? `Excluir usuários do ${filterSemestre}º semestre da IES`
                  : 'Excluir todos os usuários da IES'}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Esta ação é <strong>irreversível</strong>.{' '}
                    {filterSemestre !== 'all' ? (
                      <>Todos os usuários (exceto admins) do <strong>{filterSemestre}º semestre</strong> da IES <strong>{selectedIesName}</strong> serão permanentemente removidos.</>
                    ) : (
                      <>Todos os usuários (exceto admins) da IES <strong>{selectedIesName}</strong> serão permanentemente removidos.</>
                    )}
                  </p>
                  <p>Digite o nome da IES (<strong>{selectedIesName}</strong>) para confirmar:</p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={selectedIesName}
                    autoFocus
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button variant="destructive" onClick={handleIesDelete} disabled={confirmText !== selectedIesName}>
                <Trash2 className="h-4 w-4 mr-2" />
                {filterSemestre !== 'all' ? `Excluir do ${filterSemestre}º sem.` : 'Excluir Todos da IES'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* User Support Panel */}
        <UserSupportPanel
          userId={supportUserId}
          userName={supportUserName}
          open={supportOpen}
          onOpenChange={setSupportOpen}
        />
      </CardContent>
    </Card>
  );
};
