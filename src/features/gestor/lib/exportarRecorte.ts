/**
 * Exportação do RECORTE INSTITUCIONAL — o relatório que existia no painel
 * institucional antigo, agora como terceira opção do Início ("Exportar dados").
 *
 * Dois formatos, mesmo conteúdo:
 *  - PDF: relatório de leitura (capa vinho, seções, KPIs, tabelas zebradas,
 *    rodapé paginado) desenhado por `lib/relatorioPdf.ts`.
 *  - XLSX: planilha formatada — uma aba por bloco, largura de coluna,
 *    cabeçalho congelado e formato numérico por coluna.
 *
 * O gestor ESCOLHE os blocos (`BlocoExport`). Blocos que dependem de simulado
 * selecionado só ficam disponíveis quando há simulado no recorte; a lista
 * nominal de alunos é opcional, sai desmarcada e leva aviso de LGPD no arquivo.
 *
 * Regras de dado (CLAUDE.md §2): nada é inventado. Valor ausente sai como
 * TRAÇO no PDF e como célula VAZIA no XLSX — nunca zero.
 */

import * as XLSX from 'xlsx';
import type {
  Detalhamento,
  LinhaAluno,
  Meta,
  Questao,
  VisaoGeral,
} from '@/features/gestor/api/types';
import {
  ROTULO_GRUPO_PLURAL,
  ROTULO_NIVEL,
  ROTULO_TENDENCIA,
  TRACO,
  rotuloGrupo,
} from '@/features/gestor/lib/rotulos';
import { NIVEL_CRITICO_MAX, NIVEL_EXCELENTE_MIN, nivelDesempenho } from '@/features/gestor/lib/regras';
import { Relatorio, type Celula, type Coluna } from '@/features/gestor/lib/relatorioPdf';

export type FormatoExport = 'pdf' | 'xlsx';

export type BlocoExport =
  | 'indicadores'
  | 'evolucao'
  | 'areas'
  | 'distribuicao'
  | 'metricasSimulados'
  | 'acertoSemestre'
  | 'questoes'
  | 'alunos';

export interface DefinicaoBloco {
  id: BlocoExport;
  titulo: string;
  descricao: string;
  /** `true` quando o bloco só existe com simulado escolhido no recorte. */
  exigeSimulado?: boolean;
  /** `true` quando o bloco só existe com UM simulado escolhido. */
  exigeSimuladoUnico?: boolean;
  /** `true` para bloco com dado nominal de aluno (LGPD). */
  nominal?: boolean;
}

/** Catálogo dos blocos exportáveis, na ordem em que entram no arquivo. */
export const BLOCOS_EXPORT: readonly DefinicaoBloco[] = [
  {
    id: 'indicadores',
    titulo: 'Indicadores do recorte',
    descricao: 'Conceito ENAMED, proficiência, acerto médio e simulados com nota.',
  },
  {
    id: 'evolucao',
    titulo: 'Evolução institucional',
    descricao: 'Proficiência e participantes simulado a simulado.',
  },
  {
    id: 'areas',
    titulo: 'Acerto por grande área',
    descricao: 'Percentual de acerto e classificação de cada grande área.',
  },
  {
    id: 'distribuicao',
    titulo: 'Distribuição de alunos',
    descricao: 'Quantos alunos estão em cada grupo de evolução.',
  },
  {
    id: 'metricasSimulados',
    titulo: 'Resultado por simulado',
    descricao: 'Participantes, acerto médio e proficiência de cada simulado escolhido.',
    exigeSimulado: true,
  },
  {
    id: 'acertoSemestre',
    titulo: 'Acerto por semestre',
    descricao: 'Percentual de acerto de cada semestre nos simulados escolhidos.',
    exigeSimulado: true,
  },
  {
    id: 'questoes',
    titulo: 'Questão por questão',
    descricao: 'Acerto de cada questão, com área, especialidade e tema.',
    exigeSimuladoUnico: true,
  },
  {
    id: 'alunos',
    titulo: 'Lista de alunos',
    descricao: 'Nome, semestre, grupo e proficiência de cada aluno do recorte.',
    nominal: true,
  },
];

export const BLOCOS_PADRAO: readonly BlocoExport[] = [
  'indicadores',
  'evolucao',
  'areas',
  'distribuicao',
];

