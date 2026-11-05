import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { cn } from '@/lib/utils';
import type { Intervencao, TipoIntervencao } from '../../api/types';
import { quemDoCard } from './dadosInicio';
import { BlocoInicio, LINHA, LinkAcao, VazioBloco } from './ui';

/** Tipo de intervenção = ícone + texto neutro (nunca cor semântica). Mais próximos do Dendê para user/users/msg. */
const ICONE_TIPO: Record<TipoIntervencao, DendeIconName> = { individual: 'account_circle', coletiva: 'groups', mensagem: 'email' };
const MAX_CARDS = 4;

export interface AFazerProps {
  cards: Intervencao[] | undefined;
  carregando: boolean;
  erro: boolean;
  tentandoNovamente?: boolean;
  onTentarNovamente: () => void;
  nomes: Map<string, string>;
  onAbrirKanban: () => void;
  onAbrirCard: (id: string) => void;
}

/** B2C · A fazer ({n}) + "Abrir kanban": até 4 cards de "A fazer"; clique abre o drawer do card. */
export function AFazer({ cards, carregando, erro, tentandoNovamente, onTentarNovamente, nomes, onAbrirKanban, onAbrirCard }: AFazerProps) {
  const id = useId();
  const afazer = (cards ?? []).filter((c) => c.status === 'afazer');
  let corpo;
  if (carregando) corpo = <div className="px-5 pb-4"><GestorSkeleton altura={140} forma="cartao" rotulo="Carregando A fazer" /></div>;
  else if (erro) corpo = <div className="px-5 pb-4"><EstadoErro onRetry={onTentarNovamente} tentandoNovamente={tentandoNovamente} /></div>;
  else if (!afazer.length) corpo = <VazioBloco>Nada pendente.</VazioBloco>;
  else corpo = afazer.slice(0, MAX_CARDS).map((c) => (
    <button key={c.id} type="button" onClick={() => onAbrirCard(c.id)} className={cn(LINHA, 'flex min-h-11 items-center gap-2.5 px-5 py-2.5')}>
      <span className="flex text-[var(--gp-text-2)]"><Icon name={ICONE_TIPO[c.tipo]} size={15} /></span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-[550]" title={c.titulo}>{c.titulo}</span>
        <span className="block text-xs text-[var(--gp-text-3)]">{quemDoCard(c, nomes)}</span>
      </span>
    </button>
  ));
  return (
    <BlocoInicio
      id={id} titulo="A fazer"
      contagem={carregando || erro ? undefined : afazer.length}
      acao={<LinkAcao onClick={onAbrirKanban}>Abrir kanban</LinkAcao>}
    >
      {corpo}
    </BlocoInicio>
  );
}
