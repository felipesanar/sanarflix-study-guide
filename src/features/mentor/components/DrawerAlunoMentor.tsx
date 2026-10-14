import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, MessageCircle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { linkWhatsAppAluno } from '@/features/gestor/components/DrawerAluno';
import { fetchAluno, type AlunoDetalhe } from '@/services/mentor/turma';
import { desligarAgenda, liberarAgenda } from '@/services/mentor/sessoes';
import { invalidarMentor } from '@/services/mentor/invalidar';
import { EstadoErro } from '@/features/mentor/components/turma/EstadoErro';
import { SecaoDesempenhoAluno } from '@/features/mentor/components/turma/SecaoDesempenhoAluno';
import { descreverEvento } from '@/features/mentor/components/turma/logEvento';
import {
  SEGMENTO_CLASSE,
  SEGMENTO_ETIQUETA,
  formatDataCalendario,
  formatDiaMes,
  formatSemestre,
  formatUltimoAcesso,
  nomeOuEmail,
} from '@/features/mentor/components/turma/util';

type FiltroLog = 'tudo' | 'intervencoes' | 'mural';

const FILTROS_LOG: { valor: FiltroLog; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'intervencoes', rotulo: 'Intervenções' },
  { valor: 'mural', rotulo: 'Mural' },
];

function passaFiltro(tipo: string, filtro: FiltroLog): boolean {
  if (filtro === 'tudo') return true;
  if (filtro === 'mural') return tipo === 'mural_publicado';
  return tipo.startsWith('intervencao');
}

interface Props {
  /** E-mail do aluno; nulo mantém o drawer fechado. */
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A RPC `mentor_aluno` levanta "aluno … não é da sua turma" quando o e-mail está fora da turma. */
function alunoForaDaTurma(error: unknown): boolean {
  return error instanceof Error && /n[aã]o é da sua turma/i.test(error.message);
}

/** Drawer do aluno (tela 03): contato, ações, agenda individual e log de interações. */
export const DrawerAlunoMentor: React.FC<Props> = ({ email, open, onOpenChange }) => {
  const query = useQuery({
    queryKey: ['mentor', 'aluno', email],
    queryFn: () => fetchAluno(email as string),
    enabled: open && !!email,
  });

  return (
    <Sheet open={open && !!email} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {query.isLoading && (
          <>
            <SheetHeader>
              <SheetTitle>Carregando aluno…</SheetTitle>
              <SheetDescription className="sr-only">Detalhes do aluno</SheetDescription>
            </SheetHeader>
          </>
        )}
        {query.isError && alunoForaDaTurma(query.error) && (
          <SheetHeader>
            <SheetTitle>Aluno não encontrado</SheetTitle>
            <SheetDescription>Este aluno não está na sua turma.</SheetDescription>
          </SheetHeader>
        )}
        {query.isError && !alunoForaDaTurma(query.error) && (
          <>
            <SheetHeader>
              <SheetTitle>Aluno</SheetTitle>
              <SheetDescription className="sr-only">Detalhes do aluno</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <EstadoErro mensagem="Não foi possível carregar o aluno." onRetry={() => void query.refetch()} />
            </div>
          </>
        )}
        {query.data && email && <ConteudoAluno email={email} detalhe={query.data} />}
      </SheetContent>
    </Sheet>
  );
};

const ConteudoAluno: React.FC<{ email: string; detalhe: AlunoDetalhe }> = ({ email, detalhe }) => {
  const { aluno, liberacao, log } = detalhe;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filtroLog, setFiltroLog] = React.useState<FiltroLog>('tudo');
  const [abrirLiberar, setAbrirLiberar] = React.useState(false);
  const [mensagem, setMensagem] = React.useState('');

  const aposMudanca = () => {
    void invalidarMentor(queryClient);
  };

  const liberar = useMutation({
    mutationFn: () => liberarAgenda([email], mensagem.trim()),
    onSuccess: () => {
      toast({ title: 'Agendamento liberado', description: 'O aluno recebeu a mensagem no mural.' });
      setAbrirLiberar(false);
      setMensagem('');
      aposMudanca();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Não foi possível liberar o agendamento', description: 'Tente de novo.' });
    },
  });

