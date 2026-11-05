import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { mensagemErro } from '../../api/erros';
import { useMe, usePerolas } from '../../api/queries';
import { CARTAO, FOCO } from './estilo';
import { linhasRodizio } from './regras';

/** Banco de pérolas · rodízio entre mentores. A linha do mentor logado fica destacada ("(você)"). */
export function BancoPerolas({ hoje }: { hoje: string }) {
  const tituloId = useId();
  const me = useMe();
  const perolas = usePerolas();
  const linhas = linhasRodizio(perolas.data ?? [], me.data?.mentor.nome, hoje);

  return (
    <section aria-labelledby={tituloId} className={`${CARTAO} overflow-hidden`}>
      <div className="flex flex-wrap items-baseline gap-2.5 px-5 pb-2.5 pt-4">
        <h2 id={tituloId} className="m-0 flex-1 text-[15px] font-semibold">Banco de pérolas · rodízio entre mentores</h2>
      </div>
      {perolas.isPending ? (
        <div className="px-5 pb-4"><GestorSkeleton altura={240} rotulo="Carregando o banco de pérolas" /></div>
      ) : perolas.isError ? (
        <div className="px-5 pb-4">
          <EstadoErro altura={200} descricao={mensagemErro(perolas.error)} onRetry={() => { void perolas.refetch(); }} tentandoNovamente={perolas.isFetching} />
        </div>
      ) : linhas.length === 0 ? (
        <div className="px-5 pb-4"><EstadoVazio titulo="Nenhuma pérola no rodízio ainda." glifo="auto_stories" compacto /></div>
      ) : (
        <div className={`overflow-x-auto ${FOCO}`} tabIndex={0} role="region" aria-label="Rodízio de pérolas">
          <table aria-labelledby={tituloId} className="w-full min-w-[600px] border-collapse text-left text-[13.5px] tabular-nums">
            <thead>
              <tr className="bg-[var(--gp-surface-2)] text-xs font-semibold text-[var(--gp-text-2)]">
                <th scope="col" className="w-[70px] py-2 pl-5 pr-2.5 font-semibold">Semana</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Mentor responsável</th>
                <th scope="col" className="w-[110px] px-2.5 py-2 font-semibold">No mural em</th>
                <th scope="col" className="px-2.5 py-2 font-semibold">Tema</th>
                <th scope="col" className="w-[200px] py-2 pl-2.5 pr-5"><span className="sr-only">Situação</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.id}
                  aria-current={l.ehVoce ? 'true' : undefined}
                  className="border-t border-[var(--gp-border-subtle)]"
                  style={{ background: l.ehVoce ? 'var(--gp-brand-surface-soft)' : undefined }}
                >
                  <td className="py-2.5 pl-5 pr-2.5 text-[var(--gp-text-3)]">{l.semana ?? '—'}</td>
                  <td className="px-2.5 py-2.5" style={{ fontWeight: l.ehVoce ? 650 : 400 }}>{l.mentor ? `${l.mentor}${l.ehVoce ? ' (você)' : ''}` : '—'}</td>
                  <td className="px-2.5 py-2.5">{l.noMuralEm ?? '—'}</td>
                  <td className="px-2.5 py-2.5 text-[var(--gp-text-2)]">{l.tema ?? '—'}</td>
                  <td
                    className="whitespace-nowrap py-2.5 pl-2.5 pr-5 text-xs font-semibold"
                    style={{ color: l.ehVoce ? 'var(--gp-brand)' : 'var(--gp-text-2)' }}
                  >
                    {l.situacao ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
