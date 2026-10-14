import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { listarSessoes } from '@/services/mentor/sessoes';
import { fetchTurma } from '@/services/mentor/turma';
import { AgendaTable } from '@/features/mentor/components/sessoes/AgendaTable';
import { LiberarAgendaPanel } from '@/features/mentor/components/sessoes/LiberarAgendaPanel';
import { LinkAgendaBlock } from '@/features/mentor/components/sessoes/LinkAgendaBlock';
import { SessaoForm } from '@/features/mentor/components/sessoes/SessaoForm';

type FiltroTipo = 'todas' | 'coletiva' | 'individual';
type FiltroQuando = 'proximas' | 'realizadas';

const TIPOS: { v: FiltroTipo; l: string }[] = [
  { v: 'todas', l: 'Todas' },
  { v: 'coletiva', l: 'Coletivas' },
  { v: 'individual', l: 'Individuais' },
];
const QUANDO: { v: FiltroQuando; l: string }[] = [
  { v: 'proximas', l: 'Próximas' },
  { v: 'realizadas', l: 'Realizadas' },
];

const Chip: React.FC<{ ativo: boolean; onClick: () => void; children: React.ReactNode }> = ({
  ativo,
  onClick,
  children,
}) => (
  <Button type="button" size="sm" variant={ativo ? 'default' : 'outline'} aria-pressed={ativo} onClick={onClick}>
    {children}
  </Button>
);

/** Sessões e liberação de agenda (tela 06). */
const Sessoes: React.FC = () => {
  const [tipo, setTipo] = React.useState<FiltroTipo>('todas');
  const [quando, setQuando] = React.useState<FiltroQuando>('proximas');
  const [link, setLink] = React.useState('');
  const [linkSalvo, setLinkSalvo] = React.useState(false);

  const turma = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  const sessoes = useQuery({
    queryKey: ['mentor', 'sessoes', quando],
    queryFn: () => listarSessoes(quando),
  });

  const alunos = turma.data ?? [];
  const lista = (sessoes.data ?? []).filter((s) => tipo === 'todas' || s.tipo === tipo);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Sessões</h1>
        <p className="text-sm text-muted-foreground">
          Agende sessões coletivas e individuais e libere a sua agenda para os alunos.
        </p>
      </header>

      <SessaoForm alunos={alunos} />

      <section className="space-y-3" aria-label="Agenda de sessões">
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-1" role="group" aria-label="Filtrar por tipo">
            {TIPOS.map((t) => (
              <Chip key={t.v} ativo={tipo === t.v} onClick={() => setTipo(t.v)}>
                {t.l}
              </Chip>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Filtrar por período">
            {QUANDO.map((q) => (
              <Chip key={q.v} ativo={quando === q.v} onClick={() => setQuando(q.v)}>
                {q.l}
              </Chip>
            ))}
          </div>
        </div>

        {sessoes.isLoading && (
          <div className="space-y-2" aria-label="Carregando sessões">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {sessoes.isError && (
          <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
            Não foi possível carregar as sessões.{' '}
            <Button size="sm" variant="link" className="px-1" onClick={() => sessoes.refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {sessoes.isSuccess && lista.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {quando === 'proximas' ? 'Nenhuma sessão agendada neste filtro.' : 'Nenhuma sessão realizada neste filtro.'}
          </p>
        )}
        {sessoes.isSuccess && lista.length > 0 && <AgendaTable sessoes={lista} alunos={alunos} />}
      </section>

      <LinkAgendaBlock
        link={link}
        onLinkChange={(v) => {
          setLink(v);
          setLinkSalvo(false);
        }}
        salvo={linkSalvo}
        onSalvo={() => setLinkSalvo(true)}
      />

      {turma.isLoading && <Skeleton className="h-40 w-full" aria-label="Carregando turma" />}
      {turma.isError && (
        <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
          Não foi possível carregar a turma.{' '}
          <Button size="sm" variant="link" className="px-1" onClick={() => turma.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {turma.isSuccess && (
        <LiberarAgendaPanel
          alunos={alunos}
          link={link}
          linkSalvo={linkSalvo}
          onLinkSalvo={(url) => {
            setLink(url);
            setLinkSalvo(true);
          }}
        />
      )}
    </div>
  );
};

export default Sessoes;
