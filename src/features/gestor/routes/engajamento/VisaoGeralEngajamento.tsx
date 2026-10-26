import * as React from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { DoAcessoAoHabito } from '@/features/gestor/components/engajamento/DoAcessoAoHabito';
import { EngajamentoMesAMes } from '@/features/gestor/components/engajamento/EngajamentoMesAMes';
import { estadoDaConsulta } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { KpisEngajamento } from '@/features/gestor/components/engajamento/KpisEngajamento';
import { useEngajamentoVisaoGeral } from '@/features/gestor/api/engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';

/**
 * Aba Visão geral do Engajamento. O topo (KPIs, mês a mês, hábito) vem da RPC de
 * visão geral, a mesma que o layout já consulta (mesma chave de cache). Os demais
 * blocos entram nas tarefas B5 a B8; até lá resta o esqueleto no fim da página.
 */
export default function VisaoGeralEngajamento() {
  const filtros = useFiltrosEngajamento();
  const consulta = useEngajamentoVisaoGeral(filtros);
  const { data, meta } = consulta;

  const estadoKpis = estadoDaConsulta(consulta);
  const ocupado = consulta.isPlaceholderData === true;

  return (
    <div className="flex flex-col gap-4" data-testid="visao-geral-engajamento">
      <div aria-busy={ocupado ? true : undefined} className={ocupado ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <KpisEngajamento
          dados={data}
          meta={meta}
          periodo={filtros.periodo}
          estado={estadoKpis}
          onTentarNovamente={consulta.refetch}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EngajamentoMesAMes dados={data} consulta={consulta} />
        <DoAcessoAoHabito dados={data} consulta={consulta} />
      </div>

      <BlocoGestor titulo="Mais blocos da Visão geral" estado="loading" alturaSkeleton={240} bloco="engajamento-visao-geral">
        {null}
      </BlocoGestor>
    </div>
  );
}
