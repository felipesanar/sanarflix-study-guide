/**
 * Fatia B — Usuários: lista/tabela principal (`/admin/usuarios` e
 * `/atendimento/usuarios`, mesmo componente, recorte por `canManage`/`canSupport`).
 *
 * Reapresenta a lista antiga no vocabulário do console admin (`AdminTable`,
 * `AdminLoading/Error/Empty`, `DangerZone`) mantendo a lógica que já
 * funcionava: paginação server-side, busca com debounce, painel de suporte,
 * geração de links, edição de roles, exclusão (single e em massa, em chunks
 * de 3 via a edge `delete-user` já existente).
 *
 * Removido nesta reescrita (fora do contrato §B — não fazia parte da lista de
 * recursos pedida): os fluxos de "excluir/reenviar TODOS os usuários de uma
 * IES" que existiam via o filtro de IES. A exclusão em massa continua
 * disponível via seleção de linhas.
 */
import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';
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
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Eye,
  UserCheck,
  Link,
  KeyRound,
} from 'lucide-react';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPartial,
  AdminTable,
  DangerZone,
  MonoValue,
  adminTableCellClass,
  adminTableHeadClass,
} from '@/experiences/admin/ui';
import { logAdminAction } from '@/services/admin/logAction';
import { UserSupportPanel } from './UserSupportPanel';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { Logger } from '@/utils/logger';

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

type AppRole = 'admin' | 'professor' | 'gestor' | 'gestor_grupo' | 'atendimento';

interface EditingState {
  userId: string | null;
  nome: string;
  id_ies: string;
  semestre: string;
  roles: AppRole[]; // papéis privilegiados marcados (aditivo — pode acumular vários)
}

const EDITABLE_ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin',        label: 'Admin' },
  { value: 'professor',    label: 'Professor' },
  { value: 'gestor',       label: 'Gestor' },
  { value: 'gestor_grupo', label: 'Gestor de Grupo' },
  { value: 'atendimento',  label: 'Atendimento' },
];
const PRIVILEGED_ROLES = EDITABLE_ROLES.map(r => r.value);

const ROLE_BADGE: Record<string, { label: string; icon?: boolean }> = {
  admin: { label: 'Admin', icon: true },
  professor: { label: 'Professor' },
  gestor: { label: 'Gestor' },
  gestor_grupo: { label: 'Gestor de Grupo' },
  atendimento: { label: 'Atendimento' },
};

/** Papéis privilegiados atuais do usuário (subconjunto de PRIVILEGED_ROLES), preservando ordem estável. */
const deriveEditableRoles = (roles: string[] | undefined): AppRole[] =>
  PRIVILEGED_ROLES.filter(r => roles?.includes(r));

export interface UsersListTableProps {
  iesList: IES[];
  /** Ações administrativas plenas (criar/lote/excluir/trocar e-mail/selecionar em massa/editar roles). */
  canManage: boolean;
  /** Busca, visualização e painel de suporte — disponível também para Atendimento (CX). */
  canSupport: boolean;
  /** Incrementar para forçar um refetch (ex.: após criar usuário em outro diálogo). */
  refreshKey?: number;
  /** Abre o fluxo de "Trocar e-mail em massa" (diálogo controlado pela página). */
  onOpenBulkEmail: () => void;
}

interface FailedUser {
  id: string;
  nome: string;
  email: string;
  error: string;
}

interface DeleteProgress {
  total: number;
  done: number;
  ok: number;
  failed: FailedUser[];
  active: boolean;
}

const ITEMS_PER_PAGE = 25;
const BATCH_CHUNK_SIZE = 3; // Deve casar com MAX_BATCH_SIZE da edge function

const EMPTY_DELETE_PROGRESS: DeleteProgress = { total: 0, done: 0, ok: 0, failed: [], active: false };

