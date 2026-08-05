import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGestorContexto } from '../api/queries';
import { useFiltrosGestor } from '../hooks/useFiltrosGestor';

export interface AcoesRecorteProps {
  /** Descrição legível do recorte, ex.: "Pediatria · 6º ano". Vai no cabeçalho do texto copiado. */
  escopo: string;
  /**
   * Texto JÁ AGREGADO do recorte. Spec §7.7: "Copiar resumo" copia texto
   * agregado — nunca lista nominal completa de alunos. A assinatura é a
   * barreira: este componente não recebe lista de alunos e não pode montar uma.
   */
  resumoTexto: string;
  onExportar: () => void;
}

/**
 * Rodapé de ações dos drawers de recorte (temas e aluno) — Task 45b/45.5.
 *
 * Gate (spec §3 e §7.7): quando o papel não pode exportar (`podeExportar`,
 * decidido no SERVIDOR via `useGestorContexto`, nunca por role lido no
 * cliente — mesmo padrão de `podeTrocarIes` em `SidebarIes`), as ações ficam
 * AUSENTES — não desabilitadas. Um controle desabilitado com tooltip
 * anunciaria uma funcionalidade que a IES não contratou; aqui o componente
 * simplesmente não renderiza nada.
 */
export function AcoesRecorte({ escopo, resumoTexto, onExportar }: AcoesRecorteProps) {
  const { data: contexto } = useGestorContexto();
  const { iesId } = useFiltrosGestor();
  const { toast } = useToast();

  if (!contexto?.podeExportar) return null;

  const copiar = async () => {
    /**
     * `contexto.iesAtual` é a IES de CADASTRO do usuário e não acompanha a
     * troca no dropdown (achados 1 e 2 da revisão de 04/08) — `get_gestor_contexto()`
     * não recebe `p_ies_id` e a query não é reconsultada quando o gestor troca
     * de IES. O nome precisa vir da IES do RECORTE (mesma leitura de URL que
     * `VisaoGeral` usa para os dados), resolvida contra `iesDisponiveis` —
     * mesmo padrão já usado em `SaudacaoGestor.tsx` e `Inicio.tsx`.
     */
    const iesFocoId = iesId ?? contexto.iesAtual.id;
    const nomeIes =
      contexto.iesDisponiveis.find((ies) => ies.id === iesFocoId)?.nome ?? contexto.iesAtual.nome;
    const cabecalho = `${nomeIes} · ${escopo}`;
    try {
      await navigator.clipboard.writeText(`${cabecalho}\n${resumoTexto}`);
      toast({ description: 'Resumo copiado.' });
    } catch {
      toast({
        variant: 'destructive',
        description: 'Não foi possível copiar. Tente novamente.',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="default" size="sm" onClick={onExportar}>
        Exportar recorte
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={copiar}>
        Copiar resumo
      </Button>
    </div>
  );
}
