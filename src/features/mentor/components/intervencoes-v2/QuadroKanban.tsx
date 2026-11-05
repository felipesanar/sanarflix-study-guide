import * as React from 'react';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import type { Intervencao, StatusIntervencao } from '../../api/types';
import { CardIntervencao } from './CardIntervencao';
import { COLUNAS, type Modalidade } from './util';

interface Props {
  modalidade: Modalidade;
  cards: readonly Intervencao[];
  nomes: ReadonlyMap<string, string>;
  /** Formulário de "Nova intervenção", desenhado no topo de "A fazer". */
  criador?: React.ReactNode;
  onAbrir: (id: string) => void;
  onMover?: (id: string, status: StatusIntervencao) => void;
  movendo?: boolean;
}

const GRADE = 'grid items-start gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]';
/** O protótipo pinta a coluna de #EDEEF0 sobre main #F4F5F6; em produção o fundo do app já é #EDEEF0, então a coluna usa a superfície 3 com borda. */
const COLUNA = 'flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-3)] p-2.5';

/** Três colunas (A fazer · Em andamento · Feito); abaixo de ~560px viram uma coluna só. */
export function QuadroKanban({ modalidade, cards, nomes, criador, onAbrir, onMover, movendo }: Props) {
  const vazio = modalidade === 'b2b' ? 'Nada aqui.' : 'Nada aqui neste período.';
  return (
    <div className={GRADE}>
      {COLUNAS.map((col) => {
        const lista = cards.filter((c) => c.status === col.status);
        const idTitulo = `coluna-${col.status}`;
        const comCriador = col.status === 'afazer' && criador;
        return (
          <section key={col.status} aria-labelledby={idTitulo} className={COLUNA}>
            <div className="flex items-center gap-2 px-1.5 py-1">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: col.ponto }} />
              <h2 id={idTitulo} className="m-0 whitespace-nowrap text-[13.5px] font-[650] text-[var(--gp-text-1)]">{col.rotulo}</h2>
              <span className="text-xs tabular-nums text-[var(--gp-text-2)]">{lista.length}</span>
            </div>
            {comCriador ? criador : null}
            {lista.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {lista.map((c) => (
                  <li key={c.id}>
                    <CardIntervencao card={c} modalidade={modalidade} nomes={nomes} onAbrir={onAbrir}
                      onMover={modalidade === 'b2b' ? onMover : undefined} movendo={movendo} />
                  </li>
                ))}
              </ul>
            ) : comCriador ? null : (
              <span className="px-1.5 py-2.5 text-[12.5px] text-[var(--gp-text-2)]">{vazio}</span>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Carregando: três colunas com a anatomia de cards. */
export function QuadroKanbanSkeleton() {
  return (
    <div className={GRADE}>
      {COLUNAS.map((col) => (
        <div key={col.status} className={COLUNA}>
          <GestorSkeleton altura={220} rotulo={`Carregando ${col.rotulo}`} />
        </div>
      ))}
    </div>
  );
}
