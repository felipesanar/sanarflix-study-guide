/**
 * fonteMock (`VITE_MENTOR_FONTE=mock`; só dev, testes e inspeção visual — nunca o padrão).
 *
 * Tudo vem dos protótipos (`api/mock/b2c.ts`: tribo Carcará; `api/mock/b2b.ts`: UniAtenas Paracatu), com
 * latência simulada de 250 ms e estado mutável em memória: publicar, editar, excluir, criar sessão,
 * mover card etc. valem durante a sessão. Cada `criarMock` tem o próprio estado.
 *
 * Imita o Academy: as ações já criam/movem os cards (`eventosNoServidor = true`).
 */
import { ErroFonte, type AlunoFlix, type ConviteFlix, type FonteMentoria, type MeFlix, type NovaPublicacao } from './fonte';
import { dataHoraSp, type ComMeta, type DadosAcademy, type EventoSql, ROTULO_TIPO_SESSAO } from './fonteAcademy';
import { identidadeTribo } from '../tema/contexto';
import type {
  AcertoArea,
  AlunoB2b,
  AlunoTurmaAcademy,
  CanalTurma,
  DesempenhoAlunoB2c,
  DesempenhoTurmaB2c,
  DetalhamentoMentor,
  GrupoEvolucao,
  Intervencao,
  ItemRotinaAcademy,
  OrigemIntervencao,
  PerfilB2B,
  Perola,
  Publicacao,
  QuestaoMentor,
  QuestaoResumoMentor,
  Sessao,
  SimuladoMentor,
  StatusIntervencao,
  TemaTurmaMentor,
  TipoIntervencao,
  VisaoGeralB2b,
} from './types';
import * as B2C from './mock/b2c';
import * as B2B from './mock/b2b';

export const LATENCIA_MOCK_MS = 250;
export type ModalidadeMock = 'b2c' | 'b2b';

// ─── Utilitários ────────────────────────────────────────────────────────────

const ANO = 2026;
/** dd/mm (+ hora local) → ISO UTC, fuso de São Paulo (-03:00). */
function iso(ddmm: string, hora = 12, ano = ANO): string {
  const [dd, mm] = ddmm.split('/');
  return new Date(`${ano}-${mm}-${dd}T${String(hora).padStart(2, '0')}:00:00-03:00`).toISOString();
}
const diasAntes = (ref: string, dias: number) => new Date(new Date(ref).getTime() - dias * 86_400_000).toISOString();
const MESES: Record<string, string> = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
const ULTIMO_DIA: Record<string, string> = { '02': '28', '04': '30', '06': '30', '09': '30', '11': '30' };
function acessoAte(mmAa: string): string {
  const [m, a] = mmAa.split('/');
  const mm = MESES[m];
  return `20${a}-${mm}-${ULTIMO_DIA[mm] ?? '31'}`;
}
const emailDe = (nome: string) =>
  `${nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).slice(0, 2).join('.')}@exemplo.com`;
const segmentoDe = (dias: number | null) => (dias == null ? 'sem_dado' : dias >= 15 ? 'sumido' : dias >= 8 ? 'esfriando' : 'ativo') as AlunoTurmaAcademy['segmento'];
const agora = () => new Date().toISOString();
const clonar = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PERFIL: Record<string, PerfilB2B> = { virada: 'virada', baixo: 'muito_baixo', bom: 'muito_bom' };
const PREV = { Alta: 'alta', 'Média': 'media', Baixa: 'baixa' } as const;
const PESO = { Alta: 3, 'Média': 2, Baixa: 1 } as const;
const TAG = { Desempenho: 'desempenho', Aviso: 'aviso', 'Fique por dentro': 'fique_por_dentro' } as const;

function grupoDe(p: (number | null)[]): GrupoEvolucao | null {
  const v = p.filter((x): x is number => x != null);
  if (!v.length) return null;
  const n = v.filter((x) => x >= 60).length;
  return n === v.length ? 'consistentemente_proficiente' : n === 0 ? 'consistentemente_nao_proficiente' : 'em_variacao';
}

// ─── Estado ─────────────────────────────────────────────────────────────────

interface Estado {
  modalidade: ModalidadeMock;
  me: MeFlix;
  alunos: AlunoTurmaAcademy[];
  /** aluno → notas (B2C: acerto %, B2B: proficiência) por simulado realizado, na ordem. */
  notas: Record<string, (number | null)[]>;
  acertoB2b: Record<string, number | null>;
  perfil: Record<string, PerfilB2B | null>;
  simulados: SimuladoMentor[];
  temas: TemaTurmaMentor[];
  areas: AcertoArea[];
  questoes: QuestaoMentor[];
  publicacoes: Publicacao[];
  sessoes: Sessao[];
  convites: ConviteFlix[];
  canais: CanalTurma[];
  cards: Intervencao[];
  rotina: Record<string, ItemRotinaAcademy[]>;
  perolas: Perola[];
  sinalizacoes: Record<string, string>;
  log: Record<string, { tipo: string; em: string; payload: Record<string, unknown> }[]>;
  b2b: { visao: VisaoGeralB2b; questoesResumo: QuestaoResumoMentor[] } | null;
  seq: number;
}

function areasDoPrototipo(): AcertoArea[] {
  return B2C.AREAS_ACERTO.map(([area, acerto]) => {
    const esps = B2C.AREA_ESP[area] ?? [];
    return {
      grandeArea: area,
      acertoPct: acerto,
      respostas: esps.reduce((s, e) => s + e[2], 0),
      especialidades: esps.map(([esp, ac, resp, temas]) => ({
        especialidade: esp, acertoPct: ac, respostas: resp,
        temas: (temas ?? []).map(([t, r, a]) => ({ tema: t, acertoPct: a, respostas: r })),
      })),
      temas: esps.flatMap(([esp, , , temas]) => (temas ?? []).map(([t, r, a]) => ({ tema: `${esp} > ${t}`, acertoPct: a, respostas: r }))),
    };
  });
}

function questoesDoPrototipo(simuladoId: string, participantes: number, emails: string[]): QuestaoMentor[] {
  return B2C.QUESTOES_PROTO.map((q) => {
    const domEmails = emails.slice(0, Math.min(q.domN, emails.length));
    return {
      questaoId: `mock-q-${q.n}`, simuladoId, ordem: 5, numero: q.n, grandeArea: q.area, especialidade: q.esp,
      tema: `${q.esp} > ${q.tema}`, temaCurto: q.tema, dificuldade: null, enunciado: q.enun, imagens: [],
      explicacao: null, explicacaoImagemUrl: null, respostas: participantes, acertoPct: q.acerto,
      alternativas: q.alts.map(([l, pct]) => ({
        label: l, texto: q.textos[l] ?? null, correta: l === q.certa, n: Math.round((pct * participantes) / 100), pct,
        emails: l === q.certa ? null : l === q.dom ? domEmails : [],
      })),
      branco: { n: 0, emails: [] },
    };
  });
}

