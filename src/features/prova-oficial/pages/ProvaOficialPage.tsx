import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProvaOficialAluno } from '../api';
import { DesempenhoPorArea } from '../components/DesempenhoPorArea';
import { TrajetoriaProva } from '../components/TrajetoriaProva';
import { ListaQuestoes } from '../components/ListaQuestoes';

const formatarData = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'dd/MM/yyyy');
  } catch {
    return '';
  }
};

const AVISO_GABARITO =
  'Correção pelo gabarito preliminar do INEP. Se o gabarito definitivo mudar alguma questão, atualizamos aqui.';

/**
 * Página dedicada da prova oficial (ENAMED) do aluno. O aluno nunca vê
 * TRI/proficiência/nota estimada aqui — só acertos, desempenho por área,
 * tendência e a revisão questão a questão no seu próprio caderno (spec D3/D4).
 */
const ProvaOficialPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useProvaOficialAluno(id);

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-muted-foreground">Não foi possível carregar o resultado da sua prova oficial.</p>
        <Button onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-lg font-semibold">Resultado ainda não disponível</p>
        <p className="text-sm text-muted-foreground">
          Assim que a correção da sua prova oficial for liberada, o resultado aparece aqui.
        </p>
        <Button asChild variant="outline">
          <Link to="/simulados">Voltar para Simulados</Link>
        </Button>
      </div>
    );
  }

  const linhaData = [formatarData(data.dataRealizacao), `Caderno ${data.caderno}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-8 pb-16">
      <header data-testid="prova-oficial-header" className="space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <GraduationCap className="h-3.5 w-3.5" />
          Prova oficial
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">{data.nome}</h1>
        {linhaData && <p className="text-sm text-muted-foreground">{linhaData}</p>}

        <div className="pt-2">
          <p className="text-3xl sm:text-4xl font-bold text-primary tabular-nums">
            Você acertou {data.acertos} de {data.totalValidas}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{data.emBranco} em branco</p>
        </div>
      </header>

      <DesempenhoPorArea areas={data.areas} />
      <TrajetoriaProva pontos={data.trajetoria} />
      <ListaQuestoes questoes={data.questoes} caderno={data.caderno} />

      <p className="text-xs text-muted-foreground border-t border-border/40 pt-4">{AVISO_GABARITO}</p>
    </div>
  );
};

export default ProvaOficialPage;
