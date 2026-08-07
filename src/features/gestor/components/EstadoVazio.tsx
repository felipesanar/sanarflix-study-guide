import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName, DendeIconVariant } from '@/features/gestor/components/icon-names';

/** A única saída oferecida pelo vazio — o handoff §7 limita a "no máximo 1 ação". */
export interface AcaoEstadoVazio {
  rotulo: string;
  onClick: () => void;
}

interface EstadoVazioProps {
  titulo: string;
  descricao?: string;
  /**
   * Glifo do tile. A referência NÃO tem um ícone genérico de vazio: cada vazio
   * mostra o glifo do que está faltando — `calendar_month` (sem simulado no
   * período), `insights` (módulo não contratado / sem seleção), `schedule`
   * (gabarito em processamento). Por isso o glifo é do chamador, não daqui.
   *
   * O default é `insights` porque é o glifo que a referência repete nos vazios
   * sem causa datada, e porque o Lucide `Inbox` que este componente usava não
   * tem equivalente no Fontello do Dendê — não havia como portar o genérico.
   */
  glifo?: DendeIconName;
  glifoVariante?: DendeIconVariant;
  acao?: AcaoEstadoVazio;
  altura?: number | string;
  /**
   * Versão de UMA LINHA, sem o tile do glifo e sem centralização — para vazio
   * que mora DENTRO de um card pequeno, ao lado de irmãos cheios.
   *
   * A anatomia completa (tile de 36px + título + apoio, tudo centrado com
   * 24px de respiro) é a de um vazio que ocupa o bloco inteiro. Nos três
   * cards do Diagnóstico Curricular ela era o que fazia a linha inteira
   * crescer: dois cards com "nenhuma área…" esticavam a altura de todos os
   * três, porque num grid os irmãos acompanham o mais alto. O vazio ali não
   * é o assunto do card — é a resposta curta a uma pergunta que o gestor fez
   * de passagem.
   */
  compacto?: boolean;
  className?: string;
}

/**
 * Bloco sem dado. Nunca preenche lacuna com zero, média ou estimativa
 * (spec §4.10) — diz que não há dado e para de falar.
 *
 * Anatomia da referência (§9 "Estados de dados"): tile de 36px com o glifo
 * Dendê a 18px, título, UMA linha de apoio e no máximo uma ação de saída.
 */
export const EstadoVazio: React.FC<EstadoVazioProps> = ({
  titulo,
  descricao,
  glifo = 'insights',
  glifoVariante = 'outlined',
  acao,
  altura,
  compacto = false,
  className,
}) => (
  <div
    style={altura ? { minHeight: typeof altura === 'number' ? `${altura}px` : altura } : undefined}
    className={cn(
      'flex w-full flex-col rounded-xl border border-dashed border-border',
      compacto
        ? 'items-start gap-1 px-3 py-2.5 text-left'
        : 'items-center justify-center gap-2 p-6 text-center',
      className,
    )}
  >
    {compacto ? null : (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--gp-radius-sm)',
          background: 'var(--gp-surface-3)',
          color: 'var(--gp-text-3)',
        }}
      >
        <Icon name={glifo} variant={glifoVariante} size={18} />
      </span>
    )}
    <p className={cn('font-medium text-foreground', compacto ? 'text-xs' : 'text-sm')}>{titulo}</p>
    {descricao && (
      <p className={cn('text-xs text-muted-foreground', compacto ? undefined : 'max-w-sm')}>{descricao}</p>
    )}
    {acao && (
      <Button
        variant="outline"
        size="sm"
        className="mt-1 h-auto rounded-sm px-3 py-1.5 text-[11px] font-semibold"
        onClick={acao.onClick}
      >
        {acao.rotulo}
      </Button>
    )}
  </div>
);
