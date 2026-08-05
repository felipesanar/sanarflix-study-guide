import { DispersaoChart } from '../charts/DispersaoChart';
import { EvolucaoChart } from '../charts/EvolucaoChart';
import type { FiltroSemestre, MetricasSimulado } from '../api/types';

/** '6ano' e 'geral' são agregadores; o resto é um semestre único (§4.5). */
export function ehSemestreEspecifico(semestre: FiltroSemestre): boolean {
  return semestre !== '6ano' && semestre !== 'geral';
}

export interface EvolucaoRecorteProps {
  metricas: MetricasSimulado[];
  semestre: FiltroSemestre;
  dispersao: { alunoId: string; semestre: number; nota: number }[];
}

/**
 * Com um semestre específico, "evolução entre simulados" perde o eixo de
 * comparação (só resta um recorte) e vira distribuição daquele semestre —
 * mesma virada de §4.5 usada no gráfico protagonista da Visão Geral.
 *
 * `EvolucaoChart` e `DispersaoChart` (Fase 4) já trazem sozinhos alternativa
 * tabular, `role="img"` acessível e estado vazio — nada disso é reimplementado
 * aqui, só a decisão de qual dos dois mostrar e o formato dos dados.
 */
export function EvolucaoRecorte({ metricas, semestre, dispersao }: EvolucaoRecorteProps) {
  if (ehSemestreEspecifico(semestre)) {
    const alvo = Number(semestre);
    const pontos = dispersao.filter((p) => p.semestre === alvo);

    return (
      <section aria-labelledby="evolucao-recorte-titulo" className="rounded-lg border border-border bg-card p-4">
        <h3 id="evolucao-recorte-titulo" className="mb-2 text-base font-semibold text-foreground">
          Distribuição do {alvo}º semestre
        </h3>
        <DispersaoChart pontos={pontos} />
      </section>
    );
  }

  return (
    <section aria-labelledby="evolucao-recorte-titulo" className="rounded-lg border border-border bg-card p-4">
      <h3 id="evolucao-recorte-titulo" className="mb-2 text-base font-semibold text-foreground">
        Evolução do recorte
      </h3>
      <EvolucaoChart
        pontos={metricas.map((m) => ({
          simuladoId: m.simuladoId,
          nome: m.nome,
          data: m.data,
          valor: m.proficienciaMedia,
          participantes: m.participantes,
        }))}
      />
    </section>
  );
}
