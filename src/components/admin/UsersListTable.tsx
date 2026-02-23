import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';

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

const ITEMS_PER_PAGE = 25;

export const UsersListTable: React.FC<UsersListTableProps> = ({ iesList, onStatsUpdate }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIes, setFilterIes] = useState<string>('all');
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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Build query with filters
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

      // Apply IES filter
      if (filterIes !== 'all') {
        query = query.eq('id_ies', filterIes);
      }

      // Apply search filter
      if (searchTerm.trim()) {
        query = query.or(`nome.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Pagination
      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data: usersData, count, error } = await query
        .order('nome')
        .range(from, to);

      if (error) throw error;

      // Fetch roles for all users
      const userIds = usersData?.map(u => u.id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Map roles to users
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

      // Also fetch total admin count for stats
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
  }, [page, searchTerm, filterIes, onStatsUpdate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterIes]);

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

    // Validation
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
        body: {
          nome: editing.nome.trim(),
          email: user.email,
          id_ies: editing.id_ies,
          semestre,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao atualizar');
      }

      toast.success('Usuário atualizado com sucesso');
      cancelEditing();
      fetchUsers();
    } catch (err) {
      console.error('Save error:', err);
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
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .eq('role', 'admin');

        if (error) throw error;
        toast.success(`${user.nome} não é mais administrador`);
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'admin' });

        if (error) throw error;
        toast.success(`${user.nome} agora é administrador`);
      }
      fetchUsers();
    } catch (err) {
      console.error('Toggle admin error:', err);
      toast.error('Erro ao alterar permissão');
    } finally {
      setActionLoading(null);
    }
  };

  const syncUserAuth = async (email: string) => {
    setActionLoading(email);
    try {
      const { data, error } = await supabase.functions.invoke('sync-user-auth', {
        body: { email },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Autenticação sincronizada');
      } else {
        toast.info(data?.error || 'Nenhuma ação necessária');
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar');
    } finally {
      setActionLoading(null);
    }
  };

  const resendInvite = async (user: UserRow) => {
    setActionLoading(user.id);
    try {
      // Re-invoke the create user function which sends the invite
      const { data, error } = await supabase.functions.invoke('b2b-create-user', {
        body: {
          nome: user.nome,
          email: user.email,
          id_ies: user.id_ies,
          semestre: user.semestre || 1,
          resend_email: true,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Email de convite reenviado');
      } else {
        toast.info(data?.message || 'Usuário já confirmado');
      }
    } catch (err) {
      console.error('Resend invite error:', err);
      toast.error('Erro ao reenviar convite');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const showingFrom = page * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min((page + 1) * ITEMS_PER_PAGE, totalCount);

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
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterIes} onValueChange={setFilterIes}>
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
          <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
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
                // Loading skeleton
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
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
                  <TableCell colSpan={6} className="h-24 text-center">
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

                  return (
                    <TableRow key={user.id} className={isEditing ? 'bg-muted/50' : ''}>
                      {/* Nome */}
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

                      {/* Email (always read-only) */}
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>

                      {/* IES */}
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

                      {/* Semestre */}
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

                      {/* Papel */}
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

                      {/* Ações */}
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveEditing}
                              disabled={saving}
                              className="h-8 w-8 p-0"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                              disabled={saving}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(user)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={isLoading}
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
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
                disabled={page === 0 || loading}
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
                disabled={page >= totalPages - 1 || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