function resumoDe(q: QuestaoMentor): QuestaoResumoMentor {
  return {
    questaoId: q.questaoId, numero: q.numero, ordem: q.ordem, grandeArea: q.grandeArea, especialidade: q.especialidade, tema: q.tema,
    temaCurto: q.temaCurto, dificuldade: q.dificuldade, enunciadoInicio: q.enunciado?.slice(0, 140) ?? null, temImagem: q.imagens.length > 0,
    corretaLabel: q.alternativas.find((a) => a.correta)?.label ?? null, acertoPct: q.acertoPct, respostas: q.respostas,
    distribuicao: Object.fromEntries(q.alternativas.map((a) => [a.label, a.n])),
    emailsPorAlternativa: Object.fromEntries(q.alternativas.filter((a) => a.emails?.length).map((a) => [a.label, a.emails!])),
  };
}

function alunoTurma(p: { nome: string; tel: string | null; semestre: number | null; acesso: string | null; dias: number; ref: string; meta: AlunoTurmaAcademy['meta']; b2b: boolean }): AlunoTurmaAcademy {
  const q30 = p.dias >= 15 ? Math.max(0, 18 - p.dias) : Math.round(260 - p.dias * 14);
  const q7 = Math.round(q30 / 4);
  const acertos = (n: number) => Math.round(n * 0.7);
  return {
    email: emailDe(p.nome), nome: p.nome, telefone: p.tel ? p.tel.replace(/\D/g, '') : null, semestre: p.semestre, acessoAte: p.acesso,
    b2b: p.b2b, academyUserId: null, sanarflixUserId: null, ultimaAtividade: diasAntes(p.ref, p.dias), diasSemAtividade: p.dias,
    segmento: segmentoDe(p.dias), meta: p.meta,
    conteudos7d: { videos: Math.round(q7 / 9), documentos: Math.round(q7 / 22), total: Math.round(q7 / 9) + Math.round(q7 / 22) },
    conteudos30d: { videos: Math.round(q30 / 9), documentos: Math.round(q30 / 22), total: Math.round(q30 / 9) + Math.round(q30 / 22) },
    temDadoConsumo: true,
    questoes7d: { respondidas: q7, acertos: acertos(q7), erros: q7 - acertos(q7), pctAcerto: q7 ? Math.round((1000 * acertos(q7)) / q7) / 10 : null },
    questoes30d: { respondidas: q30, acertos: acertos(q30), erros: q30 - acertos(q30), pctAcerto: q30 ? Math.round((1000 * acertos(q30)) / q30) / 10 : null },
    temDadoQuestoes: true,
  };
}

function cardBase(id: string, tipo: TipoIntervencao, titulo: string, alunoIds: string[], turmaToda: boolean, origem: OrigemIntervencao, status: StatusIntervencao, criadaEm: string, extra: Partial<Intervencao> = {}): Intervencao {
  return {
    id, tipo, titulo, nota: null, destino: turmaToda ? { turmaToda: true, alunoIds } : { alunoIds }, perfil: null, status, origem,
    referenciaId: null, criadaEm, historico: [{ em: criadaEm, texto: 'Intervenção criada' }], comentarios: [], peso: turmaToda ? 1 : Math.max(alunoIds.length, 1),
    tipoOriginal: { individual: 'reuniao_individual', coletiva: 'reuniao_coletiva', mensagem: 'mensagem_mural' }[tipo], ...extra,
  };
}

function estadoB2c(): Estado {
  const ref = B2C.HOJE_PROTOTIPO_B2C;
  const t = B2C.MENTOR_B2C.tribo;
  const ident = identidadeTribo('carcara');
  const email = (id: string) => emailDe(B2C.ALUNOS_B2C.find((a) => a.id === id)!.nome);
  const alunos = B2C.ALUNOS_B2C.map((a) => alunoTurma({
    nome: a.nome, tel: a.tel, semestre: null, acesso: acessoAte(a.acesso), dias: a.dias, ref, b2b: false,
    meta: { especialidade: a.meta, instituicao: a.inst, cortePct: a.corte },
  }));
  const simulados: SimuladoMentor[] = B2C.SIMULADOS_B2C.map(([ordem, nome, data, part, , , status]) => ({
    id: `mock-sim-${ordem}`, ordem, nome, data: iso(data, 23), status, participantes: part,
  }));
  const regrediram = B2C.ALUNOS_B2C.filter((a) => { const v = a.sims.filter((x): x is number => x != null); return v.length >= 2 && v[v.length - 2] - v[v.length - 1] >= 5; }).map((a) => email(a.id));
  const sumiram = B2C.ALUNOS_B2C.filter((a) => a.dias >= 15).map((a) => email(a.id));
  const emailsPorUltimo = [...B2C.ALUNOS_B2C].sort((x, y) => (x.sims[4] ?? -1) - (y.sims[4] ?? -1)).map((a) => email(a.id));
  const quem = (q: string) => (q === 'turma' ? [] : q === 'sumiram' ? sumiram : q === 'regrediram' ? regrediram : [email(q)]);
  const sessoes: Sessao[] = B2C.SESSOES_B2C.map(([ddmm, hora, tipo, q, tema, meet, status, grav], i) => sessaoMock(`mock-sessao-${i + 1}`, {
    inicio: iso(ddmm, hora), tipo, tema, alunoId: q === 'turma' ? null : email(q), link: meet, status, gravacaoUrl: grav ? `https://drive.google.com/mock-gravacao-${i + 1}` : null,
  }));
  return {
    modalidade: 'b2c',
    me: {
      mentor: { id: B2C.MENTOR_B2C.id, nome: B2C.MENTOR_B2C.nome, fotoUrl: null, agendaUrl: B2C.MENTOR_B2C.agendaUrl, modalidade: 'b2c', bio: null, mote: null, googleEmail: null, ativo: true },
      tribos: [{ id: t.id, nome: t.nome, slug: t.slug, modalidade: 'b2c', papel: 'titular', mentoriaAtiva: true, lema: ident.lema, iconeUrl: null, cores: ident.cores, iesId: null, iesNome: null, campus: null, encontrosPorMes: null, totalAlunos: alunos.length }],
      portalMentor: true,
    },
    alunos,
    notas: Object.fromEntries(B2C.ALUNOS_B2C.map((a) => [email(a.id), a.sims])),
    acertoB2b: {},
    perfil: {},
    simulados,
    temas: B2C.TEMAS_B2C.map(([tema, area, prev, acerto, resp, abaixo]) => ({
      id: slug(tema), tema, especialidade: null, grandeArea: area, prevalencia: PREV[prev], peso: PESO[prev], respostas: resp, acertoPct: acerto,
      alunosAbaixo50: emailsPorUltimo.slice(0, Math.min(abaixo, emailsPorUltimo.length)), critico: resp >= 30, serie: [{ simuladoId: 'mock-sim-5', acertoPct: acerto }],
    })),
    areas: areasDoPrototipo(),
    questoes: questoesDoPrototipo('mock-sim-5', 62, emailsPorUltimo),
    publicacoes: B2C.MURAL_B2C.map(([titulo, tag, para, ddmm], i) => ({
      id: `mock-pub-${i + 1}`, tag: TAG[tag], titulo, mensagem: titulo, link: null, anexoUrl: null,
      destino: para === 'turma' ? { tipo: 'turma' } : { tipo: 'selecionados', alunoIds: quem(para) },
      status: 'publicada', publicadaEm: iso(ddmm), editadaEm: null, fixada: false, anexoNome: null, origem: 'mentor', tagOriginal: null,
    })),
    sessoes,
    convites: B2C.AGENDA_LIBERADA_B2C.map(([id, ddmm], i) => ({
      id: `mock-convite-${i + 1}`, alunoId: email(id), alunoNome: B2C.ALUNOS_B2C.find((a) => a.id === id)!.nome, publicacaoId: null,
      mensagem: 'Liberei minha agenda pra você. Escolha um horário.', ativo: true, liberadoEm: iso(ddmm),
    })),
    canais: canaisMock(B2C.CANAIS_B2C.grupo),
    cards: B2C.CARDS_B2C.map(([tipo, titulo, q, origem, ddmm, status, nota], i) =>
      cardBase(`mock-card-${i + 1}`, tipo, titulo, quem(q), q === 'turma', origem, status, iso(ddmm), { nota: nota ?? null })),
    rotina: {},
    perolas: [],
    sinalizacoes: {},
    log: Object.fromEntries(Object.entries(B2C.LOGS_B2C).map(([id, l]) => [email(id), l.map(([tipo, texto, ddmm]) => ({ tipo, em: iso(ddmm), payload: { texto } }))])),
    b2b: null,
    seq: 100,
  };
}

