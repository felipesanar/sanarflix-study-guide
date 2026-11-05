/**
 * Indicadores da turma (docs/02 § Tela 2, bloco 1). Anatomia do `KpiCard` do Gestor (44px), régua
 * "1º · anterior · atual" só com 2 pontos válidos, delta só com 2 pontos. Em V0 (sem simulado) os
 * indicadores viram engajamento.
 */
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { calcularVariacao } from '@/features/gestor/lib/regras';
import { TRACO, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { PontoSerie } from '@/features/gestor/api/types';
import type { AlunoTurmaAcademy, DesempenhoTurmaB2c, EngajamentoAluno, PontoSerieTurma, SimuladoMentor } from '../../api/types';
import { metaMentor } from '../../api/meta';
import { ativosNaSemana, formatDiaMes, mediaQuestoesAtivos, questoesPorAtivoNaSemana, regua3, type TurmaMontada } from './regrasTurma';

export interface KpisTurmaProps {
  estado: Exclude<EstadoKpi, 'empty'>;
  turma?: TurmaMontada;
  alunos?: AlunoTurmaAcademy[];
  desempenho?: DesempenhoTurmaB2c;
  serie?: PontoSerieTurma[];
  engajamento?: EngajamentoAluno[];
  onTentarNovamente?: () => void;
}

/** Série do simulado 1 até o último fechado, com o ponto atual igual ao valor exibido no cartão. */
function serieAteUltimo(serie: PontoSerieTurma[], ultimo: SimuladoMentor, valor: (p: PontoSerieTurma) => number | null, atual: number | null): PontoSerie[] {
  const ate = serie.filter((p) => p.fechado && (p.ordem ?? 0) <= ultimo.ordem && p.simuladoId !== ultimo.id)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((p) => ({ rotulo: String(p.ordem ?? ''), valor: valor(p) }));
  return regua3([...ate, { rotulo: 'atual', valor: atual }]);
}
/** Régua semanal "Sem −2 · Sem −1 · Atual" (só pontos válidos, mínimo 2). */
function reguaSemanas(sem2: number | null, sem1: number | null, atual: number | null): PontoSerie[] {
  const pts = [{ rotulo: 'Sem −2', valor: sem2 }, { rotulo: 'Sem −1', valor: sem1 }, { rotulo: 'Atual', valor: atual }].filter((p) => p.valor !== null);
  return pts.length >= 2 ? pts : [];
}
const deltaDa = (r: PontoSerie[]) => (r.length >= 2 ? calcularVariacao(r[r.length - 2].valor, r[r.length - 1].valor) : null);
const pct = (v: number | null) => formatPct(v);
const GRADE = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 } as const;

