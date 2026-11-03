/**
 * "Exportar" do cabeçalho do Engajamento (spec 2026-10-22-engajamento §10.7, D11, P16):
 * CSV em seções com os números AGREGADOS da aba atual. Não tem dado pessoal (nem
 * e-mail, nem id de aluno; só o nome do aluno filtrado, na linha do recorte), por
 * isso não depende de `podeExportar`.
 *
 * Toda seção abre com o título da seção e o recorte (período, semestre, aluno), na
 * mesma linha, para que um bloco recortado do arquivo continue dizendo de que
 * recorte é. Os números saem como aparecem na tela: contagens inteiras, percentuais
 * com 1 casa e vírgula (Excel pt-BR).
 */
import { secaoCsv, nomeArquivoCsv, type SecaoCsv } from '@/features/gestor/lib/exportarCsv';
import { formatData } from '@/features/gestor/lib/formatters';
import { dec1, mesAno, pct1, slugIes } from '@/features/gestor/lib/engajamento';
import type {
  ConteudosEngajamento,
  QuestoesEngajamento,
  VisaoGeralEngajamento,
} from '@/features/gestor/api/types-engajamento';

export type AbaExportavel = 'visao-geral' | 'questoes' | 'conteudos';

export interface RecorteExportacao {
  /** `'AAAA-MM-DD'`. */
  inicio: string;
  fim: string;
  semestre: number | null;
  /** Nome do aluno filtrado (só na Visão geral). */
  alunoNome?: string | null;
  /** Só na aba Conteúdos. */
  tipo?: 'todos' | 'video' | 'document';
}

const ROTULO_TIPO = { todos: 'Todos', video: 'Vídeo', document: 'Documento' } as const;

/** "Período: 01/05/2026 a 22/10/2026 · Semestre: Todos · Aluno: Todos" (+ "· Tipo: …" em Conteúdos). */
export function textoRecorteCsv(r: RecorteExportacao): string {
  const partes = [
    `Período: ${formatData(r.inicio)} a ${formatData(r.fim)}`,
    `Semestre: ${r.semestre === null ? 'Todos' : `${r.semestre}º`}`,
    `Aluno: ${r.alunoNome ? r.alunoNome : 'Todos'}`,
  ];
  if (r.tipo) partes.push(`Tipo: ${ROTULO_TIPO[r.tipo]}`);
  return partes.join(' · ');
}

/** Nome do arquivo (§10.7): `gestor-engajamento-<aba>-<slug da IES>-AAAA-MM-DD.csv`. */
export function nomeArquivoExportacao(aba: AbaExportavel, iesNome: string, agora?: Date): string {
  return nomeArquivoCsv(['engajamento', aba, slugIes(iesNome)], agora);
}

type Linha = Record<string, string | number | null>;

/** Monta uma seção a partir de linhas já com as chaves = cabeçalhos das colunas. */
function secao(nome: string, recorte: string, cabecalhos: string[], linhas: Linha[]): SecaoCsv<unknown> {
  return secaoCsv<Linha>({
    titulo: `${nome} · ${recorte}`,
    colunas: cabecalhos.map((c) => ({ cabecalho: c, valor: (l: Linha) => l[c] })),
    linhas,
  });
}

const mesRotulo = (mes: string, parcial: boolean) => `${mesAno(mes)}${parcial ? ' (parcial)' : ''}`;

const CICLO_SEMESTRE = { basico: 'Básico', clinico: 'Clínico', internato: 'Internato' } as const;

