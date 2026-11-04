import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, PlayCircle } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { chavesConteudos, fetchAlunoConteudos, type ConteudoRecente } from '@/services/mentor/conteudos';
import type { AlunoTurma, ContagemConteudos } from '@/services/mentor/turma';
import { EstadoErro } from './EstadoErro';
import { NOTA_SEM_CONSUMO_B2C, TOOLTIP_SEM_CONSUMO, descreverConteudos } from './consumo';
import { plural } from './util';

const RECENTES_INICIAIS = 5;
const RECENTES_MAX = 20;
const COR_VIDEOS = 'hsl(var(--primary))';
const COR_DOCUMENTOS = 'hsl(var(--primary) / 0.4)';

/** "2026-10-12" -> "12/10" lendo os dígitos, sem `Date` (o dia não anda com o fuso). */
function rotuloSemana(semana: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(semana);
  return m ? `${m[2]}/${m[1]}` : semana;
}

function tempoRelativo(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
}

const Totais: React.FC<{ rotulo: string; contagem: ContagemConteudos | null | undefined; testId: string }> = ({
  rotulo,
  contagem,
  testId,
}) => (
  <div data-testid={testId}>
    <dt className="text-muted-foreground">{rotulo}</dt>
    <dd className="font-medium">{contagem?.total != null ? contagem.total : '–'}</dd>
    {contagem?.total != null && <dd className="text-xs text-muted-foreground">{descreverConteudos(contagem)}</dd>}
  </div>
);

interface Props {
  aluno: Pick<AlunoTurma, 'email' | 'b2b' | 'conteudos_7d' | 'conteudos_30d'>;
}

/**
 * Seção "Conteúdos" do drawer do aluno. Só monta com o drawer aberto (vive dentro do
 * conteúdo do Sheet), então a RPC `mentor_aluno_conteudos` é buscada sob demanda.
 */
export const SecaoConteudosAluno: React.FC<Props> = ({ aluno }) => {
  const { email } = aluno;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chavesConteudos.aluno(email),
    queryFn: () => fetchAlunoConteudos(email),
  });
  const [verMais, setVerMais] = React.useState(false);

  // Totais 7d/30d vêm de `mentor_turma`; usa o cache da turma quando o detalhe não os traz.
  const daTurma = queryClient
    .getQueryData<AlunoTurma[]>(['mentor', 'turma'])
    ?.find((a) => a.email.toLowerCase() === email.toLowerCase());
  const c7 = aluno.conteudos_7d ?? daTurma?.conteudos_7d;
  const c30 = aluno.conteudos_30d ?? daTurma?.conteudos_30d;

  const dados = query.data;
  const porSemana = dados?.por_semana ?? [];
  const recentes: ConteudoRecente[] = dados?.recentes ?? [];
  const topCursos = dados?.top_cursos ?? [];
  const totalVideos = porSemana.reduce((t, s) => t + s.videos, 0);
  const totalDocs = porSemana.reduce((t, s) => t + s.documentos, 0);
  const visiveis = verMais ? recentes.slice(0, RECENTES_MAX) : recentes.slice(0, RECENTES_INICIAIS);

  return (
    <section className="space-y-3" data-testid="secao-conteudos">
      <h3 className="text-sm font-semibold">Conteúdos</h3>

      {query.isLoading && <p className="text-sm text-muted-foreground">Carregando conteúdos…</p>}
      {query.isError && (
        <EstadoErro mensagem="Não foi possível carregar os conteúdos." onRetry={() => void query.refetch()} />
      )}

      {dados && !dados.tem_dado_consumo && (
        <p className="text-sm text-muted-foreground" data-testid="conteudos-sem-dado">
          {aluno.b2b ? `${TOOLTIP_SEM_CONSUMO}.` : NOTA_SEM_CONSUMO_B2C}
        </p>
      )}

      {dados?.tem_dado_consumo && (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Totais rotulo="Últimos 7 dias" contagem={c7} testId="conteudos-total-7d" />
            <Totais rotulo="Últimos 30 dias" contagem={c30} testId="conteudos-total-30d" />
          </dl>

          {porSemana.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Por semana, últimas {porSemana.length} semanas</p>
              <div
                role="img"
                aria-label={`Últimas ${porSemana.length} semanas: ${plural(totalVideos, 'vídeo', 'vídeos')} e ${plural(totalDocs, 'documento', 'documentos')}`}
                className="h-20 w-full"
                data-testid="conteudos-sparkline"
              >
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 80 }}>
                  <BarChart data={porSemana} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="semana"
                      tickFormatter={rotuloSemana}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      labelFormatter={(semana: string) => `Semana de ${rotuloSemana(semana)}`}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="videos" name="Vídeos" stackId="c" fill={COR_VIDEOS} isAnimationActive={false} />
                    <Bar
                      dataKey="documentos"
                      name="Documentos"
                      stackId="c"
                      fill={COR_DOCUMENTOS}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="flex gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: COR_VIDEOS }} aria-hidden="true" />
                  Vídeos
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: COR_DOCUMENTOS }} aria-hidden="true" />
                  Documentos
                </span>
              </p>
            </div>
          )}

          {topCursos.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground">Cursos mais vistos (30 dias)</h4>
              <ol className="space-y-1 text-sm" data-testid="conteudos-top-cursos">
                {topCursos.slice(0, 5).map((c) => (
                  <li key={c.curso} className="flex items-center justify-between gap-2 border-b pb-1">
                    <span className="min-w-0 truncate">{c.curso}</span>
                    <span className="shrink-0 font-medium">{c.total}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recentes.length > 0 ? (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground">Vistos recentemente</h4>
              <ul className="space-y-2 text-sm" data-testid="conteudos-recentes">
                {visiveis.map((r, i) => (
                  <li
                    key={`${r.quando}-${r.conteudo}-${i}`}
                    className="flex items-start justify-between gap-2 border-b pb-2"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {r.tipo === 'video' ? (
                        <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Vídeo" />
                      ) : (
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Documento" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate">{r.conteudo}</p>
                        {(r.curso || r.modulo) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[r.curso, r.modulo].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{tempoRelativo(r.quando)}</span>
                  </li>
                ))}
              </ul>
              {recentes.length > RECENTES_INICIAIS && (
                <button
                  type="button"
                  aria-expanded={verMais}
                  onClick={() => setVerMais((v) => !v)}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  {verMais ? 'ver menos' : 'ver mais'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum conteúdo visto recentemente.</p>
          )}
        </>
      )}
    </section>
  );
};
