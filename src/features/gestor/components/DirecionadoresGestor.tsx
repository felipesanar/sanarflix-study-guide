import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BarChart3, FileSearch } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { prefetchVisaoGeral } from '@/features/gestor/api/prefetch';
import type { FiltroSemestre } from '@/features/gestor/api/types';

export interface DirecionadoresGestorProps {
  iesId: string;
  semestre: FiltroSemestre;
}

/** Hover: sobe 1px + borda de marca (handoff docs/05-telas.md tela 1). */
const CARTAO =
  'group flex flex-col gap-2 rounded-lg border border-border bg-card p-5 ' +
  'transition-all hover:-translate-y-px hover:border-primary ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Os dois direcionadores que respondem "o que eu faço agora?" (spec §2.1).
 * Hover e foco (não só mouse) aquecem o cache da Visão Geral antes do clique.
 */
export function DirecionadoresGestor({ iesId, semestre }: DirecionadoresGestorProps) {
  const queryClient = useQueryClient();
  const location = useLocation();
  /**
   * `prefetchVisaoGeral` precisa do `user?.id` porque `useEnvelope` insere esse
   * id na queryKey logo após o namespace `'gestor'` (card 107) — sem ele o
   * hover aquece uma chave que a Visão Geral nunca lê. Este componente já roda
   * dentro do `AuthContext` (é filho de `GestorShell`), então lê o id daqui em
   * vez de recebê-lo por prop.
   */
  const { user } = useAuth();
  const aquecer = () => void prefetchVisaoGeral(queryClient, user?.id, iesId, semestre);

  /**
   * Preserva o recorte global (IES + semestre) ao trocar de tela (achados 6
   * e 16 da revisão de 03/08): sem a `search` atual, o destino nasce sem
   * `?ies=`/`?semestre=` e `useFiltrosGestor` degrada pro padrão, ignorando
   * o que a gestora tinha selecionado.
   */
  const comFiltroAtual = (pathname: string) => ({ pathname, search: location.search });

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="direcionadores">
      <Link
        to={comFiltroAtual('/gestor/visao-geral')}
        data-testid="direcionador-visao-geral"
        className={CARTAO}
        onMouseEnter={aquecer}
        onFocus={aquecer}
      >
        <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-base font-semibold text-foreground">Visão Geral</span>
        <span className="text-sm text-muted-foreground">
          Como estamos e onde dói — o panorama da instituição em um recorte só.
        </span>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          Abrir
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>

      <Link
        to={comFiltroAtual('/gestor/detalhamento')}
        data-testid="direcionador-detalhamento"
        className={CARTAO}
      >
        <FileSearch className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-base font-semibold text-foreground">Detalhamento por Simulados</span>
        <span className="text-sm text-muted-foreground">
          O que exatamente aconteceu num simulado — questão por questão, aluno por aluno.
        </span>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          Abrir
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
