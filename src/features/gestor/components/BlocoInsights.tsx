import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { VisaoGeral } from '@/features/gestor/api/types';

const ROTULO_ESCOPO: Record<VisaoGeral['insights'][number]['escopo'], string> = {
  area: 'Por grande área',
  aluno: 'Por aluno',
};

/**
 * 2 insights autogerados da Visão Geral (spec §4.8): um por área, um por
 * aluno — leitura curta, sem linguagem nominal de aluno (o texto já vem
 * agregado do servidor). Nenhum corte de nota é decidido aqui.
 */
export function BlocoInsights({ insights }: { insights: VisaoGeral['insights'] }) {
  return (
    <section data-testid="bloco-insights" aria-labelledby="titulo-insights" className="space-y-3">
      <h2 id="titulo-insights" className="text-sm font-semibold">
        Insights
      </h2>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem insights para este recorte.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {insights.map((insight) => (
            <li key={`${insight.escopo}-${insight.texto}`}>
              <Card className="h-full">
                <CardContent className="space-y-1 p-4">
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    {ROTULO_ESCOPO[insight.escopo]}
                  </span>
                  <p className="text-sm">{insight.texto}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
