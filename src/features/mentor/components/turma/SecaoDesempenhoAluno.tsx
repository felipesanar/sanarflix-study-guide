import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlunoNotas } from '@/services/mentor/desempenho';
import { EstadoErro } from './EstadoErro';
import { formatDiaMes } from './util';
import { formatPct } from './simulados';

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
              <li key={n.simulado_id} className="flex items-center justify-between gap-2 border-b pb-2">
                <span>
                  <span className="text-muted-foreground">#{n.sequence_number}</span> {n.titulo}
                </span>
                <span className="shrink-0">
                  <span className="font-medium">{formatPct(n.acerto_pct)}</span>{' '}
                  <span className="text-xs text-muted-foreground">{formatDiaMes(n.finalizada_em)}</span>
                </span>
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
              <li key={area.grande_area} className="space-y-1">
                <p className="flex items-center justify-between gap-2 font-medium">
                  <span>{area.grande_area}</span>
                  <span>
                    {formatPct(area.acerto_pct)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">{area.respostas} respostas</span>
                  </span>
                </p>
                {area.temas.length > 0 && (
                  <ul className="space-y-0.5 border-l pl-3 text-muted-foreground">
                    {area.temas.map((t) => (
                      <li key={t.tema} className="flex items-center justify-between gap-2">
                        <span>{t.tema}</span>
                        <span>
                          {formatPct(t.acerto_pct)} <span className="text-xs">{t.respostas} respostas</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};