  const desligar = useMutation({
    mutationFn: () => desligarAgenda([email]),
    onSuccess: () => {
      toast({ title: 'Agendamento desligado' });
      aposMudanca();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Não foi possível desligar o agendamento', description: 'Tente de novo.' });
    },
  });

  if (!aluno) {
    return (
      <SheetHeader>
        <SheetTitle>Aluno não encontrado</SheetTitle>
        <SheetDescription>Este aluno não está na sua turma.</SheetDescription>
      </SheetHeader>
    );
  }

  const nome = nomeOuEmail(aluno);
  const primeiroNome = nome.split(' ')[0];
  const linkWhats = linkWhatsAppAluno(aluno.telefone, `Oi, ${primeiroNome}! Aqui é seu mentor.`);
  const emailParam = encodeURIComponent(email);
  const eventos = log.filter((e) => passaFiltro(e.tipo, filtroLog));
  const mensagemVazia = mensagem.trim().length === 0;

  return (
    <div className="space-y-6">
      <SheetHeader className="space-y-1 text-left">
        <SheetTitle>{nome}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{formatSemestre(aluno.semestre)}</span>
            <span
              className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SEGMENTO_CLASSE[aluno.segmento])}
            >
              {SEGMENTO_ETIQUETA[aluno.segmento]}
            </span>
          </div>
        </SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Telefone</dt>
          <dd>{aluno.telefone || 'Sem telefone'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Acesso até</dt>
          <dd>{formatDataCalendario(aluno.acesso_ate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="break-all">{aluno.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último acesso</dt>
          <dd>{formatUltimoAcesso(aluno.dias_sem_atividade)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {linkWhats && (
          <Button asChild variant="outline" size="sm">
            <a href={linkWhats} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to={`/mentor/mural?para=${emailParam}`}>
            <Megaphone className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Mensagem no mural
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/mentor/intervencoes?novo=1&aluno=${emailParam}`}>
            <ClipboardList className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Criar intervenção
          </Link>
        </Button>
      </div>

      <section className="space-y-3 rounded-lg border p-3">
        {liberacao?.ligado ? (
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm">
              <p className="font-medium">Agendamento individual</p>
              <p className="text-muted-foreground">Liberado desde {formatDiaMes(liberacao.desde)}</p>
            </div>
            <Button variant="outline" size="sm" disabled={desligar.isPending} onClick={() => desligar.mutate()}>
              Desligar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="liberar-agenda" className="text-sm font-medium">
                Liberar agendamento individual
              </Label>
              <Switch
                id="liberar-agenda"
                checked={abrirLiberar}
                onCheckedChange={setAbrirLiberar}
                aria-label="Liberar agendamento individual"
              />
            </div>
            {abrirLiberar && (
              <div className="space-y-2">
                <Label htmlFor="liberar-mensagem" className="text-sm">
                  Mensagem para o aluno
                </Label>
                <Textarea
                  id="liberar-mensagem"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Escreva o convite que o aluno vai ler no mural."
                  rows={3}
                />
                {mensagemVazia && <p className="text-xs text-muted-foreground">Falta 1 passo</p>}
                <Button size="sm" disabled={mensagemVazia || liberar.isPending} onClick={() => liberar.mutate()}>
                  Enviar e liberar
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <SecaoDesempenhoAluno email={email} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Log de interações</h3>
          <div className="flex gap-1">
            {FILTROS_LOG.map((f) => (
              <button
                key={f.valor}
                type="button"
                aria-pressed={filtroLog === f.valor}
                onClick={() => setFiltroLog(f.valor)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs',
                  filtroLog === f.valor ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                )}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>
        {eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma interação registrada ainda.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {eventos.map((e, i) => (
              <li key={`${e.tipo}-${e.criado_em}-${i}`} className="flex justify-between gap-2 border-b pb-2">
                <p>{descreverEvento(e.tipo, e.payload)}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDiaMes(e.criado_em)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
