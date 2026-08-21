import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminTable, adminTableCellClass, adminTableHeadClass, MonoValue, StatusPill } from '@/experiences/admin/ui';
import { toBrazilDate } from '@/utils/timezone';
import type { FinalizacaoRow } from './liberacoes-types';

/** Máximo de saídas listadas no tooltip antes de resumir em "+N saídas". */
const MAX_SAIDAS_NO_TOOLTIP = 10;

export interface LiberacoesTableProps {
  rows: FinalizacaoRow[];
  toolbar?: React.ReactNode;
  onLiberar: (row: FinalizacaoRow) => void;
}

function formatTempo(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (horas === 0) return `${minutos}m`;
  return `${horas}h ${minutos}m`;
}

/** Duração de uma saída: "Xs" abaixo de 1min, "Xmin Ys" a partir daí. */
function formatDuracaoSaida(saiuEm: string, voltouEm: string | null): string {
  if (!voltouEm) return 'não retornou';
  const segundos = Math.max(0, Math.round((new Date(voltouEm).getTime() - new Date(saiuEm).getTime()) / 1000));
  if (segundos < 60) return `${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${minutos}min ${resto}s`;
}

/** Tabela de finalizações elegíveis para liberação — vocabulário AdminTable. */
export function LiberacoesTable({ rows, toolbar, onLiberar }: LiberacoesTableProps) {
  return (
    <AdminTable toolbar={toolbar}>
      <TableHeader>
        <TableRow>
          <TableHead className={adminTableHeadClass}>Aluno</TableHead>
          <TableHead className={adminTableHeadClass}>Simulado</TableHead>
          <TableHead className={adminTableHeadClass}>Tent.</TableHead>
          <TableHead className={adminTableHeadClass}>Finalizado</TableHead>
          <TableHead className={adminTableHeadClass}>Tempo</TableHead>
          <TableHead className={adminTableHeadClass}>Saídas</TableHead>
          <TableHead className={adminTableHeadClass}>Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const totalSaidas = row.saidas_de_aba + row.saidas_de_fullscreen;
          const saidasDetalhe = row.saidas_detalhe ?? [];
          const saidasPill = (
            <StatusPill variant={totalSaidas > 0 ? 'red' : 'muted'}>
              {row.saidas_de_aba} aba · {row.saidas_de_fullscreen} tela
            </StatusPill>
          );
          return (
            <TableRow key={row.id}>
              <TableCell className={adminTableCellClass}>
                <div className="space-y-0.5">
                  <p className="font-medium leading-tight">{row.user_nome ?? 'Nome não disponível'}</p>
                  <MonoValue muted className="text-xs">
                    {row.user_email ?? '—'}
                  </MonoValue>
                </div>
              </TableCell>
              <TableCell className={adminTableCellClass}>{row.simulado_nome ?? 'Simulado não encontrado'}</TableCell>
              <TableCell className={adminTableCellClass}>
                <MonoValue>#{row.tentativa_numero || 1}</MonoValue>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <MonoValue>{format(toBrazilDate(row.finalizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</MonoValue>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <MonoValue>{formatTempo(row.tempo_total_segundos)}</MonoValue>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <div className="space-y-1">
                  {saidasDetalhe.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default underline decoration-dotted decoration-muted-foreground">
                          {saidasPill}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <ul className="space-y-0.5 text-xs">
                          {saidasDetalhe.slice(0, MAX_SAIDAS_NO_TOOLTIP).map((saida, i) => (
                            <li key={i}>
                              {format(toBrazilDate(saida.saiu_em), 'HH:mm:ss', { locale: ptBR })} ·{' '}
                              {formatDuracaoSaida(saida.saiu_em, saida.voltou_em)}
                            </li>
                          ))}
                          {saidasDetalhe.length > MAX_SAIDAS_NO_TOOLTIP && (
                            <li className="text-muted-foreground">
                              +{saidasDetalhe.length - MAX_SAIDAS_NO_TOOLTIP} saídas
                            </li>
                          )}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    saidasPill
                  )}
                  {row.bloqueado_por_saidas && (
                    <div>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Bloqueado por saídas
                      </Badge>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                {row.liberado_novamente ? (
                  <div className="space-y-0.5">
                    <StatusPill variant="emerald">✓ Liberado</StatusPill>
                    {row.liberado_em && (
                      <p className="text-xs text-muted-foreground">
                        {format(toBrazilDate(row.liberado_em), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onLiberar(row)} className="gap-2">
                    <Unlock className="h-3.5 w-3.5" /> Liberar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </AdminTable>
  );
}
