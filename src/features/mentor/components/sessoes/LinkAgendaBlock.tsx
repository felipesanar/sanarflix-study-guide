import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { definirLinkAgendamento } from '@/services/mentor/sessoes';
import { ehLinkHttps } from './dataHora';

interface Props {
  link: string;
  onLinkChange: (v: string) => void;
  salvo: boolean;
  onSalvo: (url: string) => void;
}

/** Bloco "Link do seu Google Agenda" — obrigatório antes de liberar a agenda. */
export const LinkAgendaBlock: React.FC<Props> = ({ link, onLinkChange, salvo, onSalvo }) => {
  const [erro, setErro] = React.useState<string | null>(null);
  const salvar = useMutation({
    mutationFn: (url: string) => definirLinkAgendamento(url),
    onSuccess: (_r, url) => {
      setErro(null);
      onSalvo(url);
    },
    onError: (e: Error) => setErro(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    if (!ehLinkHttps(url)) {
      setErro('Informe um link https válido do Google Agenda.');
      return;
    }
    salvar.mutate(url);
  };

  return (
    <section className="rounded-lg border p-4 space-y-2">
      <h2 className="text-base font-semibold">
        Link do seu Google Agenda
      </h2>
      <p className="text-sm text-muted-foreground">
        É o link que o aluno usa para marcar a sessão individual com você. Cadastre antes de liberar a agenda.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="url"
          aria-label="Link do seu Google Agenda"
          placeholder="https://calendar.app.google/..."
          value={link}
          onChange={(e) => {
            onLinkChange(e.target.value);
            setErro(null);
          }}
        />
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : 'Salvar link'}
        </Button>
      </form>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      {salvo && !erro && <p className="text-sm text-emerald-700">Link salvo</p>}
    </section>
  );
};
