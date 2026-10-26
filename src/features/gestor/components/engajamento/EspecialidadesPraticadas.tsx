import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { queryParaAba } from '@/features/gestor/hooks/useFiltrosEngajamento';
import type { VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import { BarraHorizontal } from './BarraHorizontal';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';

export interface EspecialidadesPraticadasProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
}

/**
 * "Especialidades mais praticadas" (spec §12.2, P7): as 6 especialidades com mais
 * questões resolvidas no recorte, com barra relativa à maior e o % de acerto
 * abaixo (em alerta quando crítico, P12). "Abrir taxonomia →" leva à aba Questões
 * mantendo os filtros.
 */
export function EspecialidadesPraticadas({ dados, consulta }: EspecialidadesPraticadasProps) {
  const { search } = useLocation();
  const especialidades = dados?.especialidades ?? [];
  const maior = especialidades.reduce((m, e) => Math.max(m, e.questoes), 0);

  return (
    <BlocoEngajamento
      titulo="Especialidades mais praticadas"
      descricao="Questões resolvidas e % de acerto"
      acao={
        <Link
          to={{ pathname: '/gestor/engajamento/questoes', search: queryParaAba(search, 'questoes') }}
          className="text-[color:var(--gp-brand-strong)] underline-offset-2 hover:underline dark:text-[color:var(--gp-brand-on-dark)]"
          style={{ fontSize: 'var(--gp-font-size-apoio)', fontWeight: 'var(--gp-font-weight-medio)' }}
        >
          Abrir taxonomia →
        </Link>
      }
      consulta={consulta}
      vazio={Boolean(dados) && especialidades.length === 0}
      mensagemVazio="Nenhuma questão classificada neste recorte."
      alturaSkeleton={300}
      bloco="especialidades-praticadas"
    >
      <ul className="m-0 flex list-none flex-col p-0" style={{ gap: 12 }}>
        {especialidades.map((e) => {
          const critico = nivelDesempenho(e.acertoPct) === 'critico';
          return (
            <li key={e.id} data-testid="especialidade-praticada">
              <div className="flex items-baseline justify-between" style={{ gap: 8, fontSize: 'var(--gp-font-size-body)' }}>
                <span style={{ color: 'var(--gp-text-1)', fontWeight: 'var(--gp-font-weight-medio)' }}>{e.nome}</span>
                <span className="tabular-nums" style={{ color: 'var(--gp-text-1)' }}>
                  {formatNumero(e.questoes)}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                <BarraHorizontal pct={maior > 0 ? (100 * e.questoes) / maior : 0} />
              </div>
              <div
                data-testid="especialidade-acerto"
                style={{
                  marginTop: 2,
                  fontSize: 'var(--gp-font-size-apoio)',
                  color: critico ? 'var(--gp-danger-on)' : 'var(--gp-text-3)',
                }}
              >
                acerto {formatPct(e.acertoPct)}
              </div>
            </li>
          );
        })}
      </ul>
    </BlocoEngajamento>
  );
}
