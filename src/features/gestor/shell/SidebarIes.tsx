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

  // `?ies=` só é aceito se apontar para uma IES que a pessoa de fato acessa.
  // Sem essa validação, um link colável para uma IES fora do escopo (ou um
  // bookmark de um gestor_grupo cuja IES saiu do grupo) deixaria o `<Select>`
  // com um `value` sem `SelectItem` correspondente — seletor em branco, sem
  // caminho de saída (achado 17). A autorização de fato é da RPC; isto é só
  // para a UI nunca ficar num estado sem saída.
  const iesValida = contexto ? contexto.iesDisponiveis.some((ies) => ies.id === iesId) : false;

  // Semeia (ou corrige) o recorte global com a IES do contexto assim que ele
  // chega, sempre que a URL não tiver uma seleção válida — seja porque `iesId`
  // ainda é `null` no primeiro acesso (achado do Felipe, item 3a: sem isso
  // nenhum hook de dado como useCronograma/useVisaoGeral dispara, porque todos
  // são `enabled: iesId !== null`), seja porque aponta para uma IES fora do
  // escopo (achado 17). Cai para `contexto.iesAtual.id`, que é sempre uma das
  // opções do dropdown — nunca deixa a pessoa sem seletor utilizável. Termina
  // em uma escrita: depois da correção `iesValida` passa a `true` e o efeito
  // não corre de novo, sem risco de loop.
  React.useEffect(() => {
    if (contexto && !iesValida) {
      setIesId(contexto.iesAtual.id);
    }
  }, [contexto, iesValida, setIesId]);

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
  // 3b). Cai em `iesAtual` quando não há seleção válida ainda: `iesId` nulo no
  // primeiro acesso, ou fora de `iesDisponiveis` (achado 17) — em ambos os
  // casos só até o efeito de correção rodar.
  const iesSelecionada = iesValida ? iesId ?? contexto.iesAtual.id : contexto.iesAtual.id;

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