function estadoB2b(): Estado {
  const ref = B2B.HOJE_PROTOTIPO_B2B;
  const m = B2B.MENTOR_B2B;
  const email = (id: string) => emailDe(B2B.ALUNOS_B2B.find((a) => a.id === id)!.nome);
  const simulados: SimuladoMentor[] = B2B.SIMULADOS_B2B.map(([ordem, nome, data, part, , , , , status]) => ({
    id: `mock-sim-${ordem}`, ordem, nome, data: data ? iso(data, 23) : null, status, participantes: part,
  }));
  const realizados = B2B.SIMULADOS_B2B.filter((s) => s[8] === 'realizado');
  const ponto = (i: number) => realizados.map((s) => ({ rotulo: `${s[0]}º`, valor: s[i] as number | null }));
  const ult = realizados[realizados.length - 1];
  const pen = realizados[realizados.length - 2];
  const delta = (i: number) => (ult[i] != null && pen[i] != null ? Math.round(((ult[i] as number) - (pen[i] as number)) * 10) / 10 : null);
  const emails = B2B.ALUNOS_B2B.map((a) => email(a.id));
  const questoesResumo: QuestaoResumoMentor[] = B2B.QUESTOES_B2B.map(([n, tema, area, acerto, certa]) => ({
    questaoId: `mock-qb-${n}`, numero: n, ordem: 4, grandeArea: area, especialidade: null, tema, temaCurto: tema, dificuldade: null,
    enunciadoInicio: null, temImagem: false, corretaLabel: certa, acertoPct: acerto, respostas: ult[3] as number,
    distribuicao: { [certa]: Math.round(((ult[3] as number) * acerto) / 100) }, emailsPorAlternativa: {},
  }));
  return {
    modalidade: 'b2b',
    me: {
      mentor: { id: m.id, nome: m.nome, fotoUrl: null, agendaUrl: m.agendaUrl, modalidade: 'b2b', bio: null, mote: null, googleEmail: null, ativo: true },
      tribos: [{ id: m.turma.id, nome: m.turma.nome, slug: m.turma.slug, modalidade: 'b2b', papel: 'titular', mentoriaAtiva: true, lema: null, iconeUrl: null, cores: null,
        iesId: m.turma.iesId, iesNome: m.turma.iesNome, campus: m.turma.campus, encontrosPorMes: m.encontrosPorMes, totalAlunos: m.totalAlunos }],
      portalMentor: true,
    },
    alunos: B2B.ALUNOS_B2B.map((a) => alunoTurma({ nome: a.nome, tel: null, semestre: a.sem, acesso: '2026-12-31', dias: a.dias, ref, b2b: true, meta: null })),
    notas: Object.fromEntries(B2B.ALUNOS_B2B.map((a) => [email(a.id), a.p])),
    acertoB2b: Object.fromEntries(B2B.ALUNOS_B2B.map((a) => [email(a.id), a.ac])),
    perfil: Object.fromEntries(B2B.ALUNOS_B2B.map((a) => [email(a.id), a.perfil ? PERFIL[a.perfil] : null])),
    simulados,
    temas: B2B.TEMAS_B2B.map(([tema, area, esp, prev, acerto, resp, abaixo, serie]) => ({
      id: slug(tema), tema, especialidade: esp, grandeArea: area, prevalencia: PREV[prev], peso: PESO[prev], respostas: resp, acertoPct: acerto,
      alunosAbaixo50: emails.slice(0, Math.min(abaixo, emails.length)), critico: resp >= 30,
      serie: serie.map((v, i) => ({ simuladoId: `mock-sim-${i + 2}`, acertoPct: v })),
    })),
    areas: areasDoPrototipo(),
    questoes: questoesDoPrototipo('mock-sim-4', ult[3] as number, emails),
    publicacoes: B2B.MURAL_B2B.map(([titulo, tag, ddmm], i) => ({
      id: `mock-pub-${i + 1}`, tag: TAG[tag], titulo, mensagem: titulo, link: null, anexoUrl: null, destino: { tipo: 'turma' },
      status: 'publicada', publicadaEm: iso(ddmm), editadaEm: null, fixada: false, anexoNome: null, origem: 'mentor', tagOriginal: null,
    })),
    sessoes: B2B.SESSOES_B2B.map(([ddmm, hora, tipo, tema, meet, status, grav, aluno, pauta], i) => sessaoMock(`mock-sessao-${i + 1}`, {
      inicio: iso(ddmm, hora), tipo, tema, alunoId: aluno ? email(aluno) : null, link: meet, status,
      gravacaoUrl: grav ? `https://drive.google.com/mock-gravacao-${i + 1}` : null,
      pauta: pauta.map(([texto, refId], j) => ({ id: `mock-sessao-${i + 1}:${j}`, origem: 'tema_critico' as const, referenciaId: refId, texto })),
    })),
    convites: [{ id: 'mock-convite-1', alunoId: email('bt'), alunoNome: 'Bruno Teles', publicacaoId: null, mensagem: 'Liberei minha agenda pra você.', ativo: true, liberadoEm: iso('14/10') }],
    canais: canaisMock(B2B.CANAIS_B2B.grupo),
    cards: B2B.CARDS_B2B.map(([tipo, titulo, q, perfil, ddmm, status], i) =>
      cardBase(`mock-card-${i + 1}`, tipo, titulo, q === 'turma' ? [] : [email(q)], q === 'turma', 'manual', status, iso(ddmm), { perfil: perfil ? PERFIL[perfil] : null })),
    rotina: {
      [B2B.ROTINA_SEMANA_B2B]: B2B.ROTINA_B2B.map(([dia, tipo, conteudo, enviado]) => ({ id: `mock-rotina-${B2B.ROTINA_SEMANA_B2B}-${dia}`, semana: B2B.ROTINA_SEMANA_B2B, dia, tipo, conteudo, enviadoEm: enviado })),
    },
    perolas: B2B.PEROLAS_B2B.map(([semana, mentor, ddmm, tema]) => ({ id: `mock-perola-${semana}`, texto: `Semana ${semana} · ${mentor} · no mural em ${ddmm}`, tema, criadaEm: iso(ddmm) })),
    sinalizacoes: Object.fromEntries(B2B.SINALIZACOES_B2B.map(([id, , ddmm]) => [email(id), iso(ddmm)])),
    log: {},
    b2b: {
      visao: {
        simulados, simuladoReferenciaId: `mock-sim-${ult[0]}`,
        conceitoEnamed: { valor: ult[7] as number, delta: delta(7), serie: ponto(7) },
        triProjetado: { valor: ult[5] as number, delta: delta(5), serie: ponto(5) },
        proficientesPct: { valor: ult[6] as number, delta: delta(6), serie: ponto(6) },
        proficientes: B2B.PROFICIENTES_ULTIMO_B2B, participantes: ult[3] as number, totalAlunos: m.totalAlunos,
        acertoPct: ult[4] as number, simuladosRealizados: realizados.length, simuladosContratados: B2B.SIMULADOS_CONTRATADOS_B2B,
      },
      questoesResumo,
    },
    seq: 100,
  };
}

