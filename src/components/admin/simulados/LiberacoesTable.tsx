import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminTable, adminTableCellClass, adminTableHeadClass, MonoValue, StatusPill } from '@/experiences/admin/ui';
import { toBrazilDate } from '@/utils/timezone';
import type { FinalizacaoRow } from './liberacoes-types';

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
                <StatusPill variant={totalSaidas > 0 ? 'red' : 'muted'}>
                  {row.saidas_de_aba} aba · {row.saidas_de_fullscreen} tela
                </StatusPill>
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
