/**
 * fonteAcademy (padrão): implementa `FonteMentoria` e `DadosAcademy` sobre as RPCs `mentor_*` do
 * Supabase do Academy (docs/handoff/mentor/IMPLEMENTACAO.md § Fontes de dados e § RPCs).
 *
 * - O recorte é sempre a turma do mentor logado, resolvida no servidor (`mentor_ativo_id()`).
 *   `triboId` existe só para cumprir o contrato: aqui ele é o `user_id` do mentor e é ignorado.
 * - `alunoId` = e-mail normalizado.
 * - As RPCs de ação já criam/movem os cards do kanban: `eventosNoServidor = true`.
 * - Erro do Postgres → `ErroFonte` `validacao` (texto do RAISE) ou `rede`.
 * - snake_case → camelCase nos tipos de `types.ts`; `null` nunca vira zero.
 *
 * Contratos lidos em: 20261104120000_mentor_portal_v2.sql, 20261104130000_mentor_b2c_v2.sql,
 * 20261014171927 (marcar_feita, definir_link, agenda, intervenções), 20261014180542 (agenda_desligar),
 * 20261014205241 (aluno_conteudos), 20261015201557 (mentor_questao), 20261026184129 (aluno_questoes).
 */
import { supabase } from '@/integrations/supabase/client';
import type { AcertoPorAreaESemestre, Meta, MetricasSimulado } from '@/features/gestor/api/types';
import { identidadeTribo } from '../tema/contexto';
import type { EventoMentor } from '../lib/eventosIntervencao';
import {
  ErroFonte,
  type AlunoFlix,
  type ConviteFlix,
  type FonteMentoria,
  type MeFlix,
  type NovaPublicacao,
  type NovaSessao,
  type Pagina,
  type TriboMe,
} from './fonte';
import type {
  AcertoArea,
  AlunoB2b,
  AlunoB2bDetalhe,
  AlunoDetalheB2c,
  AlunoTurmaAcademy,
  CanalTurma,
  ConsumoPeriodo,
  DesempenhoTurmaB2c,
  DetalhamentoB2b,
  DetalhamentoMentor,
  EngajamentoAluno,
  Intervencao,
  IntervencaoResumo,
  ItemRotinaAcademy,
  NovaIntervencaoManual,
  OrigemIntervencao,
  PerfilB2B,
  PeriodoB2b,
  PeriodoIntervencoes,
  Perola,
  PontoSerieTurma,
  Prevalencia,
  Publicacao,
  QuadroIntervencoes,
  QuestaoMentor,
  QuestaoResumoMentor,
  QuestoesPeriodo,
  RespondenteB2b,
  SegmentoAtividade,
  Sessao,
  SimuladoMentor,
  SinalizacaoCriada,
  StatusIntervencao,
  TagMural,
  TemaTurmaMentor,
  TipoIntervencao,
  TipoSessao,
  TriboId,
  VisaoGeralB2b,
} from './types';

// ─── Infra: chamada de RPC e erro ───────────────────────────────────────────

export type ChamadorRpc = (fn: string, args?: Record<string, unknown>) => Promise<unknown>;

interface ErroPostgrest { message?: string; code?: string; details?: string | null; hint?: string | null }

/** Primeira letra maiúscula, sem o prefixo técnico `validacao:` dos RAISE. */
function limparMensagemRaise(msg: string): string {
  const s = msg.replace(/^validacao:\s*/i, '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Postgres/PostgREST → ErroFonte. RAISE EXCEPTION (P0001) e violações de dado/integridade (classes 22 e 23)
 * são `validacao` com o texto do RAISE; permissão (42501) é `sem_acesso_tribo`; o resto é `rede`.
 */
export function erroDoPostgres(error: unknown): ErroFonte {
  if (error instanceof ErroFonte) return error;
  const e = (error ?? {}) as ErroPostgrest;
  const code = typeof e.code === 'string' ? e.code : '';
  const msg = typeof e.message === 'string' ? e.message : '';
  if (code === 'P0001' || /^2[23]/.test(code)) return new ErroFonte(400, 'validacao', limparMensagemRaise(msg));
  if (code === '42501') return new ErroFonte(403, 'sem_acesso_tribo', msg || 'Sem permissão.');
  return new ErroFonte(503, 'rede', msg || 'Falha de rede.');
}

/** Chamador padrão: `supabase.rpc` (as RPCs do mentor ainda não estão nos tipos gerados). */
export const rpcSupabase: ChamadorRpc = async (fn, args) => {
  let resposta: { data: unknown; error: unknown };
  try {
    resposta = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>)(fn, args ?? {});
  } catch (e) {
    throw new ErroFonte(503, 'rede', e instanceof Error ? e.message : 'Falha de rede.');
  }
  if (resposta.error) throw erroDoPostgres(resposta.error);
  return resposta.data;
};

/** Upload de anexo do mural (bucket `mural-anexos`, path `<mentor>/…`, exigido por `mentor_mural_salvar`). */
export type AssinarUpload = (path: string) => Promise<{ signedUrl: string; path: string }>;
export const assinarUploadSupabase: AssinarUpload = async (path) => {
  const { data, error } = await supabase.storage.from('mural-anexos').createSignedUploadUrl(path);
  if (error || !data) throw new ErroFonte(503, 'rede', error?.message ?? 'Falha ao preparar o envio do anexo.');
  return { signedUrl: data.signedUrl, path: data.path };
};

/**
 * Fallback enquanto `get_mentor_contexto` não devolve `link_agendamento`/`foto_url`:
 * leitura direta do próprio cadastro (policy "Mentor lê o próprio cadastro", mesma de services/mentor/agenda.ts).
 */
export type LerCadastroMentor = (userId: string) => Promise<{ link_agendamento: string | null; foto_url: string | null } | null>;
export const lerCadastroSupabase: LerCadastroMentor = async (userId) => {
  try {
    const { data, error } = await (supabase.from as unknown as (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
    })('mentores').select('link_agendamento, foto_url').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return (data as { link_agendamento: string | null; foto_url: string | null } | null) ?? null;
  } catch {
    return null;
  }
};

// ─── Conversores básicos ────────────────────────────────────────────────────

type Linha = Record<string, unknown>;
const obj = (v: unknown): Linha => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Linha) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (v == null ? null : typeof v === 'string' ? v : String(v));
const strOu = (v: unknown, padrao: string): string => str(v) ?? padrao;
/** Número ou null. Nunca transforma ausência em zero. */
export const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
/** Contagem: ausência vira 0 só onde o servidor garante contagem (count(*)). */
const contagem = (v: unknown): number => num(v) ?? 0;
const bool = (v: unknown): boolean => v === true;
const boolOuNull = (v: unknown): boolean | null => (v == null ? null : v === true);
const strs = (v: unknown): string[] => lista(v).filter((x): x is string => typeof x === 'string');

