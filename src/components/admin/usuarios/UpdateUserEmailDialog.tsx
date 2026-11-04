/**
 * Troca individual do e-mail de login de um usuário (aluno, professor ou
 * gestor). Reusa a edge `admin-bulk-update-email` com uma única linha — as
 * travas (admin/atendimento protegidos, self-update, colisão, signOut global,
 * auditoria e alertas) ficam todas no servidor.
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usersService } from '@/services/usersService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REASON_MESSAGES: Record<string, string> = {
  user_not_found: 'Usuário não encontrado.',
  cannot_update_self: 'Você não pode alterar o próprio e-mail.',
  protected_role: 'Contas de admin e atendimento não podem ter o e-mail alterado.',
  email_already_in_use: 'Esse e-mail já está em uso por outra conta.',
  auth_update_failed: 'Não foi possível atualizar o login. Tente novamente.',
  public_update_failed: 'Não foi possível atualizar o cadastro. Tente novamente.',
};

const ROLES_WITH_OLD_EMAIL_ALERT = ['gestor', 'gestor_grupo', 'professor', 'mentor'];

/** Remove espaços e caracteres invisíveis comuns em copy-paste. */
export function sanitizeEmailInput(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const c = ch.codePointAt(0) ?? 0;
    const invisible = (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff;
    if (!invisible) out += ch;
  }
  return out.trim().toLowerCase();
}

interface Props {
  user: { id: string; nome: string; email: string; roles: string[] } | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export const UpdateUserEmailDialog: React.FC<Props> = ({ user, onOpenChange, onUpdated }) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue('');
    setError(null);
  }, [user?.id]);

  const novo = sanitizeEmailInput(value);
  const atual = user?.email.toLowerCase() ?? '';
  const formatoOk = EMAIL_RE.test(novo);
  const igual = novo === atual;
  const canSubmit = !!user && formatoOk && !igual && !saving;
  const alertaAntigo = !!user?.roles.some((r) => ROLES_WITH_OLD_EMAIL_ALERT.includes(r));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await usersService.bulkUpdateEmail([{ email_antigo: atual, email_novo: novo }]);
      const row = res.results?.[0];
      if (res.success && row?.status === 'updated') {
        toast.success('E-mail atualizado. O usuário precisa entrar de novo com o novo e-mail.');
        onUpdated();
        onOpenChange(false);
        return;
      }
      setError(REASON_MESSAGES[row?.reason ?? ''] ?? 'Não foi possível atualizar o e-mail. Tente novamente.');
    } catch {
      setError('Não foi possível atualizar o e-mail. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Alterar e-mail</DialogTitle>
            <DialogDescription>{user?.nome}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-mail atual</Label>
            <p className="font-mono text-sm break-all">{user?.email}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="novo-email">Novo e-mail</Label>
            <Input
              id="novo-email"
              type="email"
              autoComplete="off"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              aria-invalid={!!value && (!formatoOk || igual)}
              autoFocus
            />
            {value && !formatoOk && <p className="text-xs text-destructive">Digite um e-mail válido.</p>}
            {value && formatoOk && igual && <p className="text-xs text-destructive">O novo e-mail é igual ao atual.</p>}
          </div>

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="space-y-1 text-sm">
              <p>As sessões abertas do usuário são encerradas e ele recebe um aviso no novo e-mail.</p>
              {alertaAntigo && <p>Por ser professor ou gestor, o e-mail antigo também recebe um alerta de segurança.</p>}
              <p>Progresso, simulados e histórico continuam na conta.</p>
            </AlertDescription>
          </Alert>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={!canSubmit}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar e-mail
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