export interface DadosExportRecorte {
  iesNome: string;
  /** Rótulo legível do recorte de semestre, ex.: "6º ano" / "Geral" / "8º período". */
  semestreRotulo: string;
  /** Nomes dos simulados escolhidos no recorte (vazio = nenhum escolhido). */
  simuladosRotulos?: string[];
  visaoGeral: VisaoGeral;
  detalhamento?: Detalhamento;
  questoes?: Questao[];
  alunos?: LinhaAluno[];
  meta?: Meta;
}

const AVISO_LGPD =
  'Este arquivo contém dados nominais de alunos. Trate como informação pessoal: compartilhe apenas com quem tem finalidade pedagógica legítima e não publique em canais abertos (LGPD, art. 6º).';

const pct = (valor: number | null | undefined): string =>
  valor === null || valor === undefined || Number.isNaN(valor)
    ? TRACO
    : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const num = (valor: number | null | undefined): string =>
  valor === null || valor === undefined || Number.isNaN(valor)
    ? TRACO
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const dataBr = (iso: string | null): string => {
  if (!iso) return TRACO;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? TRACO : d.toLocaleDateString('pt-BR');
};

/** Célula de planilha: `null` vira vazio (nunca 0) — mesma regra do TRAÇO na UI. */
/** Grupo de evolução com inicial maiúscula — no arquivo ele é rótulo de coluna, não texto corrido. */
const rotuloGrupoTitulo = (grupo: keyof typeof ROTULO_GRUPO_PLURAL): string => {
  const texto = ROTULO_GRUPO_PLURAL[grupo];
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const celula = (valor: number | null | undefined): number | null =>
  valor === null || valor === undefined || Number.isNaN(valor) ? null : valor;

/** Blocos que o recorte atual comporta — a UI usa isto para habilitar as opções. */
export function blocosDisponiveis(quantidadeSimulados: number): Set<BlocoExport> {
  const disponiveis = new Set<BlocoExport>();
  BLOCOS_EXPORT.forEach((bloco) => {
    if (bloco.exigeSimuladoUnico && quantidadeSimulados !== 1) return;
    if (bloco.exigeSimulado && quantidadeSimulados < 1) return;
    disponiveis.add(bloco.id);
  });
  return disponiveis;
}

export function nomeArquivoExport(dados: DadosExportRecorte, ext: FormatoExport): string {
  const agora = new Date();
  const data = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');
  const miolo = [dados.iesNome, dados.semestreRotulo]
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `relatorio-${miolo || 'recorte'}-${data}.${ext}`;
}

/* ------------------------------- blocos de dado ------------------------------ */

/**
 * Tom da célula derivado da RÉGUA ÚNICA (`nivelDesempenho`, `lib/regras.ts`) —
 * o arquivo nunca reimplementa o corte de nível.
 */
const nivelDoAcerto = (valor: number | null): Celula['tom'] => {
  const nivel = nivelDesempenho(valor);
  if (nivel === null) return 'suave';
  if (nivel === 'excelente') return 'sucesso';
  if (nivel === 'critico') return 'perigo';
  return 'normal';
};

interface Tabela {
  colunas: Coluna[];
  linhas: Celula[][];
}

function tabelaEvolucao(vg: VisaoGeral): Tabela {
  return {
    colunas: [
      { titulo: 'Ordem', fracao: 0.12 },
      { titulo: 'Simulado', fracao: 0.42 },
      { titulo: 'Data', fracao: 0.14, alinhar: 'centro' },
      { titulo: 'Proficiência', fracao: 0.16, alinhar: 'direita' },
      { titulo: 'Participantes', fracao: 0.16, alinhar: 'direita' },
    ],
    linhas: vg.evolucao.map((ponto, i) => [
      { texto: `${i + 1}º`, tom: 'suave' as const },
      { texto: ponto.nome },
      { texto: dataBr(ponto.data), tom: 'suave' as const },
      { texto: pct(ponto.valor), negrito: true },
      { texto: num(ponto.participantes) },
    ]),
  };
}

function tabelaAreas(vg: VisaoGeral): Tabela {
  return {
    colunas: [
      { titulo: 'Grande área', fracao: 0.5 },
      { titulo: 'Acerto', fracao: 0.2, alinhar: 'direita' },
      { titulo: 'Classificação', fracao: 0.3 },
    ],
    linhas: vg.diagnosticoResumo.flatMap((bloco) =>
      bloco.areas.map((area) => [
        { texto: area.nome },
        { texto: pct(area.acertoPct), negrito: true, tom: nivelDoAcerto(area.acertoPct) },
        { texto: ROTULO_NIVEL[bloco.nivel], tom: 'suave' as const },
      ]),
    ),
  };
}

function tabelaDistribuicao(vg: VisaoGeral): Tabela {
  return {
    colunas: [
      { titulo: 'Grupo', fracao: 0.56 },
      { titulo: 'Alunos', fracao: 0.22, alinhar: 'direita' },
      { titulo: '% do recorte', fracao: 0.22, alinhar: 'direita' },
    ],
    linhas: vg.distribuicaoAlunos.map((item) => [
      { texto: rotuloGrupoTitulo(item.grupo) },
      { texto: num(item.quantidade), negrito: true },
      { texto: pct(item.percentual) },
    ]),
  };
}

function tabelaMetricas(det: Detalhamento | undefined): Tabela {
  return {
    colunas: [
      { titulo: 'Simulado', fracao: 0.36 },
      { titulo: 'Data', fracao: 0.13, alinhar: 'centro' },
      { titulo: 'Participantes', fracao: 0.15, alinhar: 'direita' },
      { titulo: 'Acerto médio', fracao: 0.14, alinhar: 'direita' },
      { titulo: 'Proficiência', fracao: 0.13, alinhar: 'direita' },
      { titulo: 'ENAMED', fracao: 0.09, alinhar: 'direita' },
    ],
    linhas: (det?.metricas ?? []).map((m) => [
      { texto: m.nome },
      { texto: dataBr(m.data), tom: 'suave' as const },
      { texto: num(m.participantes) },
      { texto: pct(m.acertoMedioPct) },
      { texto: pct(m.proficienciaMedia), negrito: true },
      { texto: num(m.enamedProjetado) },
    ]),
  };
}

function tabelaAcertoSemestre(det: Detalhamento | undefined): Tabela {
  return {
    colunas: [
      { titulo: 'Semestre', fracao: 0.5 },
      { titulo: 'Acerto', fracao: 0.25, alinhar: 'direita' },
      { titulo: 'Em evidência', fracao: 0.25, alinhar: 'centro' },
    ],
    linhas: (det?.acertoPorAreaESemestre.semestres ?? []).map((s) => [
      { texto: `${s.semestre}º período` },
      { texto: pct(s.acertoPct), negrito: true, tom: nivelDoAcerto(s.acertoPct) },
      { texto: s.emEvidencia ? 'Sim' : TRACO, tom: 'suave' as const },
    ]),
  };
}

function tabelaQuestoes(questoes: Questao[] | undefined): Tabela {
  return {
    colunas: [
      { titulo: 'Nº', fracao: 0.07, alinhar: 'centro' },
      { titulo: 'Grande área', fracao: 0.22 },
      { titulo: 'Especialidade', fracao: 0.24 },
      { titulo: 'Tema', fracao: 0.31 },
      { titulo: 'Acerto', fracao: 0.16, alinhar: 'direita' },
    ],
    linhas: (questoes ?? []).map((q) => [
      { texto: String(q.numero), tom: 'suave' as const },
      { texto: q.grandeArea },
      { texto: q.especialidade },
      { texto: q.tema },
      { texto: pct(q.acertoPct), negrito: true, tom: nivelDoAcerto(q.acertoPct) },
    ]),
  };
}

function tabelaAlunos(alunos: LinhaAluno[] | undefined): Tabela {
  const linhas = (alunos ?? []).map((aluno) => {
    const notas = aluno.proficiencias.map((p) => p.valor).filter((v): v is number => v !== null);
    const ultima = notas.length > 0 ? notas[notas.length - 1] : null;
    return [
      { texto: aluno.nome },
      { texto: aluno.semestre === null ? TRACO : `${aluno.semestre}º`, tom: 'suave' as const },
      { texto: rotuloGrupo(aluno.grupo) },
      { texto: ROTULO_TENDENCIA[aluno.tendencia], tom: 'suave' as const },
      { texto: num(notas.length) },
      { texto: pct(ultima), negrito: true, tom: nivelDoAcerto(ultima) },
    ] satisfies Celula[];
  });
  return {
    colunas: [
      { titulo: 'Aluno', fracao: 0.34 },
      { titulo: 'Sem.', fracao: 0.08, alinhar: 'centro' },
      { titulo: 'Grupo', fracao: 0.24 },
      { titulo: 'Tendência', fracao: 0.12 },
      { titulo: 'Notas', fracao: 0.09, alinhar: 'direita' },
      { titulo: 'Proficiência', fracao: 0.13, alinhar: 'direita' },
    ],
    linhas,
  };
}

/* ----------------------------------- PDF ----------------------------------- */

export function exportarRecortePdf(dados: DadosExportRecorte, blocos: BlocoExport[]): string {
  const vg = dados.visaoGeral;
  const escolhidos = BLOCOS_EXPORT.filter((b) => blocos.includes(b.id));
  const relatorio = new Relatorio();
  const geradoEm = new Date().toLocaleString('pt-BR');

  const linhasCapa = [
    `Recorte de semestre: ${dados.semestreRotulo}`,
    dados.meta?.periodo ? `Período: ${dados.meta.periodo}` : '',
    dados.simuladosRotulos && dados.simuladosRotulos.length > 0
      ? `Simulados: ${dados.simuladosRotulos.join(' · ')}`
      : 'Simulados: todos os do recorte',
  ].filter(Boolean);

  relatorio.capa({
    instituicao: dados.iesNome,
    recorte: dados.semestreRotulo,
    linhas: linhasCapa,
    dataExtenso: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  });

  if (escolhidos.length > 1) relatorio.sumario(escolhidos.map((b) => b.titulo));

  escolhidos.forEach((bloco) => {
    switch (bloco.id) {
      case 'indicadores': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        relatorio.kpis([
          {
            rotulo: 'Conceito ENAMED projetado (1–5)',
            valor: num(vg.kpis.enamedProjetado.valor),
            observacao: vg.kpis.enamedProjetado.origem === 'oficial' ? 'Nota oficial' : 'Estimado',
          },
          { rotulo: 'Alunos proficientes', valor: pct(vg.kpis.proficientesPct.valor) },
          { rotulo: 'Acerto médio', valor: pct(vg.kpis.acertoPct.valor) },
          {
            rotulo: 'Simulados com nota',
            valor: String(vg.kpis.simulados.realizados),
            observacao:
              vg.kpis.simulados.contratados === null
                ? 'Sem contrato cadastrado'
                : `de ${vg.kpis.simulados.contratados} contratados`,
          },
          {
            rotulo: 'Alunos matriculados no recorte',
            valor: num(vg.alunosMatriculadosNoRecorte),
          },
        ]);
        relatorio.nota(
          'Onde não há dado medido o relatório mostra “—”. Nenhum valor é estimado além do conceito ENAMED marcado como tal.',
        );
        break;
      }
      case 'evolucao': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        const t = tabelaEvolucao(vg);
        relatorio.tabela(t.colunas, t.linhas, 'Nenhum simulado com nota neste recorte.');
        break;
      }
      case 'areas': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        const t = tabelaAreas(vg);
        relatorio.tabela(t.colunas, t.linhas);
        relatorio.nota(
          `Classificação por percentual de acerto: excelente a partir de ${NIVEL_EXCELENTE_MIN}%, crítico até ${NIVEL_CRITICO_MAX}%, mediano no intervalo entre os dois.`,
        );
        break;
      }
      case 'distribuicao': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        const t = tabelaDistribuicao(vg);
        relatorio.tabela(t.colunas, t.linhas);
        break;
      }
      case 'metricasSimulados': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        const t = tabelaMetricas(dados.detalhamento);
        relatorio.tabela(t.colunas, t.linhas, 'Nenhum simulado escolhido no recorte.');
        break;
      }
      case 'acertoSemestre': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        const t = tabelaAcertoSemestre(dados.detalhamento);
        relatorio.tabela(t.colunas, t.linhas, 'Sem acerto por semestre neste recorte.');
        break;
      }
      case 'questoes': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        const t = tabelaQuestoes(dados.questoes);
        relatorio.tabela(t.colunas, t.linhas, 'Questões indisponíveis para este simulado.');
        break;
      }
      case 'alunos': {
        relatorio.secao(bloco.titulo, bloco.descricao);
        relatorio.nota(AVISO_LGPD, true);
        relatorio.subtitulo(`${dados.alunos?.length ?? 0} alunos incluídos`);
        const t = tabelaAlunos(dados.alunos);
        relatorio.tabela(t.colunas, t.linhas, 'Nenhum aluno com resultado neste recorte.');
        break;
      }
      default:
        break;
    }
  });

  return relatorio.finalizar(nomeArquivoExport(dados, 'pdf'), geradoEm);
}

