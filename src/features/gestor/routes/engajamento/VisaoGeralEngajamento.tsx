import * as React from 'react';
import { ComparativoSemestres } from '@/features/gestor/components/engajamento/ComparativoSemestres';
import { ConsumoAlunos } from '@/features/gestor/components/engajamento/ConsumoAlunos';
import { DoAcessoAoHabito } from '@/features/gestor/components/engajamento/DoAcessoAoHabito';
import { DrawerAlunoEngajamento } from '@/features/gestor/components/engajamento/DrawerAlunoEngajamento';
import { EngajamentoMesAMes } from '@/features/gestor/components/engajamento/EngajamentoMesAMes';
import { estadoDaConsulta } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { NivelEngajamento } from '@/features/gestor/components/engajamento/NivelEngajamento';
import { EspecialidadesPraticadas } from '@/features/gestor/components/engajamento/EspecialidadesPraticadas';
import { KpisEngajamento } from '@/features/gestor/components/engajamento/KpisEngajamento';
import { QuemNaoVoltou } from '@/features/gestor/components/engajamento/QuemNaoVoltou';
import { useEngajamentoVisaoGeral } from '@/features/gestor/api/engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';

/**
 * Aba Visão geral do Engajamento. Todos os blocos, menos a tabela "Por aluno", as
 * listas e o drawer, vêm da RPC de visão geral, a mesma que o layout já consulta
 * (mesma chave de cache). O filtro "Sem atividade há 14 dias" da tabela fica aqui
 * porque "Quem não voltou" também o liga.
 */
export default function VisaoGeralEngajamento() {
  const filtros = useFiltrosEngajamento();
  const consulta = useEngajamentoVisaoGeral(filtros);
  const { data, meta } = consulta;

  // Filtro "Sem atividade há 14 dias" da tabela: vive aqui porque "Quem não voltou" também o liga.
  const [sem14, setSem14] = React.useState(false);
  // Aluno com o drawer aberto.
  const [alunoDrawer, setAlunoDrawer] = React.useState<string | null>(null);

  // "Filtrar na tabela de alunos" (Quem não voltou): liga "Sem atividade há 14 dias" e rola até a tabela.
  const filtrarNaTabela = React.useCallback(() => {
    setSem14(true);
    document.getElementById('consumo')?.scrollIntoView?.({ block: 'start' });
  }, []);

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

      <NivelEngajamento dados={data} consulta={consulta} filtros={filtros} />

      <ConsumoAlunos
        dados={data}
        consulta={consulta}
        filtros={filtros}
        sem14={sem14}
        onSem14Change={setSem14}
        onAbrirDetalhes={setAlunoDrawer}
      />

      {alunoDrawer ? (
        <DrawerAlunoEngajamento alunoId={alunoDrawer} filtros={filtros} onFechar={() => setAlunoDrawer(null)} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <QuemNaoVoltou dados={data} consulta={consulta} filtros={filtros} onFiltrarTabela={filtrarNaTabela} />
        <EspecialidadesPraticadas dados={data} consulta={consulta} />
      </div>

      <ComparativoSemestres dados={data} consulta={consulta} filtros={filtros} />
    </div>
  );
}
