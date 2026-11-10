import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { checkSimuladoDeletable, deleteSimulado, type SimuladoDeleteCheck } from '@/services/admin/simulados';

interface Props {
  simuladoId: string;
  simuladoNome: string;
  onDeleted: () => void;
}

export default function ExcluirSimuladoButton({ simuladoId, simuladoNome, onDeleted }: Props) {
  const [check, setCheck] = useState<SimuladoDeleteCheck | null>(null);
  const [checkError, setCheckError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    setCheck(null);
    setCheckError(false);
    checkSimuladoDeletable(simuladoId)
      .then((c) => alive && setCheck(c))
      .catch(() => alive && setCheckError(true));
    return () => { alive = false; };
  }, [simuladoId]);

  const bloqueado = !check || !check.deletable;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSimulado(simuladoId);
      toast.success('Simulado excluído');
      setConfirmOpen(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir o simulado');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mr-auto flex max-w-sm flex-col gap-1">
      <Button
        type="button"
        variant="destructive"
        className="w-fit"
        disabled={bloqueado}
        onClick={() => { setTyped(''); setConfirmOpen(true); }}
      >
        {!check && !checkError ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Excluir simulado
      </Button>
      {check && !check.deletable && (
        <p className="text-xs text-muted-foreground" data-testid="excluir-bloqueado">
          {check.alunos > 0
            ? `Este simulado tem respostas de alunos (${check.alunos} alunos) e não pode ser excluído pelo painel.`
            : 'Este simulado tem resultados ou simulados vinculados e não pode ser excluído pelo painel.'}{' '}
          Fale com o time de desenvolvimento.
        </p>
      )}
      {checkError && (
        <p className="text-xs text-muted-foreground">Não foi possível verificar se o simulado pode ser excluído.</p>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{simuladoNome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O simulado e as questões dele serão apagados de vez. Para confirmar, digite o nome do simulado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input aria-label="Nome do simulado" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={simuladoNome} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting || typed.trim() !== simuladoNome.trim()} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir de vez
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
