import { KpiCard } from '@/features/gestor/components/KpiCard';
import { mediaPonderadaPorParticipantes } from '../lib/agregarDetalhamento';
import { formatConceito, formatNumero, formatPct } from '../lib/formatters';
import { PROFICIENCIA_MINIMA } from '../lib/regras';
import type { Meta, MetricasSimulado } from '../api/types';

export interface KpisDetalhamentoProps {
  metricas: MetricasSimulado[];
  meta: Meta;
}

const CRITERIO_ACERTO =
  'Média dos índices de acerto dos simulados do recorte, ponderada pelo número de participantes de cada um.';
const CRITERIO_ENAMED =
  'Conceito projetado por simulado, escala 1 a 5. Não existe média de conceito: com 2+ simulados o cartão compara simulado a simulado.';
const CRITERIO_PROFICIENCIA =
  'Média das proficiências (escala 0 a 100) dos participantes, ponderada pelo número de participantes de cada simulado.';

/**
 * Os 3 indicadores do Detalhamento. Usam o MESMO `KpiCard` da Visão Geral —
 * até o passe de conformidade havia um cartão local aqui, sem tooltip de
 * rastreabilidade e com tipografia própria, e a procedência dos três números
 * aparecia uma única vez, achatada num parágrafo sob a grade. Agora cada
 * cartão carrega o seu próprio `info` (§4.1: rastreabilidade é POR
 * indicador), o que também corrige o "Atualizado em": o parágrafo usava
 * `formatData`, que lê a data-calendário em UTC e, depois das ~21h em
 * Brasília, mostrava o dia seguinte.
 *
 * Nenhum dos três tem régua nem delta: a evolução no Detalhamento é o
 * comparativo entre simulados selecionados, não uma linha do tempo do
 * contrato.
 */
export function KpisDetalhamento({ metricas, meta }: KpisDetalhamentoProps) {
  const multiSimulado = metricas.length > 1;
  const base = `${metricas.length} ${metricas.length === 1 ? 'simulado' : 'simulados'}`;

  const acertoMedio = mediaPonderadaPorParticipantes(
    metricas.map((m) => ({ valor: m.acertoMedioPct, participantes: m.participantes })),
  );
  const proficienciaMedia = mediaPonderadaPorParticipantes(
    metricas.map((m) => ({ valor: m.proficienciaMedia, participantes: m.participantes })),
  );

  /**
   * Rodapé do acerto médio: base de PARTICIPAÇÃO, não contagem de simulados.
   * A referência escreve "98 participantes de 104 elegíveis" — o rodapé responde
   * "sobre quem esta média foi calculada". O denominador (`elegíveis`) ainda não
   * existe no envelope (`MetricasSimulado` só traz `participantes`), então o
   * cartão afirma apenas o numerador em vez de inventar a turma inteira.
   *
   * Com 2+ simulados a soma é de PARTICIPAÇÕES, não de alunos distintos: o mesmo
   * aluno participa de vários simulados e chamar isso de "participantes" inflaria
   * a turma. É exatamente o peso que `mediaPonderadaPorParticipantes` usa como
   * denominador — o rodapé descreve a conta que o número acima dele representa.
   */
  const participacoes = metricas.reduce((soma, m) => soma + m.participantes, 0);
  const baseAcerto = multiSimulado
    ? `${base} · ${formatNumero(participacoes)} participações`
    : `${formatNumero(participacoes)} ${participacoes === 1 ? 'participante' : 'participantes'}`;

  /**
   * Proficiência: o rodapé situa a média contra a régua única (`lib/regras.ts`),
   * como na referência — nunca um `60` datilografado na copy. Sem valor medido
   * não há "acima" nem "abaixo" de nada (§4.10), e o cartão volta a dizer só a
   * base do recorte.
   */
  const rodapeProficiencia =
    proficienciaMedia === null
      ? base
      : `${proficienciaMedia >= PROFICIENCIA_MINIMA ? 'acima' : 'abaixo'} da meta de proficiência (${PROFICIENCIA_MINIMA})`;

  return (
    <section aria-label="Indicadores do recorte" className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          testId="kpi-acerto-medio"
          titulo="Percentual de acerto médio"
          hint="questões certas nos simulados do recorte"
          valor={formatPct(acertoMedio)}
          meta={meta}
          criterio={CRITERIO_ACERTO}
          rodape={baseAcerto}
        />

        {/* §4.1: Conceito ENAMED não tem média. Com 2+ simulados é comparativo lado a lado. */}
        <KpiCard
          testId="kpi-enamed"
          titulo="Conceito ENAMED"
          badge="projetado"
          hint="projeção por simulado · escala 1 a 5"
          /* Escala colada ao número ("3/5"), não em `sufixo`: aqui o valor é o
             mesmo texto que o comparativo mostra por simulado, e separá-lo faria
             os dois modos do cartão falarem escalas diferentes. */
          valor={formatConceito(metricas[0]?.enamedProjetado ?? null)}
          meta={meta}
          criterio={CRITERIO_ENAMED}
          corpo={
            multiSimulado ? (
              <ul className="flex flex-wrap gap-2">
                {metricas.map((m) => (
                  <li
                    key={m.simuladoId}
                    data-testid={`enamed-${m.simuladoId}`}
                    className="tabular-nums"
                    style={{
                      fontSize: 13,
                      padding: '4px 10px',
                      borderRadius: 'var(--gp-radius-pill)',
                      background: 'var(--gp-surface-3)',
                    }}
                  >
                    <span style={{ color: 'var(--gp-text-3)' }}>{m.nome}: </span>
                    <span style={{ fontWeight: 700, color: 'var(--gp-text-1)' }}>
                      {formatConceito(m.enamedProjetado)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : undefined
          }
          /* Mesmo com 1 simulado o rodapé enuncia a REGRA, como na referência:
             é onde a gestora aprende que o conceito nunca vira média — antes de
             selecionar o segundo simulado e ver o cartão mudar de forma. */
          rodape={
            multiSimulado
              ? 'comparativo por simulado — sem média'
              : 'sem média — com 2+ simulados, comparativo entre simulados'
          }
        />

        <KpiCard
          testId="kpi-proficiencia-media"
          titulo="Proficiência média"
          hint="média das proficiências dos participantes"
          valor={
            proficienciaMedia === null
              ? formatNumero(null)
              : formatNumero(Math.round(proficienciaMedia * 10) / 10)
          }
          /* Sem escala quando não há número: "— / 100" afirmaria uma medição
             que não existe (§4.10). */
          sufixo={proficienciaMedia === null ? undefined : '/ 100'}
          meta={meta}
          criterio={CRITERIO_PROFICIENCIA}
          rodape={rodapeProficiencia}
        />
      </div>
    </section>
  );
}
