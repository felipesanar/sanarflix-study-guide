import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProvasOficiaisAluno } from '../api';
import type { ProvaOficialResumo } from '../types';

const formatarData = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
};

const CardProvaOficialItem = ({ resumo }: { resumo: ProvaOficialResumo }) => {
  const dataFormatada = formatarData(resumo.dataRealizacao);
  const linhaData = [dataFormatada, resumo.caderno ? `Caderno ${resumo.caderno}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card
      className={cn(
        'border-2 border-primary/30 bg-primary/[0.03] group hover:shadow-lg transition-all duration-300',
      )}
    >
      <CardContent className="p-4 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
            <GraduationCap className="h-3.5 w-3.5" />
            Prova oficial
          </span>
          <h3 className="text-base sm:text-lg font-bold leading-tight break-words">{resumo.nome}</h3>
          {linhaData && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{linhaData}</p>}
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center shrink-0">
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-primary">
              {resumo.acertos} de {resumo.totalValidas}
            </p>
            <p className="text-xs text-muted-foreground">acertos</p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to={`/simulados/${resumo.simuladoId}/prova-oficial`}>Ver meu resultado</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Cards de destaque para provas oficiais (ENAMED) do aluno, exibidos acima
 * das abas de /simulados. Não renderiza nada enquanto carrega, em erro ou
 * quando o aluno não tem prova oficial nenhuma — não há estado vazio a
 * mostrar aqui (spec D3: card só aparece quando existe prova).
 */
export const CardsProvaOficial = () => {
  const { data, isLoading, isError } = useProvasOficiaisAluno();

  if (isLoading || isError || !data || data.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {data.map((resumo) => (
        <CardProvaOficialItem key={resumo.simuladoId} resumo={resumo} />
      ))}
    </div>
  );
};
