import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { listarLiberacoesLigadas } from '@/services/mentor/agenda';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { definirLinkAgendamento, desligarAgenda, liberarAgenda } from '@/services/mentor/sessoes';
import type { AlunoTurma } from '@/services/mentor/turma';
import { ehLinkHttps, formatarData } from './dataHora';

interface Props {
  mentorId: string;
  alunos: AlunoTurma[];
  /** Link digitado no bloco do Google Agenda. */
  link: string;
  /** Link já salvo nesta sessão de uso. */
  linkSalvo: boolean;
  onLinkSalvo: (url: string) => void;
}

/** Liberação em massa da agenda individual + lista de quem já está liberado. */
export const LiberarAgendaPanel: React.FC<Props> = ({ mentorId, alunos, link, linkSalvo, onLinkSalvo }) => {
  const qc = useQueryClient();
  const [busca, setBusca] = React.useState('');
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set());
  const [mensagem, setMensagem] = React.useState('');
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const liberacoes = useQuery({ queryKey: ['mentor', 'agenda-liberacoes', mentorId], queryFn: () => listarLiberacoesLigadas(mentorId) });

  const nomePorEmail = React.useMemo(() => {
    const m = new Map<string, string>();
    alunos.forEach((a) => m.set(a.email, a.nome ?? a.email));
    return m;
  }, [alunos]);

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: ['mentor', 'agenda-liberacoes'] });
    await qc.invalidateQueries({ queryKey: ['mentor', 'intervencoes'] });
  };

  const liberar = useMutation({
    mutationFn: async () => {
      if (!linkSalvo) {
        const url = link.trim();
        await definirLinkAgendamento(url);
        onLinkSalvo(url);
      }
      return liberarAgenda(Array.from(selecionados), mensagem.trim());
    },
    onSuccess: async (r) => {
      setAviso(null);
      setOk(`Agenda liberada para ${r.liberados} ${r.liberados === 1 ? 'aluno' : 'alunos'}.`);
      setSelecionados(new Set());
      setMensagem('');
      await refrescar();
    },
    onError: (e: Error) => {
      setOk(null);
      setAviso(e.message);
    },
  });

  const desligar = useMutation({
    mutationFn: (emails: string[] | null) => desligarAgenda(emails),
    onSuccess: async (r) => {
      setAviso(null);
      setOk(`Agenda desligada para ${r.desligados} ${r.desligados === 1 ? 'aluno' : 'alunos'}.`);
      await refrescar();
    },
    onError: (e: Error) => {
      setOk(null);
      setAviso(e.message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    if (!linkSalvo && !link.trim()) {
      setAviso('Cadastre o link do seu Google Agenda antes de liberar.');
      return;
    }
    if (!linkSalvo && !ehLinkHttps(link)) {
      setAviso('O link do Google Agenda precisa ser um https válido.');
      return;
    }
    if (selecionados.size === 0) {
      setAviso('Escolha ao menos um aluno.');
      return;
    }
    if (!mensagem.trim()) {
      setAviso('Escreva a mensagem que o aluno vai ver. Sem mensagem não libera.');
      return;
    }
    setAviso(null);
    liberar.mutate();
  };

  const filtrados = alunos.filter((a) => {
    const q = busca.trim().toLowerCase();
    return !q || (a.nome ?? '').toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  const toggle = (email: string, on: boolean) =>
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (on) n.add(email);
      else n.delete(email);
      return n;
    });

  const ligadas = liberacoes.data ?? [];

  return (
    <section className="rounded-lg border p-4 space-y-4" aria-labelledby="liberar-titulo">
      <div>
        <h2 id="liberar-titulo" className="text-base font-semibold">
          Liberar sessão individual
        </h2>
        <p className="text-sm text-muted-foreground">
          Escolha os alunos e escreva a mensagem. Eles passam a ver o link do seu Google Agenda.
        </p>
      </div>

      <form noValidate onSubmit={submit} className="space-y-3">
        <Input
          aria-label="Buscar aluno"
          placeholder="Buscar aluno por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <ul className="max-h-48 overflow-y-auto rounded-md border divide-y" aria-label="Alunos da turma">
          {filtrados.length === 0 && <li className="p-2 text-sm text-muted-foreground">Nenhum aluno encontrado.</li>}
          {filtrados.map((a) => (
            <li key={a.email} className="flex items-center gap-2 p-2 text-sm">
              <Checkbox
                id={`lib-${a.email}`}
                aria-label={`Selecionar ${a.nome ?? a.email}`}
                checked={selecionados.has(a.email)}
                onCheckedChange={(v) => toggle(a.email, v === true)}
              />
              <label htmlFor={`lib-${a.email}`} className="flex-1 cursor-pointer">
                {a.nome ?? a.email}
              </label>
            </li>
          ))}
        </ul>
        <label className="block space-y-1 text-sm">
          <span>Mensagem para o aluno (obrigatória)</span>
          <Textarea
            aria-label="Mensagem para o aluno"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
          />
        </label>
        {aviso && (
          <p role="alert" className="text-sm text-amber-700">
            {aviso}
          </p>
        )}
        {ok && <p role="status" className="text-sm text-emerald-700">{ok}</p>}
        <Button type="submit" disabled={liberar.isPending}>
          {liberar.isPending
            ? 'Liberando...'
            : `Liberar para ${selecionados.size} ${selecionados.size === 1 ? 'aluno' : 'alunos'}`}
        </Button>
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {liberacoes.isSuccess ? `Liberada para ${ligadas.length} ${ligadas.length === 1 ? 'aluno' : 'alunos'}` : 'Liberações'}
          </h3>
          {ligadas.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={desligar.isPending}>
                  Desligar todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desligar a agenda de todos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {ligadas.length} {ligadas.length === 1 ? 'aluno deixa' : 'alunos deixam'} de ver o link do seu Google
                    Agenda. Você pode liberar de novo depois.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => desligar.mutate(null)}>Sim, desligar todos</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        {liberacoes.isLoading && <p className="text-sm text-muted-foreground">Carregando liberações...</p>}
        {liberacoes.isError && (
          <div role="alert" className="text-sm text-destructive">
            Não foi possível carregar as liberações.{' '}
            <Button size="sm" variant="link" className="px-1" onClick={() => liberacoes.refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {liberacoes.isSuccess && ligadas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum aluno com a agenda liberada.</p>
        )}
        {ligadas.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Aluno</th>
                <th className="py-1 font-medium">Desde</th>
                <th className="py-1 font-medium">Mensagem</th>
                <th className="py-1 font-medium">
                  <span className="sr-only">Liberada</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ligadas.map((l) => {
                const nome = nomePorEmail.get(l.aluno_email) ?? l.aluno_email;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="py-1.5">{nome}</td>
                    <td className="py-1.5 whitespace-nowrap">{formatarData(l.desde)}</td>
                    <td className="py-1.5">{l.mensagem}</td>
                    <td className="py-1.5 text-right">
                      <Switch
                        checked
                        aria-label={`Agenda liberada para ${nome}`}
                        disabled={desligar.isPending}
                        onCheckedChange={() => desligar.mutate([l.aluno_email])}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
