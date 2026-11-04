import * as React from 'react';
import type { CardIntervencao, StatusIntervencao } from '@/services/mentor/intervencoes';
import type { AlunoTurma } from '@/services/mentor/turma';
import { STATUS, formatarDataCurta, rotuloAlvo, rotuloOrigem, rotuloTipo } from './util';

interface Props {
  card: CardIntervencao;
  alunos: Map<string, AlunoTurma>;
  onAbrir: (card: CardIntervencao) => void;
  onMudarStatus: (card: CardIntervencao, status: StatusIntervencao) => void;
  desabilitado?: boolean;
}

export const CardIntervencaoKanban: React.FC<Props> = ({ card, alunos, onAbrir, onMudarStatus, desabilitado }) => (
  <li
    className="rounded-lg border bg-card p-3 text-sm shadow-sm"
    data-testid={`card-intervencao-${card.id}`}
  >
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{rotuloTipo(card.tipo)}</span>
      <span>{formatarDataCurta(card.criado_em)}</span>
    </div>
    <button
      type="button"
      onClick={() => onAbrir(card)}
      className="mt-1 block w-full text-left font-medium hover:underline focus-visible:underline"
    >
      {card.titulo}
    </button>
    {card.nota ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.nota}</p> : null}
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>{rotuloAlvo(card, alunos)}</span>
      <span aria-hidden>·</span>
      <span>{rotuloOrigem(card)}</span>
      {card.peso > 1 ? (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]" title="Peso no medidor">
          Conta {card.peso}
        </span>
      ) : null}
    </div>
    <div className="mt-2">
      <label className="sr-only" htmlFor={`status-${card.id}`}>
        Mover {card.titulo} para
      </label>
      <select
        id={`status-${card.id}`}
        aria-label={`Mover ${card.titulo} para`}
        value={card.status}
        disabled={desabilitado}
        onChange={(e) => onMudarStatus(card, e.target.value as StatusIntervencao)}
        className="h-7 rounded border bg-background px-1.5 text-xs"
      >
        {STATUS.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>
    </div>
  </li>
);
