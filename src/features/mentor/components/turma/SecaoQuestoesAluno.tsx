import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { chavesQuestoes, fetchAlunoQuestoes } from '@/services/mentor/questoes';
import type { AlunoTurma, ContagemQuestoes } from '@/services/mentor/turma';
import { formatPct } from '../detalhamento/util';
import { EstadoErro } from './EstadoErro';
import { NOTA_SEM_QUESTOES_B2C, TOOLTIP_SEM_QUESTOES } from './questoes';

const COR_ACERTOS = 'hsl(var(--primary))';
const COR_ERROS = 'hsl(var(--primary) / 0.4)';

function rotuloSemana(semana: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(semana);
  return m ? `${m[2]}/${m[1]}` : semana;
}

function tempoRelativo(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '–' : formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
}

const Totais: React.FC<{ rotulo: string; contagem: ContagemQuestoes | null | undefined; testId: string }> = ({ rotulo, contagem, testId }) => (
  <div data-testid={testId}>
    <dt className="text-muted-foreground">{rotulo}</dt>
    <dd className="font-medium">{contagem?.respondidas != null ? contagem.respondidas.toLocaleString('pt-BR') : '–'}</dd>
    {contagem?.pct_acerto != null && <dd className="text-xs text-muted-foreground">{formatPct(contagem.pct_acerto)} de acerto</dd>}
  </div>
);

interface Props {
  aluno: Pick<AlunoTurma, 'email' | 'b2b' | 'questoes_7d' | 'questoes_30d'>;
}

export const SecaoQuestoesAluno: React.FC<Props> = ({ aluno }) => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: chavesQuestoes.aluno(aluno.email), queryFn: () => fetchAlunoQuestoes(aluno.email) });
  const daTurma = queryClient.getQueryData<AlunoTurma[]>(['mentor', 'turma'])
    ?.find((a) => a.email.toLowerCase() === aluno.email.toLowerCase());
  const c7 = aluno.questoes_7d ?? daTurma?.questoes_7d;
  const c30 = aluno.questoes_30d ?? daTurma?.questoes_30d;
  const dados = query.data;
  const semanas = dados?.por_semana ?? [];
  const total = semanas.reduce((t, s) => t + s.respondidas, 0);
  const acertos = semanas.reduce((t, s) => t + s.acertos, 0);
  const corrigidas = semanas.reduce((t, s) => t + s.acertos + s.erros, 0);
  const descricaoAcerto = corrigidas > 0 ? `${formatPct((acertos / corrigidas) * 100)} de acerto` : 'sem correção';

  return (
    <section className="space-y-3" data-testid="secao-questoes">
      <h3 className="text-sm font-semibold">Questões</h3>
      {query.isLoading && <p className="text-sm text-muted-foreground">Carregando questões…</p>}
      {query.isError && <EstadoErro mensagem="Não foi possível carregar as questões." onRetry={() => void query.refetch()} />}
      {dados && !dados.tem_dado_questoes && <p className="text-sm text-muted-foreground">
        {aluno.b2b ? `${TOOLTIP_SEM_QUESTOES}.` : NOTA_SEM_QUESTOES_B2C}
      </p>}
      {dados?.tem_dado_questoes && <>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Totais rotulo="Últimos 7 dias" contagem={c7} testId="questoes-total-7d" />
          <Totais rotulo="Últimos 30 dias" contagem={c30} testId="questoes-total-30d" />
        </dl>
        {semanas.length > 0 && <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Por semana, últimas {semanas.length} semanas</p>
          <div role="img" aria-label={`Últimas ${semanas.length} semanas: ${total.toLocaleString('pt-BR')} questões, ${descricaoAcerto}`} className="h-20 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 80 }}>
              <BarChart data={semanas} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="semana" tickFormatter={rotuloSemana} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} labelFormatter={(semana: string) => `Semana de ${rotuloSemana(semana)}`} contentStyle={{ fontSize: 12 }} formatter={(valor: number) => valor.toLocaleString('pt-BR')} />
                <Bar dataKey="acertos" name="Acertos" stackId="q" fill={COR_ACERTOS} isAnimationActive={false} />
                <Bar dataKey="erros" name="Erros" stackId="q" fill={COR_ERROS} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="flex gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: COR_ACERTOS }} aria-hidden="true" />Acertos</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: COR_ERROS }} aria-hidden="true" />Erros</span>
          </p>
        </div>}
        {dados.por_area.length > 0 && <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Por área (30 dias)</h4>
          <ol className="space-y-1 text-sm" data-testid="questoes-por-area">
            {dados.por_area.map((a) => <li key={a.area} className="flex items-center justify-between gap-2 border-b pb-1">
              <span className="min-w-0 truncate">{a.area}</span>
              <span className="shrink-0 font-medium">{a.respondidas.toLocaleString('pt-BR')} · {formatPct(a.pct_acerto)}</span>
            </li>)}
          </ol>
        </div>}
        {dados.ultima_resposta && <p className="text-xs text-muted-foreground">Última resposta {tempoRelativo(dados.ultima_resposta)}</p>}
      </>}
    </section>
  );
};
