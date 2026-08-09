import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { Icon } from '@/features/gestor/components/Icon';
import type { VisaoGeral } from '@/features/gestor/api/types';

/**
 * A referência não rotula o insight por escopo antes do texto: ela põe a
 * PROCEDÊNCIA embaixo ("fonte: … · Diagnóstico Curricular"), depois de um
 * divisor. O escopo do dado é o bloco de onde ele saiu — por isso o rótulo é o
 * nome do bloco, não a categoria abstrata.
 */
const FONTE_ESCOPO: Record<VisaoGeral['insights'][number]['escopo'], string> = {
  area: 'Diagnóstico Curricular',
  aluno: 'Visão de Alunos',
};

type EstadoInsightIA = 'idle' | 'loading' | 'sucesso' | 'erro';

/**
 * Ocultado por decisão de produto em 09/08 — a RPC/edge function seguem no ar
 * em produção, só a entrada de UI foi desligada enquanto o insight por IA não
 * é revisado. Reativar trocando para `true` (ver também `DrawerAluno.tsx`).
 */
const MOSTRAR_INSIGHT_IA = false;

/**
 * Terceiro card, sob demanda: um insight gerado por IA (`gestor-ai-insights`,
 * `modo: 'pedagogico'`), ao lado dos 2 autogerados por template SQL. Nunca
 * dispara ao montar — decisão de custo já tomada — só quando a gestora clica
 * em "Gerar com IA"; e uma falha aqui fica contida no próprio card (estado de
 * erro discreto + retry), nunca derruba os outros dois insights, que são
 * grátis e já vieram prontos no envelope da tela.
 *
 * `iesId`/`semestre` vêm do MESMO recorte global que o resto da tela usa
 * (`useFiltrosGestor`), com a mesma queda para o contexto do servidor que
 * `VisaoGeral.tsx` já faz para `iesAtivaId` — sem ela, um acesso sem `?ies`
 * na URL (link colado, F5 no caminho puro) deixaria este card sem IES antes
 * de `SidebarIes` semear a URL.
 */
function CardInsightIA() {
  const filtros = useFiltrosGestor();
  const contexto = useGestorContexto();
  const iesId = filtros.iesId ?? contexto.data?.iesAtual.id ?? null;
  const semestre = filtros.semestre;

  const [estado, setEstado] = React.useState<EstadoInsightIA>('idle');
  const [texto, setTexto] = React.useState('');

  const gerar = React.useCallback(async () => {
    if (!iesId) {
      setEstado('erro');
      return;
    }
    setEstado('loading');
    try {
      const { data, error } = await supabase.functions.invoke('gestor-ai-insights', {
        body: { modo: 'pedagogico', iesId, semestre },
      });
      if (error) throw error;
      setTexto(typeof data?.insight === 'string' ? data.insight : '');
      setEstado('sucesso');
    } catch {
      setEstado('erro');
    }
  }, [iesId, semestre]);

  return (
    <Card className="h-full" data-testid="card-insight-ia">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5">
          <Icon name="auto_awesome" size={14} className="text-muted-foreground" />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Análise por IA</p>
        </div>

        {estado === 'loading' ? (
          /* `GestorSkeleton`, não o `Skeleton` do shadcn: este era o ÚNICO
             lugar do portal que carregava com o pulso de opacidade do
             primitivo compartilhado, em vez do shimmer calibrado nos dois
             temas (`--gp-skeleton`/`--gp-skeleton-brilho`) que todo o resto
             usa — dois sistemas de carregamento na mesma tela. */
          <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
            <GestorSkeleton altura={12} rotulo="Gerando insight por IA" />
            <GestorSkeleton altura={12} rotulo="Gerando insight por IA" className="w-4/5" />
            <GestorSkeleton altura={12} rotulo="Gerando insight por IA" className="w-3/5" />
            <span className="sr-only">Gerando insight por IA…</span>
          </div>

        ) : estado === 'sucesso' ? (
          <>
            <p style={{ fontSize: 13, lineHeight: '20px' }}>{texto}</p>
            <button
              type="button"
              onClick={gerar}
              className="mt-auto w-fit border-t border-border pt-2 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Gerar novamente
            </button>
          </>
        ) : estado === 'erro' ? (
          <div className="mt-auto flex flex-col items-start gap-1.5" role="alert">
            <p className="text-xs text-muted-foreground">Não foi possível gerar o insight agora.</p>
            <Button
              variant="outline"
              size="sm"
              className="h-auto rounded-sm px-3 py-1.5 text-[11px] font-semibold"
              onClick={gerar}
            >
              Tentar de novo
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Peça uma leitura gerada por IA sobre este recorte, a partir dos mesmos dados já carregados na tela.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-auto w-fit h-auto rounded-sm px-3 py-1.5 text-[11px] font-semibold"
              onClick={gerar}
            >
              Gerar com IA
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 2 insights autogerados da Visão Geral (spec §4.8): um por área, um por
 * aluno — leitura curta, sem linguagem nominal de aluno (o texto já vem
 * agregado do servidor). Nenhum corte de nota é decidido aqui.
 *
 * O card de IA vive numa grade PRÓPRIA, fora do `<ul>` dos 2 autogerados: são
 * naturezas diferentes (grátis/sempre presentes vs. sob demanda/pago), e
 * misturá-los no mesmo `<ul>` faria a contagem de `<li>` da tela — usada por
 * quem lê "quantos insights existem neste recorte" — incluir um card que não
 * é insight autogerado nenhum.
 */
export function BlocoInsights({ insights }: { insights: VisaoGeral['insights'] }) {
  return (
    <section data-testid="bloco-insights" aria-labelledby="titulo-insights" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* O glifo herda `currentColor`; a cor vem do token, nunca de `--primary`
            cru — no escuro a marca reprova AA como cor de traço fino. */}
        <span className="inline-flex" style={{ color: 'var(--gp-brand-on-dark)' }}>
          <Icon name="insights" variant="filled" size={18} />
        </span>
        <h2 id="titulo-insights" style={{ fontSize: 16, fontWeight: 700 }}>
          Insights Pedagógicos
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          agregado do período · sem simulado específico
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem insights para este recorte.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {insights.map((insight) => (
            <li key={`${insight.escopo}-${insight.texto}`}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <p style={{ fontSize: 13, lineHeight: '20px' }}>{insight.texto}</p>
                  <p className="mt-auto border-t border-border pt-2 text-[11px] text-muted-foreground">
                    fonte: {FONTE_ESCOPO[insight.escopo]}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {MOSTRAR_INSIGHT_IA ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <CardInsightIA />
        </div>
      ) : null}
    </section>
  );
}
