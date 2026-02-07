import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Search, ChevronDown, ChevronUp, ExternalLink, 
  Clock, AlertTriangle, FileText, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SimuladoOverview } from '@/hooks/useSimuladosAnalytics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SimuladosTableProps {
  simulados: SimuladoOverview[];
  onSimuladoClick: (simulado: SimuladoOverview) => void;
  isLoading?: boolean;
}

type SortKey = 'nome' | 'taxa_conclusao' | 'acuracia_media' | 'iniciados_unicos' | 'tempo_mediano_segundos';
type SortOrder = 'asc' | 'desc';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ativo':
      return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0 text-xs">Ativo</Badge>;
    case 'encerrado':
      return <Badge variant="secondary" className="text-xs">Encerrado</Badge>;
    case 'aguardando':
      return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-0 text-xs">Aguardando</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
};

export const SimuladosTable: React.FC<SimuladosTableProps> = ({
  simulados,
  onSimuladoClick,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('iniciados_unicos');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredSimulados = simulados
    .filter(s => s.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Performance por Simulado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (simulados.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="font-semibold mb-2">Nenhum simulado encontrado</h3>
          <p className="text-sm text-muted-foreground">
            Configure simulados no painel administrativo para visualizar métricas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Performance por Simulado
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar simulado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center gap-1">
                    Simulado <SortIcon column="nome" />
                  </div>
                </TableHead>
                <TableHead className="text-center w-24">Status</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('iniciados_unicos')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Inícios <SortIcon column="iniciados_unicos" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('taxa_conclusao')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Conclusão <SortIcon column="taxa_conclusao" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort('acuracia_media')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Acurácia <SortIcon column="acuracia_media" />
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50 transition-colors hidden md:table-cell"
                  onClick={() => handleSort('tempo_mediano_segundos')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Tempo <SortIcon column="tempo_mediano_segundos" />
                  </div>
                </TableHead>
                <TableHead className="text-center hidden lg:table-cell">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 mx-auto">
                        Fricção <Info className="w-3 h-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Saídas de aba / fullscreen (média)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSimulados.map((sim) => {
                const hasFriction = sim.saidas_aba_media > 2 || sim.saidas_fullscreen_media > 1;
                
                return (
                  <TableRow 
                    key={sim.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onSimuladoClick(sim)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[200px]">{sim.nome}</span>
                        {sim.data_encerramento && (
                          <span className="text-xs text-muted-foreground">
                            até {format(new Date(sim.data_encerramento), "dd/MM", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(sim.status)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sim.iniciados_unicos}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={
                          sim.iniciados_unicos === 0 ? 'outline' :
                          sim.taxa_conclusao >= 75 ? 'default' :
                          sim.taxa_conclusao >= 50 ? 'secondary' : 'destructive'
                        }
                        className="font-mono"
                      >
                        {sim.iniciados_unicos === 0 ? '—' : `${sim.taxa_conclusao}%`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant={
                          sim.acuracia_media >= 70 ? 'default' :
                          sim.acuracia_media >= 50 ? 'secondary' : 'destructive'
                        }
                        className="font-mono"
                      >
                        {sim.acuracia_media}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      <div className="flex items-center justify-end gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-sm">
                          {sim.tempo_mediano_segundos > 0 
                            ? formatDuration(sim.tempo_mediano_segundos)
                            : '—'
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      <div className={cn(
                        "flex items-center justify-center gap-1 text-sm",
                        hasFriction && "text-yellow-600"
                      )}>
                        {hasFriction && <AlertTriangle className="w-3 h-3" />}
                        <span className="font-mono text-xs">
                          {sim.saidas_aba_media.toFixed(1)}/{sim.saidas_fullscreen_media.toFixed(1)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
