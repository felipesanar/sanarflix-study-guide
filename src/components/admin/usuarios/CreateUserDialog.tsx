/**
 * Fatia B — Usuários: diálogo "Novo usuário" (criação individual B2B).
 *
 * Reaproveita `usersService.createUser` (mesma edge `b2b-create-user`,
 * idempotente — cria ou atualiza) que já existia em `UsersTab`. Aberto pelo
 * botão do header de `UsuariosPage` ou pelo deep-link `?new=1`.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { AtSign, Building2, GraduationCap, Loader2, Mail, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usersService } from '@/services/usersService';
import type { Ies } from '@/services/iesService';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/experiences/access';
import { Logger } from '@/utils/logger';

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'aluno', label: 'Aluno (padrão)' },
  { value: 'admin', label: 'Admin' },
  { value: 'professor', label: 'Professor' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'gestor_grupo', label: 'Gestor de Grupo' },
  { value: 'atendimento', label: 'Atendimento' },
];

const EMPTY_FORM = { nome: '', email: '', id_ies: '', semestre: '', role: 'aluno' };

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iesList: Ies[];
  /** Chamado após criação/atualização bem-sucedida (para o caller reconsultar stats/lista). */
  onCreated: () => void;
}

/** Diálogo de criação individual — form migrado de `UsersTab` (lógica intacta). */
export function CreateUserDialog({ open, onOpenChange, iesList, onCreated }: CreateUserDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isCreating) return;
    onOpenChange(next);
    if (!next) setForm(EMPTY_FORM);
  };

  const createUser = async () => {
    if (!form.nome || !form.email || !form.id_ies) {
      toast.error('Preencha nome, email e instituição');
      return;
    }
    if (form.semestre) {
      const sem = parseInt(form.semestre, 10);
      if (Number.isNaN(sem) || sem < 1 || sem > 12) {
        toast.error('Semestre deve ser entre 1 e 12');
        return;
      }
    }

    setIsCreating(true);
    try {
      const data = await usersService.createUser({
        nome: form.nome,
        email: form.email.toLowerCase().trim(),
        id_ies: form.id_ies,
        semestre: form.semestre ? parseInt(form.semestre, 10) : null,
        ...(form.role && form.role !== 'aluno' ? { role: form.role as 'aluno' | 'professor' | 'admin' | 'gestor' | 'gestor_grupo' | 'atendimento' } : {}),
      });

      if (!data.success) {
        const displayMsg = data.message ? `${data.error}: ${data.message}` : (data.error ?? 'Erro ao criar usuário');
        toast.error(displayMsg);
        return;
      }

      const actionMsg = data.action === 'created'
        ? (data.details?.emailSent ? 'Usuário cadastrado. E-mail de boas-vindas enviado.' : 'Usuário cadastrado, mas não foi possível enviar o e-mail.')
        : `Usuário atualizado: ${data.details?.fieldsUpdated?.join(', ') || 'nenhuma alteração'}`;

      toast.success(actionMsg);
      onCreated();
      handleOpenChange(false);
    } catch (err) {
      Logger.error('[CreateUserDialog] create user error:', err);
      toast.error('Erro inesperado ao criar usuário');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Adicione um usuário. Um e-mail de convite será enviado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cu-nome" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Nome completo
            </Label>
            <Input
              id="cu-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="João Silva"
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-email" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AtSign className="h-3.5 w-3.5" /> Email
            </Label>
            <Input
              id="cu-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="joao@exemplo.com"
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Instituição
            </Label>
            <Select value={form.id_ies} onValueChange={(v) => setForm({ ...form, id_ies: v })} disabled={isCreating}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a IES" />
              </SelectTrigger>
              <SelectContent>
                {iesList.map((ies) => (
                  <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-semestre" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> Semestre
            </Label>
            <Input
              id="cu-semestre"
              type="number"
              min={1}
              max={12}
              value={form.semestre}
              onChange={(e) => setForm({ ...form, semestre: e.target.value })}
              placeholder="5"
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Papel
            </Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })} disabled={isCreating}>
              <SelectTrigger>
                <SelectValue placeholder="Aluno (padrão)" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={createUser} disabled={isCreating}>
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Criar e enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateUserDialog;
