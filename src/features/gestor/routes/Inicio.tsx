import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AvisosSanar } from '@/features/gestor/components/AvisosSanar';
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';
import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import { DirecionadoresGestor } from '@/features/gestor/components/DirecionadoresGestor';
import { SaudacaoGestor } from '@/features/gestor/components/SaudacaoGestor';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';

/**
 * Início do gestor — rota `/gestor` do portal v2 (spec §2.1).
 * Propósito: ORIENTAR. Nenhum indicador de desempenho vive aqui — sem
 * proficiência, sem % de acerto, sem conceito ENAMED, sem TRI. Quem quer
 * número desce para a Visão Geral.
 */
export default function Inicio() {
  const { data: contexto } = useGestorContexto();
  const { semestre, iesId } = useFiltrosGestor();

  // A URL é hint de UI; a IES autoritativa vem do servidor (§3) — sem
  // nenhuma das duas, a tela fica em loading, nunca chuta uma IES.
  const iesAtivaId = iesId ?? contexto?.iesAtual.id ?? null;

  return (
    <div className="space-y-8 p-8" data-testid="gestor-inicio">
      <SaudacaoGestor />

      {iesAtivaId ? (
        <DirecionadoresGestor iesId={iesAtivaId} semestre={semestre} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton data-testid="inicio-skeleton-direcionadores" className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]" data-testid="inicio-grade">
        {iesAtivaId && contexto ? (
          <>
            {/* Boundary por bloco (§8.4): um erro de render num bloco não derruba o outro. */}
            <BlocoErrorBoundary bloco="cronograma">
              <CronogramaSimulados
                iesId={iesAtivaId}
                iesNome={contexto.iesAtual.nome}
                contrato={contexto.contrato}
              />
            </BlocoErrorBoundary>
            <BlocoErrorBoundary bloco="avisos">
              <AvisosSanar iesId={iesAtivaId} />
            </BlocoErrorBoundary>
          </>
        ) : (
          <>
            <Skeleton data-testid="inicio-skeleton-cronograma" className="h-72 w-full" />
            <Skeleton data-testid="inicio-skeleton-avisos" className="h-72 w-full" />
          </>
        )}
      </div>
    </div>
  );
}