export function KpisTurma({ estado, turma, alunos = [], desempenho, serie = [], engajamento = [], onTentarNovamente }: KpisTurmaProps) {
  const comum = { estado, onTentarNovamente };
  const v0 = estado === 'ok' && !!turma?.v0;
  const n = Math.max(0, ...engajamento.map((a) => a.semanas.length));
  const semana = (f: (e: EngajamentoAluno[], i: number) => number | null, k: number) => (n - k >= 0 ? f(engajamento, n - k) : null);

  // Questões na semana: atual = últimos 7 dias (mentor_turma); semanas anteriores = semanas fechadas do engajamento.
  const qAtual = estado === 'ok' ? mediaQuestoesAtivos(alunos) : null;
  const qRegua = reguaSemanas(semana(questoesPorAtivoNaSemana, 3), semana(questoesPorAtivoNaSemana, 2), qAtual);
  const metaSemana = metaMentor({ periodo: 'Últimos 7 dias', criterio: 'Questões do banco nos últimos 7 dias ÷ alunos com acesso nos últimos 7 dias' });
  const questoes = (
    <KpiCard {...comum} testId="kpi-questoes-semana" titulo="Questões na semana" hint="média por aluno ativo, banco de questões"
      meta={metaSemana} valor={formatNumero(qAtual)} valorNumerico={qAtual} formatarValor={formatNumero}
      delta={deltaDa(qRegua)} serie={qRegua} formatarPonto={formatNumero} rodape="últimos 7 dias"
      {...(estado === 'ok' && qAtual === null ? { estado: 'empty' as const } : {})} />
  );

  if (v0) {
    const total = alunos.length;
    const ativos = alunos.filter((a) => a.segmento === 'ativo').length;
    const sumidos = alunos.filter((a) => a.segmento === 'sumido').length;
    const aRegua = reguaSemanas(semana(ativosNaSemana, 3), semana(ativosNaSemana, 2), ativos);
    return (
      <section aria-label="Indicadores da turma" style={GRADE}>
        <KpiCard {...comum} estado="empty" testId="kpi-possivel-aprovacao" titulo="Possível aprovação" hint="acima do corte no último simulado"
          meta={metaMentor({ periodo: 'Sem simulado', criterio: 'Participantes com acerto ≥ corte da meta mais difícil' })} valor={TRACO}
          rodape="Precisa de simulados e de Metas (previsto para novembro)." />
        <KpiCard {...comum} testId="kpi-ativos-semana" titulo="Ativos na semana" hint="acessaram nos últimos 7 dias"
          meta={metaMentor({ periodo: 'Últimos 7 dias', criterio: 'Alunos com atividade de estudo nos últimos 7 dias' })}
          valor={formatNumero(ativos)} valorNumerico={ativos} formatarValor={formatNumero} sufixo={`/ ${formatNumero(total)}`}
          delta={deltaDa(aRegua)} serie={aRegua} formatarPonto={formatNumero} rodape="último acesso = última atividade no Flix" />
        {questoes}
        <KpiCard {...comum} testId="kpi-sem-acesso" titulo="Sem acesso há 15+ dias" hint="mesmo corte do alerta Sumiram"
          meta={metaMentor({ periodo: 'Hoje', criterio: 'Sem atividade de estudo há 15 dias ou mais' })}
          valor={formatNumero(sumidos)} valorNumerico={sumidos} formatarValor={formatNumero} sufixo="alunos"
          rodape="Abra o segmento Sumidos abaixo." />
      </section>
    );
  }

  const ultimo = turma?.ultimo ?? null;
  // Sem simulado fechado não há participação a mostrar (nunca "0 / N" inventado).
  const fizeram = ultimo ? desempenho?.participacaoUltimo.fizeram ?? null : null;
  const total = ultimo ? desempenho?.participacaoUltimo.total ?? null : null;
  const aprovacao = desempenho?.possivelAprovacaoPct ?? null;
  const acerto = desempenho?.acertoMedioUltimo ?? null;
  const pronto = estado === 'ok' && !!ultimo;
  const rAprov = pronto ? serieAteUltimo(serie, ultimo!, (p) => p.acimaCortePct, aprovacao) : [];
  const rAcerto = pronto ? serieAteUltimo(serie, ultimo!, (p) => p.acertoMedio, acerto) : [];
  const rPart = pronto ? serieAteUltimo(serie, ultimo!, (p) => p.participantes, fizeram) : [];
  const acima = turma?.linhas.filter((l) => l.fezUltimo && l.vsCortePp !== null && l.vsCortePp >= 0).length ?? 0;
  const ref = ultimo ? `${ultimo.ordem}º simulado` : 'último simulado';
  const meta = (criterio: string) => metaMentor({ periodo: ultimo?.nome ?? 'Último simulado', criterio });
  const vazio = (v: number | null) => (estado === 'ok' && v === null ? { estado: 'empty' as const } : {});
  const fechou = formatDiaMes(ultimo?.data ?? null);

  return (
    <section aria-label="Indicadores da turma" style={GRADE}>
      <KpiCard {...comum} {...vazio(aprovacao)} testId="kpi-possivel-aprovacao" titulo="Possível aprovação" hint="acima do corte da meta mais difícil"
        meta={meta('Participantes com acerto ≥ corte da meta mais difícil (Metas)')} valor={pct(aprovacao)} valorNumerico={aprovacao} formatarValor={pct}
        delta={deltaDa(rAprov)} serie={rAprov} formatarPonto={pct}
        rodape={aprovacao === null ? 'Precisa de Metas (previsto para novembro).' : `${acima} de ${formatNumero(fizeram)} participantes do ${ref}`} />
      <KpiCard {...comum} {...vazio(acerto)} testId="kpi-acerto-medio" titulo="Acerto médio" hint="no último simulado · anulada fica fora"
        meta={meta('Questões certas ÷ respondidas; anulada fica fora')} valor={pct(acerto)} valorNumerico={acerto} formatarValor={pct}
        delta={deltaDa(rAcerto)} serie={rAcerto} formatarPonto={pct} rodape={`média dos ${formatNumero(fizeram)} participantes`} />
      {questoes}
      <KpiCard {...comum} {...vazio(fizeram)} testId="kpi-participacao" titulo="Participação" hint="no último simulado"
        meta={meta('Alunos da turma que fizeram o último simulado fechado')} valor={formatNumero(fizeram)} valorNumerico={fizeram}
        formatarValor={formatNumero} sufixo={`/ ${formatNumero(total)}`} delta={deltaDa(rPart)} serie={rPart} formatarPonto={formatNumero}
        rodape={fizeram === null || total === null ? undefined : `${total - fizeram} não fizeram${fechou ? ` · fechou em ${fechou}` : ''}`} />
    </section>
  );
}
