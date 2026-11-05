import { useId } from 'react';
import type { IndicadorResumo, ResumoVisaoGeral, TomComparacao } from './dadosInicio';
import { LinkAcao, MarcadorProjetado } from './ui';

const COR_TOM: Record<TomComparacao, { cor: string; peso: number }> = {
  positivo: { cor: 'var(--gp-success-on)', peso: 600 },
  negativo: { cor: 'var(--gp-danger-on)', peso: 600 },
  neutro: { cor: 'var(--gp-text-3)', peso: 400 },
};

function Indicador({ k }: { k: IndicadorResumo }) {
  const tom = k.comparacao ? COR_TOM[k.comparacao.tom] : null;
  return (
    <div className="-ml-px flex min-w-0 flex-col gap-0.5 border-l border-[var(--gp-border-subtle)] px-5 py-0.5">
      <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
        <span>{k.rotulo}</span>{k.projetado ? <MarcadorProjetado /> : null}
      </span>
      <span className="flex flex-wrap items-baseline gap-2">
        <span
          className="text-[28px] font-[750] tabular-nums tracking-[-0.03em]"
          style={{ color: k.destaque === 'perigo' ? 'var(--gp-danger-on)' : 'var(--gp-text-1)' }}
        >
          {k.valor}
        </span>
        {k.sufixo ? <span className="text-[13px] text-[var(--gp-text-3)]">{k.sufixo}</span> : null}
      </span>
      {k.comparacao && tom ? (
        <span className="text-[12.5px] tabular-nums" style={{ color: tom.cor, fontWeight: tom.peso }}>{k.comparacao.texto}</span>
      ) : null}
    </div>
  );
}

export interface VisaoGeralResumoProps {
  titulo: string;
  resumo: ResumoVisaoGeral;
  link: { rotulo: string; onClick: () => void };
  /** B2B: legenda "projetado" ao lado do título. */
  legendaProjetado?: boolean;
}

/** Visão geral resumida: 3 indicadores lado a lado separados por divisória (empilham no mobile). */
export function VisaoGeralResumo({ titulo, resumo, link, legendaProjetado = false }: VisaoGeralResumoProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3">
        <h2 id={id} className="m-0 text-[13px] font-[650] text-[var(--gp-text-2)]">{titulo}</h2>
        {legendaProjetado ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--gp-text-3)]"><MarcadorProjetado decorativo />projetado</span>
        ) : null}
        {resumo.referencia ? <span className="ml-auto whitespace-nowrap text-xs text-[var(--gp-text-3)]">{resumo.referencia}</span> : <span className="ml-auto" />}
        <LinkAcao onClick={link.onClick} chevron>{link.rotulo}</LinkAcao>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-y-2 overflow-hidden pb-3.5 pt-2.5">
        {resumo.itens.map((k) => <Indicador key={k.id} k={k} />)}
      </div>
    </section>
  );
}
