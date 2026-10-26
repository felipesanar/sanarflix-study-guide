import * as React from 'react';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import type { OrdemAlunos, VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { deltaPct, deltaPp, dec1, diaMes, mesCurto, rotuloPeriodoAnterior } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { BarrasMensais, COR_BARRA_CLARA } from './BarrasMensais';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';
import { TabelaPorAluno } from './TabelaPorAluno';

export interface ConsumoAlunosProps {
  dados: VisaoGeralEngajamento | undefined;
  consulta: ConsultaDoBloco;
  filtros: FiltrosEngajamento;
  sem14: boolean;
  onSem14Change: (valor: boolean) => void;
  onAbrirDetalhes: (alunoId: string) => void;
}

const ABAS: Array<{ id: OrdemAlunos; rotulo: string }> = [
  { id: 'questoes', rotulo: 'Questões' },
  { id: 'videos', rotulo: 'Vídeos' },
  { id: 'documentos', rotulo: 'Documentos' },
];

const SEM_COMPARATIVO = 'sem comparativo para este período';

interface Cartao {
  titulo: string;
  valor: string;
  nota?: string;
}

function CartaoCinza({ titulo, valor, nota }: Cartao) {
  return (
    <div
      data-testid="consumo-kpi"
      style={{ padding: 14, borderRadius: 'var(--gp-radius-md)', background: 'var(--gp-surface-2)', border: '1px solid var(--gp-border-subtle)' }}
    >
      <div style={{ fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{titulo}</div>
      <div
        data-testid="consumo-kpi-valor"
        className="tabular-nums"
        style={{ marginTop: 2, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--gp-text-1)', lineHeight: '30px' }}
      >
        {valor}
      </div>
      {nota ? <div style={{ marginTop: 2, fontSize: 'var(--gp-font-size-apoio)', color: 'var(--gp-text-3)' }}>{nota}</div> : null}
    </div>
  );
}

/**
 * "Consumo dos alunos" (spec §12.2): abas Questões | Vídeos | Documentos que
 * trocam os 3 KPIs, o gráfico mensal e a ordenação da tabela "Por aluno".
 * Sem aluno filtrado os KPIs são do recorte da página; com aluno, comparam o aluno
 * com a média do semestre dele.
 */
export function ConsumoAlunos({ dados, consulta, filtros, sem14, onSem14Change, onAbrirDetalhes }: ConsumoAlunosProps) {
  const [aba, setAba] = React.useState<OrdemAlunos>('questoes');
  const refsAbas = React.useRef<Array<HTMLButtonElement | null>>([]);

  const aoTeclar = (e: React.KeyboardEvent, i: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const proxima = (i + passo + ABAS.length) % ABAS.length;
    setAba(ABAS[proxima].id);
    refsAbas.current[proxima]?.focus();
  };

  const k = dados?.kpis;
  const aluno = dados?.aluno ?? null;
  const alunoRecorte = dados?.aluno ? dados.recorte.aluno : null;
  const semestreFiltrado = dados?.recorte.semestre != null;
  const consumo = dados?.consumo;
  const base = k?.baseAtiva ?? 0;
  const rotuloAnterior = dados ? rotuloPeriodoAnterior(filtros.periodo, dados.periodo.dias) : '';
  const meses = dados?.meses ?? [];
  const ultimo = meses[meses.length - 1];

  const notaTotal = (atual: number, anterior: number | null, ies: number | null, comparavel: boolean): string => {
    if (semestreFiltrado) return `IES inteira: ${formatNumero(ies)}`;
    const delta = comparavel ? deltaPct(atual, anterior) : null;
    return delta ? `${delta} sobre os ${rotuloAnterior}` : SEM_COMPARATIVO;
  };

  const cartoes = (): Cartao[] => {
    if (!dados || !k || !consumo) return [];

    if (aba === 'questoes') {
      const q = consumo.questoes;
      if (aluno && alunoRecorte) {
        return [
          { titulo: 'Questões resolvidas', valor: formatNumero(k.questoes), nota: `média do semestre: ${formatNumero(aluno.mediaSemestreQuestoes)}` },
          { titulo: '% de acerto', valor: formatPct(k.acertoPct), nota: `média do semestre: ${formatPct(aluno.mediaSemestreAcertoPct)}` },
          { titulo: 'Dias com questões', valor: formatNumero(aluno.diasComQuestoes), nota: `de ${formatNumero(aluno.diasAtivos)} dias ativos` },
        ];
      }
      const deltaAcerto = dados.periodo.anterior.comparavelQuestoes ? deltaPp(q.acertoPct, q.acertoPctAnterior) : null;
      return [
        {
          titulo: 'Questões resolvidas',
          valor: formatNumero(q.total),
          nota: notaTotal(q.total, q.totalAnterior, q.totalIes, dados.periodo.anterior.comparavelQuestoes),
        },
        {
          titulo: '% de acerto',
          valor: formatPct(q.acertoPct),
          nota: semestreFiltrado
            ? `média da IES: ${formatPct(q.acertoPctIes)}`
            : deltaAcerto
              ? `${deltaAcerto} sobre os ${rotuloAnterior}`
              : SEM_COMPARATIVO,
        },
        { titulo: 'Alunos que resolveram', valor: `${formatNumero(q.alunos)} de ${formatNumero(base)}`, nota: `${formatNumero(base - q.alunos)} sem nenhuma questão no período` },
      ];
    }

    const video = aba === 'videos';
    const c = video ? consumo.videos : consumo.documentos;
    if (aluno && alunoRecorte) {
      const destaque = video ? aluno.especialidadeMaisAssistida : aluno.especialidadeMaisLida;
      const media = video ? aluno.mediaSemestreVideos : aluno.mediaSemestreDocumentos;
      return [
        { titulo: video ? 'Vídeos assistidos' : 'Documentos lidos', valor: formatNumero(c.total), nota: `média do semestre: ${dec1(media)}` },
        { titulo: 'Média por mês', valor: meses.length > 0 ? dec1(c.total / meses.length) : TRACO, nota: video ? 'vídeos' : 'documentos' },
        {
          titulo: video ? 'Especialidade mais assistida' : 'Especialidade mais lida',
          valor: destaque?.nome ?? TRACO,
          nota: destaque ? `${formatNumero(destaque.total)} ${video ? 'vídeos' : 'documentos'}` : undefined,
        },
      ];
    }
    return [
      {
        titulo: video ? 'Vídeos assistidos' : 'Documentos lidos',
        valor: formatNumero(c.total),
        nota: notaTotal(c.total, c.totalAnterior, c.totalIes, dados.periodo.anterior.comparavelConteudos),
      },
      {
        titulo: video ? 'Média por aluno que assistiu' : 'Média por aluno que leu',
        valor: c.alunos > 0 ? dec1(c.total / c.alunos) : TRACO,
        nota: video ? 'vídeos no período' : 'documentos no período',
      },
      {
        titulo: video ? 'Alunos que assistiram' : 'Alunos que leram',
        valor: `${formatNumero(c.alunos)} de ${formatNumero(base)}`,
        nota: `${formatNumero(base - c.alunos)} sem nenhum ${video ? 'vídeo' : 'documento'} no período`,
      },
    ];
  };

  const nomeSerie = aba === 'questoes' ? 'Questões resolvidas' : aba === 'videos' ? 'Vídeos assistidos' : 'Documentos lidos';
  const tituloGrafico = [
    `${nomeSerie} por mês`,
    alunoRecorte ? alunoRecorte.nome : null,
    dados && ultimo?.parcial ? `${mesCurto(ultimo.mes)} parcial até ${diaMes(dados.periodo.fim)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const valorMes = (m: VisaoGeralEngajamento['meses'][number]) => (aba === 'questoes' ? m.questoes : aba === 'videos' ? m.videos : m.documentos);

  return (
    <div id="consumo">
      <BlocoEngajamento
        sobretitulo="Acompanhamento"
        titulo="Consumo dos alunos"
        descricao="O que os alunos estão resolvendo, assistindo e lendo no SanarFlix · clique no nome para filtrar a página, na seta para ver o detalhe"
        consulta={consulta}
        alturaSkeleton={520}
        bloco="consumo-alunos"
      >
        <div role="tablist" aria-label="Tipo de consumo" className="inline-flex self-start" style={{ gap: 6 }}>
          {ABAS.map((a, i) => (
            <button
              key={a.id}
              ref={(el) => {
                refsAbas.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`aba-consumo-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls="painel-consumo"
              tabIndex={aba === a.id ? 0 : -1}
              onClick={() => setAba(a.id)}
              onKeyDown={(e) => aoTeclar(e, i)}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 'var(--gp-radius-pill)',
                fontSize: 'var(--gp-font-size-body)',
                fontWeight: 'var(--gp-font-weight-medio)',
                border: `1px solid ${aba === a.id ? 'var(--gp-brand-border)' : 'var(--gp-border-strong)'}`,
                background: aba === a.id ? 'var(--gp-brand-surface)' : 'transparent',
                color: 'var(--gp-text-1)',
              }}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div id="painel-consumo" role="tabpanel" aria-labelledby={`aba-consumo-${aba}`} className="flex flex-col" style={{ gap: 18 }}>
          <div className="grid gap-3 sm:grid-cols-3">
            {cartoes().map((c) => (
              <CartaoCinza key={c.titulo} {...c} />
            ))}
          </div>

          <div>
            <h3 style={{ fontSize: 'var(--gp-font-size-h3)', fontWeight: 'var(--gp-font-weight-forte)', marginBottom: 8 }}>{tituloGrafico}</h3>
            <BarrasMensais
              rotulo={tituloGrafico}
              corFechada={COR_BARRA_CLARA}
              corParcial={COR_BARRA_CLARA}
              pontos={meses.map((m) => ({ mes: m.mes, parcial: m.parcial, valor: valorMes(m), texto: formatNumero(valorMes(m)) }))}
            />
          </div>

          {dados ? (
            <TabelaPorAluno
              filtros={filtros}
              ordem={aba}
              sem14={sem14}
              onSem14Change={onSem14Change}
              iesNome={dados.ies.nome}
              onAbrirDetalhes={onAbrirDetalhes}
            />
          ) : null}
        </div>
      </BlocoEngajamento>
    </div>
  );
}
