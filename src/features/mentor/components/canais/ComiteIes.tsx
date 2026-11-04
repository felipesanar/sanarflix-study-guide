import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '../../api/erros';
import { dataHoraSp } from '../../api/fonteAcademy';
import { useAlunosB2b, useMe } from '../../api/queries';
import { CARTAO } from './estilo';
import { ddmm } from './regras';

const DIA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** "Ter, 28/10 · 15h" (America/Sao_Paulo). */
export function rotuloComite(inicio: string): string {
  const { data, hora } = dataHoraSp(inicio);
  if (!data) return '';
  const dow = new Date(`${data}T12:00:00Z`).getUTCDay();
  const [h, m] = hora.split(':');
  return `${DIA_SEMANA[dow]}, ${ddmm(data)} · ${Number(h)}h${m && m !== '00' ? m : ''}`;
}

export interface ComiteIesProps {
  /**
   * Início (ISO) do próximo comitê com a coordenação. TODO(contrato-comite): nenhuma RPC devolve a
   * agenda do comitê; sem dado, a linha mostra "Data a definir".
   */
  proximoComite?: string | null;
}

/**
 * Comitê pedagógico da IES: data do próximo encontro e as sinalizações à IES deste ciclo, feitas
 * pelo drawer do aluno ("Sinalizar à IES"). Lista = alunos com `sinalizadoEm` em `useAlunosB2b`.
 * TODO(contrato-comite): o motivo da sinalização (2ª linha no protótipo) não volta em nenhuma RPC de leitura.
 */
export function ComiteIes({ proximoComite = null }: ComiteIesProps) {
  const tituloId = useId();
  const me = useMe();
  const tribo = me.data?.tribos[0];
  const nomeIes = tribo?.iesNome ?? tribo?.nome ?? null;
  const alunos = useAlunosB2b('ciclo');
  const sinalizados = (alunos.data ?? [])
    .filter((a) => a.sinalizadoEm)
    .map((a) => ({ email: a.email, nome: a.nome?.trim() || a.email, em: a.sinalizadoEm as string }))
    .sort((a, b) => b.em.localeCompare(a.em));
  const data = proximoComite ? rotuloComite(proximoComite) : '';

  return (
    <section aria-labelledby={tituloId} className={`${CARTAO} flex flex-col gap-2 px-5 py-4`}>
      <div className="flex items-center gap-2.5">
        <Icon name="school" size={18} />
        <h2 id={tituloId} className="m-0 flex-1 text-[15px] font-semibold">Comitê pedagógico{nomeIes ? ` · ${nomeIes}` : ''}</h2>
      </div>
      <span className="text-[13.5px]"><b>{data || 'Data a definir'}</b> com a coordenação do curso</span>
      {alunos.isLoading ? (
        <GestorSkeleton altura={72} rotulo="Carregando as sinalizações à IES" />
      ) : alunos.isError ? (
        <EstadoErro altura={120} descricao={mensagemErro(alunos.error)} onRetry={alunos.refetch} tentandoNovamente={alunos.isFetching} />
      ) : (
        <>
          <span className="mt-1.5 text-[12.5px] font-semibold text-[var(--gp-text-2)]">Sinalizações à IES · {sinalizados.length}</span>
          {sinalizados.length === 0 ? (
            <EstadoVazio titulo="Nenhum aluno sinalizado neste ciclo." descricao="Sinalize pelo drawer do aluno." glifo="flag" compacto />
          ) : (
            <ul aria-label="Sinalizações à IES" className="m-0 flex list-none flex-col p-0">
              {sinalizados.map((s) => (
                <li key={s.email} className="flex gap-2 border-t border-[var(--gp-border-subtle)] py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 break-words">
                    {s.nome}
                  </span>
                  <span className="text-xs tabular-nums text-[var(--gp-text-3)]">{ddmm(dataHoraSp(s.em).data)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
