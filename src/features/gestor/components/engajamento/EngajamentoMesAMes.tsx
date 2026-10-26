import * as React from 'react';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { diaMes, mesExtenso, primeiroNome } from '@/features/gestor/lib/engajamento';
import type { VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { BarrasMensais } from './BarrasMensais';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';

export interface EngajamentoMesAMesProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
}

/**
 * "Engajamento mês a mês" (spec §12.2): % da base ativa com ao menos 1 atividade
 * em cada mês, com a quantidade de alunos embaixo. Com aluno filtrado vira "Dias
 * ativos mês a mês" ("N d"). Mês parcial leva `*` no rótulo e o rodapé diz até
 * que dia vai.
 */
export function EngajamentoMesAMes({ dados, consulta }: EngajamentoMesAMesProps) {
  const alunoRecorte = dados?.aluno ? dados.recorte.aluno : null;
  const titulo = alunoRecorte ? 'Dias ativos mês a mês' : 'Engajamento mês a mês';
  const descricao = alunoRecorte
    ? `Dias em que ${primeiroNome(alunoRecorte.nome)} teve ao menos 1 atividade`
    : '% da base ativa com ao menos 1 atividade no mês';

  const meses = dados?.meses ?? [];
  const ultimo = meses[meses.length - 1];
  const rodape =
    dados && ultimo?.parcial ? `${mesExtenso(ultimo.mes)} parcial, até ${diaMes(dados.periodo.fim)}.` : undefined;

  const pontos = meses.map((m) =>
    alunoRecorte
      ? { mes: m.mes, parcial: m.parcial, valor: m.diasAtivos ?? 0, texto: `${formatNumero(m.diasAtivos ?? 0)} d` }
      : {
          mes: m.mes,
          parcial: m.parcial,
          valor: m.pctBase ?? 0,
          texto: formatPct(m.pctBase),
          sub: `${formatNumero(m.alunosAtivos)} alunos`,
        },
  );

  return (
    <BlocoEngajamento
      titulo={titulo}
      descricao={descricao}
      consulta={consulta}
      alturaSkeleton={260}
      bloco="engajamento-mes-a-mes"
      rodape={rodape}
    >
      <BarrasMensais rotulo={titulo} pontos={pontos} />
    </BlocoEngajamento>
  );
}
