import * as React from 'react';
import { BarrasPorSemestre } from '@/features/gestor/components/engajamento/BarrasPorSemestre';
import { ComCarregamentoInicial, ROTEIRO_CONTEUDOS } from '@/features/gestor/components/engajamento/CarregamentoEngajamento';
import { BlocoEngajamento, estadoDaConsulta } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { FiltroTipoConteudo } from '@/features/gestor/components/engajamento/FiltroTipoConteudo';
import { GavetaConteudos } from '@/features/gestor/components/engajamento/GavetaConteudos';
import { KpisConteudos } from '@/features/gestor/components/engajamento/KpisConteudos';
import { LinhaMensal } from '@/features/gestor/components/engajamento/LinhaMensal';
import { useEngajamentoConteudos, useEngajamentoVisaoGeral } from '@/features/gestor/api/engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { diaMes, evolucaoPorDia, mesExtenso, rotuloDia } from '@/features/gestor/lib/engajamento';
import { formatNumero } from '@/features/gestor/lib/formatters';

/** Altura das barras de "Conteúdos por semestre": com ela o bloco fica da altura da Evolução ao lado. */
const ALTURA_BARRAS = 190;

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

  // Só os semestres que a IES tem (base ativa > 0). A base vem da visão geral, que o layout já consulta
  // (mesma chave de cache) e que ignora o filtro de semestre. Enquanto ela não chega, vale quem tem consumo.
  const baseDosSemestres = useEngajamentoVisaoGeral(filtros).data?.semestres;

  const meses = data?.meses ?? [];
  const ultimo = meses[meses.length - 1];
  const semestresDaIes = (data?.semestres ?? []).filter((s) =>
    baseDosSemestres ? baseDosSemestres.some((b) => b.semestre === s.semestre && b.base > 0) : s.consumos > 0,
  );
  // Período de até 31 dias: a Evolução vai dia a dia; acima disso, consolidado por mês.
  const dias = data?.dias ?? [];
  const porDia = evolucaoPorDia(filtros.inicio, filtros.fim) && dias.length > 0;
  const pontosEvolucao = porDia
    ? dias.map((d, i) => ({ mes: d.dia, rotulo: rotuloDia(d.dia, i === 0), parcial: false, valor: d.consumos }))
    : meses.map((m) => ({ mes: m.mes, parcial: m.parcial, valor: m.consumos }));
  const parcial = !porDia && ultimo?.parcial ? ` · ${mesExtenso(ultimo.mes).toLowerCase()} parcial, até ${diaMes(filtros.fim)}` : '';

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="conteudos-engajamento">
      <FiltroTipoConteudo tipo={filtros.tipo} setTipo={filtros.setTipo} />

      <ComCarregamentoInicial carregando={estadoDaConsulta(consulta) === 'loading'} roteiro={ROTEIRO_CONTEUDOS}>
        <div aria-busy={ocupado ? true : undefined} className={ocupado ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <KpisConteudos dados={data} meta={meta} tipo={filtros.tipo} estado={estadoDaConsulta(consulta)} onTentarNovamente={consulta.refetch} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <BlocoEngajamento
            titulo="Evolução dos conteúdos consumidos"
            descricao={`Total por ${porDia ? 'dia' : 'mês'}${parcial}`}
            consulta={consulta}
            alturaSkeleton={300}
            bloco="conteudos-evolucao"
            preencherAltura
          >
            <LinhaMensal
              rotulo="Evolução dos conteúdos consumidos"
              modo="quantidade"
              formatar={formatNumero}
              passoQuantidade={porDia ? 'auto' : 500}
              pontos={pontosEvolucao}
            />
          </BlocoEngajamento>

          <BlocoEngajamento
            titulo="Conteúdos por semestre"
            descricao="Total consumido no período por alunos de cada semestre"
            consulta={consulta}
            alturaSkeleton={300}
            bloco="conteudos-por-semestre"
            preencherAltura
          >
            {/* Mesma altura da Evolução ao lado: a folga fica acima das barras. */}
            <div className="flex flex-1 flex-col justify-end">
              <BarrasPorSemestre
                rotulo="Conteúdos por semestre"
                modo="quantidade"
                selecionado={filtros.semestre}
                altura={ALTURA_BARRAS}
                linhas={semestresDaIes.map((s) => ({ semestre: s.semestre, valor: s.consumos, texto: formatNumero(s.consumos) }))}
              />
            </div>
          </BlocoEngajamento>
        </div>

        <GavetaConteudos dados={data} consulta={consulta} filtros={filtros} />
      </ComCarregamentoInicial>
    </div>
  );
}
