import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { mensagemErro } from '../../api/erros';

interface Props {
  consulta: Pick<UseQueryResult<unknown>, 'isPending' | 'isError' | 'error' | 'isFetching' | 'refetch'>;
  vazio: boolean;
  filtrado: boolean;
  onLimparFiltro: () => void;
  linhas: number;
  alturaLinha: number;
  children: ReactNode;
}

/** Carregando (skeleton na anatomia das linhas), erro com retry local, vazio com "Limpar filtro". */
export function EstadosLista({ consulta, vazio, filtrado, onLimparFiltro, linhas, alturaLinha, children }: Props) {
  if (consulta.isPending) {
    return (
      <div role="status" aria-busy="true" aria-label="Carregando sessões" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        {Array.from({ length: linhas }, (_, i) => <GestorSkeleton key={i} altura={alturaLinha} rotulo="" className="rounded-[8px]" />)}
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <div style={{ padding: '4px 20px 20px' }}>
        <EstadoErro descricao={mensagemErro(consulta.error)} onRetry={() => void consulta.refetch()} tentandoNovamente={consulta.isFetching} />
      </div>
    );
  }
  if (vazio) {
    return (
      <div className="ms-vazio">
        <EstadoVazio
          titulo="Nenhuma sessão neste filtro."
          glifo="calendar_month"
          glifoVariante="filled"
          acao={filtrado ? { rotulo: 'Limpar filtro', onClick: onLimparFiltro } : undefined}
        />
      </div>
    );
  }
  return <>{children}</>;
}
