import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Grupo de escolha única com a semântica de rádio (`role="radiogroup"`/`role="radio"`, setas
 * movem e selecionam, só o item marcado entra no Tab). Visual fica com o chamador.
 */
export function GrupoRadio<V extends string>({
  rotulo, rotuloId, valor, opcoes, onChange, className, classeOpcao, renderOpcao,
}: {
  rotulo?: string;
  rotuloId?: string;
  valor: V;
  opcoes: readonly { valor: V; rotulo: string }[];
  onChange: (v: V) => void;
  className?: string;
  classeOpcao?: string;
  renderOpcao: (o: { valor: V; rotulo: string }, marcado: boolean) => ReactNode;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function teclado(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const passo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const j = (i + passo + opcoes.length) % opcoes.length;
    onChange(opcoes[j].valor);
    refs.current[j]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={rotuloId ? undefined : rotulo} aria-labelledby={rotuloId} className={className}>
      {opcoes.map((o, i) => {
        const marcado = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            className={classeOpcao}
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            onClick={() => onChange(o.valor)}
            onKeyDown={(e) => teclado(e, i)}
            data-marcado={marcado || undefined}
          >
            {renderOpcao(o, marcado)}
          </button>
        );
      })}
    </div>
  );
}
