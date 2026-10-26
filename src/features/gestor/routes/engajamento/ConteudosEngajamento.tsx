import * as React from 'react';
import { BarrasPorSemestre } from '@/features/gestor/components/engajamento/BarrasPorSemestre';
import { BlocoEngajamento, estadoDaConsulta } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { FiltroTipoConteudo } from '@/features/gestor/components/engajamento/FiltroTipoConteudo';
import { GavetaConteudos } from '@/features/gestor/components/engajamento/GavetaConteudos';
import { KpisConteudos } from '@/features/gestor/components/engajamento/KpisConteudos';
import { LinhaMensal } from '@/features/gestor/components/engajamento/LinhaMensal';
import { useEngajamentoConteudos } from '@/features/gestor/api/engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { diaMes, mesExtenso } from '@/features/gestor/lib/engajamento';
import { formatNumero } from '@/features/gestor/lib/formatters';

/**
 * Aba Conteúdos do Engajamento (spec §9.4). Tudo vem de
 * `get_gestor_engajamento_conteudos`, recalculada pelo tipo (Todos, Vídeo, Documento);
 * só o pop-up de um conteúdo tem a sua própria consulta.
 */
export default function ConteudosEngajamento() {
  const filtros = useFiltrosEngajamento();
  const consulta = useEngajamentoConteudos(filtros);
  const { data, meta } = consulta;
  const ocupado = consulta.isPlaceholderData === true;

  const meses = data?.meses ?? [];
  const ultimo = meses[meses.length - 1];
  const parcial = ultimo?.parcial ? ` · ${mesExtenso(ultimo.mes).toLowerCase()} parcial, até ${diaMes(filtros.fim)}` : '';

  return (
    <div className="flex flex-col gap-4" data-testid="conteudos-engajamento">
      <FiltroTipoConteudo tipo={filtros.tipo} setTipo={filtros.setTipo} />

      <div aria-busy={ocupado ? true : undefined} className={ocupado ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <KpisConteudos dados={data} meta={meta} tipo={filtros.tipo} estado={estadoDaConsulta(consulta)} onTentarNovamente={consulta.refetch} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BlocoEngajamento
          titulo="Evolução dos conteúdos consumidos"
          descricao={`Total por mês${parcial}`}
          consulta={consulta}
          alturaSkeleton={300}
          bloco="conteudos-evolucao"
        >
          <LinhaMensal
            rotulo="Evolução dos conteúdos consumidos"
            modo="quantidade"
            formatar={formatNumero}
            passoQuantidade={500}
            pontos={meses.map((m) => ({ mes: m.mes, parcial: m.parcial, valor: m.consumos }))}
          />
        </BlocoEngajamento>

        <BlocoEngajamento
          titulo="Conteúdos por semestre"
          descricao="Total consumido no período por alunos de cada semestre"
          consulta={consulta}
          alturaSkeleton={300}
          bloco="conteudos-por-semestre"
        >
          <BarrasPorSemestre
            rotulo="Conteúdos por semestre"
            modo="quantidade"
            selecionado={filtros.semestre}
            linhas={(data?.semestres ?? []).map((s) => ({ semestre: s.semestre, valor: s.consumos, texto: formatNumero(s.consumos) }))}
          />
        </BlocoEngajamento>
      </div>

      <GavetaConteudos dados={data} consulta={consulta} filtros={filtros} />
    </div>
  );
}
