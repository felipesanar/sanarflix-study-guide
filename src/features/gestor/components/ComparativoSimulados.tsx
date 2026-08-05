import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { calcularVariacao } from '../lib/regras';
import { formatConceito, formatData, formatDelta, formatNumero, formatPct } from '../lib/formatters';
import type { Detalhamento, MetricasSimulado } from '../api/types';

export interface ComparativoSimuladosProps {
  metricas: MetricasSimulado[];
  comparativoTemas?: Detalhamento['comparativoTemas'];
}

export function ComparativoSimulados({ metricas, comparativoTemas }: ComparativoSimuladosProps) {
  const [aberto, setAberto] = React.useState(false);

  // §4.7.4: comparativo existe só a partir de 2 simulados.
  if (metricas.length < 2) return null;

  const indiceAtual = metricas.length - 1;

  return (
    <section aria-labelledby="comparativo-titulo" className="space-y-3">
      <h3 id="comparativo-titulo" className="text-base font-semibold text-foreground">
        Comparativo entre simulados
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metricas.map((m, i) => {
          const anterior = i > 0 ? metricas[i - 1] : null;
          const ehAtual = i === indiceAtual;
          return (
            <Card
              key={m.simuladoId}
              data-testid={`card-simulado-${m.simuladoId}`}
              data-atual={String(ehAtual)}
              className={cn(ehAtual && 'ring-2 ring-primary')}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatData(m.data)}</p>
                  </div>
                  {ehAtual && <Badge>atual</Badge>}
                </div>

                <dl className="space-y-1 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Percentual de acerto</dt>
                    <dd className="flex items-baseline gap-2 tabular-nums">
                      <span data-testid="card-acerto" className="font-semibold text-foreground">
                        {formatPct(m.acertoMedioPct)}
                      </span>
                      <span data-testid="card-delta-acerto" className="text-xs text-muted-foreground">
                        {formatDelta(calcularVariacao(anterior?.acertoMedioPct ?? null, m.acertoMedioPct))}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Conceito ENAMED</dt>
                    <dd data-testid="card-enamed" className="font-semibold tabular-nums text-foreground">
                      {formatConceito(m.enamedProjetado)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Proficiência média</dt>
                    <dd className="flex items-baseline gap-2 tabular-nums">
                      <span data-testid="card-proficiencia" className="font-semibold text-foreground">
                        {formatNumero(m.proficienciaMedia)}
                      </span>
                      <span data-testid="card-delta-proficiencia" className="text-xs text-muted-foreground">
                        {formatDelta(calcularVariacao(anterior?.proficienciaMedia ?? null, m.proficienciaMedia))}
                      </span>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger className="inline-flex items-center gap-1 text-sm underline">
          {aberto ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          Ver comparativo completo
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {comparativoTemas && comparativoTemas.length > 0 ? (
            <div className="rounded-lg border border-border">
              <Table data-testid="comparativo-temas">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tema</TableHead>
                    {metricas.map((m) => (
                      <TableHead key={m.simuladoId} className="text-right">
                        {m.nome}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativoTemas.map((linha) => (
                    <TableRow key={linha.tema}>
                      <TableCell>{linha.tema}</TableCell>
                      {metricas.map((m) => {
                        const ponto = linha.porSimulado.find((p) => p.simuladoId === m.simuladoId);
                        return (
                          <TableCell
                            key={m.simuladoId}
                            data-testid={`tema-${m.simuladoId}`}
                            className="text-right tabular-nums"
                          >
                            {formatPct(ponto?.acertoPct ?? null)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p data-testid="comparativo-temas-vazio" className="text-sm text-muted-foreground">
              Sem tema comparável entre estes simulados
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
