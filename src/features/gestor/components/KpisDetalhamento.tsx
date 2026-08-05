import { Card, CardContent } from '@/components/ui/card';
import { mediaPonderadaPorParticipantes } from '../lib/agregarDetalhamento';
import { formatConceito, formatData, formatNumero, formatPct } from '../lib/formatters';
import type { Meta, MetricasSimulado } from '../api/types';

export interface KpisDetalhamentoProps {
  metricas: MetricasSimulado[];
  meta: Meta;
}

function CartaoKpi({
  testId,
  rotulo,
  base,
  children,
}: {
  testId: string;
  rotulo: string;
  base: string;
  children: React.ReactNode;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="space-y-1 p-4">
        <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
        {children}
        <p className="text-xs text-muted-foreground">{base}</p>
      </CardContent>
    </Card>
  );
}

function Valor({ children }: { children: React.ReactNode }) {
  return (
    <p data-testid="kpi-valor" className="text-3xl font-semibold tabular-nums text-foreground">
      {children}
    </p>
  );
}

export function KpisDetalhamento({ metricas, meta }: KpisDetalhamentoProps) {
  const multiSimulado = metricas.length > 1;
  const base = `${metricas.length} ${metricas.length === 1 ? 'simulado' : 'simulados'}`;

  const acertoMedio = mediaPonderadaPorParticipantes(
    metricas.map((m) => ({ valor: m.acertoMedioPct, participantes: m.participantes })),
  );
  const proficienciaMedia = mediaPonderadaPorParticipantes(
    metricas.map((m) => ({ valor: m.proficienciaMedia, participantes: m.participantes })),
  );

  return (
    <section aria-label="Indicadores do recorte" className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CartaoKpi testId="kpi-acerto-medio" rotulo="Percentual de acerto médio" base={base}>
          <Valor>{formatPct(acertoMedio)}</Valor>
        </CartaoKpi>

        {/* §4.1: Conceito ENAMED não tem média. Com 2+ simulados é comparativo lado a lado. */}
        <CartaoKpi
          testId="kpi-enamed"
          rotulo="Conceito ENAMED (projetado)"
          base={multiSimulado ? 'comparativo por simulado — sem média' : base}
        >
          {multiSimulado ? (
            <ul className="flex flex-wrap gap-2">
              {metricas.map((m) => (
                <li
                  key={m.simuladoId}
                  data-testid={`enamed-${m.simuladoId}`}
                  className="rounded-md bg-muted px-2 py-1 text-sm tabular-nums"
                >
                  <span className="text-muted-foreground">{m.nome}: </span>
                  <span className="font-semibold text-foreground">{formatConceito(m.enamedProjetado)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Valor>{formatConceito(metricas[0]?.enamedProjetado ?? null)}</Valor>
          )}
        </CartaoKpi>

        <CartaoKpi testId="kpi-proficiencia-media" rotulo="Proficiência média" base={base}>
          <Valor>
            {proficienciaMedia === null ? formatNumero(null) : formatNumero(Math.round(proficienciaMedia * 10) / 10)}
          </Valor>
        </CartaoKpi>
      </div>

      <p data-testid="kpis-rastreabilidade" className="text-xs text-muted-foreground">
        {meta.periodo} · {meta.fonte} · Atualizado em {formatData(meta.atualizadoEm)} · {meta.criterio}
      </p>
    </section>
  );
}
