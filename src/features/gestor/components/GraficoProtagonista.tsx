import * as React from 'react';
import { useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AreasChart } from '@/features/gestor/charts/AreasChart';
import { DispersaoChart } from '@/features/gestor/charts/DispersaoChart';
import { EvolucaoChart } from '@/features/gestor/charts/EvolucaoChart';
import type { ModoGrafico, VisaoGeral } from '@/features/gestor/api/types';

export interface GraficoProtagonistaProps {
  visao: VisaoGeral;
}

const MODOS: { valor: ModoGrafico; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'area', rotulo: 'Por grande área' },
  { valor: 'aluno', rotulo: 'Por aluno' },
];

const TITULOS: Record<ModoGrafico, string> = {
  geral: 'Evolução institucional',
  area: 'Evolução por grande área',
  aluno: 'Alunos por semestre',
};

/**
 * Gráfico protagonista da Visão Geral (spec §4.8) — 3 modos que leem as três
 * séries já carregadas juntas por `useVisaoGeral` (`evolucao`,
 * `evolucaoPorArea`, `dispersao`). Trocar de modo é trocar de LEITURA do
 * mesmo payload em memória, nunca um novo hook de dado: nenhum refetch
 * (§8.2, caso crítico nº15) — provado no teste com `supabase.rpc` espionado
 * através de um harness com o hook real.
 *
 * O controle vive DENTRO do card (22/07: "o filtro tem que estar no
 * gráfico, não na página"), com roving tabIndex igual a `FiltroSemestre`
 * (Fase 2): só o segmento ativo é alcançável por Tab; as setas movem seleção
 * e foco juntos.
 */
export function GraficoProtagonista({ visao }: GraficoProtagonistaProps) {
  const [modo, setModo] = React.useState<ModoGrafico>('geral');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceAtivo = MODOS.findIndex((opcao) => opcao.valor === modo);

  const selecionar = (indice: number) => {
    setModo(MODOS[indice].valor);
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLButtonElement>) => {
    const total = MODOS.length;
    let proximo: number | null = null;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      proximo = (indiceAtivo + 1) % total;
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      proximo = (indiceAtivo - 1 + total) % total;
    } else if (evento.key === 'Home') {
      proximo = 0;
    } else if (evento.key === 'End') {
      proximo = total - 1;
    }
    if (proximo === null) return;
    evento.preventDefault();
    selecionar(proximo);
    refs.current[proximo]?.focus();
  };

  return (
    <Card data-testid="grafico-protagonista">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <h2 className="text-sm font-semibold">{TITULOS[modo]}</h2>
        <div
          data-testid="grafico-modos"
          role="toolbar"
          aria-label="Modo do gráfico"
          aria-orientation="horizontal"
          className="flex items-center rounded-lg bg-muted/60 p-0.5"
        >
          {MODOS.map((opcao, indice) => {
            const ativo = indice === indiceAtivo;
            return (
              <button
                key={opcao.valor}
                ref={(elemento) => { refs.current[indice] = elemento; }}
                type="button"
                aria-pressed={ativo}
                tabIndex={ativo ? 0 : -1}
                onClick={() => selecionar(indice)}
                onKeyDown={aoTeclar}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ativo
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {modo === 'geral' ? <EvolucaoChart pontos={visao.evolucao} /> : null}
        {modo === 'area' ? <AreasChart areas={visao.evolucaoPorArea} /> : null}
        {modo === 'aluno' ? <DispersaoChart pontos={visao.dispersao} /> : null}
      </CardContent>
    </Card>
  );
}
