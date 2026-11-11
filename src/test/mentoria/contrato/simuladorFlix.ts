import type { InvocarProxy } from '@/features/mentor/api/flixClient';
import documento from '../../../../docs/mentoria/contrato-v2.3.openapi.json';
import { resolverOperacao } from './especificacao';
import { validarEsquema } from './validarEsquema';

export interface PedidoSimulado { metodo: string; caminho: string; corpo?: unknown; chaveIdempotencia?: string; requestId?: string }
export interface RespostaSimulada { status: number; corpo: unknown; requestId: string }
export interface OpcoesSimulador { agora?: () => Date; mentorId?: string }
export interface SimuladorFlix {
  responder(pedido: PedidoSimulado): RespostaSimulada;
  invocar: InvocarProxy;
  pedidos: PedidoSimulado[];
  comoMentor(mentorId: string): void;
  comoAluno(alunoId: string): void;
  avancarRelogio(ms: number): void;
  moverAlunoParaOutraTribo(alunoId: string): void;
  concluirSalaMeet(sessaoId: string, resultado: 'pronto' | 'falhou'): void;
  marcarRealizada(sessaoId: string): void;
  ligarGravacaoAutomatica(sessaoId: string, url: string): void;
  falharProxima(codigo: 'rede' | 'limite_requisicoes'): void;
  semente: { mentorId: string; outroMentorId: string; triboId: string; triboB2bId: string; triboDeOutroMentorId: string; alunoIds: string[] };
}
type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Objeto : {};
const copiar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const canonico = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonico).join(',')}]` : v !== null && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(objeto(v)[k])}`).join(',')}}` : JSON.stringify(v) ?? 'undefined';
const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const HORA = 3600000;
const DIA = 24 * HORA;
interface Aluno extends Objeto { alunoId: string; nome: string; triboId: string }
interface Tribo extends Objeto { id: string; mentorId: string; modalidade: string }
interface Publicacao extends Objeto { id: string; triboId: string; createdAt: string; fixada: boolean; status: string; anexo: unknown }
interface Meet { salaId: string | null; url: string | null; estado: string }
interface Gravacao { estado: string; url: string | null; duracaoSeg: number | null; disponivelEm: string | null }
interface Sessao {
  id: string; triboId: string; mentorId: string; tipo: string; inicio: string; duracaoMin: number;
  tema: string | null; descricao: string | null; alunoId: string | null; alunoNome: string | null;
  status: string; canceladaMotivo: string | null; meet: Meet; gravacao: Gravacao; pauta: unknown[];
  createdAt: string; updatedAt: string;
}
interface Upload { anexo: Objeto; criado: number; publicado: boolean }

export function criarSimuladorFlix(opcoes: OpcoesSimulador = {}): SimuladorFlix {
  const semente = { mentorId: uuid(1), outroMentorId: uuid(2), triboId: uuid(10), triboB2bId: uuid(11), triboDeOutroMentorId: uuid(12), alunoIds: Array.from({ length: 12 }, (_, i) => uuid(100 + i)) };
  let mentorId = opcoes.mentorId ?? semente.mentorId;
  let alunoId = semente.alunoIds[0];
  let deslocamento = 0;
  let sequencia = 1000;
  let requisicoes = 0;
  let chaves = 0;
  let proximaFalha: 'rede' | 'limite_requisicoes' | null = null;
  const agora = () => (opcoes.agora?.() ?? new Date('2026-11-11T15:00:00Z')).getTime() + deslocamento;
  const instante = () => new Date(agora()).toISOString();
  const novoId = () => uuid(++sequencia);
  const pedidos: PedidoSimulado[] = [];
  const mentores = new Map([semente.mentorId, semente.outroMentorId].map((id, i) => [id, { id, nome: i ? 'Outro Mentor' : 'Mentor Sanar', fotoUrl: null, bio: null, mote: null, googleEmail: null, modalidade: 'b2c', ativo: true } as Objeto]));
  const tribos: Tribo[] = [semente.triboId, semente.triboB2bId, semente.triboDeOutroMentorId].map((id, i) => ({ id, mentorId: i === 2 ? semente.outroMentorId : semente.mentorId, slug: `tribo-${i}`, nome: `Tribo ${i + 1}`, modalidade: i === 1 ? 'b2b' : 'b2c', papel: 'titular', lema: null, iconeUrl: null, cores: null, iesId: null, iesNome: null, campus: null, encontrosPorMes: 2, totalAlunos: i === 0 ? 12 : 3, mentoriaAtiva: true }));
  const alunos: Aluno[] = tribos.flatMap((tribo, t) => Array.from({ length: t === 0 ? 12 : 3 }, (_, i) => ({ alunoId: uuid(100 + t * 100 + i), nome: t === 0 && i === 0 ? 'Ana Souza' : `Aluno ${t + 1}-${i + 1}`, email: `aluno${t}-${i}@exemplo.com`, whatsapp: null, produto: 'pro', acessoAte: null, semestre: null, campus: null, triboId: tribo.id, entrouNaTriboEm: '2026-11-01T12:00:00Z', origemAlocacao: 'onboarding', ultimaAtividadeEm: null, meta: null })));
  const canais = tribos.flatMap((tribo) => (tribo.modalidade === 'b2b' ? ['grupo_tribo'] : ['avisos', 'plantao', 'grupo_tribo']).map((tipo) => ({ triboId: tribo.id, tipo, nome: tipo, url: null as string | null, editavel: tipo === 'grupo_tribo' })));
  const publicacoes = new Map<string, Publicacao>();
  const sessoes = new Map<string, Sessao>();
  const reservadas = new Set<string>();
  const uploads = new Map<string, Upload>();
  const idempotencia = new Map<string, { corpo: string; resposta: RespostaSimulada; criado: number }>();
  const coletiva = (s: Sessao) => !['individual', 'disponivel'].includes(s.tipo);
  const meetVazio = (): Meet => ({ salaId: null, url: null, estado: 'sem_sala' });
  const gravacaoVazia = (): Gravacao => ({ estado: 'nao_se_aplica', url: null, duracaoSeg: null, disponivelEm: null });
  function lerSessao(s: Sessao): Sessao {
    const resultado = copiar(s);
    if (coletiva(s) && s.status === 'realizada' && !s.gravacao.url) resultado.gravacao.estado = agora() > Date.parse(s.inicio) + s.duracaoMin * 60000 + DIA ? 'pendente' : 'aguardando';
    return resultado;
  }
  function liberar(s: Sessao): void {
    Object.assign(s, { tipo: 'disponivel', alunoId: null, alunoNome: null, meet: meetVazio(), updatedAt: instante() });
    reservadas.delete(s.id);
  }
  function novaSessao(triboId: string, corpo: Objeto): Sessao {
    const aluno = alunos.find((a) => a.alunoId === corpo.alunoId);
    return { id: novoId(), triboId, mentorId, tipo: String(corpo.tipo), inicio: new Date(String(corpo.inicio)).toISOString(), duracaoMin: Number(corpo.duracaoMin ?? 60), tema: typeof corpo.tema === 'string' ? corpo.tema : null, descricao: typeof corpo.descricao === 'string' ? corpo.descricao : null, alunoId: corpo.tipo === 'individual' ? aluno?.alunoId ?? null : null, alunoNome: corpo.tipo === 'individual' ? aluno?.nome ?? null : null, status: 'agendada', canceladaMotivo: null, meet: corpo.tipo === 'disponivel' ? meetVazio() : { salaId: null, url: null, estado: 'pendente' }, gravacao: gravacaoVazia(), pauta: Array.isArray(corpo.pauta) ? copiar(corpo.pauta) : [], createdAt: instante(), updatedAt: instante() };
  }
  function sobrepoe(inicio: number, duracao: number, ignorar?: string): boolean {
    return [...sessoes.values()].some((s) => s.id !== ignorar && s.mentorId === mentorId && s.status !== 'cancelada' && inicio < Date.parse(s.inicio) + s.duracaoMin * 60000 && inicio + duracao * 60000 > Date.parse(s.inicio));
  }
  function aviso(s: Sessao, mensagem: string): string {
    const id = novoId();
    publicacoes.set(id, { id, triboId: s.triboId, autorMentorId: s.mentorId, tag: 'aviso', titulo: 'Atualizacao da sessao', mensagem, link: null, anexo: null, destino: coletiva(s) ? { tipo: 'tribo' } : { tipo: 'alunos', alunoIds: [s.alunoId] }, grupoRotulo: null, grupoTotal: null, status: 'publicada', fixada: false, publicadaEm: instante(), editadaEm: null, origem: 'aviso_sessao', destinatarios: coletiva(s) ? null : 1, lidas: coletiva(s) ? null : 0, createdAt: instante(), updatedAt: instante() });
    return id;
  }
  function responder(pedido: PedidoSimulado): RespostaSimulada {
    pedidos.push(copiar(pedido));
    const requestId = pedido.requestId ?? `simulado-${++requisicoes}`;
    const resolucao = resolverOperacao(pedido.metodo, pedido.caminho);
    const operacao = resolucao?.operacao;
    function resposta(status: number, corpo: unknown): RespostaSimulada {
      // A proposta omite erros transversais em varias operacoes; o corpo continua sendo Erro.
      const esquema = operacao?.respostas[String(status)] ?? (status >= 400 ? documento.components.schemas.Erro : null);
      if (status < 400 && (!operacao || !(String(status) in operacao.respostas))) throw new Error(`Status de sucesso nao declarado: ${status}`);
      const erros = esquema === null ? corpo === null ? [] : [{ caminho: '', mensagem: 'Resposta sem corpo deve ser null.' }] : validarEsquema(esquema, corpo);
      if (erros.length) throw new Error(`Resposta fora do contrato (${operacao?.operationId ?? 'rota desconhecida'} ${status}): ${JSON.stringify(erros)}`);
      return copiar({ status, corpo, requestId });
    }
    const erro = (status: number, code: string, message = code, field?: string): RespostaSimulada => resposta(status, { error: { code, message, ...(field === undefined ? {} : { field }), requestId } });
    if (!resolucao || !operacao) return erro(404, 'nao_encontrado');
    if (proximaFalha) {
      const falha = proximaFalha; proximaFalha = null;
      // 'rede' e resposta do PROXY (flix-mentoria-proxy/index.ts), nao da API: fica fora do schema da API.
      if (falha === 'rede') return copiar({ status: 502, corpo: { error: { code: 'rede', message: 'Nao foi possivel acessar o Flix.' } }, requestId });
      return erro(429, 'limite_requisicoes');
    }
    const { parametros, query } = resolucao;
    const corpo = objeto(pedido.corpo);
    const sessao = sessoes.get(parametros.id);
    const publicacao = publicacoes.get(parametros.id);
    const triboId = parametros.triboId ?? sessao?.triboId ?? publicacao?.triboId;
    if (operacao.tag === 'academy' && triboId && !tribos.some((t) => t.id === triboId && t.mentorId === mentorId)) return erro(403, 'sem_acesso_tribo');
    if (operacao.tag === 'academy' && !mentores.has(mentorId)) return erro(403, 'sem_acesso_tribo');
    for (const nome of Object.keys(query)) if (!operacao.parametrosDeQuery.includes(nome)) return erro(400, 'validacao', 'Parametro de query nao permitido.', `/${nome}`);
    const definicao = objeto(objeto(objeto(documento.paths)[operacao.modelo])[operacao.metodo.toLowerCase()]);
    for (const valor of Array.isArray(definicao.parameters) ? definicao.parameters : []) {
      const p = objeto(valor);
      const parametro = typeof p.$ref === 'string' ? objeto(objeto(documento.components.parameters)[p.$ref.split('/').pop() ?? '']) : p;
      const nome = String(parametro.name);
      const v = parametro.in === 'path' ? parametros[nome] : parametro.in === 'query' ? query[nome] : undefined;
      if (v === undefined) continue;
      const esquema = objeto(parametro.schema);
      const erros = validarEsquema(esquema, esquema.type === 'integer' ? /^\d+$/.test(v) ? Number(v) : NaN : v);
      if (erros.length) return erro(400, 'validacao', erros[0].mensagem, `/${nome}${erros[0].caminho}`);
    }
    if (operacao.esquemaCorpo) {
      const erros = validarEsquema(operacao.esquemaCorpo, pedido.corpo);
      if (erros.length) return erro(400, 'validacao', erros[0].mensagem, erros[0].caminho);
    }
    let chave: string | undefined;
    if (operacao.exigeIdempotencia) {
      const erros = validarEsquema(documento.components.parameters.IdempotencyKey.schema, pedido.chaveIdempotencia);
      if (erros.length) return erro(400, 'validacao', 'Informe uma chave de idempotencia de 16 a 64 caracteres.', '/Idempotency-Key');
      chave = `${operacao.tag === 'academy' ? mentorId : alunoId}:${pedido.metodo}:${pedido.caminho}:${pedido.chaveIdempotencia}`;
      const anterior = idempotencia.get(chave);
      if (anterior && agora() - anterior.criado < DIA) {
        if (anterior.corpo !== canonico(pedido.corpo)) return erro(409, 'chave_reutilizada');
        return copiar(anterior.resposta);
      }
    }
    function pagina(itens: unknown[]): RespostaSimulada {
      const inicio = Number(query.cursor ?? 0);
      if (!Number.isSafeInteger(inicio) || inicio < 0) return erro(400, 'validacao', 'Cursor invalido.', '/cursor');
      const limite = Number(query.limit ?? 50);
      return resposta(200, { data: itens.slice(inicio, inicio + limite), nextCursor: inicio + limite < itens.length ? String(inicio + limite) : null });
    }
    function executar(): RespostaSimulada {
      switch (operacao?.operationId) {
        case 'obterMe': return resposta(200, { mentor: mentores.get(mentorId), tribos: tribos.filter((t) => t.mentorId === mentorId).map(({ mentorId: _mentor, ...t }) => ({ ...t, totalAlunos: alunos.filter((a) => a.triboId === t.id).length })) });
        case 'atualizarMe': { const mentor = mentores.get(mentorId); Object.assign(mentor ?? {}, corpo); return resposta(200, mentor); }
        case 'listarAlunos': return pagina(alunos.filter((a) => a.triboId === triboId && a.nome.toLocaleLowerCase('pt-BR').includes((query.busca ?? '').toLocaleLowerCase('pt-BR'))));
        case 'obterAluno': { const aluno = alunos.find((a) => a.alunoId === parametros.alunoId && a.triboId === triboId); return aluno ? resposta(200, aluno) : erro(404, 'nao_encontrado'); }
        case 'listarCanais': return resposta(200, canais.filter((c) => c.triboId === triboId));
        case 'salvarGrupoTribo': { const canal = canais.find((c) => c.triboId === triboId && c.tipo === 'grupo_tribo'); if (!canal) return erro(404, 'nao_encontrado'); canal.url = String(corpo.url); return resposta(200, canal); }
        case 'listarPublicacoes': return pagina([...publicacoes.values()].filter((p) => p.triboId === triboId && (!query.status || p.status === query.status) && (!query.tag || p.tag === query.tag)).reverse().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
        case 'pedirUpload': {
          const arquivoId = novoId();
          uploads.set(arquivoId, { anexo: { arquivoId, ...copiar(corpo) }, criado: agora(), publicado: false });
          return resposta(201, { arquivoId, uploadUrl: `https://upload.exemplo.com/${arquivoId}`, metodo: 'PUT', campos: {}, expiraEm: new Date(agora() + 2 * HORA).toISOString() });
        }
        case 'criarPublicacao':
        case 'editarPublicacao': {
          const editar = operacao.operationId === 'editarPublicacao';
          if (editar && !publicacao) return erro(404, 'nao_encontrado');
          const dados = { ...publicacao, ...corpo };
          const destino = objeto(dados.destino);
          const ids = Array.isArray(destino.alunoIds) ? destino.alunoIds as string[] : [];
          const dentro = ids.filter((id) => alunos.some((a) => a.alunoId === id && a.triboId === triboId));
          const fora = ids.filter((id) => !dentro.includes(id));
          if (destino.tipo === 'alunos' && !dentro.length) return erro(422, 'sem_destinatarios');
          let anexo: unknown = publicacao?.anexo ?? null;
          let upload: Upload | undefined;
          if ('anexoId' in corpo) {
            upload = typeof corpo.anexoId === 'string' ? uploads.get(corpo.anexoId) : undefined;
            if (corpo.anexoId !== null && !upload) return erro(422, 'anexo_invalido');
            anexo = upload?.anexo ?? null;
          }
          if (!upload && objeto(anexo).arquivoId) upload = uploads.get(String(objeto(anexo).arquivoId));
          if (upload && !upload.publicado && agora() - upload.criado > 2 * DIA) return erro(422, 'anexo_expirado');
          let desafixadaId: string | null = null;
          if (dados.fixada) for (const p of publicacoes.values()) if (p.triboId === triboId && p.fixada && p.id !== publicacao?.id) { p.fixada = false; p.updatedAt = instante(); desafixadaId = p.id; }
          const p: Publicacao = { id: publicacao?.id ?? novoId(), triboId: String(triboId), autorMentorId: publicacao?.autorMentorId ?? mentorId, tag: dados.tag, titulo: dados.titulo, mensagem: dados.mensagem, link: dados.link ?? null, anexo, destino: destino.tipo === 'tribo' ? { tipo: 'tribo' } : { tipo: 'alunos', alunoIds: dentro }, grupoRotulo: dados.grupoRotulo ?? null, grupoTotal: dados.grupoTotal ?? null, status: String(dados.status), fixada: dados.fixada === true, publicadaEm: dados.status === 'publicada' ? publicacao?.publicadaEm ?? instante() : null, editadaEm: editar && publicacao?.status === 'publicada' ? instante() : publicacao?.editadaEm ?? null, origem: publicacao?.origem ?? 'manual', destinatarios: destino.tipo === 'tribo' ? null : dentro.length, lidas: destino.tipo === 'tribo' ? null : publicacao?.lidas ?? 0, createdAt: publicacao?.createdAt ?? instante(), updatedAt: instante() };
          if (upload && p.status === 'publicada') upload.publicado = true;
          publicacoes.set(p.id, p);
          return resposta(editar ? 200 : 201, { publicacao: p, warnings: fora.length ? [{ code: 'aluno_fora_da_tribo', alunoIds: fora, nomes: fora.map((id) => alunos.find((a) => a.alunoId === id)?.nome ?? id) }] : [], desafixadaId });
        }
        case 'excluirPublicacao': if (!publicacao) return erro(404, 'nao_encontrado'); publicacoes.delete(publicacao.id); return resposta(204, null);
        case 'listarSessoes': return pagina([...sessoes.values()].filter((s) => s.triboId === triboId && (!query.de || Date.parse(s.inicio) >= Date.parse(query.de)) && (!query.ate || Date.parse(s.inicio) <= Date.parse(query.ate)) && (!query.status || s.status === query.status) && (!query.tipo || s.tipo === query.tipo)).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio)).map(lerSessao));
        case 'criarHorarios': {
          const inicio = Date.parse(String(corpo.inicio)); const fim = Date.parse(String(corpo.fim)); const duracao = Number(corpo.duracaoMin);
          if (inicio < agora() || fim <= inicio) return erro(400, 'validacao', 'Janela no passado ou fim anterior ao inicio.', '/inicio');
          const blocos: number[] = [];
          for (let t = inicio; t + duracao * 60000 <= fim; t += duracao * 60000) { if (t > agora() + 30 * DIA) return erro(422, 'fora_do_horizonte'); blocos.push(t); }
          if (blocos.some((t) => sobrepoe(t, duracao))) return erro(409, 'conflito_horario');
          const criadas = blocos.map((t) => novaSessao(String(triboId), { tipo: 'disponivel', inicio: new Date(t).toISOString(), duracaoMin: duracao }));
          criadas.forEach((s) => sessoes.set(s.id, s));
          return resposta(201, { data: criadas });
        }
        case 'criarSessao': {
          if (Date.parse(String(corpo.inicio)) < agora()) return erro(400, 'validacao', 'Inicio no passado.', '/inicio');
          if (corpo.tipo === 'individual') {
            if (!corpo.alunoId) return erro(400, 'validacao', 'Informe o aluno.', '/alunoId');
            if (!alunos.some((a) => a.alunoId === corpo.alunoId && a.triboId === triboId)) return erro(422, 'aluno_fora_da_tribo');
          } else if (typeof corpo.tema !== 'string' || !corpo.tema.trim()) return erro(400, 'validacao', 'Informe o tema.', '/tema');
          if (sobrepoe(Date.parse(String(corpo.inicio)), Number(corpo.duracaoMin ?? 60))) return erro(409, 'conflito_horario');
          const s = novaSessao(String(triboId), corpo); sessoes.set(s.id, s); return resposta(201, lerSessao(s));
        }
      }
      if (!sessao) return erro(404, 'nao_encontrado');
      const s = sessao;
      switch (operacao?.operationId) {
        case 'reservarHorario': {
          if (!alunos.some((a) => a.alunoId === alunoId && a.triboId === s.triboId)) return erro(404, 'nao_encontrado');
          if (s.tipo !== 'disponivel' || s.status !== 'agendada') return erro(409, 'horario_ocupado');
          if ([...sessoes.values()].some((outra) => reservadas.has(outra.id) && outra.alunoId === alunoId && outra.status === 'agendada' && Date.parse(outra.inicio) > agora())) return erro(422, 'limite_reservas');
          if (Date.parse(s.inicio) - agora() < 2 * HORA) return erro(422, 'fora_do_prazo');
          Object.assign(s, { tipo: 'individual', alunoId, alunoNome: alunos.find((a) => a.alunoId === alunoId)?.nome ?? null, meet: { salaId: null, url: null, estado: 'pendente' }, updatedAt: instante() });
          reservadas.add(s.id); return resposta(200, lerSessao(s));
        }
        case 'cancelarReserva':
          if (!reservadas.has(s.id) || s.alunoId !== alunoId || s.status !== 'agendada') return erro(404, 'nao_encontrado');
          if (Date.parse(s.inicio) - agora() < 2 * HORA) return erro(422, 'fora_do_prazo');
          liberar(s); return resposta(204, null);
        case 'excluirHorario':
          if (reservadas.has(s.id)) return erro(409, 'horario_reservado', `Este horario foi reservado por ${s.alunoNome}.`);
          if (s.tipo !== 'disponivel') return erro(422, 'use_cancelar');
          sessoes.delete(s.id); return resposta(204, null);
        case 'cancelarSessao': {
          if (s.status !== 'agendada' || s.tipo === 'disponivel') return erro(422, 'sessao_nao_editavel');
          s.status = 'cancelada'; s.canceladaMotivo = typeof corpo.motivo === 'string' ? corpo.motivo : null; s.updatedAt = instante();
          return resposta(200, { sessao: lerSessao(s), avisoPublicacaoId: aviso(s, 'Sessao cancelada.') });
        }
        case 'editarSessao': {
          if (s.status !== 'agendada' || s.tipo === 'disponivel') return erro(422, 'sessao_nao_editavel');
          if (reservadas.has(s.id) && ('inicio' in corpo || 'duracaoMin' in corpo)) return erro(422, 'sessao_nao_editavel');
          if ('inicio' in corpo && coletiva(s) && agora() >= Date.parse(s.inicio) - 10 * 60000) return erro(422, 'sessao_nao_editavel');
          if ('meetUrl' in corpo && s.meet.estado !== 'falhou') return erro(422, 'sessao_nao_editavel');
          if ('inicio' in corpo && Date.parse(String(corpo.inicio)) < agora()) return erro(400, 'validacao', 'Inicio no passado.', '/inicio');
          if (('inicio' in corpo || 'duracaoMin' in corpo) && sobrepoe(Date.parse(String(corpo.inicio ?? s.inicio)), Number(corpo.duracaoMin ?? s.duracaoMin), s.id)) return erro(409, 'conflito_horario');
          const mudouInicio = 'inicio' in corpo && Date.parse(String(corpo.inicio)) !== Date.parse(s.inicio);
          const { meetUrl, ...alteracoes } = corpo;
          Object.assign(s, alteracoes, { updatedAt: instante() });
          if (typeof corpo.inicio === 'string') s.inicio = new Date(corpo.inicio).toISOString();
          if (typeof meetUrl === 'string') s.meet = { salaId: null, url: meetUrl, estado: 'pronto' };
          return resposta(200, { sessao: lerSessao(s), avisoPublicacaoId: mudouInicio && coletiva(s) ? aviso(s, 'Data da sessao alterada.') : null });
        }
        case 'vincularGravacao':
          if (!coletiva(s) || s.status !== 'realizada') return erro(422, 'gravacao_nao_permitida');
          s.gravacao = { estado: 'manual', url: String(corpo.url), duracaoSeg: typeof corpo.duracaoSeg === 'number' ? corpo.duracaoSeg : null, disponivelEm: instante() }; s.updatedAt = instante();
          return resposta(200, lerSessao(s));
        default: return erro(404, 'nao_encontrado');
      }
    }
    const resultado = executar();
    if (chave) idempotencia.set(chave, { corpo: canonico(pedido.corpo), resposta: copiar(resultado), criado: agora() });
    return resultado;
  }
  const invocar: InvocarProxy = async (_nome, opcoesProxy) => {
    const body = objeto(opcoesProxy.body);
    const r = responder({ metodo: String(body.metodo ?? ''), caminho: String(body.caminho ?? ''), ...(body.corpo === undefined ? {} : { corpo: body.corpo }), chaveIdempotencia: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : `simulador-chave-${String(++chaves).padStart(12, '0')}`, ...(typeof body.requestId === 'string' ? { requestId: body.requestId } : {}) });
    return r.status < 400 ? { data: r.corpo, error: null } : { data: null, error: { name: 'FunctionsHttpError', message: 'A funcao retornou um erro HTTP.', context: new Response(JSON.stringify(r.corpo), { status: r.status }) } };
  };
  const exigirSessao = (id: string): Sessao => { const s = sessoes.get(id); if (!s) throw new Error(`Sessao nao encontrada: ${id}`); return s; };
  return {
    responder, invocar, pedidos, semente,
    comoMentor: (id) => { mentorId = id; },
    comoAluno: (id) => { alunoId = id; },
    avancarRelogio: (ms) => { deslocamento += ms; },
    moverAlunoParaOutraTribo: (id) => {
      const aluno = alunos.find((a) => a.alunoId === id);
      if (!aluno) throw new Error(`Aluno nao encontrado: ${id}`);
      aluno.triboId = aluno.triboId === semente.triboId ? semente.triboB2bId : semente.triboId;
      for (const s of sessoes.values()) if (reservadas.has(s.id) && s.alunoId === id && s.status === 'agendada' && Date.parse(s.inicio) > agora()) liberar(s);
    },
    concluirSalaMeet: (id, resultado) => { const s = exigirSessao(id); s.meet = resultado === 'pronto' ? { estado: 'pronto', salaId: `spaces/${id}`, url: `https://meet.google.com/${id}` } : { estado: 'falhou', salaId: null, url: null }; s.updatedAt = instante(); },
    marcarRealizada: (id) => { const s = exigirSessao(id); s.status = 'realizada'; s.updatedAt = instante(); },
    ligarGravacaoAutomatica: (id, url) => { const s = exigirSessao(id); s.gravacao = { estado: 'pronta', url, duracaoSeg: null, disponivelEm: instante() }; s.updatedAt = instante(); },
    falharProxima: (codigo) => { proximaFalha = codigo; },
  };
}
