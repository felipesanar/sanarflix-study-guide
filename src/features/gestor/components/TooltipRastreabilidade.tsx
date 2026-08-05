import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TRACO } from '@/features/gestor/lib/formatters';
import type { Meta } from '@/features/gestor/api/types';

/**
 * `meta.atualizadoEm` é um INSTANTE (timestamptz UTC — as RPCs emitem
 * `to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`), não uma
 * data-calendário de cronograma. `formatData` (lib/formatters.ts) é exclusiva
 * desta última: lê os dígitos do ISO por regex, sem instanciar `Date`, DE
 * PROPÓSITO, para não reinterpretar fuso em datas de simulado. Aplicado a um
 * instante, isso mostra a data-calendário em UTC — depois das ~21h em
 * Brasília (UTC-3) já é o dia seguinte em UTC, uma data no futuro para o
 * gestor. Por isso este componente tem seu próprio formatador, que instancia
 * `Date` e converte explicitamente para America/Sao_Paulo (achado da revisão
 * de 05/08). Também mostra a hora: a pergunta do gestor é "quão fresco é este
 * número".
 */
function formatDataHora(iso: string): string {
  if (!iso) return TRACO;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return TRACO;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

/**
 * Rastreabilidade de um indicador: Período · Fonte · Atualizado em · Critério
 * (spec §4.1). O texto do critério vem do servidor (`meta.criterio`) por padrão,
 * mas cada consumidor pode sobrescrever com um `criterio` mais específico
 * (ex.: o critério de um KPI que não é o critério geral do bloco).
 *
 * O mesmo texto some duplicado num `<span>` `sr-only` (`data-testid`
 * `rastreabilidade-texto`) para leitores de tela e para asserção em teste sem
 * depender de hover/focus no tooltip.
 */
export const TooltipRastreabilidade: React.FC<{
  meta: Meta;
  criterio?: string;
  children?: React.ReactNode;
}> = ({ meta, criterio, children }) => {
  /**
   * `meta.lowSample` faz parte da resposta à pergunta "de onde vem este
   * número": um indicador calculado sobre amostra pequena não tem a mesma
   * procedência de um calculado sobre a turma inteira. `KpiCard` já mostra o
   * selo visível "cobertura parcial", mas `ContextoDoRecorte` — o outro
   * consumidor deste tooltip — não tinha nenhum canal para esse aviso, e
   * afirmava Período/Fonte/Critério como se a cobertura fosse completa.
   *
   * Sem número de `n`: `Meta` (api/types.ts) não carrega o tamanho da amostra,
   * e inventar um aqui seria pior que omitir. Acrescentar `n` ao envelope exige
   * mudar `get_gestor_visao_geral` — pendência de contrato, não deste arquivo.
   */
  const cobertura = meta.lowSample ? 'parcial (amostra pequena)' : null;

  const linhas = [
    `Período: ${meta.periodo}`,
    `Fonte: ${meta.fonte}`,
    `Atualizado em: ${formatDataHora(meta.atualizadoEm)}`,
    `Critério: ${criterio ?? meta.criterio}`,
    ...(cobertura ? [`Cobertura: ${cobertura}`] : []),
  ];

  return (
    <span className="inline-flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          {children ?? (
            <button
              type="button"
              aria-label="Rastreabilidade do indicador"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt className="font-medium text-muted-foreground">Período</dt>
            <dd>{meta.periodo}</dd>
            <dt className="font-medium text-muted-foreground">Fonte</dt>
            <dd>{meta.fonte}</dd>
            <dt className="font-medium text-muted-foreground">Atualizado em</dt>
            <dd>{formatDataHora(meta.atualizadoEm)}</dd>
            <dt className="font-medium text-muted-foreground">Critério</dt>
            <dd>{criterio ?? meta.criterio}</dd>
            {cobertura ? (
              <>
                <dt className="font-medium text-muted-foreground">Cobertura</dt>
                <dd data-testid="rastreabilidade-cobertura">{cobertura}</dd>
              </>
            ) : null}
          </dl>
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" data-testid="rastreabilidade-texto">
        {linhas.join(' · ')}
      </span>
    </span>
  );
};