/** "9", "9º", 9 → 9; vazio/inválido → null. */
export function semestreDe(v: unknown): number | null {
  if (v == null) return null;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** snake_case → camelCase, profundo. */
export function paraCamel<T = unknown>(v: unknown): T {
  if (Array.isArray(v)) return v.map((x) => paraCamel(x)) as T;
  if (v && typeof v === 'object') {
    const out: Linha = {};
    for (const [k, val] of Object.entries(v as Linha)) out[k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = paraCamel(val);
    return out as T;
  }
  return v as T;
}

/** Envelope do Gestor `{ data, meta }` → repassa os dois; JSON cru → meta null. */
export interface ComMeta<T> { data: T; meta: Meta | null }
export function desembrulhar(raw: unknown): { data: unknown; meta: Meta | null } {
  const o = obj(raw);
  if ('data' in o && 'meta' in o) return { data: o.data, meta: (o.meta as Meta) ?? null };
  return { data: raw, meta: null };
}
const semMeta = <T>(data: T): ComMeta<T> => ({ data, meta: null });

/** Data `YYYY-MM-DD` e hora `HH:mm` em America/Sao_Paulo. */
export function dataHoraSp(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { data: '', hora: '' };
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  return { data: `${p('year')}-${p('month')}-${p('day')}`, hora: `${p('hour')}:${p('minute')}` };
}

// ─── Mentor (get_mentor_contexto) ───────────────────────────────────────────

const TRIBOS: readonly TriboId[] = ['carcara', 'camaleao', 'colmeia', 'octopus'];
const ehTriboId = (s: string | null): s is TriboId => !!s && (TRIBOS as readonly string[]).includes(s);

/** Slug do Academy ('a-colmeia', 'carcara') → id de tribo do tema, quando for uma das quatro. */
export function triboIdDoSlug(slug: string | null): TriboId | null {
  if (!slug) return null;
  if (ehTriboId(slug)) return slug;
  const semArtigo = slug.replace(/^(a|o)-/, '');
  return ehTriboId(semArtigo) ? semArtigo : null;
}

export function mapearMe(raw: unknown, cadastro?: { link_agendamento: string | null; foto_url: string | null } | null): MeFlix {
  const m = obj(obj(raw).mentor);
  if (!m.user_id) throw new ErroFonte(404, 'mentor_sem_cadastro', 'Cadastro de mentor não encontrado.');
  const modalidade: 'b2c' | 'b2b' = (m.modalidade ?? m.tipo) === 'b2b' ? 'b2b' : 'b2c';
  const slug = str(m.tribo_slug);
  const triboId = triboIdDoSlug(slug);
  const identidade = modalidade === 'b2c' && triboId ? identidadeTribo(triboId) : null;
  const agendaUrl = str(m.link_agendamento ?? m.agenda_url) ?? cadastro?.link_agendamento ?? null;
  const fotoUrl = str(m.foto_url) ?? cadastro?.foto_url ?? null;
  const tribo: TriboMe = {
    id: String(m.user_id),
    nome: strOu(m.turma_nome, ''),
    slug: slug ?? '',
    modalidade,
    papel: 'titular',
    mentoriaAtiva: false,
    lema: identidade?.lema ?? null,
    iconeUrl: null,
    cores: identidade?.cores ?? null,
    iesId: str(m.ies_id),
    iesNome: str(m.ies_nome),
    campus: null,
    encontrosPorMes: null,
    totalAlunos: num(obj(raw).alunos_ativos),
  };
  return {
    mentor: { id: String(m.user_id), nome: strOu(m.nome, ''), fotoUrl: fotoUrl?.trim() || null, agendaUrl: agendaUrl?.trim() || null, modalidade, bio: str(m.bio), mote: null, googleEmail: null, ativo: true },
    tribos: [tribo],
    portalMentor: m.portal_mentor === true,
  };
}

// ─── Turma (mentor_turma) ───────────────────────────────────────────────────

const consumoPeriodo = (v: unknown): ConsumoPeriodo => {
  const o = obj(v);
  return { videos: num(o.videos), documentos: num(o.documentos), total: num(o.total) };
};
const questoesPeriodo = (v: unknown): QuestoesPeriodo => {
  const o = obj(v);
  return { respondidas: num(o.respondidas), acertos: num(o.acertos), erros: num(o.erros), pctAcerto: num(o.pct_acerto) };
};
const SEGMENTOS: readonly SegmentoAtividade[] = ['ativo', 'esfriando', 'sumido', 'sem_dado'];
const segmento = (v: unknown): SegmentoAtividade => (SEGMENTOS.includes(v as SegmentoAtividade) ? (v as SegmentoAtividade) : 'sem_dado');

export function mapearAlunoTurma(raw: unknown, modalidade: 'b2c' | 'b2b'): AlunoTurmaAcademy {
  const r = obj(raw);
  const meta = obj(r.meta);
  const corte = num(meta.cortePct);
  return {
    email: strOu(r.email, ''),
    nome: str(r.nome),
    telefone: str(r.telefone),
    semestre: modalidade === 'b2b' ? semestreDe(r.semestre) : null,
    acessoAte: str(r.acesso_ate),
    b2b: bool(r.b2b),
    academyUserId: str(r.academy_user_id),
    sanarflixUserId: str(r.sanarflix_user_id),
    ultimaAtividade: str(r.ultima_atividade),
    diasSemAtividade: num(r.dias_sem_atividade),
    segmento: segmento(r.segmento),
    // Meta sem corte conhecido não serve para "vs corte": fica null em vez de inventar.
    meta: r.meta && corte != null ? { especialidade: strOu(meta.especialidade, ''), instituicao: strOu(meta.instituicao, ''), cortePct: corte } : null,
    conteudos7d: consumoPeriodo(r.conteudos_7d),
    conteudos30d: consumoPeriodo(r.conteudos_30d),
    temDadoConsumo: bool(r.tem_dado_consumo),
    questoes7d: questoesPeriodo(r.questoes_7d),
    questoes30d: questoesPeriodo(r.questoes_30d),
    temDadoQuestoes: bool(r.tem_dado_questoes),
  };
}

export function alunoTurmaParaFlix(a: AlunoTurmaAcademy, triboId: string): AlunoFlix {
  return {
    alunoId: a.email,
    nome: a.nome ?? a.email,
    email: a.email,
    whatsapp: a.telefone,
    // TODO(contrato): o Academy não sabe o produto do aluno; "padrao" até o Flix assumir a lista.
    produto: 'padrao',
    acessoAte: a.acessoAte,
    semestre: a.semestre,
    campus: null,
    triboId,
    entrouNaTriboEm: null,
    origemAlocacao: 'planilha',
    ultimaAtividadeEm: a.ultimaAtividade,
    meta: a.meta,
  };
}

function casaBusca(a: AlunoFlix, busca?: string): boolean {
  const q = busca ? normalizar(busca) : '';
  if (!q) return true;
  return normalizar(a.nome).includes(q) || normalizar(a.email).includes(q);
}

// ─── Mural ──────────────────────────────────────────────────────────────────

export const ROTULO_TAG: Record<TagMural, string> = { desempenho: 'Desempenho', aviso: 'Aviso', fique_por_dentro: 'Fique por dentro' };

/** Texto livre da tag do Academy → tag do contrato. Tags fora das três (ex.: 'Agenda') caem em 'aviso'. */
export function tagDoAcademy(tag: string): TagMural {
  const t = normalizar(tag);
  if (t === 'desempenho') return 'desempenho';
  if (t === 'fique por dentro' || t === 'fique_por_dentro') return 'fique_por_dentro';
  return 'aviso';
}

export function mapearPublicacao(raw: unknown): Publicacao {
  const r = obj(raw);
  const tagTexto = strOu(r.tag, '');
  const tag = tagDoAcademy(tagTexto);
  const url = str(r.link_url);
  return {
    id: String(r.id),
    tag,
    titulo: strOu(r.titulo, ''),
    mensagem: strOu(r.mensagem, ''),
    link: url ? { url, titulo: strOu(r.link_titulo, '') } : null,
    // Academy: path no bucket `mural-anexos` (assinar para exibir); é o mesmo valor que `pedirUpload` devolve em fileUrl.
    anexoUrl: str(r.anexo_path),
    destino: r.publico === 'selecionados' ? { tipo: 'selecionados', alunoIds: strs(r.destinatarios) } : { tipo: 'turma' },
    status: r.status === 'publicado' ? 'publicada' : 'rascunho',
    publicadaEm: str(r.publicado_em),
    editadaEm: str(r.editada_em),
    fixada: bool(r.fixada),
    anexoNome: str(r.anexo_nome),
    origem: str(r.origem),
    tagOriginal: ROTULO_TAG[tag] === tagTexto ? null : tagTexto,
  };
}

type DestinoNovo = NovaPublicacao['destino'] | Publicacao['destino'];
function argsMural(id: string | null, p: NovaPublicacao) {
  const destino = p.destino as DestinoNovo;
  const selecionados = destino.tipo === 'alunos' || destino.tipo === 'selecionados';
  return {
    p_id: id,
    p_tag: ROTULO_TAG[p.tag] ?? p.tag,
    p_titulo: p.titulo,
    p_mensagem: p.mensagem,
    p_link_titulo: p.link?.titulo ?? null,
    p_link_url: p.link?.url ?? null,
    p_anexo_path: p.anexo?.url ?? null,
    p_anexo_nome: p.anexo?.nome ?? null,
    p_publico: selecionados ? 'selecionados' : 'turma',
    p_destinatarios: selecionados ? [...(destino as { alunoIds: string[] }).alunoIds] : [],
    p_publicar: p.status === 'publicada',
    p_registrar_intervencao: p.registrarIntervencao === true,
  };
}

// ─── Sessões ────────────────────────────────────────────────────────────────

export const ROTULO_TIPO_SESSAO: Record<TipoSessao, string> = {
  encontro_tribo: 'Encontro da tribo', pos_simulado: 'Pós-simulado', oficina: 'Oficina de questões', individual: 'Reunião individual',
};
const TIPOS_SESSAO: readonly TipoSessao[] = ['encontro_tribo', 'pos_simulado', 'oficina', 'individual'];
const tipoSessao = (v: unknown): TipoSessao => (v === 'coletiva' ? 'encontro_tribo' : TIPOS_SESSAO.includes(v as TipoSessao) ? (v as TipoSessao) : 'encontro_tribo');

export function mapearSessao(raw: unknown): Sessao {
  const r = obj(raw);
  const inicio = str(r.inicio);
  const { data, hora } = inicio ? dataHoraSp(inicio) : { data: '', hora: '' };
  const pauta = lista(r.pauta).map(obj).map((it, i) => ({ it, ordem: num(it.ordem) ?? i })).sort((a, b) => a.ordem - b.ordem);
  return {
    id: String(r.id),
    tipo: tipoSessao(r.tipo),
    data,
    hora,
    tema: str(r.tema),
    alunoId: str(r.aluno_email),
    link: str(r.meet_link),
    status: r.status === 'realizada' ? 'realizada' : 'agendada',
    gravacaoUrl: str(r.gravacao_url),
    pauta: pauta.map(({ it, ordem }) => ({
      id: `${String(r.id)}:${ordem}`,
      origem: it.origem === 'tema_critico' || it.origem === 'mais_erradas' ? it.origem : 'livre',
      referenciaId: str(it.referenciaId),
      texto: strOu(it.texto, ''),
    })),
    titulo: str(r.titulo),
    inicio: inicio ?? undefined,
    duracaoMin: num(r.duracao_min),
    descricao: str(r.descricao),
    realizadaEm: str(r.realizada_em),
    origem: str(r.origem),
  };
}

const pautaSql = (pauta?: NovaSessao['pauta']) =>
  pauta ? pauta.map((p) => ({ texto: p.texto, origem: p.origem, referenciaId: p.referenciaId ?? null, ordem: p.ordem })) : null;

// ─── Convites e canais ──────────────────────────────────────────────────────

export function mapearConvite(raw: unknown): ConviteFlix {
  const r = obj(raw);
  return {
    id: String(r.id),
    alunoId: strOu(r.alunoEmail ?? r.aluno_email, ''),
    alunoNome: str(r.alunoNome ?? r.aluno_nome),
    publicacaoId: null,
    mensagem: str(r.mensagem),
    ativo: true,
    liberadoEm: strOu(r.desde, ''),
  };
}

export function mapearCanal(raw: unknown): CanalTurma {
  const r = obj(raw);
  const url = str(r.url);
  const tipo = r.tipo === 'avisos' || r.tipo === 'plantao' ? r.tipo : 'grupo_turma';
  return { tipo, url: url ?? '', editavel: bool(r.editavel), nome: strOu(r.nome, ''), configurado: !!url };
}

// ─── DAG B2C ────────────────────────────────────────────────────────────────

export function mapearSimuladoDesempenho(raw: unknown): SimuladoMentor {
  const r = obj(raw);
  return {
    id: String(r.id),
    ordem: num(r.sequence_number) ?? 0,
    nome: strOu(r.titulo, ''),
    data: str(r.janela_fim),
    status: r.encerrado === true ? 'realizado' : 'agendado',
    participantes: null,
  };
}

const SITUACOES = ['sem_simulado', 'sem_meta', 'acima', 'proximo', 'longe'] as const;
export function mapearDesempenho(raw: unknown): DesempenhoTurmaB2c {
  const r = obj(raw);
  const part = obj(r.participacao_ultimo);
  return {
    alunos: lista(r.alunos).map(obj).map((a) => ({
      email: strOu(a.email, ''),
      nome: str(a.nome),
      notas: lista(a.notas).map(obj).map((n) => ({
        simuladoId: String(n.simulado_id), ordem: num(n.sequence_number), acertoPct: num(n.acerto_pct), finalizadaEm: str(n.finalizada_em),
      })),
      ultimoAcerto: num(a.ultimo_acerto),
      corteMaisDificil: num(a.corte_mais_dificil),
      vsCortePp: num(a.vs_corte_pp),
      situacao: SITUACOES.includes(a.situacao as never) ? (a.situacao as DesempenhoTurmaB2c['alunos'][number]['situacao']) : 'sem_simulado',
      regrediu: bool(a.regrediu),
      estagnado: bool(a.estagnado),
      fezUltimo: boolOuNull(a.fez_ultimo),
    })),
    possivelAprovacaoPct: num(r.possivel_aprovacao_pct),
    acertoMedioUltimo: num(r.acerto_medio_ultimo),
    simulados: lista(r.simulados).map(mapearSimuladoDesempenho),
    participacaoUltimo: { simuladoId: str(part.simulado_id), fizeram: contagem(part.fizeram), total: contagem(part.total) },
  };
}

export function mapearSerie(raw: unknown): PontoSerieTurma[] {
  return lista(raw).map(obj).map((p) => ({
    simuladoId: String(p.simulado_id),
    ordem: num(p.sequence_number),
    titulo: str(p.titulo),
    fechado: bool(p.fechado),
    participantes: contagem(p.participantes),
    acertoMedio: num(p.acerto_medio),
    acimaCortePct: num(p.acima_corte_pct),
  }));
}

export function mapearEngajamento(raw: unknown): EngajamentoAluno[] {
  return lista(raw).map(obj).map((a) => ({
    email: strOu(a.email, ''),
    ultimaAtividade: str(a.ultima_atividade),
    diasSemAtividade: num(a.dias_sem_atividade),
    segmento: segmento(a.segmento),
    semanas: lista(a.semanas).map(obj).map((s) => ({
      semana: strOu(s.semana, ''), questoes: num(s.questoes), acertos: num(s.acertos), conteudos: num(s.conteudos),
    })),
  }));
}

const PREVALENCIA: Record<string, Prevalencia> = { alta: 'alta', media: 'media', baixa: 'baixa' };
export const prevalenciaDe = (v: unknown): Prevalencia | null => (typeof v === 'string' ? PREVALENCIA[normalizar(v)] ?? null : null);
const chaveTema = (area: string, esp: string | null, tema: string) => [area, esp ?? '', tema].map(normalizar).join('|');

export function mapearTemas(raw: unknown): TemaTurmaMentor[] {
  return lista(raw).map(obj).map((t) => {
    const grandeArea = strOu(t.grande_area, 'Sem área');
    const especialidade = str(t.especialidade);
    const tema = strOu(t.tema, 'Sem tema');
    return {
      id: str(t.id) ?? chaveTema(grandeArea, especialidade, tema),
      tema,
      especialidade,
      grandeArea,
      prevalencia: prevalenciaDe(t.prevalencia),
      peso: num(t.peso),
      respostas: contagem(t.respostas),
      acertoPct: num(t.acerto_pct),
      alunosAbaixo50: strs(t.alunos_abaixo_50),
      critico: bool(t.critico),
      serie: lista(t.serie).map(obj).map((s) => ({ simuladoId: String(s.simulado_id), acertoPct: num(s.acerto_pct) })),
    };
  });
}

const acertoTema = (v: unknown) => lista(v).map(obj).map((t) => ({ tema: strOu(t.tema, 'Sem tema'), acertoPct: num(t.acerto_pct), respostas: contagem(t.respostas) }));
export function mapearAreas(raw: unknown): AcertoArea[] {
  return lista(raw).map(obj).map((a) => ({
    grandeArea: strOu(a.grande_area, 'Sem área'),
    acertoPct: num(a.acerto_pct),
    respostas: contagem(a.respostas),
    especialidades: lista(a.especialidades).map(obj).map((e) => ({
      especialidade: str(e.especialidade), acertoPct: num(e.acerto_pct), respostas: contagem(e.respostas), temas: acertoTema(e.temas),
    })),
    temas: acertoTema(a.temas),
  }));
}

const mapaNumeros = (v: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries(obj(v)).map(([k, n]) => [k, contagem(n)]));
const mapaEmails = (v: unknown): Record<string, string[]> =>
  Object.fromEntries(Object.entries(obj(v)).map(([k, e]) => [k, strs(e)]));

export function mapearQuestaoResumo(raw: unknown): QuestaoResumoMentor {
  const q = obj(raw);
  return {
    questaoId: String(q.questao_id),
    numero: num(q.numero),
    ordem: num(q.sequence_number),
    grandeArea: strOu(q.grande_area, 'Sem área'),
    especialidade: str(q.especialidade),
    tema: strOu(q.tema, 'Sem tema'),
    temaCurto: str(q.tema_curto),
    dificuldade: str(q.dificuldade),
    enunciadoInicio: str(q.enunciado_inicio),
    temImagem: bool(q.tem_imagem),
    corretaLabel: str(q.correta_label),
    acertoPct: num(q.acerto_pct),
    respostas: contagem(q.respostas),
    distribuicao: mapaNumeros(q.distribuicao),
    emailsPorAlternativa: mapaEmails(q.emails),
  };
}

export function mapearDetalhamento(raw: unknown): DetalhamentoMentor {
  const r = obj(raw);
  return {
    areas: mapearAreas(r.areas),
    questoes: lista(r.questoes).map(mapearQuestaoResumo),
    bloqueados: lista(r.bloqueados).map(obj).map((b) => ({ simuladoId: String(b.simulado_id), ordem: num(b.sequence_number), liberaEm: str(b.libera_em) })),
  };
}

export function mapearQuestao(raw: unknown): QuestaoMentor {
  const q = obj(raw);
  const branco = obj(q.branco);
  return {
    questaoId: String(q.questao_id),
    simuladoId: str(q.simulado_id),
    ordem: num(q.sequence_number),
    numero: num(q.numero),
    grandeArea: strOu(q.grande_area, 'Sem área'),
    especialidade: str(q.especialidade),
    tema: strOu(q.tema, 'Sem tema'),
    temaCurto: str(q.tema_curto),
    dificuldade: str(q.dificuldade),
    enunciado: str(q.enunciado),
    imagens: strs(q.imagens),
    explicacao: str(q.explicacao),
    explicacaoImagemUrl: str(q.explicacao_imagem_url),
    respostas: contagem(q.respostas),
    acertoPct: num(q.acerto_pct),
    alternativas: lista(q.alternativas).map(obj).map((a) => ({
      label: strOu(a.label, ''), texto: str(a.texto), correta: bool(a.correta), n: contagem(a.n), pct: contagem(a.pct),
      emails: a.emails == null ? null : strs(a.emails),
    })),
    branco: { n: contagem(branco.n), emails: strs(branco.emails) },
  };
}

// ─── Kanban ─────────────────────────────────────────────────────────────────

const TIPO_INTERVENCAO_SQL: Record<string, TipoIntervencao> = {
  reuniao_individual: 'individual', reuniao_coletiva: 'coletiva', mensagem_mural: 'mensagem', whatsapp: 'mensagem',
};
const SQL_DO_TIPO: Record<TipoIntervencao, string> = { individual: 'reuniao_individual', coletiva: 'reuniao_coletiva', mensagem: 'mensagem_mural' };
const STATUS_SQL: Record<string, StatusIntervencao> = { a_fazer: 'afazer', em_andamento: 'andamento', feito: 'feito' };
const SQL_DO_STATUS: Record<StatusIntervencao, string> = { afazer: 'a_fazer', andamento: 'em_andamento', feito: 'feito' };
const PERFIL_SQL: Record<string, PerfilB2B> = { virada: 'virada', baixo: 'muito_baixo', bom: 'muito_bom', muito_baixo: 'muito_baixo', muito_bom: 'muito_bom' };
const SQL_DO_PERFIL: Record<PerfilB2B, 'virada' | 'baixo' | 'bom'> = { virada: 'virada', muito_baixo: 'baixo', muito_bom: 'bom' };
const ORIGEM_DO_KIND: Record<string, OrigemIntervencao> = {
  mural_post: 'mural', agenda_liberacao: 'agenda_liberada', sessao: 'sessao_criada', tema_critico: 'tema_critico', questao: 'questao',
};
const ROTULO_STATUS: Record<StatusIntervencao, string> = { afazer: 'A fazer', andamento: 'Em andamento', feito: 'Feito' };

const tipoIntervencao = (tipo: unknown, alvo: unknown): TipoIntervencao =>
  TIPO_INTERVENCAO_SQL[String(tipo)] ?? (alvo === 'aluno' ? 'individual' : 'coletiva');
const statusIntervencao = (v: unknown): StatusIntervencao => STATUS_SQL[String(v)] ?? (['afazer', 'andamento', 'feito'].includes(String(v)) ? (v as StatusIntervencao) : 'afazer');

export function textoDoEvento(tipo: string, payload: Linha): string {
  if (typeof payload.texto === 'string' && payload.texto.trim()) return payload.texto;
  switch (tipo) {
    case 'intervencao_status':
    case 'status_alterado': {
      const para = statusIntervencao(payload.para ?? payload.status);
      return `Status alterado para ${ROTULO_STATUS[para]}`;
    }
    case 'intervencao_criada': case 'intervencao_tema': case 'intervencao_aluno': return 'Intervenção criada';
    case 'intervencao_comentario': return 'Comentário adicionado';
    case 'mural_publicado': return 'Publicado no mural';
    case 'agenda_liberada': return 'Agendamento individual liberado';
    case 'agenda_desligada': return 'Agendamento desligado';
    case 'sessao_criada': return 'Sessão criada';
    case 'sessao_realizada': return 'Sessão realizada';
    case 'sessao_excluida': return 'Sessão excluída';
    case 'whatsapp': return 'WhatsApp aberto pelo Academy';
    case 'sinalizacao_ies': return 'Sinalizado à IES';
    default: return tipo;
  }
}

export function mapearIntervencao(raw: unknown): Intervencao {
  const c = obj(raw);
  const ref = obj(c.origem_ref);
  const kind = str(ref.kind);
  const alunos = strs(c.alunos);
  // O servidor grava um evento por aluno: o histórico do card mostra cada ocorrência uma vez.
  const vistos = new Set<string>();
  const historico = lista(c.historico).map(obj).map((h) => ({ em: strOu(h.em, ''), texto: textoDoEvento(strOu(h.tipo, ''), obj(h.payload)) }))
    .filter((h) => { const k = `${h.em}|${h.texto}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  return {
    id: String(c.id),
    tipo: tipoIntervencao(c.tipo, c.alvo),
    titulo: strOu(c.titulo, ''),
    nota: str(c.nota),
    destino: c.alvo === 'turma' ? { turmaToda: true, alunoIds: alunos } : { alunoIds: alunos },
    perfil: PERFIL_SQL[String(c.perfil)] ?? null,
    status: statusIntervencao(c.status),
    origem: (kind && ORIGEM_DO_KIND[kind]) || 'manual',
    referenciaId: str(ref.id),
    criadaEm: strOu(c.criado_em, ''),
    historico,
    comentarios: lista(c.comentarios).map(obj).map((x) => ({ em: strOu(x.criado_em, ''), texto: strOu(x.texto, '') })),
    peso: num(c.peso) ?? undefined,
    tipoOriginal: strOu(c.tipo, ''),
  };
}

export function mapearQuadro(raw: unknown): QuadroIntervencoes {
  const r = obj(raw);
  return { cards: lista(r.cards).map(mapearIntervencao), planejadas: contagem(r.planejadas), realizadas: contagem(r.realizadas) };
}

export function mapearIntervencaoResumo(raw: unknown): IntervencaoResumo {
  const i = obj(raw);
  return { id: String(i.id), tipo: tipoIntervencao(i.tipo, null), tipoOriginal: strOu(i.tipo, ''), titulo: strOu(i.titulo, ''), status: statusIntervencao(i.status), criadaEm: strOu(i.criado_em, '') };
}

export function mapearRotina(raw: unknown): ItemRotinaAcademy[] {
  return lista(raw).map(obj).map((r) => ({
    id: String(r.id),
    semana: strOu(r.semana, ''),
    dia: (['ter', 'qui', 'sex'].includes(String(r.dia)) ? r.dia : 'ter') as ItemRotinaAcademy['dia'],
    tipo: (['enquete', 'resposta', 'perola'].includes(String(r.tipo)) ? r.tipo : 'enquete') as ItemRotinaAcademy['tipo'],
    conteudo: strOu(r.conteudo, ''),
    enviadoEm: str(r.enviado_em),
  }));
}

export function mapearPerolas(raw: unknown): Perola[] {
  return lista(raw).map(obj).map((p) => ({ id: String(p.id), texto: strOu(p.texto, ''), tema: str(p.tema), criadaEm: strOu(p.criado_em, '') }));
}

// ─── Drawer B2C ─────────────────────────────────────────────────────────────

export function mapearAlunoDetalhe(email: string, aluno: unknown, notas: unknown, conteudos: unknown, questoes: unknown, modalidade: 'b2c' | 'b2b'): AlunoDetalheB2c {
  const a = obj(aluno);
  const n = obj(notas);
  const c = obj(conteudos);
  const q = obj(questoes);
  const lib = a.liberacao ? obj(a.liberacao) : null;
  const temConsumo = bool(c.tem_dado_consumo);
  const temQuestoes = bool(q.tem_dado_questoes);
  // Sem fonte de dado, a série semanal é desconhecida (null), não zero.
  const seFonte = (tem: boolean, v: unknown) => (tem ? num(v) : null);
  return {
    email,
    aluno: a.aluno ? mapearAlunoTurma(a.aluno, modalidade) : null,
    liberacao: lib ? { ligado: bool(lib.ligado), desde: strOu(lib.desde, ''), mensagem: str(lib.mensagem) } : null,
    intervencoes: lista(a.intervencoes).map(mapearIntervencaoResumo),
    log: lista(a.log).map(obj).map((l) => ({ tipo: strOu(l.tipo, ''), em: strOu(l.criado_em, ''), payload: obj(l.payload) })),
    sinalizadoEm: str(a.sinalizado_em),
    notas: lista(n.notas).map(obj).map((x) => ({
      simuladoId: String(x.simulado_id), ordem: num(x.sequence_number), titulo: str(x.titulo), acertoPct: num(x.acerto_pct),
      finalizadaEm: str(x.finalizada_em), acertos: num(x.acertos), respondidas: num(x.respondidas), posicao: num(x.posicao),
      participantes: num(x.participantes), percentil: num(x.percentil), dentroJanela: boolOuNull(x.dentro_janela),
    })),
    areas: mapearAreas(n.areas),
    conteudos: {
      temDadoConsumo: temConsumo,
      porSemana: lista(c.por_semana).map(obj).map((s) => ({ semana: strOu(s.semana, ''), videos: seFonte(temConsumo, s.videos), documentos: seFonte(temConsumo, s.documentos) })),
      recentes: lista(c.recentes).map(obj).map((x) => ({ quando: strOu(x.quando, ''), tipo: strOu(x.tipo, ''), conteudo: str(x.conteudo), curso: str(x.curso), modulo: str(x.modulo) })),
      topCursos: lista(c.top_cursos).map(obj).map((x) => ({ curso: strOu(x.curso, ''), total: contagem(x.total) })),
    },
    questoes: {
      temDadoQuestoes: temQuestoes,
      ultimaResposta: str(q.ultima_resposta),
      porSemana: lista(q.por_semana).map(obj).map((s) => ({
        semana: strOu(s.semana, ''), respondidas: seFonte(temQuestoes, s.respondidas), acertos: seFonte(temQuestoes, s.acertos), erros: seFonte(temQuestoes, s.erros),
      })),
      porArea: lista(q.por_area).map(obj).map((x) => ({
        area: strOu(x.area, ''), respondidas: contagem(x.respondidas), acertos: contagem(x.acertos), erros: contagem(x.erros), pctAcerto: num(x.pct_acerto),
      })),
    },
  };
}

// ─── B2B · contratos das migrations 20261104185935 e 20261104192114 ──

/** Janela em datas civis de SP; seis meses de calendario, com ajuste de fim de mes. */
export function periodoB2bParaDatas(periodo: PeriodoB2b, agora = new Date()): { p_inicio: string | null; p_fim: string | null } {
  if (periodo === 'ciclo') return { p_inicio: null, p_fim: null };
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora);
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);
  const fim = new Date(Date.UTC(parte('year'), parte('month') - 1, parte('day')));
  const inicio = new Date(fim);
  if (periodo === '6m') {
    inicio.setUTCDate(1);
    inicio.setUTCMonth(inicio.getUTCMonth() - 6);
    const ultimoDia = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0)).getUTCDate();
    inicio.setUTCDate(Math.min(fim.getUTCDate(), ultimoDia));
  } else inicio.setUTCDate(inicio.getUTCDate() - (periodo === '30d' ? 30 : 90));
  return { p_inicio: inicio.toISOString().slice(0, 10), p_fim: fim.toISOString().slice(0, 10) };
}

function mapearCronogramaB2b(raw: unknown): SimuladoMentor[] {
  const linhas = lista(raw).map(obj);
  const cronologicas = [...linhas].sort((a, b) => {
    const data = (r: Linha) => str(r.data) ? Date.parse(String(r.data)) : Infinity;
    return data(a) - data(b) || strOu(a.nome, '').localeCompare(strOu(b.nome, '')) || strOu(a.id, '').localeCompare(strOu(b.id, ''));
  });
  return linhas.map((s) => ({
    id: strOu(s.id, ''), ordem: cronologicas.indexOf(s) + 1, nome: strOu(s.nome, ''), data: str(s.data),
    status: s.status === 'processing' ? 'processando' : s.status === 'reagendado' ? 'agendado' : s.status as SimuladoMentor['status'],
    participantes: num(s.participantes), statusOriginal: strOu(s.status, ''),
    modalidade: (str(s.modalidade) as SimuladoMentor['modalidade']) ?? null, indisponivelPorque: str(s.indisponivelPorque),
  }));
}

function indicadorB2b(raw: unknown, nomes = new Map<string, string>()) {
  const k = obj(raw);
  return { valor: num(k.valor), delta: num(k.delta), serie: lista(k.serie).map(obj).map((p) => ({ rotulo: str(p.rotulo) ?? nomes.get(String(p.simuladoId)) ?? strOu(p.simuladoId, ''), valor: num(p.valor) })) };
}

function mapearVisaoB2b(raw: unknown, cronograma: SimuladoMentor[]): VisaoGeralB2b {
  const d = obj(raw), k = obj(d.kpis), evolucao = lista(d.evolucao).map(obj);
  const nomes = new Map(evolucao.map((e) => [String(e.simuladoId), strOu(e.nome, '')]));
  const ultimo = evolucao.at(-1);
  return {
    simulados: cronograma.filter((s) => evolucao.some((e) => e.simuladoId === s.id)),
    simuladoReferenciaId: str(ultimo?.simuladoId), conceitoEnamed: indicadorB2b(k.enamedProjetado, nomes),
    triProjetado: indicadorB2b(k.triProjetado, nomes), proficientesPct: indicadorB2b(k.proficientesPct, nomes),
    proficientes: num(d.n_prof), participantes: num(ultimo?.participantes), totalAlunos: num(d.alunosMatriculadosNoRecorte),
    acertoPct: num(obj(k.acertoPct).valor), simuladosRealizados: num(obj(k.simulados).realizados), simuladosContratados: num(obj(k.simulados).contratados),
    comTri: num(d.n_tri), faltamParaProximoConceito: num(d.faltam_para_proximo_conceito),
  };
}

export function mapearAlunoB2b(raw: unknown): AlunoB2b {
  const a = obj(raw);
  const perfis = strs(a.perfil).map((p) => PERFIL_SQL[p]).filter((p): p is PerfilB2B => Boolean(p));
  return {
    id: str(a.id), perfis, tendencia: (str(a.tendencia) as AlunoB2b['tendencia']) ?? null,
    email: strOu(a.email, ''),
    nome: str(a.nome),
    semestre: semestreDe(a.semestre),
    telefone: str(a.telefone),
    proficiencias: lista(a.proficiencias).map(obj).map((p) => ({ simuladoId: strOu(p.simuladoId, ''), ordem: null, valor: num(p.valor) })),
    acertoUltimoPct: null,
    ultimaAtividade: str(a.ultima_atividade),
    diasSemAtividade: num(a.dias_sem_atividade),
    perfil: (['muito_baixo', 'virada', 'muito_bom'] as const).find((p) => perfis.includes(p)) ?? null,
    grupo: (str(a.grupo) as AlunoB2b['grupo']) ?? null,
    sinalizadoEm: str(a.sinalizado_em),
  };
}

function mapearQuestaoB2b(raw: unknown): QuestaoResumoMentor {
  const q = obj(raw);
  const alternativas = lista(q.alternativas).map(obj).map((a) => ({ letra: strOu(a.letra, ''), texto: str(a.texto), correta: boolOuNull(a.correta), marcadaPct: num(a.marcadaPct) }));
  return {
    questaoId: str(q.id), numero: num(q.numero), ordem: null, grandeArea: strOu(q.grandeArea, 'Sem área'),
    especialidade: str(q.especialidade), tema: strOu(q.tema, 'Sem tema'), temaCurto: null, dificuldade: null,
    enunciadoInicio: str(q.enunciado), temImagem: Boolean(q.imagemEnunciado || q.imagemEnunciado2),
    corretaLabel: alternativas.find((a) => a.correta === true)?.letra ?? null,
    acertoPct: num(q.acertoPct), respostas: null, distribuicao: {}, emailsPorAlternativa: {},
    simuladoId: str(q.simuladoId), alternativas, distribuicaoPct: Object.fromEntries(alternativas.map((a) => [a.letra, a.marcadaPct])),
    imagemEnunciado: str(q.imagemEnunciado), imagemEnunciado2: str(q.imagemEnunciado2), imagemComentario: str(q.imagemComentario), distratorDominante: str(q.distratorDominante),
  };
}

function mapearDetalhamentoB2b(raw: unknown, questoes: QuestaoResumoMentor[]): DetalhamentoB2b {
  const d = obj(raw), metricas = lista(d.metricas).map(obj);
  // A RPC so fornece metricas por simulado: nao ha agregado ponderado do recorte.
  const unica = metricas.length === 1 ? metricas[0] : {};
  const indicador = (campo: string) => ({ valor: num(unica[campo]), delta: null, serie: metricas.map((m) => ({ rotulo: strOu(m.nome, ''), valor: num(m[campo]) })) });
  return {
    areas: lista(obj(d.acertoPorAreaESemestre).areas).map(obj).map((a) => ({ id: strOu(a.id, ''), grandeArea: strOu(a.nome, 'Sem área'), acertoPct: num(a.acertoPct), respostas: null, critica: bool(a.critica), especialidades: [], temas: [] })),
    questoes: lista(obj(d.questoes).data).map((rawQuestao) => {
      const q = mapearQuestaoB2b(rawQuestao);
      const candidatas = questoes.filter((c) => q.numero !== null && c.numero === q.numero && (!q.simuladoId || c.simuladoId === q.simuladoId));
      return { ...q, questaoId: q.questaoId ?? (candidatas.length === 1 ? candidatas[0].questaoId : null) };
    }),
    bloqueados: [], acertoMedioPct: num(unica.acertoMedioPct), conceitoEnamed: indicador('enamedProjetado'), triProjetado: indicador('proficienciaMedia'), proficientesPct: num(unica.proficientesPct),
    metricas: metricas as unknown as MetricasSimulado[], acertoPorAreaESemestre: d.acertoPorAreaESemestre as AcertoPorAreaESemestre | undefined,
  };
}

function mapearAlunoB2bDetalhe(email: string, raw: unknown): AlunoB2bDetalhe {
  const linhas = lista(raw).map(obj), primeiro = linhas[0];
  return {
    aluno: primeiro ? mapearAlunoB2b({ ...primeiro, email, proficiencias: linhas.map((s) => ({ simuladoId: s.simuladoId, valor: s.proficiencia })) }) : null,
    simulados: linhas.map((s) => ({ simuladoId: strOu(s.simuladoId, ''), ordem: null, titulo: str(s.simuladoNome), proficiencia: num(s.proficiencia), acertoPct: null, participou: bool(s.participou), data: str(s.simuladoData), acertos: num(s.acertos), situacao: str(s.situacao), posicao: (s.posicao as AlunoB2bDetalhe['simulados'][number]['posicao']) ?? null, acertoPorArea: lista(s.acertoPorArea) as NonNullable<AlunoB2bDetalhe['simulados'][number]['acertoPorArea']>, variacao: num(s.variacao) })),
    consumo30d: null, intervencoes: [], log: [], sinalizadoEm: null,
  };
}

// ─── Eventos do kanban (registrar_evento_mentor) ────────────────────────────

/** Contrato SQL de `registrar_evento_mentor(p_evento jsonb)` (20261104120000, comentário da função). */
export interface EventoSql {
  tipo: 'mural_publicado' | 'agenda_liberada' | 'sessao_criada' | 'sessao_realizada' | 'intervencao_tema' | 'intervencao_aluno' | 'whatsapp' | 'status_alterado';
  referencia_id: string;
  titulo?: string;
  nota?: string;
  alunos?: string[];
  turma_toda?: boolean;
  tipo_sessao?: TipoSessao;
  perfil?: 'virada' | 'baixo' | 'bom';
  origem?: 'tema_critico' | 'questao';
  intervencao_id?: string;
  status?: StatusIntervencao;
  registrar_intervencao?: boolean;
}

export interface OpcoesEventoSql {
  /** id da publicação/sessão/convite quando difere do que o evento carrega (ex.: convite em agenda_liberada). */
  referenciaId?: string;
  /** alunoId da fonte → e-mail do Academy (no Flix o id não é o e-mail). Padrão: identidade. */
  emailDe?: (alunoId: string) => string;
  /** Id único por ocorrência (whatsapp, status, intervenção de aluno). */
  novoId?: () => string;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** Evento de domínio (lib/eventosIntervencao) → payload de `registrar_evento_mentor`. */
export function eventoParaSql(e: EventoMentor, opts: OpcoesEventoSql = {}): EventoSql {
  const email = opts.emailDe ?? ((id: string) => id);
  const novoId = opts.novoId ?? uuid;
  switch (e.tipo) {
    case 'mural_publicado': {
      const turma = e.publicacao.destino.tipo === 'turma';
      return {
        tipo: 'mural_publicado', referencia_id: opts.referenciaId ?? e.publicacao.id, titulo: e.publicacao.titulo,
        registrar_intervencao: e.registrarIntervencao,
        ...(turma ? { turma_toda: true } : { alunos: (e.publicacao.destino as { alunoIds: string[] }).alunoIds.map(email) }),
      };
    }
    case 'agenda_liberada':
      return { tipo: 'agenda_liberada', referencia_id: opts.referenciaId ?? e.alunoId, titulo: `Reunião individual com ${primeiroNome(e.alunoNome)}`, alunos: [email(e.alunoId)] };
    case 'sessao_criada':
    case 'sessao_realizada': {
      const individual = e.sessao.tipo === 'individual';
      return {
        tipo: e.tipo, referencia_id: opts.referenciaId ?? e.sessao.id, tipo_sessao: e.sessao.tipo,
        titulo: individual ? `Reunião individual: ${e.sessao.tema ?? e.alunoNome ?? ''}`.trim() : `Sessão: ${e.sessao.tema ?? 'tema a definir'}`,
        ...(individual ? { alunos: e.sessao.alunoId ? [email(e.sessao.alunoId)] : [] } : { turma_toda: true }),
      };
    }
    case 'intervencao_tema':
      return {
        tipo: 'intervencao_tema', referencia_id: opts.referenciaId ?? e.temaId, origem: e.origem, turma_toda: true,
        titulo: `${e.tema}: ${e.acertoPct === null ? '—' : `${e.acertoPct}%`} de acerto da turma`,
      };
    case 'intervencao_aluno':
      return {
        tipo: 'intervencao_aluno', referencia_id: opts.referenciaId ?? novoId(), alunos: [email(e.alunoId)],
        titulo: `Acompanhar ${primeiroNome(e.alunoNome)}`, ...(e.perfil ? { perfil: SQL_DO_PERFIL[e.perfil] } : {}),
      };
    case 'whatsapp_aberto':
      return { tipo: 'whatsapp', referencia_id: opts.referenciaId ?? novoId(), alunos: [email(e.alunoId)] };
    case 'status_alterado':
      return { tipo: 'status_alterado', referencia_id: opts.referenciaId ?? novoId(), intervencao_id: e.intervencaoId, status: e.status };
  }
}

// ─── Parte do Academy que não passa pela FonteMentoria (DAGs + kanban) ──────

export interface DadosAcademy {
  // DAG B2C
  turma(): Promise<ComMeta<AlunoTurmaAcademy[]>>;
  desempenhoTurma(simulados: string[] | null): Promise<ComMeta<DesempenhoTurmaB2c>>;
  serieTurma(simulados: string[] | null): Promise<ComMeta<PontoSerieTurma[]>>;
  engajamentoTurma(semanas: number): Promise<ComMeta<EngajamentoAluno[]>>;
  temasTurma(simulados: string[] | null): Promise<ComMeta<TemaTurmaMentor[]>>;
  detalhamento(simulados: string[], emails?: string[] | null): Promise<ComMeta<DetalhamentoMentor>>;
  questao(questaoId: string, simulados: string[] | null): Promise<ComMeta<QuestaoMentor>>;
  alunoDetalhe(email: string): Promise<ComMeta<AlunoDetalheB2c>>;
  // DAG B2B
  visaoGeralB2b(periodo: PeriodoB2b): Promise<ComMeta<VisaoGeralB2b>>;
  alunosB2b(periodo: PeriodoB2b): Promise<ComMeta<AlunoB2b[]>>;
  temasTurmaB2b(periodo: PeriodoB2b): Promise<ComMeta<TemaTurmaMentor[]>>;
  detalhamentoB2b(simulados: string[]): Promise<ComMeta<DetalhamentoB2b>>;
  questoesB2b(simulados: string[]): Promise<ComMeta<QuestaoResumoMentor[]>>;
  respondentesB2b(questaoId: string, simulados: string[]): Promise<ComMeta<RespondenteB2b[]>>;
  cronogramaB2b(): Promise<ComMeta<SimuladoMentor[]>>;
  alunoB2b(email: string): Promise<ComMeta<AlunoB2bDetalhe>>;
  // Kanban, rotina, sinalização, pérolas
  intervencoes(periodo: PeriodoIntervencoes): Promise<QuadroIntervencoes>;
  criarIntervencao(n: NovaIntervencaoManual): Promise<{ id: string }>;
  atualizarIntervencao(id: string, p: { titulo?: string | null; nota?: string | null; status?: StatusIntervencao | null }): Promise<{ id: string; status: StatusIntervencao }>;
  comentarIntervencao(id: string, texto: string): Promise<{ id: string }>;
  registrarEvento(evento: EventoSql): Promise<{ intervencaoId: string | null; duplicado: boolean }>;
  rotina(semana: string): Promise<ItemRotinaAcademy[]>;
  marcarRotinaEnviada(id: string): Promise<{ id: string; enviadoEm: string | null }>;
  sinalizarIes(email: string, motivo: string): Promise<SinalizacaoCriada>;
  perolas(): Promise<Perola[]>;
  salvarPerola(texto: string, tema: string | null): Promise<{ id: string }>;
}

export function criarDadosAcademy(rpc: ChamadorRpc = rpcSupabase, modalidade: () => Promise<'b2c' | 'b2b'> = async () => 'b2c'): DadosAcademy {
  const uuidArr = (s: string[] | null) => (s && s.length ? s : null);
  const b2b = async <T>(fn: string, args: Record<string, unknown>, mapear: (d: unknown) => T): Promise<ComMeta<T>> => {
    const { data, meta } = desembrulhar(await rpc(fn, args));
    return { data: mapear(data), meta };
  };
  return {
    turma: async () => {
      const [m, rows] = await Promise.all([modalidade(), rpc('mentor_turma')]);
      return semMeta(lista(rows).map((r) => mapearAlunoTurma(r, m)));
    },
    desempenhoTurma: async (s) => semMeta(mapearDesempenho(await rpc('mentor_desempenho_turma', { p_simulados: uuidArr(s) }))),
    serieTurma: async (s) => semMeta(mapearSerie(await rpc('mentor_serie_turma', { p_simulados: uuidArr(s) }))),
    engajamentoTurma: async (semanas) => semMeta(mapearEngajamento(await rpc('mentor_engajamento_turma', { p_semanas: semanas }))),
    temasTurma: async (s) => semMeta(mapearTemas(await rpc('mentor_temas_turma', { p_simulados: uuidArr(s) }))),
    detalhamento: async (s, emails) => semMeta(mapearDetalhamento(await rpc('mentor_detalhamento', { p_simulados: s, p_emails: emails?.length ? emails : null }))),
    questao: async (id, s) => semMeta(mapearQuestao(await rpc('mentor_questao', { p_questao_id: id, p_simulados: uuidArr(s) }))),
    alunoDetalhe: async (email) => {
      const [m, aluno, notas, conteudos, questoes] = await Promise.all([
        modalidade(),
        rpc('mentor_aluno', { p_email: email }),
        rpc('mentor_aluno_notas', { p_email: email }),
        rpc('mentor_aluno_conteudos', { p_email: email }),
        rpc('mentor_aluno_questoes', { p_email: email }),
      ]);
      return semMeta(mapearAlunoDetalhe(email, aluno, notas, conteudos, questoes, m));
    },
    visaoGeralB2b: async (periodo) => {
      const { data, meta } = desembrulhar(await rpc('mentor_visao_geral_b2b', periodoB2bParaDatas(periodo)));
      const cronograma = desembrulhar(await rpc('mentor_cronograma_b2b', {}));
      return { data: mapearVisaoB2b(data, mapearCronogramaB2b(cronograma.data)), meta };
    },
    alunosB2b: (periodo) => b2b('mentor_alunos_b2b', periodoB2bParaDatas(periodo), (d) => lista(obj(d).data).map(mapearAlunoB2b)),
    temasTurmaB2b: (periodo) => b2b('mentor_temas_turma_b2b', periodoB2bParaDatas(periodo), (d) => mapearTemas(d).map((t, i) => {
      const raw = obj(lista(d)[i]);
      return { ...t, peso: t.prevalencia ? { alta: 3, media: 2, baixa: 1 }[t.prevalencia] : null, impacto: num(raw.impacto), amostra: num(raw.amostra), lowSample: bool(raw.lowSample) };
    })),
    detalhamentoB2b: async (s) => {
      const { data, meta } = desembrulhar(await rpc('mentor_detalhamento_b2b', { p_simulados: s }));
      const embutidas = lista(obj(obj(data).questoes).data);
      const questoes = embutidas.some((q) => obj(q).id == null)
        ? lista(obj(desembrulhar(await rpc('mentor_questoes_b2b', { p_simulados: s })).data).data).map(mapearQuestaoB2b) : [];
      return { data: mapearDetalhamentoB2b(data, questoes), meta };
    },
    questoesB2b: (s) => b2b('mentor_questoes_b2b', { p_simulados: s }, (d) => lista(obj(d).data).map(mapearQuestaoB2b)),
    respondentesB2b: (id, s) => b2b('mentor_questao_respondentes_b2b', { p_questao_id: id, p_simulados: s }, (d) => lista(d).map(obj).map((r) => ({ email: strOu(r.email, ''), nome: str(r.nome), alternativa: strOu(r.alternativa, ''), alunoId: str(r.alunoId) }))),
    cronogramaB2b: () => b2b('mentor_cronograma_b2b', {}, mapearCronogramaB2b),
    alunoB2b: (email) => b2b('mentor_aluno_b2b', { p_email: email }, (d) => mapearAlunoB2bDetalhe(email, d)),
    intervencoes: async (p) => mapearQuadro(await rpc('mentor_intervencoes_listar', { p_de: p.de, p_ate: p.ate })),
    criarIntervencao: async (n) => {
      const ids = n.destino.alunoIds ?? [];
      const alvo = n.destino.turmaToda ? 'turma' : ids.length === 1 ? 'aluno' : 'grupo';
      const r = obj(await rpc('mentor_intervencao_criar', {
        p_tipo: SQL_DO_TIPO[n.tipo], p_titulo: n.titulo, p_nota: n.nota ?? null, p_alvo: alvo, p_alunos: n.destino.turmaToda ? [] : ids,
      }));
      return { id: String(r.intervencao_id) };
    },
    atualizarIntervencao: async (id, p) => {
      const r = obj(await rpc('mentor_intervencao_atualizar', {
        p_id: id, p_titulo: p.titulo ?? null, p_nota: p.nota === undefined ? null : p.nota ?? '', p_status: p.status ? SQL_DO_STATUS[p.status] : null,
      }));
      return { id: String(r.intervencao_id ?? id), status: statusIntervencao(r.status) };
    },
    comentarIntervencao: async (id, texto) => {
      const r = obj(await rpc('mentor_intervencao_comentar', { p_id: id, p_texto: texto }));
      return { id: String(r.comentario_id) };
    },
    registrarEvento: async (evento) => {
      // status do domínio ('afazer'/'andamento'/'feito') é aceito pela função (CASE no SQL).
      const r = obj(await rpc('registrar_evento_mentor', { p_evento: evento }));
      return { intervencaoId: str(r.intervencao_id), duplicado: bool(r.duplicado) };
    },
    rotina: async (semana) => mapearRotina(await rpc('mentor_rotina_listar', { p_semana: semana })),
    marcarRotinaEnviada: async (id) => {
      const r = obj(await rpc('mentor_rotina_marcar_enviado', { p_id: id }));
      return { id: String(r.id ?? id), enviadoEm: str(r.enviado_em) };
    },
    sinalizarIes: async (email, motivo) => {
      const r = obj(await rpc('mentor_sinalizar_ies', { p_email: email, p_motivo: motivo }));
      return { id: String(r.id), sinalizadoEm: strOu(r.sinalizado_em, '') };
    },
    perolas: async () => mapearPerolas(await rpc('mentor_perolas_listar')),
    salvarPerola: async (texto, tema) => {
      const r = obj(await rpc('mentor_perola_salvar', { p_texto: texto, p_tema: tema }));
      return { id: String(r.id) };
    },
  };
}

// ─── FonteMentoria sobre o Academy ──────────────────────────────────────────

export interface DepsFonteAcademy {
  rpc?: ChamadorRpc;
  assinarUpload?: AssinarUpload;
  lerCadastro?: LerCadastroMentor;
}

export interface FonteAcademy extends FonteMentoria {
  /** Modalidade do mentor logado (cacheada a partir de `me()`). */
  modalidade(): Promise<'b2c' | 'b2b'>;
}

export function criarFonteAcademy(deps: DepsFonteAcademy = {}): FonteAcademy {
  const rpc = deps.rpc ?? rpcSupabase;
  const assinar = deps.assinarUpload ?? assinarUploadSupabase;
  const lerCadastro = deps.lerCadastro ?? lerCadastroSupabase;
  let meCache: Promise<MeFlix> | null = null;

  const carregarMe = async (): Promise<MeFlix> => {
    const raw = await rpc('get_mentor_contexto');
    const m = obj(obj(raw).mentor);
    // TODO(contrato): get_mentor_contexto ainda não devolve link_agendamento nem foto_url.
    const precisaCadastro = m.user_id && !('link_agendamento' in m || 'agenda_url' in m);
    const cadastro = precisaCadastro ? await lerCadastro(String(m.user_id)) : null;
    return mapearMe(raw, cadastro);
  };
  const meCacheado = () => (meCache ??= carregarMe().catch((e) => { meCache = null; throw e; }));
  const modalidade = async () => (await meCacheado()).mentor.modalidade;

  const listarPublicacoes = async () => lista(await rpc('mentor_mural_listar', { p_aluno_email: null, p_tag: null })).map(mapearPublicacao);
  const buscarPublicacao = async (id: string) => {
    const p = (await listarPublicacoes()).find((x) => x.id === id);
    if (!p) throw new ErroFonte(404, 'validacao', 'Publicação não encontrada.');
    return p;
  };
  const listarSessoes = async () => lista(await rpc('mentor_sessoes_listar', { p_quando: 'todas' })).map(mapearSessao);
  const buscarSessao = async (id: string) => {
    const s = (await listarSessoes()).find((x) => x.id === id);
    if (!s) throw new ErroFonte(404, 'validacao', 'Sessão não encontrada.');
    return s;
  };
  const listarConvites = async () => lista(await rpc('mentor_convites_listar')).map(mapearConvite);
  const listarAlunos = async (triboId: string) => {
    const [m, rows] = await Promise.all([modalidade(), rpc('mentor_turma')]);
    return lista(rows).map((r) => alunoTurmaParaFlix(mapearAlunoTurma(r, m), triboId));
  };

  return {
    nome: 'academy',
    eventosNoServidor: true,
    modalidade,

    me: async () => {
      const m = await carregarMe();
      meCache = Promise.resolve(m);
      return m;
    },
    atualizarPerfil: async (p) => {
      if (p.fotoUrl !== undefined) throw new ErroFonte(400, 'validacao', 'A foto ainda não pode ser alterada pelo Academy.', 'fotoUrl');
      let agenda: string | null = null;
      if (p.agendaUrl !== undefined) agenda = str(obj(await rpc('mentor_definir_link_agendamento', { p_url: p.agendaUrl })).link_agendamento);
      meCache = null;
      const atual = await meCacheado();
      return { ...atual.mentor, agendaUrl: agenda ?? atual.mentor.agendaUrl };
    },

    alunos: async (triboId, busca) => (await listarAlunos(triboId)).filter((a) => casaBusca(a, busca)),
    aluno: async (triboId, alunoId) => {
      const alvo = alunoId.trim().toLowerCase();
      const a = (await listarAlunos(triboId)).find((x) => x.alunoId.toLowerCase() === alvo);
      if (!a) throw new ErroFonte(404, 'aluno_fora_da_tribo', 'Aluno fora da turma.');
      return a;
    },

    canais: async () => lista(await rpc('mentor_canais_listar')).map(mapearCanal),
    salvarGrupoTribo: async (_t, url) => mapearCanal(await rpc('mentor_canal_grupo_salvar', { p_url: url })),

    publicacoes: async (_t, filtro): Promise<Pagina<Publicacao>> => {
      const tag = filtro?.tag && filtro.tag in ROTULO_TAG ? ROTULO_TAG[filtro.tag as TagMural] : filtro?.tag ?? null;
      const linhas = lista(await rpc('mentor_mural_listar', { p_aluno_email: null, p_tag: tag })).map(mapearPublicacao);
      return { data: filtro?.status ? linhas.filter((p) => p.status === filtro.status) : linhas, nextCursor: null };
    },
    criarPublicacao: async (_t, p) => {
      const r = obj(await rpc('mentor_mural_salvar', argsMural(null, p)));
      return buscarPublicacao(String(r.post_id));
    },
    editarPublicacao: async (id, p) => {
      const atual = await buscarPublicacao(id);
      const completo: NovaPublicacao = {
        tag: p.tag ?? atual.tag,
        titulo: p.titulo ?? atual.titulo,
        mensagem: p.mensagem ?? atual.mensagem,
        link: p.link !== undefined ? p.link : atual.link,
        status: p.status ?? atual.status,
        anexo: p.anexo !== undefined ? p.anexo : atual.anexoUrl ? { url: atual.anexoUrl, nome: atual.anexoNome ?? 'anexo', mime: '', bytes: 0 } : null,
        destino: p.destino ?? (atual.destino.tipo === 'turma' ? { tipo: 'tribo' } : { tipo: 'alunos', alunoIds: atual.destino.alunoIds }),
        registrarIntervencao: p.registrarIntervencao ?? false,
      };
      await rpc('mentor_mural_salvar', argsMural(id, completo));
      return buscarPublicacao(id);
    },
    excluirPublicacao: async (id) => { await rpc('mentor_mural_excluir', { p_id: id }); },
    pedirUpload: async (arquivo) => {
      const { mentor } = await meCacheado();
      const nome = normalizar(arquivo.nome).replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'anexo';
      const r = await assinar(`${mentor.id}/${Date.now()}-${nome}`);
      return { uploadUrl: r.signedUrl, fileUrl: r.path };
    },

    sessoes: async (_t, filtro) => {
      const todas = await listarSessoes();
      const data = todas.filter((s) =>
        (!filtro?.status || s.status === filtro.status) &&
        (!filtro?.tipo || s.tipo === filtro.tipo) &&
        (!filtro?.de || (s.inicio ?? '') >= filtro.de) &&
        (!filtro?.ate || (s.inicio ?? '') <= filtro.ate));
      return { data, nextCursor: null };
    },
    criarSessao: async (_t, s) => {
      const titulo = s.titulo?.trim() || s.tema?.trim() || ROTULO_TIPO_SESSAO[s.tipo];
      const pauta = s.pauta?.length ? pautaSql(s.pauta) : null;
      const r = obj(await rpc('mentor_sessao_salvar', {
        p_id: null, p_tipo: s.tipo, p_titulo: titulo, p_tema: s.tema ?? null, p_inicio: s.inicio, p_duracao_min: s.duracaoMin ?? null,
        p_meet_link: s.meetUrl ?? null, p_aluno_email: s.alunoId ?? null, p_pauta: pauta, p_descricao: s.descricao ?? null,
      }));
      // TODO(P13): o Academy não confere o contrato de encontros (warning 'acima_do_contrato' do Flix).
      return { ...(await buscarSessao(String(r.sessao_id))), warnings: [] };
    },
    editarSessao: async (id, s) => {
      const { status, ...campos } = s;
      const atual = await buscarSessao(id);
      if (status === 'agendada' && atual.status === 'realizada') throw new ErroFonte(400, 'validacao', 'Uma sessão realizada não volta a ser agendada.', 'status');
      if (Object.keys(campos).length > 0) {
        await rpc('mentor_sessao_salvar', {
          p_id: id,
          p_tipo: atual.tipo,
          p_titulo: campos.titulo?.trim() || atual.titulo || atual.tema || ROTULO_TIPO_SESSAO[atual.tipo],
          p_tema: campos.tema !== undefined ? campos.tema : atual.tema,
          p_inicio: campos.inicio ?? atual.inicio,
          p_duracao_min: campos.duracaoMin ?? atual.duracaoMin ?? null,
          p_meet_link: campos.meetUrl !== undefined ? campos.meetUrl : atual.link,
          p_aluno_email: atual.alunoId,
          p_pauta: campos.pauta !== undefined ? pautaSql(campos.pauta) ?? [] : null,
          p_descricao: campos.descricao !== undefined ? campos.descricao ?? '' : null,
        });
      }
      if (status === 'realizada' && atual.status !== 'realizada') await rpc('mentor_sessao_marcar_feita', { p_id: id, p_gravacao_url: null });
      return buscarSessao(id);
    },
    excluirSessao: async (id) => { await rpc('mentor_sessao_excluir', { p_id: id }); },
    // Academy: anexar gravação passa por marcar_feita (a sessão fica realizada).
    vincularGravacao: async (id, g) => {
      await rpc('mentor_sessao_marcar_feita', { p_id: id, p_gravacao_url: g.url });
      return buscarSessao(id);
    },

    convites: async () => listarConvites(),
    liberarAgenda: async (_t, alunoId, mensagem) => {
      await rpc('mentor_agenda_liberar', { p_emails: [alunoId], p_mensagem: mensagem.mensagem });
      const alvo = alunoId.trim().toLowerCase();
      const c = (await listarConvites()).find((x) => x.alunoId.toLowerCase() === alvo);
      if (!c) throw new ErroFonte(503, 'rede', 'Agenda liberada, mas não foi possível relê-la.');
      return c;
    },
    desligarAgenda: async (conviteId) => {
      const c = (await listarConvites()).find((x) => x.id === conviteId);
      if (!c) throw new ErroFonte(404, 'validacao', 'Liberação não encontrada.');
      await rpc('mentor_agenda_desligar', { p_emails: [c.alunoId] });
    },
  };
}
