import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';

/**
 * Superfície do tooltip do portal — escura NOS DOIS TEMAS, por decisão de
 * design (referência LIGHT.html, bloco "Tooltip do 'i'"). Os mesmos quatro
 * tokens que `TooltipRastreabilidade` aplica; exportados aqui porque o
 * tooltip do gráfico (`EvolucaoChart`) não é um Radix e precisa da MESMA
 * superfície sem herdar a geometria de um popover.
 *
 * `borderColor` é obrigatório: o primitivo (`src/components/ui/tooltip.tsx`)
 * traz a classe `border` sem cor, que resolve para `hsl(var(--border))` — um
 * anel cinza-claro contra a superfície escura no tema claro.
 */
export const SUPERFICIE_TOOLTIP: React.CSSProperties = {
  background: 'var(--gp-tooltip-surface)',
  color: 'var(--gp-tooltip-value)',
  boxShadow: 'var(--gp-tooltip-shadow)',
  borderColor: 'var(--gp-tooltip-surface)',
};

export interface DicaProps {
  /** Texto de ajuda. Frase inteira, em linguagem de gestor — não legenda telegráfica. */
  texto: string;
  /** Nome acessível do gatilho ("Como ler …"), já que o glifo sozinho não diz nada. */
  rotulo: string;
  /** Aresta do glifo `info` (14px em cabeçalho de KPI/bloco, 15px em gráfico). */
  tamanho?: number;
  /** `data-testid` do espelho `sr-only`, para asserção sem simular hover. */
  testId?: string;
  className?: string;
}

/**
 * Ajuda pontual de um rótulo: o "i" que abre uma frase explicativa.
 *
 * Existe para tirar da tela a nota que só importa na primeira leitura. O
 * exemplo que motivou o componente é a régua do Panorama: a explicação
 * ("compara 1º simulado · anterior · atual…") ocupava uma linha inteira ao
 * lado do overline, em toda visita, para uma informação que a gestora lê uma
 * vez e nunca mais. No tooltip ela continua a um gesto de distância.
 *
 * O gatilho é `<button>`, não o `<i>` da referência: `<i>` não é alcançável
 * por teclado, e a §11 exige o mesmo conteúdo no FOCO, não só no hover. O
 * texto também sai duplicado num `sr-only` — leitor de tela não precisa
 * "passar o mouse", e o teste não precisa simular hover.
 */
export const Dica: React.FC<DicaProps> = ({ texto, rotulo, tamanho = 14, testId, className }) => (
  <span className={cn('inline-flex items-center', className)}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ color: 'var(--gp-border-strong)' }}
        >
          <Icon name="info" variant="outlined" size={tamanho} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs"
        style={{
          ...SUPERFICIE_TOOLTIP,
          borderRadius: 'var(--gp-radius-md)',
          padding: 14,
          fontSize: 12,
          lineHeight: '17px',
          fontWeight: 400,
        }}
      >
        {texto}
      </TooltipContent>
    </Tooltip>
    <span className="sr-only" data-testid={testId}>
      {texto}
    </span>
  </span>
);
