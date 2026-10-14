import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMentorContexto } from '@/services/mentor/contexto';
import { fetchLinkAgendamento } from '@/services/mentor/agenda';
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
  /** Valor gravado no cadastro (ou salvo agora); o link só conta como salvo se for igual a ele. */
  const [salvoValor, setSalvoValor] = React.useState<string | null>(null);
  const linkSalvo = salvoValor !== null && link.trim() === salvoValor;

  const contexto = useQuery({ queryKey: ['mentor', 'contexto'], queryFn: fetchMentorContexto });
  const mentorId = contexto.data?.mentor?.user_id;

  const turma = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma });
  // 'proximas' e 'realizadas' do banco escondem sessões que já passaram e não foram
  // marcadas como feitas; por isso lemos 'todas' e filtramos aqui.
  const sessoes = useQuery({
    queryKey: ['mentor', 'sessoes', 'todas'],
    queryFn: () => listarSessoes('todas'),
  });
  const linkCadastrado = useQuery({
    queryKey: ['mentor', 'link-agendamento', mentorId],
    queryFn: () => fetchLinkAgendamento(mentorId as string),
    enabled: !!mentorId,
  });

  const prefillFeito = React.useRef(false);
  React.useEffect(() => {
    if (prefillFeito.current || !linkCadastrado.isSuccess) return;
    prefillFeito.current = true;
    if (linkCadastrado.data) {
      setLink(linkCadastrado.data);
      setSalvoValor(linkCadastrado.data);
    }
  }, [linkCadastrado.isSuccess, linkCadastrado.data]);

  const alunos = turma.data ?? [];
  const lista = React.useMemo(() => {
    const todas = (sessoes.data ?? []).filter((s) => tipo === 'todas' || s.tipo === tipo);
    const t = (s: { inicio: string }) => new Date(s.inicio).getTime();
    return quando === 'proximas'
      ? todas.filter((s) => s.status === 'agendada').sort((a, b) => t(a) - t(b))
      : todas.filter((s) => s.status === 'realizada').sort((a, b) => t(b) - t(a));
  }, [sessoes.data, tipo, quando]);

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
        onLinkChange={setLink}
        salvo={linkSalvo}
        salvoValor={salvoValor}
        onSalvo={(url) => {
          setLink(url);
          setSalvoValor(url);
        }}
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
      {turma.isSuccess && mentorId && (
        <LiberarAgendaPanel
          mentorId={mentorId}
          alunos={alunos}
          link={link}
          linkSalvo={linkSalvo}
          onLinkSalvo={(url) => {
            setLink(url);
            setSalvoValor(url);
          }}
        />
      )}
    </div>
  );
};

export default Sessoes;
