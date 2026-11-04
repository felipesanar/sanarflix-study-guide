/** Log de interações (B2C): filtros Tudo · Intervenções · Mural; status em etiqueta neutra (não é desempenho). */
import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { formatDiaMesSp, type FiltroLog, type ItemLog } from './formatos';

const FILTROS: { valor: FiltroLog; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'intervencoes', rotulo: 'Intervenções' },
  { valor: 'mural', rotulo: 'Mural' },
];

export function LogInteracoes({ itens }: { itens: ItemLog[] }) {
  const [filtro, setFiltro] = React.useState<FiltroLog>('tudo');
  const id = React.useId();
  const lista = itens.filter((i) => filtro === 'tudo' || i.filtro === filtro);
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={id} className="m-0 flex-1 text-[14px] font-[650]">Log de interações</h3>
        {FILTROS.map((f) => {
          const ativo = filtro === f.valor;
          return (
            <button
              key={f.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltro(f.valor)}
              className="h-[26px] whitespace-nowrap rounded-full border bg-white px-2.5 text-[12px] max-[640px]:min-h-[44px]"
              style={{ borderColor: ativo ? '#111212' : 'var(--gp-border-strong)', fontWeight: ativo ? 650 : 500 }}
            >
              {f.rotulo}
            </button>
          );
        })}
      </div>
      {lista.length === 0 ? (
        <span className="text-[13px]" style={{ color: 'var(--gp-text-3)' }}>Nenhuma interação registrada ainda.</span>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {lista.map((i) => (
            <li key={i.chave} className="flex items-start gap-2.5 py-2 text-[13px]">
              <span className="mt-px" style={{ color: 'var(--gp-text-2)' }}><Icon name={i.icone} size={15} /></span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span>{i.texto}</span>
                {i.status && <Tag variant="neutro" className="ml-1.5 align-middle">{i.status}</Tag>}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--gp-text-3)' }}>{formatDiaMesSp(i.em)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
