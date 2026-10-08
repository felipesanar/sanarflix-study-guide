import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { usersService } from '@/services/usersService';
import { upsertMentor, type MentorTipo } from '@/services/admin/mentores';

/** IES âncora da conta de mentor B2C. Nunca a IES "B2B" (ela concede admin no b2b-create-user). */
export const IES_ANCORA_B2C = 'abec7c7d-ef07-4871-9e19-090f4d951e5e';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cria a conta do mentor (edge `b2b-create-user`, papel `mentor`) e o
 * cadastro de mentor (`admin_upsert_mentor`). Um login por perfil: quem é
 * mentor B2C e B2B usa dois e-mails.
 */
export const CreateMentorDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [tipo, setTipo] = React.useState<MentorTipo>('b2c');
  const [turma, setTurma] = React.useState('');
  const [iesId, setIesId] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const { data: iesList = [] } = useQuery({
    queryKey: ['admin', 'ies-lista'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ies').select('id, nome').order('nome');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const valido = nome.trim() && email.includes('@') && turma.trim() && (tipo === 'b2c' || iesId);

  const salvar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const conta = await usersService.createUser({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        id_ies: tipo === 'b2b' ? iesId : IES_ANCORA_B2C,
        role: 'mentor',
      });
      if (!conta.success || !conta.userId) throw new Error(conta.error ?? 'Não foi possível criar a conta.');
      await upsertMentor({ userId: conta.userId, tipo, turmaNome: turma.trim(), iesId: tipo === 'b2b' ? iesId : null });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mentores'] });
      onOpenChange(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao cadastrar o mentor.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo mentor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="mentor-nome">Nome</Label>
            <Input id="mentor-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mentor-email">E-mail de login</Label>
            <Input id="mentor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as MentorTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="b2c">B2C (Minha Turma)</SelectItem>
                <SelectItem value="b2b">B2B (Visão Geral)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mentor-turma">Nome da turma</Label>
            <Input id="mentor-turma" placeholder="Ex.: Tribo Carcará" value={turma} onChange={(e) => setTurma(e.target.value)} />
          </div>
          {tipo === 'b2b' && (
            <div className="space-y-1">
              <Label>Instituição</Label>
              <Select value={iesId} onValueChange={setIesId}>
                <SelectTrigger><SelectValue placeholder="Escolha a IES" /></SelectTrigger>
                <SelectContent>
                  {iesList.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={!valido || ocupado}>Cadastrar mentor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
