import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';

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
  const { iesId, setIesId } = useFiltrosGestor();

  // Semeia o recorte global com a IES do contexto assim que ele chega, se a
  // URL ainda não tem uma seleção. Sem isso `iesId` fica `null` no primeiro
  // acesso e nenhum hook de dado (useCronograma, useVisaoGeral, ...) dispara,
  // porque todos são `enabled: iesId !== null` (achado do Felipe, item 3a).
  React.useEffect(() => {
    if (contexto && iesId === null) {
      setIesId(contexto.iesAtual.id);
    }
  }, [contexto, iesId, setIesId]);

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

  // `iesId` (URL) é a fonte de verdade da seleção. `contexto.iesAtual` NÃO
  // acompanha a troca — `get_gestor_contexto()` não recebe `p_ies_id` e não é
  // reconsultado quando o usuário muda de IES — então usá-lo aqui prenderia o
  // rótulo do dropdown na primeira IES para sempre (achado do Felipe, item
  // 3b). Cai em `iesAtual` só no instante antes do efeito de seed rodar.
  const iesSelecionada = iesId ?? contexto.iesAtual.id;

  return (
    <div className="space-y-1 px-1">
      <Rotulo />
      <Select value={iesSelecionada} onValueChange={setIesId}>
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
