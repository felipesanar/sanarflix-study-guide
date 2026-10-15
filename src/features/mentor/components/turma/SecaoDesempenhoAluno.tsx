import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlunoNotas, type AreaDesempenho, type NotaSimulado } from '@/services/mentor/desempenho';
import { rotuloEspecialidade } from '@/features/mentor/components/detalhamento/PainelGrandeArea';
import { EstadoErro } from './EstadoErro';
import { formatDiaMes } from './util';
import { formatPct } from './simulados';

const DICA_PERCENTIL = 'entre quem fez dentro da janela';

const temNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** "Nº 3 de 40", "Nº 3" (sem total) ou nada, quando o backend ainda não manda a posição. */
export function textoPosicao(n: Pick<NotaSimulado, 'posicao' | 'participantes'>): string | null {
  if (!temNumero(n.posicao)) return null;
  return temNumero(n.participantes) && n.participantes > 0
    ? `Nº ${n.posicao} de ${n.participantes}`
    : `Nº ${n.posicao}`;
}

const RankingNota: React.FC<{ nota: NotaSimulado }> = ({ nota }) => {
  const posicao = textoPosicao(nota);
  const percentil = temNumero(nota.percentil) ? Math.round(nota.percentil) : null;
  const fora = nota.dentro_janela === false;
  if (!posicao && percentil === null && !fora) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      {posicao && <span data-testid="posicao">{posicao}</span>}
      {percentil !== null && (
        <span data-testid="percentil" title={DICA_PERCENTIL}>
          percentil {percentil}
        </span>
      )}
      {fora && (
        <span data-testid="fora-da-janela" className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          fora da janela
        </span>
      )}
    </span>
  );
};

const Temas: React.FC<{ temas: AreaDesempenho['temas'] }> = ({ temas }) => (
  <ul className="space-y-0.5 text-muted-foreground">
    {temas.map((t) => (
      <li key={t.tema} className="flex items-center justify-between gap-2">
        <span>{t.tema}</span>
        <span>
          {formatPct(t.acerto_pct)} <span className="text-xs">{t.respostas} respostas</span>
        </span>
      </li>
    ))}
  </ul>
);

/** Grande área → especialidade → tema quando o backend manda a árvore; senão, a lista plana de temas. */
const ArvoreArea: React.FC<{ area: AreaDesempenho }> = ({ area }) => {
  const especialidades = area.especialidades ?? [];
  const temasPlanos = area.temas ?? [];
  return (
    <li className="space-y-1">
      <p className="flex items-center justify-between gap-2 font-medium">
        <span>{area.grande_area}</span>
        <span>
          {formatPct(area.acerto_pct)}{' '}
          <span className="text-xs font-normal text-muted-foreground">{area.respostas} respostas</span>
        </span>
      </p>
      {especialidades.length > 0 ? (
        <ul className="space-y-2 border-l pl-3">
          {especialidades.map((e) => (
            <li key={e.especialidade ?? '__geral'} data-testid={`especialidade-${rotuloEspecialidade(e)}`} className="space-y-0.5">
              <p className="flex items-center justify-between gap-2">
                <span>{rotuloEspecialidade(e)}</span>
                <span>
                  {formatPct(e.acerto_pct)} <span className="text-xs text-muted-foreground">{e.respostas} respostas</span>
                </span>
              </p>
              {(e.temas ?? []).length > 0 && (
                <div className="border-l pl-3">
                  <Temas temas={e.temas} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        temasPlanos.length > 0 && (
          <div className="border-l pl-3">
            <Temas temas={temasPlanos} />
          </div>
        )
      )}
    </li>
  );
};

/** Notas dos simulados + desempenho por área (drawer do aluno). Some quando não há dado. */
export const SecaoDesempenhoAluno: React.FC<{ email: string }> = ({ email }) => {
  const query = useQuery({
    queryKey: ['mentor', 'aluno-notas', email],
    queryFn: () => fetchAlunoNotas(email),
  });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Carregando simulados…</p>;
  if (query.isError) {
    return (
      <EstadoErro mensagem="Não foi possível carregar os simulados." onRetry={() => void query.refetch()} />
    );
  }
  const notas = [...(query.data?.notas ?? [])].sort((a, b) => a.sequence_number - b.sequence_number);
  const areas = query.data?.areas ?? [];
  if (notas.length === 0 && areas.length === 0) return null;

  return (
    <>
      {notas.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Notas dos simulados</h3>
          <ul className="space-y-2 text-sm">
            {notas.map((n) => (
              <li key={n.simulado_id} className="space-y-0.5 border-b pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="text-muted-foreground">#{n.sequence_number}</span> {n.titulo}
                  </span>
                  <span className="shrink-0">
                    <span className="font-medium">{formatPct(n.acerto_pct)}</span>{' '}
                    <span className="text-xs text-muted-foreground">{formatDiaMes(n.finalizada_em)}</span>
                  </span>
                </div>
                <RankingNota nota={n} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {areas.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Desempenho por área</h3>
          <ul className="space-y-3 text-sm">
            {areas.map((area) => (
              <ArvoreArea key={area.grande_area} area={area} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
};
