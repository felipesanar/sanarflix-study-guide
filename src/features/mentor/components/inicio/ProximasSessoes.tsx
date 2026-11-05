import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { cn } from '@/lib/utils';
import type { Sessao } from '../../api/types';
import { statusSessao } from '../../lib/regrasMentor';
import { STATUS_SESSAO, TIPO_SESSAO_CURTO, diaSemanaCurto, horaCurta, sessoesInicio, type StatusExibicao } from './dadosInicio';
import { BlocoInicio, BotaoPequeno, LINHA, LinkAcao, VazioBloco } from './ui';

const COR_STATUS: Record<StatusExibicao['tom'], string> = {
  neutro: 'var(--gp-text-2)', atencao: 'var(--gp-warning-on)', positivo: 'var(--gp-success-on)',
};
const ICONE_STATUS: Record<StatusExibicao['tom'], DendeIconName> = { neutro: 'schedule', atencao: 'report_problem', positivo: 'check' };

function Status({ s, compacto = false }: { s: StatusExibicao; compacto?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold', !compacto && 'gap-[5px]')} style={{ color: COR_STATUS[s.tom] }}>
      <Icon name={ICONE_STATUS[s.tom]} size={13} />{s.rotulo}
    </span>
  );
}

export interface ProximasSessoesProps {
  modalidade: 'b2c' | 'b2b';
  sessoes: Sessao[] | undefined;
  carregando: boolean;
  erro: boolean;
  tentandoNovamente?: boolean;
  onTentarNovamente: () => void;
  /** alunoId → nome (sessões individuais). */
  nomes: Map<string, string>;
  /** B2C: ícone da tribo ao lado do encontro em destaque. */
  iconeTribo?: string | null;
  onVerAgenda: () => void;
  onAbrirSessao: (id: string) => void;
}

/**
 * Próximas sessões. B2C: o próximo encontro em destaque ("Falta link" + "Adicionar link" ou
 * "Link enviado à tribo") e até 2 sessões em lista compacta. B2B: a próxima em destaque com status e
 * ação contextual (Adicionar link · Definir pauta · Abrir sessão), seguida das demais em ordem cronológica.
 */
export function ProximasSessoes({ modalidade, sessoes, carregando, erro, tentandoNovamente, onTentarNovamente, nomes, iconeTribo, onVerAgenda, onAbrirSessao }: ProximasSessoesProps) {
  const id = useId();
  const b2c = modalidade === 'b2c';
  const { destaque, demais } = sessoesInicio(sessoes ?? [], modalidade);
  const nomeDe = (s: Sessao) => (s.alunoId ? nomes.get(s.alunoId) ?? 'Aluno' : null);

  let corpo;
  if (carregando) corpo = <div className="px-5 pb-4"><GestorSkeleton altura={180} forma="cartao" rotulo="Carregando Próximas sessões" /></div>;
  else if (erro) corpo = <div className="px-5 pb-4"><EstadoErro onRetry={onTentarNovamente} tentandoNovamente={tentandoNovamente} /></div>;
  else if (!destaque) corpo = <VazioBloco>Nenhuma sessão agendada.</VazioBloco>;
  else {
    const st = STATUS_SESSAO[statusSessao(destaque)];
    const encontro = destaque.tipo === 'encontro_tribo';
    const titulo = b2c && !encontro && destaque.tipo === 'individual'
      ? `${nomeDe(destaque)} · ${horaCurta(destaque.hora)}`
      : `${TIPO_SESSAO_CURTO[destaque.tipo]} · ${horaCurta(destaque.hora)}`;
    corpo = (
      <>
        <div
          className="flex gap-3.5 border-t border-[var(--gp-border-subtle)] px-5 pb-3.5 pt-3"
          style={{ background: 'color-mix(in srgb, var(--gp-warning-surface) 50%, var(--gp-surface-1))' }}
        >
          <span className="flex w-10 flex-none flex-col items-center">
            <span className="text-[11px] font-semibold" style={{ color: b2c ? 'var(--gp-warning-on)' : '#B8430C' }}>{diaSemanaCurto(destaque.data)}</span>
            <span className="text-[22px] font-[750] leading-[1.1] tabular-nums text-[var(--gp-text-1)]">{destaque.data.slice(8, 10)}</span>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-sm font-[650] text-[var(--gp-text-1)]">
              {b2c && encontro && iconeTribo ? <img src={iconeTribo} alt="" className="h-auto w-5 flex-none" /> : null}
              <span className="min-w-0 break-words">{titulo}</span>
            </span>
            {destaque.tema ? <span className="break-words text-[13px] text-[var(--gp-text-2)]">{destaque.tema}</span> : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              {b2c ? (
                destaque.tipo === 'individual' ? null : destaque.link ? (
                  <span className="inline-flex items-center gap-[5px] text-xs font-semibold text-[var(--gp-success-on)]"><Icon name="check" size={13} />Link enviado à tribo</span>
                ) : (
                  <>
                    <Status s={STATUS_SESSAO.falta_link} />
                    <BotaoPequeno onClick={() => onAbrirSessao(destaque.id)}>Adicionar link</BotaoPequeno>
                  </>
                )
              ) : (
                <>
                  <Status s={st} />
                  <BotaoPequeno onClick={() => onAbrirSessao(destaque.id)}>{st.acao}</BotaoPequeno>
                </>
              )}
            </div>
          </div>
        </div>
        {demais.map((s) => (
          <button
            key={s.id} type="button" onClick={() => onAbrirSessao(s.id)}
            className={cn(LINHA, 'grid min-h-11 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2.5 px-5 py-2.5')}
          >
            <span className="text-[12.5px] font-semibold tabular-nums">
              {diaSemanaCurto(s.data)} {b2c ? `${s.data.slice(8, 10)}/${s.data.slice(5, 7)}` : s.data.slice(8, 10)}
            </span>
            <span className="min-w-0 truncate text-[13px]">
              {b2c ? (s.tipo === 'individual' ? nomeDe(s) : s.tema ?? TIPO_SESSAO_CURTO[s.tipo]) : TIPO_SESSAO_CURTO[s.tipo]} · {horaCurta(s.hora)}
            </span>
            {b2c
              ? <span className="whitespace-nowrap text-xs text-[var(--gp-text-2)]">{s.tipo === 'individual' ? 'Individual' : 'Encontro'}</span>
              : <Status s={STATUS_SESSAO[statusSessao(s)]} compacto />}
          </button>
        ))}
      </>
    );
  }

  return (
    <BlocoInicio id={id} titulo="Próximas sessões" acao={<LinkAcao onClick={onVerAgenda}>Ver agenda</LinkAcao>}>
      {corpo}
    </BlocoInicio>
  );
}
