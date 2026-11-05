import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import type { Intervencao, StatusIntervencao } from '../../api/types';
import { FOCO } from './estilos';
import { COLUNAS, ICONE_TIPO, ROTULO_PERFIL, ddmmDeIso, paraQuem, rotuloOrigem, rotuloTipo, type Modalidade } from './util';

interface Props {
  card: Intervencao;
  modalidade: Modalidade;
  nomes: ReadonlyMap<string, string>;
  onAbrir: (id: string) => void;
  /** B2B: botões "→ coluna" no card (protótipo B2B); alternativa acessível ao arrastar. */
  onMover?: (id: string, status: StatusIntervencao) => void;
  movendo?: boolean;
}

/** Card do kanban: tipo (ícone + texto neutro) · data, título, nota, para quem · origem (+ perfil no B2B). */
export function CardIntervencao({ card, modalidade, nomes, onAbrir, onMover, movendo }: Props) {
  const id = React.useId();
  const b2b = modalidade === 'b2b';
  const corpo = (
    <button type="button" aria-haspopup="dialog" aria-label={`Abrir intervenção: ${card.titulo}`} aria-describedby={`${id}-meta`}
      data-card-id={card.id} onClick={() => onAbrir(card.id)}
      className={`flex w-full flex-col gap-2 rounded-[10px] text-left ${b2b ? '' : 'border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] p-3 hover:border-[var(--gp-border-input)] motion-safe:transition-colors'} ${FOCO}`}>
      <span className="flex w-full items-center gap-1.5 text-xs text-[var(--gp-text-2)]">
        <Icon name={ICONE_TIPO[card.tipo]} size={13} />
        <span>{rotuloTipo(card.tipo, modalidade)}</span>
        <span className="ml-auto tabular-nums text-[var(--gp-text-3)]">{ddmmDeIso(card.criadaEm)}</span>
      </span>
      <span className="block break-words text-[13.5px] font-semibold leading-[1.35] text-[var(--gp-text-1)]">{card.titulo}</span>
      {card.nota ? <span className="block break-words text-[12.5px] leading-[1.4] text-[var(--gp-text-2)]">{card.nota}</span> : null}
      <span id={`${id}-meta`} className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--gp-text-2)]">
        <span className="min-w-0 flex-1 break-words">{paraQuem(card, nomes)}</span>
        {b2b && card.perfil ? <Tag variant="neutro" className="font-semibold">{ROTULO_PERFIL[card.perfil]}</Tag> : null}
        <span className="text-[var(--gp-text-3)]">{rotuloOrigem(card.origem)}</span>
      </span>
    </button>
  );
  if (!b2b) return corpo;
  return (
    <article aria-label={card.titulo}
      className="flex flex-col gap-2 rounded-[10px] border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] p-3 hover:border-[var(--gp-border-input)] motion-safe:transition-colors">
      {corpo}
      {onMover ? (
        <div className="flex flex-wrap gap-1 border-t border-[var(--gp-border-subtle)] pt-2">
          {COLUNAS.filter((c) => c.status !== card.status).map((c) => (
            <button key={c.status} type="button" disabled={movendo} onClick={() => onMover(card.id, c.status)}
              className={`h-[26px] whitespace-nowrap rounded-md border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] px-2 text-xs text-[var(--gp-text-1)] hover:border-[var(--gp-border-input)] disabled:opacity-60 ${FOCO}`}>
              → {c.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
