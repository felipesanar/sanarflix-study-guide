import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { cn } from '@/lib/utils';
import type { ItemRotinaAcademy } from '../../api/types';
import { itensRotina } from './dadosInicio';
import { BlocoInicio, FOCO, LinkAcao, VazioBloco } from './ui';

export interface GrupoDaSemanaProps {
  itens: ItemRotinaAcademy[] | undefined;
  /** Data-calendário de hoje em São Paulo (YYYY-MM-DD). */
  hoje: string;
  carregando: boolean;
  erro: boolean;
  tentandoNovamente?: boolean;
  onTentarNovamente: () => void;
  /** id do item que está sendo marcado (desabilita o botão). */
  marcando: string | null;
  onMarcar: (id: string, rotulo: string) => void;
  onAbrirCanais: () => void;
}

/**
 * B2B · Grupo da turma · semana: Ter (enquete), Qui (resposta), Sex (pérola). Feito = círculo verde com
 * check e "Enviado"; pendente no dia (ou atrasado) = "Marcar enviado"; futuro = "Amanhã" / "Em n dias".
 */
export function GrupoDaSemana({ itens, hoje, carregando, erro, tentandoNovamente, onTentarNovamente, marcando, onMarcar, onAbrirCanais }: GrupoDaSemanaProps) {
  const id = useId();
  let corpo;
  if (carregando) corpo = <div className="px-5 pb-4"><GestorSkeleton altura={110} forma="cartao" rotulo="Carregando a rotina da semana" /></div>;
  else if (erro) corpo = <div className="px-5 pb-4"><EstadoErro onRetry={onTentarNovamente} tentandoNovamente={tentandoNovamente} /></div>;
  else if (!itens?.length) corpo = <VazioBloco>Nada pendente.</VazioBloco>;
  else corpo = (
    <ul className="m-0 list-none p-0">
      {itensRotina(itens, hoje).map((r) => {
        const feito = r.estado === 'enviado';
        return (
          <li key={r.id} className="flex min-h-11 items-center gap-2.5 border-t border-[var(--gp-border-subtle)] px-5 py-[9px] text-[13px]">
            <span
              aria-hidden="true"
              className={cn('flex h-4 w-4 flex-none items-center justify-center rounded-full text-white', !feito && 'border-[1.5px] border-[var(--gp-border-input)] bg-[var(--gp-surface-1)]')}
              style={feito ? { background: 'var(--gp-success)' } : undefined}
            >
              {feito ? <Icon name="check" size={10} /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate" title={`${r.dia} · ${r.rotulo}`}>
              <b className="font-semibold">{r.dia}</b> · {r.rotulo}
            </span>
            {r.estado === 'marcar' ? (
              <button
                type="button" disabled={marcando === r.id} onClick={() => onMarcar(r.id, r.rotulo)}
                aria-label="Marcar enviado"
                className={cn('h-[26px] whitespace-nowrap rounded-md border border-[#F3D9A8] bg-[var(--gp-warning-surface)] px-2 text-xs font-[650] text-[var(--gp-warning-on)] disabled:opacity-60 max-[979.98px]:h-11', FOCO)}
              >
                Marcar enviado
              </button>
            ) : (
              <span className="whitespace-nowrap text-xs font-semibold" style={{ color: feito ? 'var(--gp-success-on)' : 'var(--gp-text-2)' }}>
                {r.textoEstado}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <BlocoInicio id={id} titulo="Grupo da turma · semana" acao={<LinkAcao onClick={onAbrirCanais}>Abrir canais</LinkAcao>}>
      {corpo}
    </BlocoInicio>
  );
}
