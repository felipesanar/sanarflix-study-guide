import { useId } from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { ItemPrioridade, Prioridade } from '../api/types';

const PRIORIDADES = {
  alta: { rotulo: 'Alta', fundo: 'var(--gp-danger-surface)', texto: 'var(--gp-danger-on)' },
  media: { rotulo: 'Média', fundo: 'var(--gp-warning-surface)', texto: 'var(--gp-warning-on)' },
  baixa: { rotulo: 'Baixa', fundo: 'var(--gp-surface-3)', texto: 'var(--gp-text-2)' },
};
/** TODO: extensão necessária em Tag: variant="prioridade", prioridade={alta|media|baixa}. */
function TagPrioridade({ prioridade }: { prioridade: Prioridade }) {
  const p = PRIORIDADES[prioridade];
  return <Tag variant="neutro" style={{ background: p.fundo, color: p.texto, border: 0, fontWeight: 600 }}>{p.rotulo}</Tag>;
}
export interface ListaPrioridadesProps<K extends string> {
  titulo: string;
  resumo: string;
  itens: ItemPrioridade<K>[];
  icone: (chave: K) => { nome: DendeIconName; cor: string };
  iniciais?: (alunoIds: string[]) => string[];
  onSelecionar: (chave: K) => void;
  estado: 'ok' | 'loading' | 'error';
  onTentarNovamente?: () => void;
}

export function ListaPrioridades<K extends string>({ titulo, resumo, itens, icone, iniciais, onSelecionar, estado, onTentarNovamente }: ListaPrioridadesProps<K>) {
  const tituloId = useId();
  const visiveis = itens.filter(i => i.alunoIds.length > 0);
  return (
    <section aria-labelledby={tituloId} className="overflow-hidden rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <header className="flex flex-wrap items-baseline gap-2.5 px-5 pb-2.5 pt-3.5">
        <h2 id={tituloId} className="m-0 text-[15px] font-semibold">{titulo}</h2>
        <span className="text-xs text-[var(--gp-text-3)]">{resumo}</span>
      </header>
      <BlocoGestor estado={estado === 'ok' && !visiveis.length ? 'empty' : estado} aoTentarNovamente={onTentarNovamente} alturaSkeleton={240} bloco="mentor-prioridades">
        <ul className="m-0 list-none p-0">
          {visiveis.map(item => {
            const ic = icone(item.chave);
            const avatares = iniciais?.(item.alunoIds) ?? [];
            return (
              <li key={item.chave} className="border-t border-[var(--gp-border-subtle)]">
                <button type="button" onClick={() => onSelecionar(item.chave)}
                  className="grid w-full grid-cols-[20px_minmax(0,1fr)_32px_56px_16px] items-center gap-2 px-3 py-3 text-left min-[600px]:grid-cols-[20px_minmax(0,1fr)_auto_40px_64px_20px] min-[600px]:gap-3.5 min-[600px]:px-5 hover:bg-[var(--gp-surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--gp-brand)] motion-safe:transition-colors">
                  <span className="flex" style={{ color: ic.cor }}><Icon name={ic.nome} size={17} /></span>
                  <span className="min-w-0 break-words">
                    <span className="block text-sm font-semibold">{item.titulo}</span>
                    <span className="block text-[12.5px] text-[var(--gp-text-3)]">{item.criterio}</span>
                  </span>
                  <span className="hidden items-center min-[600px]:flex" aria-hidden="true">
                    {avatares.slice(0, 3).map((ini, i) => <span key={ini + i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--gp-surface-1)] bg-[var(--gp-surface-3)] text-[9.5px] font-bold text-[var(--gp-text-2)]" style={{ marginLeft: i ? -6 : 0 }}>{ini}</span>)}
                  </span>
                  <b className="text-right text-[17px] tabular-nums">{item.alunoIds.length}</b>
                  <span className="justify-self-end"><TagPrioridade prioridade={item.prioridade} /></span>
                  <span className="flex text-[var(--gp-text-3)]"><Icon name="chevron_right" size={16} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </BlocoGestor>
    </section>
  );
}