function sessaoMock(id: string, s: { inicio: string; tipo: Sessao['tipo']; tema: string | null; alunoId: string | null; link: string | null; status: Sessao['status']; gravacaoUrl: string | null; pauta?: Sessao['pauta'] }): Sessao {
  const { data, hora } = dataHoraSp(s.inicio);
  return {
    id, tipo: s.tipo, data, hora, tema: s.tema, alunoId: s.alunoId, link: s.link, status: s.status, gravacaoUrl: s.gravacaoUrl, pauta: s.pauta ?? [],
    titulo: s.tema ?? ROTULO_TIPO_SESSAO[s.tipo], inicio: s.inicio, duracaoMin: 60, descricao: null, realizadaEm: s.status === 'realizada' ? s.inicio : null, origem: 'academy',
  };
}

function canaisMock(grupo: string): CanalTurma[] {
  return [
    { tipo: 'avisos', url: 'https://chat.whatsapp.com/mock-avisos', editavel: false, nome: 'Grupo de avisos', configurado: true },
    { tipo: 'plantao', url: 'https://chat.whatsapp.com/mock-plantao', editavel: false, nome: 'Plantão de dúvidas', configurado: true },
    { tipo: 'grupo_turma', url: grupo, editavel: true, nome: 'Grupo da tribo', configurado: true },
  ];
}

// ─── Derivados de desempenho (mesmas regras do SQL de mentor_desempenho_turma) ─

function desempenhoB2c(e: Estado): DesempenhoTurmaB2c {
  const realizados = e.simulados.filter((s) => s.status === 'realizado');
  const ultimoSim = realizados[realizados.length - 1] ?? null;
  const alunos: DesempenhoAlunoB2c[] = e.alunos.map((a) => {
    const notas = (e.notas[a.email] ?? []).map((v, i) => ({ simuladoId: realizados[i]?.id ?? `mock-sim-${i + 1}`, ordem: i + 1, acertoPct: v, finalizadaEm: v == null ? null : realizados[i]?.data ?? null }));
    const feitas = notas.filter((n) => n.acertoPct != null).map((n) => n.acertoPct as number);
    const ultimo = feitas.length ? feitas[feitas.length - 1] : null;
    const penultimo = feitas.length > 1 ? feitas[feitas.length - 2] : null;
    const corte = a.meta?.cortePct ?? null;
    const vs = ultimo != null && corte != null ? Math.round((ultimo - corte) * 10) / 10 : null;
    const tres = feitas.slice(-3);
    return {
      email: a.email, nome: a.nome, notas, ultimoAcerto: ultimo, corteMaisDificil: corte, vsCortePp: vs,
      situacao: ultimo == null ? 'sem_simulado' : corte == null ? 'sem_meta' : vs! >= 0 ? 'acima' : vs! >= -3 ? 'proximo' : 'longe',
      regrediu: penultimo != null && ultimo != null && penultimo - ultimo >= 5,
      estagnado: tres.length === 3 && Math.max(...tres) - Math.min(...tres) < 2,
      fezUltimo: ultimoSim ? notas[realizados.length - 1]?.acertoPct != null : null,
    };
  });
  const proto = B2C.SIMULADOS_B2C.find((s) => `mock-sim-${s[0]}` === ultimoSim?.id);
  return {
    alunos,
    possivelAprovacaoPct: proto?.[5] ?? null,
    acertoMedioUltimo: proto?.[4] ?? null,
    simulados: e.simulados.map((s) => ({ ...s, participantes: null })),
    participacaoUltimo: { simuladoId: ultimoSim?.id ?? null, fizeram: alunos.filter((a) => a.fezUltimo).length, total: alunos.length },
  };
}