/** Visão geral: KPIs, mês a mês, hábito, níveis, recência, consumo, especialidades e comparativo (§10.7). */
export function secoesVisaoGeral(d: VisaoGeralEngajamento, r: RecorteExportacao): SecaoCsv<unknown>[] {
  const rec = textoRecorteCsv(r);
  const k = d.kpis;
  const porAluno = d.aluno !== null;
  const base = k.baseAtiva;
  const pctBase = (n: number) => pct1(base > 0 ? (100 * n) / base : null);
  const h = d.habito;
  const pctAtivos = (n: number) => pct1(h.ativosNoMes > 0 ? (100 * n) / h.ativosNoMes : null);

  const NOME_NIVEL: Record<string, string> = {
    frequente: 'Ativo e frequente',
    esporadico: 'Ativo, mas esporádico',
    parou: 'Era frequente e parou',
    nunca: 'Nunca engajou',
  };

  return [
    secao('Indicadores', rec, ['Indicador', 'Valor'], [
      { Indicador: 'Base ativa', Valor: k.baseAtiva },
      { Indicador: 'Alunos engajados', Valor: k.engajados },
      { Indicador: '% de alunos engajados', Valor: pct1(k.engajadosPct) },
      { Indicador: 'Sem retorno há 30+ dias', Valor: k.semRetorno30 },
      { Indicador: '% da base sem retorno há 30+ dias', Valor: pct1(k.semRetorno30Pct) },
      { Indicador: 'Questões resolvidas', Valor: k.questoes },
      { Indicador: 'Questões por aluno engajado', Valor: k.questoesPorEngajado },
      { Indicador: 'Acerto médio', Valor: pct1(k.acertoPct) },
    ]),
    porAluno
      ? secao('Dias ativos mês a mês', rec, ['Mês', 'Dias ativos'], d.meses.map((m) => ({ Mês: mesRotulo(m.mes, m.parcial), 'Dias ativos': m.diasAtivos })))
      : secao(
          'Engajamento mês a mês',
          rec,
          ['Mês', 'Alunos ativos', '% da base ativa'],
          d.meses.map((m) => ({ Mês: mesRotulo(m.mes, m.parcial), 'Alunos ativos': m.alunosAtivos, '% da base ativa': pct1(m.pctBase) })),
        ),
    secao(`Do acesso ao hábito (${mesAno(h.mes)})`, rec, ['Faixa', 'Alunos', '% dos ativos no mês'], [
      { Faixa: 'Base ativa', Alunos: base, '% dos ativos no mês': '' },
      { Faixa: 'Baixo engajamento (1 a 3 dias)', Alunos: h.baixo, '% dos ativos no mês': pctAtivos(h.baixo) },
      { Faixa: 'Médio engajamento (4 a 7 dias)', Alunos: h.medio, '% dos ativos no mês': pctAtivos(h.medio) },
      { Faixa: 'Alto engajamento (8 a 14 dias)', Alunos: h.alto, '% dos ativos no mês': pctAtivos(h.alto) },
      { Faixa: 'Altíssimo engajamento (15 dias ou mais)', Alunos: h.altissimo, '% dos ativos no mês': pctAtivos(h.altissimo) },
    ]),
    secao(
      'Nível de engajamento',
      rec,
      ['Categoria', 'Alunos', '% da base'],
      d.niveis.map((n) => ({ Categoria: NOME_NIVEL[n.nivel] ?? n.nivel, Alunos: n.total, '% da base': pctBase(n.total) })),
    ),
    secao('Quem não voltou', rec, ['Faixa', 'Alunos', '% da base'], [
      { Faixa: 'Ativos nos últimos 30 dias', Alunos: d.recencia.ativos30, '% da base': pctBase(d.recencia.ativos30) },
      { Faixa: 'Sumidos há 30–59 dias', Alunos: d.recencia.sumidos30a59, '% da base': pctBase(d.recencia.sumidos30a59) },
      { Faixa: 'Sumidos há 60+ dias', Alunos: d.recencia.sumidos60, '% da base': pctBase(d.recencia.sumidos60) },
      { Faixa: 'Nunca acessaram', Alunos: d.recencia.nuncaAcessou, '% da base': pctBase(d.recencia.nuncaAcessou) },
    ]),
    secao(
      'Consumo por mês',
      rec,
      ['Mês', 'Questões', '% de acerto', 'Vídeos', 'Documentos'],
      d.meses.map((m) => ({
        Mês: mesRotulo(m.mes, m.parcial),
        Questões: m.questoes,
        '% de acerto': pct1(m.acertoPct),
        Vídeos: m.videos,
        Documentos: m.documentos,
      })),
    ),
    secao(
      'Especialidades mais praticadas',
      rec,
      ['Especialidade', 'Questões', '% de acerto'],
      d.especialidades.map((e) => ({ Especialidade: e.nome, Questões: e.questoes, '% de acerto': pct1(e.acertoPct) })),
    ),
    secao(
      'Comparativo entre semestres',
      rec,
      ['Semestre', 'Ciclo', 'Base', 'Engajados', '% engajados', 'Vídeos / aluno', 'Docs / aluno', 'Questões / aluno', '% de acerto'],
      d.semestres.map((s) => ({
        Semestre: `${s.semestre}º`,
        Ciclo: CICLO_SEMESTRE[s.ciclo],
        Base: s.base,
        Engajados: s.engajados,
        '% engajados': pct1(s.engajadosPct),
        'Vídeos / aluno': dec1(s.videosPorEngajado),
        'Docs / aluno': dec1(s.documentosPorEngajado),
        'Questões / aluno': s.questoesPorEngajado,
        '% de acerto': pct1(s.acertoPct),
      })),
    ),
  ];
}

