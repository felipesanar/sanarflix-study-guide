import * as React from 'react';
import { AvisosSanar } from '@/features/gestor/components/AvisosSanar';
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';
import { ContainerRota } from '@/features/gestor/components/CabecalhoTela';

import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import { DirecionadoresGestor } from '@/features/gestor/components/DirecionadoresGestor';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { SaudacaoGestor } from '@/features/gestor/components/SaudacaoGestor';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useTelemetriaGestor } from '@/features/gestor/lib/telemetria';

/**
 * Reveal em cascata na MONTAGEM da rota (spec de motion §16) — mesma
 * implementação de `VisaoGeral.tsx`/`Detalhamento.tsx` (ver o comentário em
 * `VisaoGeral.tsx` para o raciocínio completo de CSS puro vs. Framer Motion e
 * de `prefers-reduced-motion`). Duplicada aqui em vez de extraída para um
 * módulo compartilhado: o escopo desta rodada é só estes 3 arquivos de rota.
 */
function classeRevelacao(indice: number): string {
  const BASE =
    'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-backwards [animation-duration:320ms] [animation-timing-function:var(--gp-ease-in)]';
  if (indice <= 0) return `${BASE} [animation-delay:0ms]`;
  if (indice === 1) return `${BASE} [animation-delay:40ms]`;
  return `${BASE} [animation-delay:80ms]`;
}

/**
 * Início do gestor — rota `/gestor` do portal v2 (spec §2.1).
 * Propósito: ORIENTAR. Nenhum indicador de desempenho vive aqui — sem
 * proficiência, sem % de acerto, sem conceito ENAMED, sem TRI. Quem quer
 * número desce para a Visão Geral.
 */
export default function Inicio() {
  const { data: contexto, isError, refetch } = useGestorContexto();
  const { semestre, iesId } = useFiltrosGestor();
  const { telaVista } = useTelemetriaGestor();

  // A URL é hint de UI; a IES autoritativa vem do servidor (§3) — sem
  // nenhuma das duas, a tela fica em loading, nunca chuta uma IES.
  const iesAtivaId = iesId ?? contexto?.iesAtual.id ?? null;

  /** `gestor_tela_vista` (spec §10, "adoção por tela"). */
  React.useEffect(() => {
    telaVista('inicio', semestre);
  }, [telaVista, semestre]);

  /**
   * NOME da IES em foco (achados 1, 3, 4 e 7 da revisão de 03/08):
   * `contexto.iesAtual` é a IES padrão do usuário e NÃO acompanha a troca no
   * dropdown — `get_gestor_contexto()` não recebe `p_ies_id` e não é
   * reconsultada quando `iesAtivaId` muda. Só `contexto.iesDisponiveis` cobre
   * qualquer IES que o gestor_grupo/admin tenha selecionado. Mesma armadilha
   * documentada em `SidebarIes.tsx:71-75`.
   */
  const iesNomeAtivo =
    contexto?.iesDisponiveis.find((ies) => ies.id === iesAtivaId)?.nome ?? '';

  // Sem isto a tela ficava em skeleton para sempre quando get_gestor_contexto
  // falha (ex.: 'IES not resolved', 'feature_not_enabled') — achado 5.
  if (isError) {
    return (
      <ContainerRota className="space-y-8" data-testid="gestor-inicio">
        <EstadoErro
          titulo="Não foi possível carregar o Início."
          descricao="Tente novamente em alguns instantes."
          onRetry={refetch}
        />
      </ContainerRota>
    );
  }

  return (
    <ContainerRota data-testid="gestor-inicio">

      <div className={classeRevelacao(0)}>
        <SaudacaoGestor iesId={iesAtivaId} />
      </div>

      {/* Overline do bloco de direcionadores — a referência nunca solta a grade
          direto sob a saudação; o rótulo é o que declara que ali se ESCOLHE um
          caminho, e não que ali se lê um resumo. */}
      <div className={`flex flex-col gap-3 ${classeRevelacao(1)}`}>
        <span
          data-testid="overline-direcionadores"
          className="uppercase text-muted-foreground"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}
        >
          O que você quer ver?
        </span>

        {iesAtivaId ? (
          <DirecionadoresGestor iesId={iesAtivaId} semestre={semestre} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div data-testid="inicio-skeleton-direcionadores">
              <GestorSkeleton altura={160} rotulo="Carregando direcionadores" />
            </div>
            <GestorSkeleton altura={160} rotulo="Carregando direcionadores" />
          </div>
        )}
      </div>

      {/* `items-start`: sem ele o card de Avisos estica até a altura do
          Cronograma (o `stretch` padrão da grade) e ganha um vazio no rodapé —
          na referência cada coluna tem a altura do próprio conteúdo. */}
      <div
        className={`grid items-start gap-4 lg:grid-cols-[2fr_1fr] ${classeRevelacao(2)}`}
        data-testid="inicio-grade"
      >
        {iesAtivaId && contexto ? (
          <>
            {/* Boundary por bloco (§8.4): um erro de render num bloco não derruba o outro. */}
            <BlocoErrorBoundary bloco="cronograma">
              <CronogramaSimulados iesId={iesAtivaId} iesNome={iesNomeAtivo} />
            </BlocoErrorBoundary>
            <BlocoErrorBoundary bloco="avisos">
              <AvisosSanar iesId={iesAtivaId} />
            </BlocoErrorBoundary>
          </>
        ) : (
          <>
            <div data-testid="inicio-skeleton-cronograma">
              <GestorSkeleton altura={288} rotulo="Carregando cronograma" />
            </div>
            <div data-testid="inicio-skeleton-avisos">
              <GestorSkeleton altura={288} rotulo="Carregando avisos" />
            </div>
          </>
        )}
      </div>
    </ContainerRota>

  );
}
