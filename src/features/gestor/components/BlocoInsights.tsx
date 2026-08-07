import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/features/gestor/components/Icon';
import type { VisaoGeral } from '@/features/gestor/api/types';

/**
 * A referência não rotula o insight por escopo antes do texto: ela põe a
 * PROCEDÊNCIA embaixo ("fonte: … · Diagnóstico Curricular"), depois de um
 * divisor. O escopo do dado é o bloco de onde ele saiu — por isso o rótulo é o
 * nome do bloco, não a categoria abstrata.
 */
const FONTE_ESCOPO: Record<VisaoGeral['insights'][number]['escopo'], string> = {
  area: 'Diagnóstico Curricular',
  aluno: 'Visão de Alunos',
};

/**
 * 2 insights autogerados da Visão Geral (spec §4.8): um por área, um por
 * aluno — leitura curta, sem linguagem nominal de aluno (o texto já vem
 * agregado do servidor). Nenhum corte de nota é decidido aqui.
 */
export function BlocoInsights({ insights }: { insights: VisaoGeral['insights'] }) {
  return (
    <section data-testid="bloco-insights" aria-labelledby="titulo-insights" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* O glifo herda `currentColor`; a cor vem do token, nunca de `--primary`
            cru — no escuro a marca reprova AA como cor de traço fino. */}
        <span className="inline-flex" style={{ color: 'var(--gp-brand-on-dark)' }}>
          <Icon name="insights" variant="filled" size={18} />
        </span>
        <h2 id="titulo-insights" style={{ fontSize: 16, fontWeight: 700 }}>
          Insights Pedagógicos
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          agregado do período · sem simulado específico
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem insights para este recorte.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {insights.map((insight) => (
            <li key={`${insight.escopo}-${insight.texto}`}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <p style={{ fontSize: 13, lineHeight: '20px' }}>{insight.texto}</p>
                  <p className="mt-auto border-t border-border pt-2 text-[11px] text-muted-foreground">
                    fonte: {FONTE_ESCOPO[insight.escopo]}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