/** Questões: KPIs, evolução, por semestre e a taxonomia achatada (uma linha por nó de cada nível). */
export function secoesQuestoes(d: QuestoesEngajamento, r: RecorteExportacao): SecaoCsv<unknown>[] {
  const rec = textoRecorteCsv(r);
  const k = d.kpis;

  const arvore: Linha[] = [];
  const nivel = (ciclo: string, n1: string, n2: string, n3: string, no: { questoes: number; alunos: number; acertoPct: number | null }) =>
    arvore.push({ Ciclo: ciclo, 'Nível 1': n1, 'Nível 2': n2, 'Nível 3': n3, Questões: no.questoes, Alunos: no.alunos, 'Acerto %': pct1(no.acertoPct) });

  for (const g of d.arvore.clinico.grandesAreas) {
    nivel('Clínico', g.nome, '', '', g);
    for (const e of g.especialidades) {
      nivel('Clínico', g.nome, e.nome, '', e);
      for (const t of e.temas) nivel('Clínico', g.nome, e.nome, t.nome, t);
    }
  }
  for (const disc of d.arvore.basico.disciplinas) {
    nivel('Básico', disc.nome, '', '', disc);
    for (const a of disc.assuntos) nivel('Básico', disc.nome, a.nome, '', a);
  }

  return [
    secao('Indicadores', rec, ['Indicador', 'Valor'], [
      { Indicador: 'Questões resolvidas', Valor: k.questoes },
      { Indicador: 'Acerto', Valor: pct1(k.acertoPct) },
      { Indicador: 'Alunos que resolveram', Valor: k.alunos },
      { Indicador: 'Questões por aluno', Valor: k.porAluno },
    ]),
    secao(
      'Evolução mensal',
      rec,
      ['Mês', 'Questões', '% de acerto'],
      d.meses.map((m) => ({ Mês: mesRotulo(m.mes, m.parcial), Questões: m.questoes, '% de acerto': pct1(m.acertoPct) })),
    ),
    secao(
      'Por semestre',
      rec,
      ['Semestre', 'Questões', '% de acerto'],
      d.semestres.map((s) => ({ Semestre: `${s.semestre}º`, Questões: s.questoes, '% de acerto': pct1(s.acertoPct) })),
    ),
    secao('Taxonomia', rec, ['Ciclo', 'Nível 1', 'Nível 2', 'Nível 3', 'Questões', 'Alunos', 'Acerto %'], arvore),
  ];
}

/** Conteúdos: KPIs, evolução, por semestre e a árvore achatada (uma linha por nó de cada nível). */
export function secoesConteudos(d: ConteudosEngajamento, r: RecorteExportacao): SecaoCsv<unknown>[] {
  const rec = textoRecorteCsv(r);
  const k = d.kpis;

  const arvore: Linha[] = [];
  for (const e of d.arvore) {
    arvore.push({ Especialidade: e.especialidade, Módulo: '', Conteúdo: '', Tipo: '', Consumos: e.consumos, Alunos: e.alunos });
    for (const m of e.modulos) {
      arvore.push({ Especialidade: e.especialidade, Módulo: m.modulo, Conteúdo: '', Tipo: '', Consumos: m.consumos, Alunos: m.alunos });
      for (const c of m.conteudos) {
        arvore.push({
          Especialidade: e.especialidade,
          Módulo: m.modulo,
          Conteúdo: c.nome,
          Tipo: c.tipo === 'video' ? 'Vídeo' : 'Documento',
          Consumos: c.consumos,
          Alunos: c.alunos,
        });
      }
    }
  }

  return [
    secao('Indicadores', rec, ['Indicador', 'Valor'], [
      { Indicador: 'Conteúdos consumidos', Valor: k.consumos },
      { Indicador: 'Vídeos', Valor: k.videos },
      { Indicador: 'Documentos', Valor: k.documentos },
      { Indicador: 'Alunos que consumiram', Valor: k.alunos },
      { Indicador: 'Conteúdos por aluno', Valor: k.porAluno },
    ]),
    secao('Evolução mensal', rec, ['Mês', 'Consumos'], d.meses.map((m) => ({ Mês: mesRotulo(m.mes, m.parcial), Consumos: m.consumos }))),
    secao('Por semestre', rec, ['Semestre', 'Consumos'], d.semestres.map((s) => ({ Semestre: `${s.semestre}º`, Consumos: s.consumos }))),
    secao('Por especialidade', rec, ['Especialidade', 'Módulo', 'Conteúdo', 'Tipo', 'Consumos', 'Alunos'], arvore),
  ];
}