function alunoB2b(e: Estado, a: AlunoTurmaAcademy): AlunoB2b {
  const p = e.notas[a.email] ?? [];
  return {
    email: a.email, nome: a.nome, semestre: a.semestre, telefone: a.telefone,
    proficiencias: p.map((v, i) => ({ simuladoId: `mock-sim-${i + 1}`, ordem: i + 1, valor: v })),
    acertoUltimoPct: e.acertoB2b[a.email] ?? null, ultimaAtividade: a.ultimaAtividade, diasSemAtividade: a.diasSemAtividade,
    perfil: e.perfil[a.email] ?? null, grupo: grupoDe(p), sinalizadoEm: e.sinalizacoes[a.email] ?? null,
  };
}

// ─── Fábrica ────────────────────────────────────────────────────────────────

export interface Mock { fonte: FonteMentoria; dados: DadosAcademy }

export function criarMock(modalidade: ModalidadeMock, opcoes: { latenciaMs?: number } = {}): Mock {
  const latencia = opcoes.latenciaMs ?? LATENCIA_MOCK_MS;
  const e = modalidade === 'b2b' ? estadoB2b() : estadoB2c();
  const esperar = () => (latencia > 0 ? new Promise<void>((r) => setTimeout(r, latencia)) : Promise.resolve());
  /** Toda resposta sai clonada (a tela nunca muta o estado) e depois da latência. */
  const r = async <T>(fn: () => T): Promise<T> => { await esperar(); return clonar(fn()); };
  const semMeta = <T>(data: T): ComMeta<T> => ({ data, meta: null });
  const id = (prefixo: string) => `mock-${prefixo}-${++e.seq}`;
  const soB2b = (o: string) => { if (e.modalidade !== 'b2b') throw new ErroFonte(400, 'validacao', `${o} somente B2B`); };
  const emailsTurma = () => e.alunos.map((a) => a.email);
  const flix = (a: AlunoTurmaAcademy, triboId: string): AlunoFlix => ({
    alunoId: a.email, nome: a.nome ?? a.email, email: a.email, whatsapp: a.telefone, produto: 'pro', acessoAte: a.acessoAte,
    semestre: e.modalidade === 'b2b' ? a.semestre : null, campus: e.modalidade === 'b2b' ? e.me.tribos[0].campus ?? null : null, triboId,
    entrouNaTriboEm: null, origemAlocacao: 'planilha', ultimaAtividadeEm: a.ultimaAtividade, meta: a.meta,
  });
  const exigeAluno = (email: string) => {
    const a = e.alunos.find((x) => x.email === email.trim().toLowerCase());
    if (!a) throw new ErroFonte(404, 'aluno_fora_da_tribo', 'Aluno fora da turma.');
    return a;
  };
  const novoCard = (c: Intervencao) => { e.cards.unshift(c); return c; };
  const moverCards = (ref: string, status: StatusIntervencao) => {
    for (const c of e.cards) if (c.referenciaId === ref && c.status !== status) {
      c.status = status;
      c.historico.push({ em: agora(), texto: `Status alterado para ${{ afazer: 'A fazer', andamento: 'Em andamento', feito: 'Feito' }[status]}` });
    }
  };
  const publicar = (p: NovaPublicacao, existente?: Publicacao): Publicacao => {
    const d = p.destino as { tipo: string; alunoIds?: string[] };
    const selecionados = d.tipo === 'alunos' || d.tipo === 'selecionados';
    const publicada = p.status === 'publicada';
    const pub: Publicacao = {
      id: existente?.id ?? id('pub'), tag: p.tag, titulo: p.titulo, mensagem: p.mensagem, link: p.link ?? null, anexoUrl: p.anexo?.url ?? null,
      destino: selecionados ? { tipo: 'selecionados', alunoIds: [...(d.alunoIds ?? [])] } : { tipo: 'turma' },
      status: publicada || existente?.status === 'publicada' ? 'publicada' : 'rascunho',
      publicadaEm: existente?.publicadaEm ?? (publicada ? agora() : null),
      editadaEm: existente?.status === 'publicada' ? agora() : existente?.editadaEm ?? null,
      fixada: p.fixada ?? existente?.fixada ?? false, anexoNome: p.anexo?.nome ?? null, origem: existente?.origem ?? 'mentor', tagOriginal: null,
    };
    if (publicada && existente?.status !== 'publicada' && p.registrarIntervencao) {
      novoCard(cardBase(id('card'), 'mensagem', pub.titulo, selecionados ? [...(d.alunoIds ?? [])] : emailsTurma(), !selecionados, 'mural', 'feito', agora(), { referenciaId: pub.id }));
    }
    return pub;
  };

  const fonte: FonteMentoria = {
    nome: 'mock',
    eventosNoServidor: true,
    me: () => r(() => e.me),
    atualizarPerfil: (p) => r(() => {
      if (p.agendaUrl !== undefined) e.me.mentor.agendaUrl = p.agendaUrl || null;
      if (p.fotoUrl !== undefined) e.me.mentor.fotoUrl = p.fotoUrl || null;
      return e.me.mentor;
    }),
    alunos: (triboId, busca) => r(() => {
      const q = busca?.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
      return e.alunos.map((a) => flix(a, triboId)).filter((a) => !q || a.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q) || a.email.includes(q));
    }),
    aluno: (triboId, alunoId) => r(() => flix(exigeAluno(alunoId), triboId)),

    canais: () => r(() => e.canais),
    salvarGrupoTribo: (_t, url) => r(() => {
      if (!/^https:\/\/chat\.whatsapp\.com\/\S+$/.test(url.trim())) throw new ErroFonte(400, 'validacao', 'Use um link de convite https://chat.whatsapp.com/ do grupo da tribo', 'url');
      const c = e.canais.find((x) => x.tipo === 'grupo_turma')!;
      c.url = url.trim();
      c.configurado = true;
      return c;
    }),

    publicacoes: (_t, filtro) => r(() => ({
      data: [...e.publicacoes]
        .filter((p) => (!filtro?.status || p.status === filtro.status) && (!filtro?.tag || p.tag === filtro.tag))
        .sort((a, b) => (b.publicadaEm ?? '').localeCompare(a.publicadaEm ?? '')),
      nextCursor: null,
    })),
    criarPublicacao: (_t, p) => r(() => {
      if (!p.titulo?.trim()) throw new ErroFonte(400, 'validacao', 'Título obrigatório', 'titulo');
      if (!p.mensagem?.trim()) throw new ErroFonte(400, 'validacao', 'Mensagem obrigatória', 'mensagem');
      const pub = publicar(p);
      e.publicacoes.unshift(pub);
      return pub;
    }),
    editarPublicacao: (pid, p) => r(() => {
      const i = e.publicacoes.findIndex((x) => x.id === pid);
      if (i < 0) throw new ErroFonte(404, 'validacao', 'Publicação não encontrada.');
      const atual = e.publicacoes[i];
      const completo: NovaPublicacao = {
        tag: p.tag ?? atual.tag, titulo: p.titulo ?? atual.titulo, mensagem: p.mensagem ?? atual.mensagem, link: p.link !== undefined ? p.link : atual.link,
        status: p.status ?? atual.status, anexo: p.anexo !== undefined ? p.anexo : atual.anexoUrl ? { url: atual.anexoUrl, nome: atual.anexoNome ?? 'anexo', mime: '', bytes: 0 } : null,
        destino: p.destino ?? (atual.destino.tipo === 'turma' ? { tipo: 'tribo' } : { tipo: 'alunos', alunoIds: atual.destino.alunoIds }),
        registrarIntervencao: p.registrarIntervencao, fixada: p.fixada,
      };
      e.publicacoes[i] = publicar(completo, atual);
      return e.publicacoes[i];
    }),
    excluirPublicacao: (pid) => r(() => { e.publicacoes = e.publicacoes.filter((x) => x.id !== pid); }),
    pedirUpload: (arquivo) => r(() => ({ uploadUrl: 'about:blank', fileUrl: `${e.me.mentor.id}/${slug(arquivo.nome)}` })),

    sessoes: (_t, filtro) => r(() => ({
      data: e.sessoes.filter((s) => (!filtro?.status || s.status === filtro.status) && (!filtro?.tipo || s.tipo === filtro.tipo)
        && (!filtro?.de || (s.inicio ?? '') >= filtro.de) && (!filtro?.ate || (s.inicio ?? '') <= filtro.ate)),
      nextCursor: null,
    })),
    criarSessao: (_t, s) => r(() => {
      if (!s.inicio) throw new ErroFonte(400, 'validacao', 'Informe a data da sessão.', 'inicio');
      if (s.tipo === 'individual') exigeAluno(s.alunoId ?? '');
      const nova = sessaoMock(id('sessao'), {
        inicio: s.inicio, tipo: s.tipo, tema: s.tema ?? null, alunoId: s.tipo === 'individual' ? s.alunoId!.toLowerCase() : null, link: s.meetUrl ?? null,
        status: 'agendada', gravacaoUrl: null,
        pauta: (s.pauta ?? []).map((p, i) => ({ id: `p${i}`, origem: p.origem, referenciaId: p.referenciaId ?? null, texto: p.texto })),
      });
      nova.titulo = s.titulo?.trim() || s.tema?.trim() || ROTULO_TIPO_SESSAO[s.tipo];
      nova.descricao = s.descricao ?? null;
      e.sessoes.push(nova);
      const individual = s.tipo === 'individual';
      novoCard(cardBase(id('card'), individual ? 'individual' : 'coletiva', nova.titulo, individual ? [nova.alunoId!] : emailsTurma(), !individual, 'sessao_criada', 'afazer', agora(), { referenciaId: nova.id }));
      // TODO(P13): o mock não confere o contrato de encontros.
      return { ...nova, warnings: [] as string[] };
    }),
    editarSessao: (sid, s) => r(() => {
      const atual = e.sessoes.find((x) => x.id === sid);
      if (!atual) throw new ErroFonte(404, 'validacao', 'Sessão não encontrada.');
      if (s.tema !== undefined) atual.tema = s.tema;
      if (s.titulo) atual.titulo = s.titulo;
      if (s.meetUrl !== undefined) atual.link = s.meetUrl;
      if (s.descricao !== undefined) atual.descricao = s.descricao;
      if (s.duracaoMin !== undefined) atual.duracaoMin = s.duracaoMin;
      if (s.pauta !== undefined) atual.pauta = s.pauta.map((p, i) => ({ id: `${sid}:${i}`, origem: p.origem, referenciaId: p.referenciaId ?? null, texto: p.texto }));
      if (s.inicio) Object.assign(atual, { inicio: s.inicio }, dataHoraSp(s.inicio));
      if (s.status === 'realizada' && atual.status !== 'realizada') {
        atual.status = 'realizada';
        atual.realizadaEm = agora();
        moverCards(sid, 'feito');
      }
      return atual;
    }),
    excluirSessao: (sid) => r(() => {
      const s = e.sessoes.find((x) => x.id === sid);
      if (!s) throw new ErroFonte(404, 'validacao', 'Sessão não encontrada.');
      if (s.status !== 'agendada' || (s.inicio ?? '') <= agora()) throw new ErroFonte(400, 'validacao', 'Somente sessão futura e agendada pode ser excluída');
      e.sessoes = e.sessoes.filter((x) => x.id !== sid);
    }),
    vincularGravacao: (sid, g) => r(() => {
      const s = e.sessoes.find((x) => x.id === sid);
      if (!s) throw new ErroFonte(404, 'validacao', 'Sessão não encontrada.');
      s.gravacaoUrl = g.url;
      if (s.status !== 'realizada') { s.status = 'realizada'; s.realizadaEm = agora(); moverCards(sid, 'feito'); }
      return s;
    }),

    convites: () => r(() => e.convites),
    liberarAgenda: (_t, alunoId, msg) => r(() => {
      if (!e.me.mentor.agendaUrl) throw new ErroFonte(400, 'mentor_sem_agenda', 'Cadastre o link do Google Agenda antes de liberar');
      const a = exigeAluno(alunoId);
      e.convites = e.convites.filter((c) => c.alunoId !== a.email);
      const convite: ConviteFlix = { id: id('convite'), alunoId: a.email, alunoNome: a.nome, publicacaoId: null, mensagem: msg.mensagem, ativo: true, liberadoEm: agora() };
      e.convites.unshift(convite);
      e.publicacoes.unshift({ ...publicar({ tag: 'aviso', titulo: 'Agendamento liberado', mensagem: msg.mensagem, link: null, status: 'publicada', destino: { tipo: 'alunos', alunoIds: [a.email] } }), origem: 'liberacao_agenda', tagOriginal: 'Agenda' });
      novoCard(cardBase(id('card'), 'individual', 'Agendamento liberado', [a.email], false, 'agenda_liberada', 'afazer', agora(), { referenciaId: convite.id }));
      (e.log[a.email] ??= []).unshift({ tipo: 'agenda_liberada', em: agora(), payload: { liberacao_id: convite.id } });
      return convite;
    }),
    desligarAgenda: (cid) => r(() => {
      const c = e.convites.find((x) => x.id === cid);
      if (!c) throw new ErroFonte(404, 'validacao', 'Liberação não encontrada.');
      e.convites = e.convites.filter((x) => x.id !== cid);
      moverCards(cid, 'feito');
    }),
  };

  const dados: DadosAcademy = {
    turma: () => r(() => semMeta(e.alunos)),
    desempenhoTurma: () => r(() => semMeta(e.modalidade === 'b2c' ? desempenhoB2c(e) : { alunos: [], possivelAprovacaoPct: null, acertoMedioUltimo: null, simulados: [], participacaoUltimo: { simuladoId: null, fizeram: 0, total: 0 } })),
    serieTurma: () => r(() => semMeta(e.modalidade === 'b2c'
      ? B2C.SIMULADOS_B2C.filter((s) => s[6] === 'realizado').map(([o, nome, , part, ac, apr]) => ({ simuladoId: `mock-sim-${o}`, ordem: o, titulo: nome, fechado: true, participantes: part ?? 0, acertoMedio: ac, acimaCortePct: apr }))
      : [])),
    engajamentoTurma: (semanas) => r(() => semMeta(e.alunos.map((a) => ({
      email: a.email, ultimaAtividade: a.ultimaAtividade, diasSemAtividade: a.diasSemAtividade, segmento: a.segmento,
      semanas: Array.from({ length: semanas }, (_, i) => {
        const semana = new Date(new Date(B2C.HOJE_PROTOTIPO_B2C).getTime() - (semanas - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10);
        const sumiu = (a.diasSemAtividade ?? 0) >= 7 * (semanas - i);
        const q = sumiu ? 0 : a.questoes7d.respondidas;
        return { semana, questoes: q, acertos: q == null ? null : Math.round(q * 0.7), conteudos: sumiu ? 0 : a.conteudos7d.total };
      }),
    })))),
    temasTurma: () => r(() => semMeta(e.modalidade === 'b2c' ? e.temas : [])),
    detalhamento: (simulados) => r(() => {
      const bloqueados = e.simulados.filter((s) => simulados.includes(s.id) && s.status !== 'realizado').map((s) => ({ simuladoId: s.id, ordem: s.ordem, liberaEm: s.data }));
      const d: DetalhamentoMentor = { areas: e.areas, questoes: e.questoes.map(resumoDe), bloqueados };
      return semMeta(d);
    }),
    questao: (qid) => r(() => {
      const q = e.questoes.find((x) => x.questaoId === qid);
      if (!q) throw new ErroFonte(404, 'validacao', 'Questão não encontrada.');
      return semMeta(q);
    }),
    alunoDetalhe: (email) => r(() => {
      const a = exigeAluno(email);
      const conv = e.convites.find((c) => c.alunoId === a.email);
      const notas = e.notas[a.email] ?? [];
      return semMeta({
        email: a.email, aluno: a,
        liberacao: conv ? { ligado: true, desde: conv.liberadoEm, mensagem: conv.mensagem ?? null } : null,
        intervencoes: e.cards.filter((c) => c.destino.alunoIds?.includes(a.email) && !c.destino.turmaToda)
          .map((c) => ({ id: c.id, tipo: c.tipo, tipoOriginal: c.tipoOriginal ?? '', titulo: c.titulo, status: c.status, criadaEm: c.criadaEm })),
        log: e.log[a.email] ?? [],
        sinalizadoEm: e.sinalizacoes[a.email] ?? null,
        notas: notas.map((v, i) => ({ simuladoId: `mock-sim-${i + 1}`, ordem: i + 1, titulo: e.simulados[i]?.nome ?? null, acertoPct: v, finalizadaEm: v == null ? null : e.simulados[i]?.data ?? null, acertos: null, respondidas: null, posicao: null, participantes: null, percentil: null, dentroJanela: v == null ? null : true }))
          .filter((n) => n.acertoPct != null),
        areas: e.areas,
        conteudos: { temDadoConsumo: true, porSemana: [], recentes: [], topCursos: [] },
        questoes: { temDadoQuestoes: true, ultimaResposta: a.ultimaAtividade, porSemana: [], porArea: [] },
      });
    }),

    visaoGeralB2b: () => r(() => { soB2b('visão geral'); return semMeta(e.b2b!.visao); }),
    alunosB2b: () => r(() => { soB2b('alunos'); return semMeta(e.alunos.map((a) => alunoB2b(e, a))); }),
    temasTurmaB2b: () => r(() => { soB2b('temas'); return semMeta(e.temas); }),
    detalhamentoB2b: (simulados) => r(() => {
      soB2b('detalhamento');
      const v = e.b2b!.visao;
      return semMeta({
        areas: e.areas, questoes: e.questoes.map(resumoDe),
        bloqueados: e.simulados.filter((s) => simulados.includes(s.id) && s.status !== 'realizado').map((s) => ({ simuladoId: s.id, ordem: s.ordem, liberaEm: s.data })),
        acertoMedioPct: v.acertoPct, conceitoEnamed: v.conceitoEnamed, triProjetado: v.triProjetado, proficientesPct: v.proficientesPct.valor,
      });
    }),
    questoesB2b: () => r(() => { soB2b('questões'); return semMeta(e.b2b!.questoesResumo); }),
    respondentesB2b: (qid) => r(() => {
      soB2b('respondentes');
      const q = e.b2b!.questoesResumo.find((x) => x.questaoId === qid);
      if (!q) throw new ErroFonte(404, 'validacao', 'Questão não encontrada.');
      const erradas = ['A', 'B', 'C', 'D'].filter((l) => l !== q.corretaLabel);
      return semMeta(e.alunos.slice(0, 6).map((a, i) => ({ email: a.email, nome: a.nome, alternativa: erradas[i % erradas.length] })));
    }),
    cronogramaB2b: () => r(() => { soB2b('cronograma'); return semMeta(e.simulados); }),
    alunoB2b: (email) => r(() => {
      soB2b('aluno');
      const a = exigeAluno(email);
      const b = alunoB2b(e, a);
      return semMeta({
        aluno: b,
        simulados: e.simulados.filter((s) => s.status === 'realizado').map((s, i) => ({ simuladoId: s.id, ordem: s.ordem, titulo: s.nome, proficiencia: b.proficiencias[i]?.valor ?? null, acertoPct: i === b.proficiencias.length - 1 ? b.acertoUltimoPct : null, participou: b.proficiencias[i]?.valor != null })).reverse(),
        consumo30d: { questoes: a.questoes30d.respondidas, acertoQuestoesPct: a.questoes30d.pctAcerto, aulas: a.conteudos30d.videos, pdfs: a.conteudos30d.documentos },
        intervencoes: e.cards.filter((c) => c.destino.alunoIds?.includes(a.email) && !c.destino.turmaToda).map((c) => ({ id: c.id, tipo: c.tipo, tipoOriginal: c.tipoOriginal ?? '', titulo: c.titulo, status: c.status, criadaEm: c.criadaEm })),
        log: e.log[a.email] ?? [],
        sinalizadoEm: b.sinalizadoEm,
      });
    }),

    intervencoes: (p) => r(() => {
      const dia = (iso: string) => dataHoraSp(iso).data;
      const cards = e.cards.filter((c) => (!p.de || dia(c.criadaEm) >= p.de) && (!p.ate || dia(c.criadaEm) <= p.ate));
      const peso = (c: Intervencao) => c.peso ?? 1;
      return { cards, planejadas: cards.reduce((s, c) => s + peso(c), 0), realizadas: cards.filter((c) => c.status === 'feito').reduce((s, c) => s + peso(c), 0) };
    }),
    criarIntervencao: (n) => r(() => {
      if (!n.titulo?.trim()) throw new ErroFonte(400, 'validacao', 'Título obrigatório', 'titulo');
      const ids = n.destino.turmaToda ? emailsTurma() : (n.destino.alunoIds ?? []).map((x) => exigeAluno(x).email);
      const c = novoCard(cardBase(id('card'), n.tipo, n.titulo.trim(), ids, !!n.destino.turmaToda, 'manual', 'afazer', agora(), { nota: n.nota ?? null }));
      return { id: c.id };
    }),
    atualizarIntervencao: (cid, p) => r(() => {
      const c = e.cards.find((x) => x.id === cid);
      if (!c) throw new ErroFonte(404, 'validacao', 'Intervenção não encontrada');
      if (p.titulo?.trim()) c.titulo = p.titulo.trim();
      if (p.nota !== undefined) c.nota = p.nota?.trim() || null;
      if (p.status && p.status !== c.status) {
        c.status = p.status;
        c.historico.push({ em: agora(), texto: `Status alterado para ${{ afazer: 'A fazer', andamento: 'Em andamento', feito: 'Feito' }[p.status]}` });
      }
      return { id: c.id, status: c.status };
    }),
    comentarIntervencao: (cid, texto) => r(() => {
      const c = e.cards.find((x) => x.id === cid);
      if (!c) throw new ErroFonte(404, 'validacao', 'Intervenção não encontrada');
      if (!texto.trim()) throw new ErroFonte(400, 'validacao', 'Comentário obrigatório', 'texto');
      (c.comentarios ??= []).push({ em: agora(), texto: texto.trim() });
      return { id: id('comentario') };
    }),
    registrarEvento: (ev: EventoSql) => r(() => {
      if (ev.tipo === 'status_alterado') {
        const c = e.cards.find((x) => x.id === ev.intervencao_id);
        if (!c) throw new ErroFonte(400, 'validacao', 'Intervenção não encontrada');
        if (ev.status) c.status = ev.status;
        return { intervencaoId: c.id, duplicado: false };
      }
      if (ev.tipo === 'whatsapp') {
        for (const em of ev.alunos ?? []) (e.log[em] ??= []).unshift({ tipo: 'whatsapp', em: agora(), payload: {} });
        return { intervencaoId: null, duplicado: false };
      }
      if (ev.tipo === 'sessao_realizada') { moverCards(ev.referencia_id, 'feito'); return { intervencaoId: null, duplicado: false }; }
      if (e.cards.some((c) => c.referenciaId === ev.referencia_id)) return { intervencaoId: null, duplicado: true };
      if (ev.tipo === 'mural_publicado' && !ev.registrar_intervencao) return { intervencaoId: null, duplicado: false };
      const tipo: TipoIntervencao = ev.tipo === 'mural_publicado' ? 'mensagem' : ev.tipo === 'intervencao_tema' || (ev.tipo === 'sessao_criada' && ev.tipo_sessao !== 'individual') ? 'coletiva' : 'individual';
      const origem: OrigemIntervencao = ev.tipo === 'mural_publicado' ? 'mural' : ev.tipo === 'agenda_liberada' ? 'agenda_liberada' : ev.tipo === 'sessao_criada' ? 'sessao_criada' : ev.tipo === 'intervencao_tema' ? ev.origem ?? 'tema_critico' : 'manual';
      const c = novoCard(cardBase(id('card'), tipo, ev.titulo ?? 'Intervenção', ev.turma_toda ? emailsTurma() : ev.alunos ?? [], !!ev.turma_toda, origem,
        ev.tipo === 'mural_publicado' ? 'feito' : 'afazer', agora(), { referenciaId: ev.referencia_id, perfil: ev.perfil ? PERFIL[ev.perfil] : null }));
      return { intervencaoId: c.id, duplicado: false };
    }),
    rotina: (semana) => r(() => {
      soB2b('rotina');
      return (e.rotina[semana] ??= (['ter', 'qui', 'sex'] as const).map((dia, i) => ({ id: `mock-rotina-${semana}-${dia}`, semana, dia, tipo: (['enquete', 'resposta', 'perola'] as const)[i], conteudo: '', enviadoEm: null })));
    }),
    marcarRotinaEnviada: (rid) => r(() => {
      soB2b('rotina');
      const item = Object.values(e.rotina).flat().find((x) => x.id === rid);
      if (!item) throw new ErroFonte(400, 'validacao', 'Envio não encontrado');
      item.enviadoEm ??= agora();
      return { id: item.id, enviadoEm: item.enviadoEm };
    }),
    sinalizarIes: (email, motivo) => r(() => {
      soB2b('sinalização');
      const a = exigeAluno(email);
      if (!motivo.trim()) throw new ErroFonte(400, 'validacao', 'Aluno e motivo obrigatórios', 'motivo');
      if (e.sinalizacoes[a.email]) throw new ErroFonte(400, 'validacao', 'Aluno já sinalizado neste ciclo');
      e.sinalizacoes[a.email] = agora();
      return { id: id('sinalizacao'), sinalizadoEm: e.sinalizacoes[a.email] };
    }),
    perolas: () => r(() => { soB2b('pérolas'); return e.perolas; }),
    salvarPerola: (texto, tema) => r(() => {
      soB2b('pérolas');
      if (!texto.trim()) throw new ErroFonte(400, 'validacao', 'Texto obrigatório', 'texto');
      const p: Perola = { id: id('perola'), texto: texto.trim(), tema: tema?.trim() || null, criadaEm: agora() };
      e.perolas.unshift(p);
      return { id: p.id };
    }),
  };

  return { fonte, dados };
}
