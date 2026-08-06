import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/features/gestor/components/Icon';
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
 *
 * Exportado desde o passe de conformidade: `KpisDetalhamento` mostrava o mesmo
 * instante com `formatData` e reproduzia exatamente o bug acima.
 */
export function formatDataHora(iso: string): string {
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
 * O gatilho é um `<button>`, não o `<i>` puro da referência: `<i>` não é
 * alcançável por teclado, e a §11 exige que o mesmo conteúdo abra no FOCO,
 * não só no hover. O Radix já fecha com ESC.
 *
 * O mesmo texto some duplicado num `<span>` `sr-only` (`data-testid`
 * `rastreabilidade-texto`) para leitores de tela e para asserção em teste sem
 * depender de hover/focus no tooltip.
 */
export const TooltipRastreabilidade: React.FC<{
  meta: Meta;
  criterio?: string;
  /** Nome do indicador — primeira linha do tooltip, antes da grade de 4 campos. */
  titulo?: string;
  /**
   * Aresta do glifo `info`. A referência usa três tamanhos por contexto: 14px
   * no cabeçalho de KPI, 15px no cabeçalho de gráfico, 13px na linha de
   * proveniência do rodapé.
   */
  tamanho?: number;
  className?: string;
  children?: React.ReactNode;
}> = ({ meta, criterio, titulo, tamanho = 14, className, children }) => {
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
    ...(titulo ? [titulo] : []),
    `Período: ${meta.periodo}`,
    `Fonte: ${meta.fonte}`,
    `Atualizado em: ${formatDataHora(meta.atualizadoEm)}`,
    `Critério: ${criterio ?? meta.criterio}`,
    ...(cobertura ? [`Cobertura: ${cobertura}`] : []),
  ];

  return (
    <span className={cn('inline-flex items-center', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children ?? (
            <button
              type="button"
              aria-label="Rastreabilidade do indicador"
              className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ color: 'var(--gp-border-strong)' }}
            >
              <Icon name="info" variant="outlined" size={tamanho} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          className="max-w-xs"
          style={{
            borderRadius: 'var(--gp-radius-md)',
            padding: 16,
            /*
             * Item A6 — superfície escura nos dois temas (referência
             * LIGHT.html, bloco "Tooltip do 'i' · rastreabilidade"). O
             * primitivo (`src/components/ui/tooltip.tsx`) traz
             * `bg-popover text-popover-foreground border` por CLASSE
             * utilitária, sem `!important`; `style` inline sempre vence
             * classe utilitária na cascata (mesma origem, especificidade de
             * atributo > classe), então background/color abaixo bastam para
             * substituir o par claro/branco herdado.
             */
            background: 'var(--gp-tooltip-surface)',
            color: 'var(--gp-tooltip-value)',
            boxShadow: 'var(--gp-tooltip-shadow)',
          }}
        >
          {titulo ? (
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{titulo}</div>
          ) : null}
          <dl
            className="grid grid-cols-[auto_1fr]"
            style={{ gap: '6px 14px', fontSize: 11, lineHeight: '16px' }}
          >
            <dt className="font-medium" style={{ color: 'var(--gp-tooltip-label)' }}>Período</dt>
            <dd>{meta.periodo}</dd>
            <dt className="font-medium" style={{ color: 'var(--gp-tooltip-label)' }}>Fonte</dt>
            <dd>{meta.fonte}</dd>
            <dt className="font-medium" style={{ color: 'var(--gp-tooltip-label)' }}>Atualizado em</dt>
            <dd>{formatDataHora(meta.atualizadoEm)}</dd>
            <dt className="font-medium" style={{ color: 'var(--gp-tooltip-label)' }}>Critério</dt>
            <dd>{criterio ?? meta.criterio}</dd>
            {cobertura ? (
              <>
                <dt className="font-medium" style={{ color: 'var(--gp-tooltip-label)' }}>Cobertura</dt>
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
