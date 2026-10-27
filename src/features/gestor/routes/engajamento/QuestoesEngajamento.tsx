import * as React from 'react';
import { BlocoEngajamento, estadoDaConsulta, type ConsultaDoBloco } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { BarrasPorSemestre } from '@/features/gestor/components/engajamento/BarrasPorSemestre';
import { GavetaTaxonomia } from '@/features/gestor/components/engajamento/GavetaTaxonomia';
import { KpisQuestoes } from '@/features/gestor/components/engajamento/KpisQuestoes';
import { eixoPct, LinhaMensal } from '@/features/gestor/components/engajamento/LinhaMensal';
import { SeletorMetrica, type OpcaoMetrica } from '@/features/gestor/components/engajamento/SeletorMetrica';
import { useEngajamentoQuestoes, useEngajamentoVisaoGeral } from '@/features/gestor/api/engajamento';
import type { QuestoesEngajamento as Dados } from '@/features/gestor/api/types-engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { diaMes, evolucaoPorDia, mesExtenso, rotuloDia } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';

type Metrica = 'quantidade' | 'pct';

const OPCOES: ReadonlyArray<OpcaoMetrica<Metrica>> = [
  { valor: 'quantidade', rotulo: 'Quantidade' },
  { valor: 'pct', rotulo: '% de acerto' },
];

const pctInteiro = (v: number) => `${Math.round(v)}%`;

/** Altura das barras de "por semestre": com ela o bloco fica da altura da Evolução ao lado. */
const ALTURA_BARRAS = 190;

/**
 * Evolução: período de até 31 dias mostra os dados por dia; acima disso, o consolidado por mês.
 */
function EvolucaoMensal({
  dados,
  consulta,
  inicio,
  fim,
}: {
  dados: Dados | undefined;
  consulta: ConsultaDoBloco;
  inicio: string;
  fim: string;
}) {
  const [metrica, setMetrica] = React.useState<Metrica>('quantidade');
  const meses = dados?.meses ?? [];
  const dias = dados?.dias ?? [];
  const ultimo = meses[meses.length - 1];
  const pct = metrica === 'pct';
  const porDia = evolucaoPorDia(inicio, fim) && dias.length > 0;
  const unidade = porDia ? 'dia' : 'mês';

  const pontos = porDia
    ? dias.map((d, i) => ({ mes: d.dia, rotulo: rotuloDia(d.dia, i === 0), parcial: false, valor: pct ? d.acertoPct : d.questoes }))
    : meses.map((m) => ({ mes: m.mes, parcial: m.parcial, valor: pct ? m.acertoPct : m.questoes }));
  const eixo = eixoPct(pontos.map((p) => p.valor));
  const parcial = !porDia && ultimo?.parcial ? ` · ${mesExtenso(ultimo.mes).toLowerCase()} parcial, até ${diaMes(fim)}` : '';
  const titulo = pct ? 'Evolução do % de acerto' : 'Evolução das questões resolvidas';
  const descricao = `${pct ? `Acerto médio por ${unidade} (eixo de ${eixo.min}% a ${eixo.max}%)` : `Total de questões por ${unidade}`}${parcial}`;

  return (
    <BlocoEngajamento
      titulo={titulo}
      descricao={descricao}
      acao={<SeletorMetrica<Metrica> rotulo="Métrica da evolução" valor={metrica} opcoes={OPCOES} onChange={setMetrica} />}
      consulta={consulta}
      alturaSkeleton={300}
      bloco="questoes-evolucao"
      preencherAltura
    >
      <LinhaMensal
        rotulo={titulo}
        modo={metrica}
        formatar={pct ? pctInteiro : formatNumero}
        passoQuantidade={porDia ? 'auto' : 1000}
        pontos={pontos}
      />
    </BlocoEngajamento>
  );
}

function PorSemestre({
  dados,
  consulta,
  semestre,
  semestresDaIes,
}: {
  dados: Dados | undefined;
  consulta: ConsultaDoBloco;
  semestre: number | null;
  /** Semestres com alunos na base ativa da IES; `undefined` = a base ainda não chegou. */
  semestresDaIes: ReadonlySet<number> | undefined;
}) {
  const [metrica, setMetrica] = React.useState<Metrica>('quantidade');
  const pct = metrica === 'pct';
  const titulo = pct ? '% de acerto por semestre' : 'Questões por semestre';

  return (
    <BlocoEngajamento
      titulo={titulo}
      descricao={
        pct
          ? 'Acerto médio dos alunos de cada semestre (barra cheia = 100%)'
          : 'Total resolvido no período por alunos de cada semestre'
      }
      acao={<SeletorMetrica<Metrica> rotulo="Métrica por semestre" valor={metrica} opcoes={OPCOES} onChange={setMetrica} />}
      consulta={consulta}
      alturaSkeleton={300}
      bloco="questoes-por-semestre"
      preencherAltura
    >
      {/* Mesma altura da Evolução ao lado: a folga fica acima das barras. */}
      <div className="flex flex-1 flex-col justify-end">
        <BarrasPorSemestre
          rotulo={titulo}
          modo={metrica}
          selecionado={semestre}
          altura={ALTURA_BARRAS}
          linhas={(dados?.semestres ?? [])
            .filter((s) => (semestresDaIes ? semestresDaIes.has(s.semestre) : s.questoes > 0))
            .map((s) => {
              const valor = pct ? s.acertoPct : s.questoes;
              return { semestre: s.semestre, valor, texto: valor === null ? TRACO : pct ? formatPct(valor) : formatNumero(valor) };
            })}
        />
      </div>
    </BlocoEngajamento>
  );
}

/**
 * Aba Questões do Engajamento (spec §9.3). Tudo vem de `get_gestor_engajamento_questoes`,
 * com o recorte de período e semestre; só o pop-up de alunos de um tema ou assunto
 * tem a sua própria consulta.
 */
export default function QuestoesEngajamento() {
  const filtros = useFiltrosEngajamento();
  const consulta = useEngajamentoQuestoes(filtros);
  const { data, meta } = consulta;
  const ocupado = consulta.isPlaceholderData === true;

  // Só os semestres que a IES tem (base ativa > 0). A base vem da visão geral, que o layout já consulta
  // (mesma chave de cache) e que ignora o filtro de semestre. Enquanto ela não chega, vale quem tem questões.
  const baseDosSemestres = useEngajamentoVisaoGeral(filtros).data?.semestres;
  const semestresDaIes = React.useMemo(
    () => (baseDosSemestres ? new Set(baseDosSemestres.filter((s) => s.base > 0).map((s) => s.semestre)) : undefined),
    [baseDosSemestres],
  );

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="questoes-engajamento">
      <div aria-busy={ocupado ? true : undefined} className={ocupado ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <KpisQuestoes dados={data} meta={meta} estado={estadoDaConsulta(consulta)} onTentarNovamente={consulta.refetch} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EvolucaoMensal dados={data} consulta={consulta} inicio={filtros.inicio} fim={filtros.fim} />
        <PorSemestre dados={data} consulta={consulta} semestre={filtros.semestre} semestresDaIes={semestresDaIes} />
      </div>

      <GavetaTaxonomia dados={data} consulta={consulta} filtros={filtros} />
    </div>
  );
}
