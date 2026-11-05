export type AbaSessoes = 'proximas' | 'realizadas';

export interface OpcaoFiltro<T extends string> { valor: T; rotulo: string }

interface Props<T extends string> {
  opcoes: OpcaoFiltro<T>[];
  tipo: T;
  onTipo: (t: T) => void;
  aba: AbaSessoes;
  onAba: (a: AbaSessoes) => void;
  /** id da lista controlada pelas abas. */
  painelId: string;
}

const ABAS: OpcaoFiltro<AbaSessoes>[] = [{ valor: 'proximas', rotulo: 'Próximas' }, { valor: 'realizadas', rotulo: 'Realizadas' }];

/** Chips de tipo (`aria-pressed`) + segmented Próximas/Realizadas (`role="tablist"`). */
export function FiltrosSessoes<T extends string>({ opcoes, tipo, onTipo, aba, onAba, painelId }: Props<T>) {
  return (
    <div className="ms-filtros">
      <div role="group" aria-label="Tipo de sessão" className="ms-chips">
        {opcoes.map((o) => (
          <button key={o.valor} type="button" className="ms-chip" aria-pressed={tipo === o.valor} onClick={() => onTipo(o.valor)}>
            {o.rotulo}
          </button>
        ))}
      </div>
      <div role="tablist" aria-label="Quando" className="ms-tabs">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            id={`${painelId}-aba-${a.valor}`}
            aria-selected={aba === a.valor}
            aria-controls={painelId}
            className="ms-tab"
            onClick={() => onAba(a.valor)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const outra = a.valor === 'proximas' ? 'realizadas' : 'proximas';
              onAba(outra);
              document.getElementById(`${painelId}-aba-${outra}`)?.focus();
            }}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
