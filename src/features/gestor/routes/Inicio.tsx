import * as React from 'react';
import { AvisosSanar } from '@/features/gestor/components/AvisosSanar';
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';
import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import { DirecionadoresGestor } from '@/features/gestor/components/DirecionadoresGestor';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
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
  const { data: contexto, isError, refetch } = useGestorContexto();
  const { semestre, iesId } = useFiltrosGestor();

  // A URL é hint de UI; a IES autoritativa vem do servidor (§3) — sem
  // nenhuma das duas, a tela fica em loading, nunca chuta uma IES.
  const iesAtivaId = iesId ?? contexto?.iesAtual.id ?? null;

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
      <div className="space-y-8 p-8" data-testid="gestor-inicio">
        <EstadoErro
          titulo="Não foi possível carregar o Início."
          descricao="Tente novamente em alguns instantes."
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8" data-testid="gestor-inicio">
      <SaudacaoGestor iesId={iesAtivaId} />

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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]" data-testid="inicio-grade">
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
    </div>
  );
}
