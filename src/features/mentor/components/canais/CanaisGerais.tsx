import { useId } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '../../api/erros';
import { useCanais } from '../../api/queries';
import type { CanalTurma } from '../../api/types';
import { CARTAO } from './estilo';

const FIXOS: Record<'avisos' | 'plantao', { nome: string; sub: string }> = {
  avisos: { nome: 'Grupo de avisos', sub: 'comunicados para todos os alunos' },
  plantao: { nome: 'Plantão de dúvidas', sub: 'atendido pela monitoria, não pelo mentor' },
};
const ehFixo = (c: CanalTurma): c is CanalTurma & { tipo: 'avisos' | 'plantao' } => c.tipo === 'avisos' || c.tipo === 'plantao';

/** Grupo de avisos e Plantão de dúvidas: links gerais da SanarFlix, fixos (cadeado). Ajuste de 29/10. */
export function CanaisGerais() {
  const tituloId = useId();
  const canais = useCanais();
  const fixos = (canais.data ?? []).filter(ehFixo).sort((a, b) => (a.tipo === 'avisos' ? -1 : 1) - (b.tipo === 'avisos' ? -1 : 1));
  if (!canais.isPending && !canais.isError && fixos.length === 0) return null;
  return (
    <section aria-labelledby={tituloId} className={`${CARTAO} flex flex-col gap-2 px-5 py-3.5`}>
      <h2 id={tituloId} className="m-0 text-[15px] font-semibold">Canais gerais</h2>
      {canais.isPending ? (
        <GestorSkeleton altura={88} rotulo="Carregando os canais gerais" />
      ) : canais.isError ? (
        <EstadoErro altura={120} descricao={mensagemErro(canais.error)} onRetry={() => { void canais.refetch(); }} tentandoNovamente={canais.isFetching} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {fixos.map((c) => (
            <li key={c.tipo} className="flex items-center gap-2.5 border-t border-[var(--gp-border-subtle)] pt-1.5 text-[13px]">
              <Icon name="whatsapp" size={15} />
              <span className="block min-w-0 flex-1">
                <span className="block font-semibold">{c.nome?.trim() || FIXOS[c.tipo].nome}</span>
                <span className="block text-xs text-[var(--gp-text-3)]">{FIXOS[c.tipo].sub}</span>
              </span>
              <span className="flex text-[var(--gp-text-2)]"><Icon name="padlock" size={13} label="Link fixo, definido pela SanarFlix" /></span>
            </li>
          ))}
        </ul>
      )}
      <span className="text-xs text-[var(--gp-text-3)]">Links gerais definidos pela SanarFlix. O grupo da turma (ao lado) é o único que você edita.</span>
    </section>
  );
}
