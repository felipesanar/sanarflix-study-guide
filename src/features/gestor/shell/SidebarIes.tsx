import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGestorContexto } from '@/features/gestor/api/queries';

const Rotulo: React.FC = () => (
  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
    Instituição
  </p>
);

/**
 * Instituição em foco na sidebar (spec §3).
 *
 * `admin` e `gestor_grupo` trocam de IES por dropdown; `gestor` vê rótulo
 * estático — sem afordância de clique, nem controle desabilitado.
 *
 * O switch é `podeTrocarIes`, decidido no servidor: nenhum componente checa
 * role literal. E o `iesId` na URL é hint de UI — a autorização é da RPC.
 */
export const SidebarIes: React.FC = () => {
  const { data: contexto, isLoading } = useGestorContexto();
  const [, setSearchParams] = useSearchParams();

  if (isLoading) {
    return (
      <div className="px-1">
        <Rotulo />
        <div
          role="status"
          aria-busy="true"
          aria-label="Carregando instituição"
          className="mt-1 h-9 animate-pulse rounded-lg bg-muted"
        />
      </div>
    );
  }

  if (!contexto) return null;

  if (!contexto.podeTrocarIes) {
    return (
      <div className="px-1">
        <Rotulo />
        <p
          className="truncate text-sm font-semibold text-sidebar-foreground"
          title={contexto.iesAtual.nome}
        >
          {contexto.iesAtual.nome}
        </p>
      </div>
    );
  }

  // A Task 27 troca esta escrita direta pelo `setIesId` de useFiltrosGestor.
  const trocarIes = (id: string) =>
    setSearchParams((anteriores) => {
      const proximos = new URLSearchParams(anteriores);
      proximos.set('ies', id);
      return proximos;
    });

  return (
    <div className="space-y-1 px-1">
      <Rotulo />
      <Select value={contexto.iesAtual.id} onValueChange={trocarIes}>
        <SelectTrigger aria-label="Instituição em foco" className="h-9 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {contexto.iesDisponiveis.map((ies) => (
            <SelectItem key={ies.id} value={ies.id}>
              {ies.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