/* ----------------------------------- XLSX ---------------------------------- */

/** Formato numérico por coluna (SheetJS: `z` na célula) — percentual com 1 casa. */
function aplicarFormato(
  aba: XLSX.WorkSheet,
  colunasPct: number[],
  totalLinhas: number,
  primeiraLinha = 1,
) {
  colunasPct.forEach((col) => {
    for (let i = 0; i < totalLinhas; i += 1) {
      const ref = XLSX.utils.encode_cell({ r: primeiraLinha + i, c: col });
      const celulaAba = aba[ref] as XLSX.CellObject | undefined;
      if (celulaAba && typeof celulaAba.v === 'number') celulaAba.z = '0.0"%"';
    }
  });
}

export function exportarRecorteXlsx(dados: DadosExportRecorte, blocos: BlocoExport[]): string {
  const vg = dados.visaoGeral;
  const livro = XLSX.utils.book_new();

  const capa = XLSX.utils.aoa_to_sheet([
    ['Relatório de desempenho institucional'],
    ['Instituição', dados.iesNome || TRACO],
    ['Recorte de semestre', dados.semestreRotulo],
    [
      'Simulados',
      dados.simuladosRotulos && dados.simuladosRotulos.length > 0
        ? dados.simuladosRotulos.join(' · ')
        : 'Todos os do recorte',
    ],
    ['Período', dados.meta?.periodo ?? TRACO],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Blocos', BLOCOS_EXPORT.filter((b) => blocos.includes(b.id)).map((b) => b.titulo).join(' · ')],
    [],
    ['Células vazias significam dado não medido — nunca zero.'],
    ...(blocos.includes('alunos') ? [[AVISO_LGPD]] : []),
  ]);
  capa['!cols'] = [{ wch: 24 }, { wch: 78 }];
  capa['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(livro, capa, 'Capa');

  if (blocos.includes('indicadores')) {
    const resumo = XLSX.utils.aoa_to_sheet([
      ['Indicador', 'Valor', 'Observação'],
      [
        'Conceito ENAMED projetado (1–5)',
        celula(vg.kpis.enamedProjetado.valor),
        vg.kpis.enamedProjetado.origem === 'oficial' ? 'Nota oficial' : 'Estimado',
      ],
      ['Alunos proficientes (%)', celula(vg.kpis.proficientesPct.valor), ''],
      ['Acerto médio (%)', celula(vg.kpis.acertoPct.valor), ''],
      [
        'Simulados com nota',
        vg.kpis.simulados.realizados,
        vg.kpis.simulados.contratados === null
          ? 'Sem contrato cadastrado'
          : `de ${vg.kpis.simulados.contratados} contratados`,
      ],
      ['Alunos matriculados no recorte', vg.alunosMatriculadosNoRecorte, ''],
    ]);
    resumo['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 30 }];
    resumo['!freeze'] = 'A2';
    XLSX.utils.book_append_sheet(livro, resumo, 'Indicadores');
  }

  if (blocos.includes('evolucao')) {
    const evolucao = XLSX.utils.aoa_to_sheet([
      ['Ordem', 'Simulado', 'Data', 'Proficiência (%)', 'Participantes'],
      ...vg.evolucao.map((ponto, i) => [
        `${i + 1}º simulado`,
        ponto.nome,
        dataBr(ponto.data),
        celula(ponto.valor),
        ponto.participantes,
      ]),
    ]);
    evolucao['!cols'] = [{ wch: 12 }, { wch: 46 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
    evolucao['!freeze'] = 'A2';
    aplicarFormato(evolucao, [3], vg.evolucao.length);
    XLSX.utils.book_append_sheet(livro, evolucao, 'Evolução');
  }

  if (blocos.includes('areas')) {
    const areas = XLSX.utils.aoa_to_sheet([
      ['Grande área', 'Acerto (%)', 'Classificação'],
      ...vg.diagnosticoResumo.flatMap((bloco) =>
        bloco.areas.map((area) => [area.nome, celula(area.acertoPct), ROTULO_NIVEL[bloco.nivel]]),
      ),
    ]);
    areas['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 24 }];
    areas['!freeze'] = 'A2';
    aplicarFormato(areas, [1], vg.diagnosticoResumo.reduce((total, b) => total + b.areas.length, 0));
    XLSX.utils.book_append_sheet(livro, areas, 'Acerto por área');
  }

  if (blocos.includes('distribuicao')) {
    const distribuicao = XLSX.utils.aoa_to_sheet([
      ['Grupo', 'Alunos', '% do recorte'],
      ...vg.distribuicaoAlunos.map((item) => [
        rotuloGrupoTitulo(item.grupo),
        item.quantidade,
        celula(item.percentual),
      ]),
    ]);
    distribuicao['!cols'] = [{ wch: 38 }, { wch: 10 }, { wch: 14 }];
    distribuicao['!freeze'] = 'A2';
    aplicarFormato(distribuicao, [2], vg.distribuicaoAlunos.length);
    XLSX.utils.book_append_sheet(livro, distribuicao, 'Distribuição');
  }

  if (blocos.includes('metricasSimulados')) {
    const metricas = dados.detalhamento?.metricas ?? [];
    const aba = XLSX.utils.aoa_to_sheet([
      ['Simulado', 'Data', 'Participantes', 'Acerto médio (%)', 'Proficiência média (%)', 'ENAMED projetado'],
      ...metricas.map((m) => [
        m.nome,
        dataBr(m.data),
        m.participantes,
        celula(m.acertoMedioPct),
        celula(m.proficienciaMedia),
        celula(m.enamedProjetado),
      ]),
    ]);
    aba['!cols'] = [{ wch: 46 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];
    aba['!freeze'] = 'A2';
    aplicarFormato(aba, [3, 4], metricas.length);
    XLSX.utils.book_append_sheet(livro, aba, 'Simulados');
  }

  if (blocos.includes('acertoSemestre')) {
    const semestres = dados.detalhamento?.acertoPorAreaESemestre.semestres ?? [];
    const aba = XLSX.utils.aoa_to_sheet([
      ['Semestre', 'Acerto (%)', 'Em evidência'],
      ...semestres.map((s) => [`${s.semestre}º período`, celula(s.acertoPct), s.emEvidencia ? 'Sim' : '']),
    ]);
    aba['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 14 }];
    aba['!freeze'] = 'A2';
    aplicarFormato(aba, [1], semestres.length);
    XLSX.utils.book_append_sheet(livro, aba, 'Acerto por semestre');
  }

  if (blocos.includes('questoes')) {
    const questoes = dados.questoes ?? [];
    const aba = XLSX.utils.aoa_to_sheet([
      ['Nº', 'Grande área', 'Especialidade', 'Tema', 'Acerto (%)'],
      ...questoes.map((q) => [q.numero, q.grandeArea, q.especialidade, q.tema, celula(q.acertoPct)]),
    ]);
    aba['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 30 }, { wch: 44 }, { wch: 12 }];
    aba['!freeze'] = 'A2';
    aplicarFormato(aba, [4], questoes.length);
    XLSX.utils.book_append_sheet(livro, aba, 'Questões');
  }

  if (blocos.includes('alunos')) {
    const alunos = dados.alunos ?? [];
    const aba = XLSX.utils.aoa_to_sheet([
      [AVISO_LGPD],
      [`${alunos.length} alunos incluídos`],
      [],
      ['Aluno', 'Semestre', 'Grupo', 'Tendência', 'Simulados com nota', 'Última proficiência (%)'],
      ...alunos.map((aluno) => {
        const notas = aluno.proficiencias.map((p) => p.valor).filter((v): v is number => v !== null);
        return [
          aluno.nome,
          aluno.semestre,
          rotuloGrupo(aluno.grupo),
          ROTULO_TENDENCIA[aluno.tendencia],
          notas.length,
          celula(notas.length > 0 ? notas[notas.length - 1] : null),
        ];
      }),
    ]);
    aba['!cols'] = [{ wch: 38 }, { wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 22 }];
    aba['!freeze'] = 'A5';
    aplicarFormato(aba, [5], alunos.length, 4);
    XLSX.utils.book_append_sheet(livro, aba, 'Alunos');
  }

  const arquivo = nomeArquivoExport(dados, 'xlsx');
  XLSX.writeFile(livro, arquivo);
  return arquivo;
}

export function exportarRecorte(
  formato: FormatoExport,
  dados: DadosExportRecorte,
  blocos: BlocoExport[] = [...BLOCOS_PADRAO],
): string {
  return formato === 'pdf' ? exportarRecortePdf(dados, blocos) : exportarRecorteXlsx(dados, blocos);
}
