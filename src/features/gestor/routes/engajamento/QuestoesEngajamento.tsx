import * as React from 'react';
import { BlocoEngajamento, estadoDaConsulta, type ConsultaDoBloco } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { BarrasPorSemestre } from '@/features/gestor/components/engajamento/BarrasPorSemestre';
import { GavetaTaxonomia } from '@/features/gestor/components/engajamento/GavetaTaxonomia';
import { KpisQuestoes } from '@/features/gestor/components/engajamento/KpisQuestoes';
import { eixoPct, LinhaMensal } from '@/features/gestor/components/engajamento/LinhaMensal';
import { SeletorMetrica, type OpcaoMetrica } from '@/features/gestor/components/engajamento/SeletorMetrica';
import { useEngajamentoQuestoes } from '@/features/gestor/api/engajamento';
import type { QuestoesEngajamento as Dados } from '@/features/gestor/api/types-engajamento';
import { useFiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { diaMes, mesExtenso } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';

type Metrica = 'quantidade' | 'pct';

const OPCOES: ReadonlyArray<OpcaoMetrica<Metrica>> = [
  { valor: 'quantidade', rotulo: 'Quantidade' },
  { valor: 'pct', rotulo: '% de acerto' },
];

const pctInteiro = (v: number) => `${Math.round(v)}%`;

function EvolucaoMensal({ dados, consulta, fim }: { dados: Dados | undefined; consulta: ConsultaDoBloco; fim: string }) {
  const [metrica, setMetrica] = React.useState<Metrica>('quantidade');
  const meses = dados?.meses ?? [];
  const ultimo = meses[meses.length - 1];
  const pct = metrica === 'pct';

  const eixo = eixoPct(meses.map((m) => m.acertoPct));
  const parcial = ultimo?.parcial ? ` · ${mesExtenso(ultimo.mes).toLowerCase()} parcial, até ${diaMes(fim)}` : '';
  const titulo = pct ? 'Evolução do % de acerto' : 'Evolução das questões resolvidas';
  const descricao = `${pct ? `Acerto médio por mês (eixo de ${eixo.min}% a ${eixo.max}%)` : 'Total de questões por mês'}${parcial}`;

  return (
    <BlocoEngajamento
      titulo={titulo}
      descricao={descricao}
      acao={<SeletorMetrica<Metrica> rotulo="Métrica da evolução" valor={metrica} opcoes={OPCOES} onChange={setMetrica} />}
      consulta={consulta}
      alturaSkeleton={300}
      bloco="questoes-evolucao"
    >
      <LinhaMensal
        rotulo={titulo}
        modo={metrica}
        formatar={pct ? pctInteiro : formatNumero}
        passoQuantidade={1000}
        pontos={meses.map((m) => ({ mes: m.mes, parcial: m.parcial, valor: pct ? m.acertoPct : m.questoes }))}
      />
    </BlocoEngajamento>
  );
}

function PorSemestre({ dados, consulta, semestre }: { dados: Dados | undefined; consulta: ConsultaDoBloco; semestre: number | null }) {
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
    >
      <BarrasPorSemestre
        rotulo={titulo}
        modo={metrica}
        selecionado={semestre}
        linhas={(dados?.semestres ?? []).map((s) => {
          const valor = pct ? s.acertoPct : s.questoes;
          return { semestre: s.semestre, valor, texto: valor === null ? TRACO : pct ? formatPct(valor) : formatNumero(valor) };
        })}
      />
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

  return (
    <div className="flex flex-col gap-4" data-testid="questoes-engajamento">
      <div aria-busy={ocupado ? true : undefined} className={ocupado ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <KpisQuestoes dados={data} meta={meta} estado={estadoDaConsulta(consulta)} onTentarNovamente={consulta.refetch} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EvolucaoMensal dados={data} consulta={consulta} fim={filtros.fim} />
        <PorSemestre dados={data} consulta={consulta} semestre={filtros.semestre} />
      </div>

      <GavetaTaxonomia dados={data} consulta={consulta} filtros={filtros} />
    </div>
  );
}