export const UsersListTable: React.FC<UsersListTableProps> = ({ iesList, canManage, refreshKey, onOpenBulkEmail }) => {
  const { startImpersonation, access } = useAuth();
  const navigate = useNavigate();
  const canImpersonate = can(access, 'impersonate');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIes, setFilterIes] = useState<string>('all');
  const [filterSemestre, setFilterSemestre] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const fetchIdRef = useRef(0);

  // Debounce search input → searchTerm (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [editing, setEditing] = useState<EditingState>({
    userId: null,
    nome: '',
    id_ies: '',
    semestre: '',
    roles: [],
  });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Exclusão — single e em massa compartilham o mesmo fluxo (chunk de 3).
  const [deleteTargets, setDeleteTargets] = useState<UserRow[] | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress>(EMPTY_DELETE_PROGRESS);
  const cancelDeleteRef = useRef(false);

  // Seleção em massa (só canManage)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Support panel state
  const [supportUserId, setSupportUserId] = useState<string | null>(null);
  const [supportUserName, setSupportUserName] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);

  // Limpa seleção ao trocar página/filtro
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchTerm, filterIes, filterSemestre]);

  const selectableUsers = useMemo(
    () => users.filter(u => !u.roles.includes('admin')),
    [users],
  );

  const allPageSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) selectableUsers.forEach(u => next.delete(u.id));
      else selectableUsers.forEach(u => next.add(u.id));
      return next;
    });
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
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    setFetchError(null);
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
        query = query.eq('semestre', parseInt(filterSemestre, 10));
      }
      if (searchTerm.trim()) {
        // Sanitiza apenas caracteres que quebram a sintaxe do filtro .or() do
        // PostgREST (vírgulas/parênteses são delimitadores; %/_ são wildcards
        // de LIKE). Pontos, @, hífens etc. são válidos em nomes/emails.
        const sanitized = searchTerm.replace(/[%_,()]/g, '').trim();
        if (sanitized) {
          query = query.or(`nome.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
        }
      }

      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data: usersData, count, error } = await query.order('nome').range(from, to);
      if (error) throw error;

      // Descarta respostas obsoletas de buscas anteriores
      if (currentFetchId !== fetchIdRef.current) return;

      const userIds = usersData?.map(u => u.id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

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
    } catch (err) {
      Logger.error('Error fetching users:', err);
      setFetchError(err instanceof Error ? err.message : 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterIes, filterSemestre]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterIes, filterSemestre]);

  // ──── Exclusão em chunks (single = batch de 1) ────
  const executeChunkedDelete = async (targets: UserRow[]) => {
    cancelDeleteRef.current = false;
    const total = targets.length;
    setDeleteProgress({ total, done: 0, ok: 0, failed: [], active: true });

    let totalOk = 0;
    const failed: FailedUser[] = [];

    for (let i = 0; i < total; i += BATCH_CHUNK_SIZE) {
      if (cancelDeleteRef.current) break;

      const chunk = targets.slice(i, i + BATCH_CHUNK_SIZE);
      try {
        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: { user_ids: chunk.map(u => u.id) },
        });
        if (error) throw error;

        const deletedIds = new Set<string>(data?.results?.deleted ?? []);
        totalOk += deletedIds.size;
        (data?.results?.failed ?? []).forEach((f: { id: string; nome?: string; email?: string; error: string }) => {
          failed.push({ id: f.id, nome: f.nome || '', email: f.email || '', error: f.error });
        });

        if (deletedIds.size > 0) {
          setUsers(prev => prev.filter(u => !deletedIds.has(u.id)));
          setSelectedIds(prev => {
            const next = new Set(prev);
            deletedIds.forEach(id => next.delete(id));
            return next;
          });
        }
      } catch (err) {
        Logger.error('[UsersListTable] delete chunk error:', err);
        chunk.forEach(u => failed.push({ id: u.id, nome: u.nome, email: u.email, error: 'Falha de rede/servidor' }));
      }

      setDeleteProgress({ total, done: Math.min(i + BATCH_CHUNK_SIZE, total), ok: totalOk, failed: [...failed], active: true });
    }

    setDeleteProgress(prev => ({ ...prev, active: false }));
    setTotalCount(prev => Math.max(0, prev - totalOk));

    if (failed.length > 0) toast.warning(`${totalOk} removido(s), ${failed.length} falharam`);
    else if (totalOk > 0) toast.success(`${totalOk} usuário(s) removido(s) com sucesso`);

    fetchUsers();
  };

  const cancelDelete = () => {
    cancelDeleteRef.current = true;
  };

  const confirmDeleteTargets = async () => {
    const targets = deleteTargets ?? [];
    setDeleteTargets(null);
    // Fire-and-forget: a DangerZone fecha aqui; o progresso/cancelamento
    // aparece abaixo da tabela (mesmo padrão do BulkRunner).
    void executeChunkedDelete(targets);
  };

  // ──── Ações single-user existentes ────
  const startEditing = (user: UserRow) => {
    setEditing({
      userId: user.id,
      nome: user.nome,
      id_ies: user.id_ies || '',
      semestre: user.semestre?.toString() || '',
      roles: deriveEditableRoles(user.roles),
    });
  };

  const cancelEditing = () => {
    setEditing({ userId: null, nome: '', id_ies: '', semestre: '', roles: [] });
  };

  const toggleEditingRole = (role: AppRole, checked: boolean) => {
    setEditing(prev => ({
      ...prev,
      roles: checked ? [...prev.roles, role] : prev.roles.filter(r => r !== role),
    }));
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
    const semestre = parseInt(editing.semestre, 10);
    if (Number.isNaN(semestre) || semestre < 1 || semestre > 12) {
      toast.error('Semestre deve ser um número entre 1 e 12');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('b2b-create-user', {
        body: { nome: editing.nome.trim(), email: user.email, id_ies: editing.id_ies, semestre },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro ao atualizar');

      // Papéis são aditivos — diff em vez de "delete all + insert" para não
      // apagar papéis não tocados nesta edição.
      const currentRoles = deriveEditableRoles(user.roles);
      const toAdd = editing.roles.filter(r => !currentRoles.includes(r));
      const toRemove = currentRoles.filter(r => !editing.roles.includes(r));

      if (toRemove.length > 0) {
        const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', user.id).in('role', toRemove);
        if (delErr) toast.error(`Usuário atualizado, mas falhou ao remover papéis: ${delErr.message}`);
      }
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase.from('user_roles').insert(toAdd.map(role => ({ user_id: user.id, role })));
        if (insErr) toast.error(`Falha ao adicionar papéis: ${insErr.message}`);
      }
      if (toAdd.length > 0 || toRemove.length > 0) {
        await logAdminAction('roles_update', user.id, { added: toAdd, removed: toRemove });
      }

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
        await logAdminAction('roles_update', user.id, { added: [], removed: ['admin'] });
        toast.success(`${user.nome} não é mais administrador`);
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'admin' });
        if (error) throw error;
        await logAdminAction('roles_update', user.id, { added: ['admin'], removed: [] });
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

  const copyUserLink = async (email: string, type: 'welcome' | 'reset') => {
    const label = type === 'welcome' ? 'primeiro acesso' : 'redefinição de senha';
    try {
      toast.info(`Gerando link de ${label}...`);
      const { data, error } = await supabase.functions.invoke('generate-user-link', { body: { email, type } });
      if (error) throw error;
      if (!data?.url) throw new Error('URL não retornada');
      await navigator.clipboard.writeText(data.url);
      toast.success(`Link de ${label} copiado!`);
    } catch (err) {
      Logger.error('[copyUserLink]', err);
      toast.error(`Erro ao gerar link de ${label}`);
    }
  };

  const accessAsAluno = async (user: UserRow) => {
    await startImpersonation(user.id);
  };

  const accessAsGestor = async (user: UserRow) => {
    await startImpersonation(user.id);
    navigate('/gestor');
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const showingFrom = totalCount === 0 ? 0 : page * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min((page + 1) * ITEMS_PER_PAGE, totalCount);
  const deleteProgressPct = deleteProgress.total > 0 ? Math.round((deleteProgress.done / deleteProgress.total) * 100) : 0;
  const isDeleteBusy = deleteProgress.active;

  const deleteImpact = (() => {
    const targets = deleteTargets ?? [];
    const examples = targets.slice(0, 3).map(u => u.email).join(', ');
    const more = targets.length > 3 ? ` e mais ${targets.length - 3}` : '';
    return (
      <>
        <strong className="font-mono">{targets.length}</strong> usuário{targets.length === 1 ? '' : 's'} será
        {targets.length === 1 ? '' : 'ão'} removido{targets.length === 1 ? '' : 's'} permanentemente: {examples}
        {more}.
      </>
    );
  })();

  const renderContent = () => {
    if (loading) return <AdminLoading rows={6} />;
    if (fetchError) return <AdminError message={fetchError} onRetry={fetchUsers} />;
    if (users.length === 0) {
      return (
        <AdminEmpty
          title="Nenhum usuário encontrado"
          description={searchTerm || filterIes !== 'all' ? 'Ajuste a busca ou os filtros.' : 'Nenhum usuário cadastrado ainda.'}
        />
      );
    }

    return (
      <AdminTable
        toolbar={
          <>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterIes} onValueChange={(v) => { setFilterIes(v); if (v === 'all') setFilterSemestre('all'); }}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por IES" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as IES</SelectItem>
                {iesList.map((ies) => (
                  <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterIes !== 'all' && (
              <Select value={filterSemestre} onValueChange={setFilterSemestre}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Semestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os semestres</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
                    <SelectItem key={s} value={s.toString()}>{s}º semestre</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
        footer={
          totalCount > ITEMS_PER_PAGE ? (
            <>
              <p>Mostrando {showingFrom}-{showingTo} de {totalCount} usuários</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[100px] text-center">Página {page + 1} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : undefined
        }
      >
        <TableHeader>
          <TableRow>
            {canManage && (
              <TableHead className={adminTableHeadClass}>
                <Checkbox
                  checked={allPageSelected && selectableUsers.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
            )}
            <TableHead className={adminTableHeadClass}>Usuário</TableHead>
            <TableHead className={adminTableHeadClass}>IES</TableHead>
            <TableHead className={adminTableHeadClass}>Sem.</TableHead>
            <TableHead className={adminTableHeadClass}>Roles</TableHead>
            <TableHead className={`${adminTableHeadClass} text-right`}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isEditing = editing.userId === user.id;
            const isAdmin = user.roles.includes('admin');
            const isGestorRole = user.roles.includes('gestor') || user.roles.includes('gestor_grupo');
            const isLoading = actionLoading === user.id || actionLoading === user.email;
            const isSelected = selectedIds.has(user.id);

            return (
              <TableRow key={user.id} className={isEditing ? 'bg-muted/50' : isSelected ? 'bg-primary/5' : ''}>
                {canManage && (
                  <TableCell className={adminTableCellClass}>
                    {isAdmin ? (
                      <Checkbox disabled checked={false} aria-label="Admin não selecionável" />
                    ) : (
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(user.id)} aria-label={`Selecionar ${user.nome}`} />
                    )}
                  </TableCell>
                )}

                <TableCell className={adminTableCellClass}>
                  {isEditing ? (
                    <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} className="h-8" autoFocus />
                  ) : (
                    <div>
                      <div className="font-medium">{user.nome}</div>
                      <MonoValue className="text-xs" muted>{user.email}</MonoValue>
                    </div>
                  )}
                </TableCell>

                <TableCell className={adminTableCellClass}>
                  {isEditing ? (
                    <Select value={editing.id_ies} onValueChange={(v) => setEditing({ ...editing, id_ies: v })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {iesList.map((ies) => <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{user.ies_nome || '—'}</span>
                  )}
                </TableCell>

                <TableCell className={adminTableCellClass}>
                  {isEditing ? (
                    <Input
                      type="number" min={1} max={12}
                      value={editing.semestre}
                      onChange={(e) => setEditing({ ...editing, semestre: e.target.value })}
                      className="h-8 w-16"
                    />
                  ) : (
                    <MonoValue muted={!user.semestre}>{user.semestre ?? '—'}</MonoValue>
                  )}
                </TableCell>

                <TableCell className={adminTableCellClass}>
                  {isEditing ? (
                    <div className="flex flex-col gap-1 min-w-[160px]">
                      {EDITABLE_ROLES.map((r) => (
                        <label key={r.value} className="flex items-center gap-2 text-xs cursor-pointer">
                          <Checkbox
                            checked={editing.roles.includes(r.value)}
                            onCheckedChange={(checked) => toggleEditingRole(r.value, checked === true)}
                            aria-label={r.label}
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => {
                          const cfg = ROLE_BADGE[role] || { label: role };
                          return (
                            <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'} className={role === 'admin' ? 'bg-primary' : ''}>
                              {cfg.icon && <Shield className="h-3 w-3 mr-1" />}
                              {cfg.label}
                            </Badge>
                          );
                        })
                      ) : (
                        <Badge variant="secondary">Aluno</Badge>
                      )}
                    </div>
                  )}
                </TableCell>

                <TableCell className={`${adminTableCellClass} text-right`}>
                  {isEditing ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={saveEditing} disabled={saving} className="h-8 w-8 p-0">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving} className="h-8 w-8 p-0">
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setSupportUserId(user.id); setSupportUserName(user.nome); setSupportOpen(true); }}
                        className="h-8 w-8 p-0" title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => startEditing(user)} className="h-8 w-8 p-0" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={isLoading} aria-label="Mais ações">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canImpersonate && !isAdmin && (
                            <DropdownMenuItem onClick={() => accessAsAluno(user)}>
                              <UserCheck className="h-4 w-4 mr-2" /> Acessar como Aluno
                            </DropdownMenuItem>
                          )}
                          {canImpersonate && !isAdmin && isGestorRole && (
                            <DropdownMenuItem onClick={() => accessAsGestor(user)}>
                              <UserCheck className="h-4 w-4 mr-2" /> Acessar como Gestor
                            </DropdownMenuItem>
                          )}
                          {canImpersonate && <DropdownMenuSeparator />}
                          <DropdownMenuItem onClick={() => resendInvite(user)}>
                            <Mail className="h-4 w-4 mr-2" /> Reenviar Convite
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyUserLink(user.email, 'welcome')}>
                            <Link className="h-4 w-4 mr-2" /> Copiar link de primeiro acesso
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyUserLink(user.email, 'reset')}>
                            <KeyRound className="h-4 w-4 mr-2" /> Copiar link de redefinição
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => syncUserAuth(user.email)}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Auth
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleAdminRole(user)}>
                                {isAdmin ? (
                                  <><ShieldOff className="h-4 w-4 mr-2 text-red-600" /><span className="text-red-600">Remover Admin</span></>
                                ) : (
                                  <><Shield className="h-4 w-4 mr-2" />Promover a Admin</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteTargets([user])}>
                                <Trash2 className="h-4 w-4 mr-2 text-red-600" /><span className="text-red-600">Remover Usuário</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </AdminTable>
    );
  };

  return (
    <div className="space-y-4">
      {canManage && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3">
          <span className="text-sm font-medium">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
          <Button variant="outline" size="sm" onClick={onOpenBulkEmail}>
            <Mail className="h-4 w-4 mr-1" /> Trocar e-mail
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400" onClick={() => setDeleteTargets(users.filter(u => selectedIds.has(u.id)))}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4 mr-1" /> Limpar seleção
          </Button>
        </div>
      )}

      {(deleteProgress.active || deleteProgress.done > 0) && deleteProgress.total > 0 && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {isDeleteBusy ? `Excluindo usuários… ${deleteProgress.done}/${deleteProgress.total}` : `Exclusão concluída: ${deleteProgress.ok} removido(s)`}
            </span>
            {isDeleteBusy ? (
              <Button variant="outline" size="sm" onClick={cancelDelete}>Cancelar</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setDeleteProgress(EMPTY_DELETE_PROGRESS)}><X className="h-4 w-4" /></Button>
            )}
          </div>
          <Progress value={deleteProgressPct} />
          {!isDeleteBusy && deleteProgress.failed.length > 0 && (
            <AdminPartial ok={deleteProgress.ok} falhas={deleteProgress.failed.length} />
          )}
        </div>
      )}

      {renderContent()}

      <DangerZone
        open={!!deleteTargets}
        onOpenChange={(open) => { if (!open) setDeleteTargets(null); }}
        level="high"
        confirmWord="EXCLUIR"
        title={`Excluir ${deleteTargets?.length ?? 0} usuário${(deleteTargets?.length ?? 0) === 1 ? '' : 's'}`}
        impact={deleteImpact}
        actionLabel="Excluir"
        onConfirm={confirmDeleteTargets}
      />

      <UserSupportPanel userId={supportUserId} userName={supportUserName} open={supportOpen} onOpenChange={setSupportOpen} />
    </div>
  );
};
