import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

/** Estilo do gatilho de filtro do portal — o mesmo do "Por semestre" (FiltroSemestre). */
export const ESTILO_GATILHO_FILTRO: React.CSSProperties = {
  background: 'var(--gp-surface-1)',
  border: '1px solid var(--gp-border-input)',
  borderRadius: 'var(--gp-radius-sm)',
  padding: '6px 11px',
  fontSize: 12.5,
  color: 'var(--gp-text-1)',
};

export interface OpcaoFiltro {
  valor: string;
  rotulo: string;
}

/**
 * Lista suspensa de filtro com o visual do "Por semestre" do Desempenho
 * Institucional: ícone de calendário, "Prefixo: **valor**", seta e menu
 * flutuante com check na opção escolhida.
 */
export function SelectFiltroGestor({
  ariaLabel,
  prefixo,
  valor,
  opcoes,
  onChange,
  disabled,
}: {
  ariaLabel: string;
  prefixo: string;
  valor: string;
  opcoes: OpcaoFiltro[];
  onChange: (valor: string) => void;
  disabled?: boolean;
}) {
  const container = useGestorPortalContainer();
  const atual = opcoes.find((o) => o.valor === valor);

  return (
    <Select value={valor} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-auto w-auto justify-start gap-2 focus:ring-0 focus:ring-offset-0"
        style={ESTILO_GATILHO_FILTRO}
        icon={<Icon name="expand_more" size={15} className="text-[color:var(--gp-text-3)]" />}
      >
        <Icon name="calendar_month" variant="filled" size={15} className="text-[color:var(--gp-text-3)]" />
        <span>
          {prefixo}: <b style={{ fontWeight: 600 }}>{atual?.rotulo ?? '—'}</b>
        </span>
      </SelectTrigger>
      <SelectContent
        container={container}
        scrollUpIcon={<Icon name="expand_less" size={14} />}
        scrollDownIcon={<Icon name="expand_more" size={14} />}
      >
        {opcoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor} indicatorIcon={<Icon name="check" size={13} />}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
