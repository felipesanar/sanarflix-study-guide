import { beforeEach, describe, expect, it } from 'vitest';
import { criarSimuladorFlix, type SimuladorFlix, type RespostaSimulada } from './simuladorFlix';
import { resolverOperacao } from './especificacao';
import { validarEsquema } from './validarEsquema';

type Registro = Record<string, unknown>;
const registro = (v: unknown) => v as Registro;
const lista = (v: unknown) => v as Registro[];
let sim: SimuladorFlix;
let tribo: string;
let alunos: string[];
let contador = 0;
function chamar(metodo: string, caminho: string, corpo?: unknown, chaveIdempotencia = `chave-de-teste-${++contador}`): RespostaSimulada {
  const r = sim.responder({ metodo, caminho, corpo, chaveIdempotencia, requestId: `pedido-${contador}` });
  const o = resolverOperacao(metodo, caminho)?.operacao;
  const esquema = o?.respostas[String(r.status)] ?? (r.status >= 400 ? { $ref: '#/components/schemas/Erro' } : null);
  expect(esquema === null ? r.corpo : validarEsquema(esquema, r.corpo), 'toda resposta produzida nos testes valida contra o contrato').toEqual(esquema === null ? null : []);
  return r;
}
function erro(r: RespostaSimulada, status: number, code: string) { expect(r).toMatchObject({ status, corpo: { error: { code } } }); }
function publicar(extra: Registro = {}) { return chamar('POST', `/tribos/${tribo}/publicacoes`, { tag: 'aviso', titulo: 'Titulo', mensagem: 'Mensagem', destino: { tipo: 'tribo' }, status: 'publicada', ...extra }); }
function horarios(inicio = '2026-11-12T15:00:00Z', fim = '2026-11-12T17:10:00Z', outraTribo = tribo) {
  return chamar('POST', `/tribos/${outraTribo}/horarios`, { inicio, fim, duracaoMin: 60 });
}
function sessoes(query = '') { return lista(registro(chamar('GET', `/tribos/${tribo}/sessoes${query}`).corpo).data); }
function sessao(extra: Registro = {}) { return chamar('POST', `/tribos/${tribo}/sessoes`, { tipo: 'oficina', inicio: '2026-11-12T15:00:00Z', tema: 'Estudo', duracaoMin: 60, ...extra }); }
function id(r: RespostaSimulada) { return String(registro(r.corpo).id); }
function reservar(sessaoId: string) { return chamar('POST', `/sessoes/${sessaoId}/reservar`); }

beforeEach(() => { sim = criarSimuladorFlix(); tribo = sim.semente.triboId; alunos = sim.semente.alunoIds; contador = 0; });
describe('simulador Flix: gerais e operacoes diretas', () => {
  it('semente deterministica tem dois mentores, tribos B2C/B2B e 12/3 alunos', () => {
    const me = registro(chamar('GET', '/me').corpo);
    expect(lista(me.tribos)).toHaveLength(2);
    expect(registro(me.mentor).id).toBe(sim.semente.mentorId);
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/alunos`).corpo).data)).toHaveLength(12);
    expect(lista(registro(chamar('GET', `/tribos/${sim.semente.triboB2bId}/alunos`).corpo).data)).toHaveLength(3);
    expect(criarSimuladorFlix().responder({ metodo: 'GET', caminho: '/me' }).corpo).toEqual(me);
    expect(chamar('PATCH', '/me', { bio: 'Nova', googleEmail: 'mentor@sanar.com' }).corpo).toMatchObject({ bio: 'Nova' });
    sim.comoMentor(sim.semente.outroMentorId);
    expect(lista(registro(chamar('GET', '/me').corpo).tribos)).toHaveLength(1);
  });
  it('rota ou metodo desconhecido devolve 404 nao_encontrado', () => { erro(chamar('GET', '/ausente'), 404, 'nao_encontrado'); erro(chamar('POST', '/me'), 404, 'nao_encontrado'); });
  it('corpo invalido informa primeiro field e query desconhecida devolve 400', () => {
    expect(chamar('PATCH', '/me', { bio: 2 })).toMatchObject({ status: 400, corpo: { error: { field: '/bio' } } });
    erro(chamar('GET', `/tribos/${tribo}/alunos?extra=1`), 400, 'validacao');
    erro(chamar('GET', `/tribos/${tribo}/alunos?limit=201`), 400, 'validacao');
  });
  it('mentor em tribo alheia devolve 403 sem_acesso_tribo inclusive recurso por id', () => {
    erro(chamar('GET', `/tribos/${sim.semente.triboDeOutroMentorId}/alunos`), 403, 'sem_acesso_tribo');
    const p = registro(publicar().corpo).publicacao;
    const s = sessao();
    sim.comoMentor(sim.semente.outroMentorId);
    erro(chamar('PATCH', `/publicacoes/${registro(p).id}`, { titulo: 'X' }), 403, 'sem_acesso_tribo');
    erro(chamar('DELETE', `/sessoes/${id(s)}`), 403, 'sem_acesso_tribo');
  });
  it('listas paginam e busca ignora maiusculas; obterAluno devolve recurso ou 404', () => {
    const p = registro(chamar('GET', `/tribos/${tribo}/alunos?limit=5`).corpo);
    expect(lista(p.data)).toHaveLength(5);
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/alunos?limit=5&cursor=${p.nextCursor}`).corpo).data)[0].alunoId).toBe(alunos[5]);
    expect(registro(chamar('GET', `/tribos/${tribo}/alunos?limit=200`).corpo).nextCursor).toBeNull();
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/alunos?busca=ANA`).corpo).data).length).toBeGreaterThan(0);
    expect(chamar('GET', `/tribos/${tribo}/alunos/${alunos[0]}`).corpo).toMatchObject({ alunoId: alunos[0] });
    erro(chamar('GET', `/tribos/${tribo}/alunos/${sim.semente.mentorId}`), 404, 'nao_encontrado');
  });
  it('canais B2C sao tres, B2B so grupo; salvarGrupoTribo valida link', () => {
    expect(lista(chamar('GET', `/tribos/${tribo}/canais`).corpo).map((c) => c.tipo)).toEqual(['avisos', 'plantao', 'grupo_tribo']);
    expect(lista(chamar('GET', `/tribos/${sim.semente.triboB2bId}/canais`).corpo)).toHaveLength(1);
    expect(chamar('PUT', `/tribos/${tribo}/canais/grupo_tribo`, { url: 'https://chat.whatsapp.com/tribo' }).corpo).toMatchObject({ url: 'https://chat.whatsapp.com/tribo' });
  });
  it('mesma chave e mesmo corpo devolvem MESMA resposta e so um efeito; corpo diferente da 409', () => {
    const pedido = { metodo: 'POST', caminho: `/tribos/${tribo}/sessoes`, corpo: { tipo: 'oficina', inicio: '2026-11-12T15:00:00Z', tema: 'X' }, chaveIdempotencia: 'chave-idempotente-0001' };
    const primeira = sim.responder(pedido);
    expect(sim.responder({ ...pedido, corpo: { tema: 'X', inicio: '2026-11-12T15:00:00Z', tipo: 'oficina' } })).toEqual(primeira);
    expect(sessoes()).toHaveLength(1);
    erro(sim.responder({ ...pedido, corpo: { ...pedido.corpo, tema: 'Y' } }), 409, 'chave_reutilizada');
  });
  it('invocar usa Response no erro, gera chaves novas, registra historico e entrega 204 null', async () => {
    const r = await sim.invocar('flix-mentoria-proxy', { body: { metodo: 'POST', caminho: '/uploads', corpo: { nome: 'a.pdf', mime: 'application/pdf', bytes: 1 } } });
    expect(r.error).toBeNull();
    await sim.invocar('flix-mentoria-proxy', { body: { metodo: 'POST', caminho: '/uploads', corpo: { nome: 'a.pdf', mime: 'application/pdf', bytes: 1 } } });
    expect(sim.pedidos[0].chaveIdempotencia).not.toBe(sim.pedidos[1].chaveIdempotencia);
    const e = registro((await sim.invocar('flix-mentoria-proxy', { body: { metodo: 'GET', caminho: '/ausente' } })).error);
    expect(e.name).toBe('FunctionsHttpError');
    expect(e.context).toBeInstanceOf(Response);
    expect(await (e.context as Response).json()).toMatchObject({ error: { code: 'nao_encontrado' } });
    const livre = lista(registro(horarios().corpo).data)[0];
    expect(await sim.invocar('flix-mentoria-proxy', { body: { metodo: 'DELETE', caminho: `/sessoes/${livre.id}` } })).toEqual({ data: null, error: null });
  });
  it('falha proxima e consumida uma vez: 502 rede e 429 limite_requisicoes', () => {
    // 'rede' vem do proxy, nao da API: nao passa pela validacao de contrato de `chamar`.
    sim.falharProxima('rede');
    const queda = sim.responder({ metodo: 'GET', caminho: '/me' });
    expect(queda.status).toBe(502);
    expect(queda.corpo).toEqual({ error: { code: 'rede', message: 'Nao foi possivel acessar o Flix.' } });
    expect(chamar('GET', '/me').status).toBe(200);
    sim.falharProxima('limite_requisicoes'); erro(chamar('GET', '/me'), 429, 'limite_requisicoes');
  });
});

describe('mural e anexos', () => {
  it('descarta alunos fora da tribo com nomes em warnings e conta destinatarios/lidas', () => {
    sim.moverAlunoParaOutraTribo(alunos[1]);
    const r = registro(publicar({ destino: { tipo: 'alunos', alunoIds: alunos.slice(0, 2) } }).corpo);
    expect(r.publicacao).toMatchObject({ destino: { alunoIds: [alunos[0]] }, destinatarios: 1, lidas: 0, publicadaEm: '2026-11-11T15:00:00.000Z' });
    expect(lista(r.warnings)[0]).toMatchObject({ code: 'aluno_fora_da_tribo', alunoIds: [alunos[1]] });
    expect(lista(r.warnings)[0].nomes).toEqual([expect.any(String)]);
    erro(publicar({ destino: { tipo: 'alunos', alunoIds: [alunos[1]] } }), 422, 'sem_destinatarios');
  });
  it('500 destinatarios passa schema e cria para os que ficaram; 501 da 400', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${(i + 100).toString(16).padStart(12, '0')}`);
    ids[0] = alunos[0];
    expect(publicar({ destino: { tipo: 'alunos', alunoIds: ids } }).status).toBe(201);
    erro(publicar({ destino: { tipo: 'alunos', alunoIds: [...ids, sim.semente.mentorId] } }), 400, 'validacao');
  });
  it('fixada desafixa anterior; tribo tem contadores null; editar publicada marca editadaEm', () => {
    const primeira = registro(registro(publicar({ fixada: true }).corpo).publicacao);
    expect(primeira).toMatchObject({ destinatarios: null, lidas: null });
    expect(publicar({ fixada: true }).corpo).toMatchObject({ desafixadaId: primeira.id });
    sim.avancarRelogio(1000);
    expect(chamar('PATCH', `/publicacoes/${primeira.id}`, { titulo: 'Editado' }).corpo).toMatchObject({ publicacao: { editadaEm: '2026-11-11T15:00:01.000Z', fixada: false } });
  });
  it('lista mais nova primeiro com filtros status/tag; excluida some e repetir da 404', () => {
    const p = registro(registro(publicar().corpo).publicacao);
    sim.avancarRelogio(1000);
    const nova = registro(registro(publicar({ status: 'rascunho', tag: 'novidade' }).corpo).publicacao);
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/publicacoes`).corpo).data)[0].id).toBe(nova.id);
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/publicacoes?status=publicada&tag=aviso`).corpo).data)).toHaveLength(1);
    expect(chamar('DELETE', `/publicacoes/${p.id}`).status).toBe(204);
    erro(chamar('DELETE', `/publicacoes/${p.id}`), 404, 'nao_encontrado');
  });
  it('upload HTTPS PUT expira em 2 h; mime e bytes invalidos da 400', () => {
    expect(chamar('POST', '/uploads', { nome: 'a.pdf', mime: 'application/pdf', bytes: 10 }).corpo).toMatchObject({ uploadUrl: expect.stringMatching(/^https:\/\//), metodo: 'PUT', campos: {}, expiraEm: '2026-11-11T17:00:00.000Z' });
    for (const corpo of [{ mime: 'text/plain', bytes: 10 }, { mime: 'image/png', bytes: 0 }, { mime: 'image/png', bytes: 10485761 }]) erro(chamar('POST', '/uploads', { nome: 'a', ...corpo }), 400, 'validacao');
  });
  it('anexo desconhecido e expirado nao publicam; publicado nao expira', () => {
    erro(publicar({ anexoId: sim.semente.mentorId }), 422, 'anexo_invalido');
    const upload = () => String(registro(chamar('POST', '/uploads', { nome: 'a.pdf', mime: 'application/pdf', bytes: 10 }).corpo).arquivoId);
    const usado = upload(); const semUso = upload();
    expect(publicar({ anexoId: usado }).status).toBe(201);
    sim.avancarRelogio(49 * 3600000);
    erro(publicar({ anexoId: semUso }), 422, 'anexo_expirado');
    expect(publicar({ anexoId: usado }).status).toBe(201);
  });
});

describe('sessoes e horarios', () => {
  it('divide janela em blocos disponiveis e descarta sobra, sem Meet nem aluno', () => {
    const r = lista(registro(horarios().corpo).data);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ tipo: 'disponivel', status: 'agendada', alunoId: null, meet: { estado: 'sem_sala' }, gravacao: { estado: 'nao_se_aplica' } });
  });
  it('janela no passado/fim invalido da 400; horizonte de 30 dias da 422', () => {
    erro(horarios('2026-11-10T15:00:00Z'), 400, 'validacao');
    erro(horarios('2026-11-12T15:00:00Z', '2026-11-12T14:00:00Z'), 400, 'validacao');
    erro(horarios('2026-12-12T15:00:00Z', '2026-12-12T17:00:00Z'), 422, 'fora_do_horizonte');
    expect(sessoes()).toHaveLength(0);
  });
  it('sobreposicao e por mentor em qualquer tribo e janela e atomica', () => {
    sessao({ inicio: '2026-11-12T16:00:00Z' });
    erro(horarios('2026-11-12T15:00:00Z', '2026-11-12T17:00:00Z', sim.semente.triboB2bId), 409, 'conflito_horario');
    expect(lista(registro(chamar('GET', `/tribos/${sim.semente.triboB2bId}/sessoes`).corpo).data)).toEqual([]);
    erro(sessao({ inicio: '2026-11-12T16:30:00Z' }), 409, 'conflito_horario');
  });
  it('criarSessao recusa passado, individual sem aluno/fora da tribo e coletiva sem tema', () => {
    erro(sessao({ inicio: '2026-11-10T15:00:00Z' }), 400, 'validacao');
    erro(sessao({ tipo: 'individual' }), 400, 'validacao');
    erro(sessao({ tipo: 'individual', alunoId: sim.semente.mentorId }), 422, 'aluno_fora_da_tribo');
    erro(sessao({ tema: null }), 400, 'validacao');
    expect(sessao({ tipo: 'individual', alunoId: alunos[0] }).corpo).toMatchObject({ meet: { estado: 'pendente' }, alunoId: alunos[0] });
  });
  it('reserva simultanea por dois alunos: um 200 e um 409 horario_ocupado', async () => {
    const livre = String(lista(registro(horarios().corpo).data)[0].id);
    const resultados = await Promise.all(alunos.slice(0, 2).map(async (a) => { sim.comoAluno(a); return reservar(livre); }));
    expect(resultados.map((r) => r.status)).toEqual([200, 409]);
    expect(resultados[0].corpo).toMatchObject({ tipo: 'individual', alunoId: alunos[0], alunoNome: expect.any(String), meet: { estado: 'pendente' } });
    erro(resultados[1], 409, 'horario_ocupado');
  });
  it('aluno so pode ter uma reserva futura; prazo minimo de 2 h', () => {
    const livres = lista(registro(horarios().corpo).data);
    sim.comoAluno(alunos[0]); reservar(String(livres[0].id));
    erro(reservar(String(livres[1].id)), 422, 'limite_reservas');
    sim.comoAluno(alunos[1]); sim.avancarRelogio(24 * 3600000);
    erro(reservar(String(livres[1].id)), 422, 'fora_do_prazo');
  });
  it('cancelar propria reserva volta a disponivel e zera Meet; depois do prazo da 422', () => {
    const livres = lista(registro(horarios().corpo).data); const s = String(livres[0].id);
    sim.comoAluno(alunos[0]); reservar(s); sim.concluirSalaMeet(s, 'pronto');
    expect(chamar('DELETE', `/sessoes/${s}/reserva`).status).toBe(204);
    expect(sessoes()[0]).toMatchObject({ tipo: 'disponivel', alunoId: null, meet: { estado: 'sem_sala', url: null, salaId: null } });
    reservar(s); sim.avancarRelogio(23 * 3600000);
    erro(chamar('DELETE', `/sessoes/${s}/reserva`), 422, 'fora_do_prazo');
  });
  it('excluir so horario disponivel; reservado da 409 com nome e direta da 422 use_cancelar', () => {
    const livres = lista(registro(horarios().corpo).data);
    expect(chamar('DELETE', `/sessoes/${livres[0].id}`).status).toBe(204);
    sim.comoAluno(alunos[0]); const reserva = reservar(String(livres[1].id));
    const r = chamar('DELETE', `/sessoes/${livres[1].id}`);
    erro(r, 409, 'horario_reservado'); expect(String(registro(registro(r.corpo).error).message)).toContain(String(registro(reserva.corpo).alunoNome));
    const direta = sessao({ inicio: '2026-11-13T15:00:00Z' }); erro(chamar('DELETE', `/sessoes/${id(direta)}`), 422, 'use_cancelar');
  });
  it.each(['oficina', 'individual'])('cancelar %s cria aviso automatico com destino correto; repeticao da 422', (tipo) => {
    const s = sessao({ tipo, alunoId: tipo === 'individual' ? alunos[0] : null });
    const r = chamar('POST', `/sessoes/${id(s)}/cancelar`, { motivo: 'Imprevisto' });
    expect(r.corpo).toMatchObject({ sessao: { status: 'cancelada', canceladaMotivo: 'Imprevisto' }, avisoPublicacaoId: expect.any(String) });
    const p = lista(registro(chamar('GET', `/tribos/${tribo}/publicacoes`).corpo).data)[0];
    expect(p).toMatchObject({ origem: 'aviso_sessao', tag: 'aviso', destino: tipo === 'individual' ? { tipo: 'alunos', alunoIds: [alunos[0]] } : { tipo: 'tribo' } });
    erro(chamar('POST', `/sessoes/${id(s)}/cancelar`, {}), 422, 'sessao_nao_editavel');
  });
  it('cancelar disponivel da 422 sessao_nao_editavel', () => { const s = lista(registro(horarios().corpo).data)[0]; erro(chamar('POST', `/sessoes/${s.id}/cancelar`, {}), 422, 'sessao_nao_editavel'); });
  it('reservada nao permite inicio/duracao; coletiva mudando inicio gera aviso e demais edicoes nao', () => {
    const livre = String(lista(registro(horarios().corpo).data)[0].id); sim.comoAluno(alunos[0]); reservar(livre);
    for (const corpo of [{ inicio: '2026-11-13T15:00:00Z' }, { duracaoMin: 30 }]) erro(chamar('PATCH', `/sessoes/${livre}`, corpo), 422, 'sessao_nao_editavel');
    const s = sessao({ inicio: '2026-11-13T15:00:00Z' });
    expect(chamar('PATCH', `/sessoes/${id(s)}`, { tema: 'Novo' }).corpo).toMatchObject({ avisoPublicacaoId: null });
    expect(chamar('PATCH', `/sessoes/${id(s)}`, { inicio: '2026-11-14T15:00:00Z' }).corpo).toMatchObject({ avisoPublicacaoId: expect.any(String) });
  });
  it('editar data coletiva a menos de 10 min do inicio e recusado', () => {
    const s = sessao({ inicio: '2026-11-11T15:09:00Z' });
    erro(chamar('PATCH', `/sessoes/${id(s)}`, { inicio: '2026-11-13T15:00:00Z' }), 422, 'sessao_nao_editavel');
  });
  it('Meet pronto preenche sala e URL; falhou permite colar manual, pendente nao', () => {
    const s = id(sessao());
    erro(chamar('PATCH', `/sessoes/${s}`, { meetUrl: 'https://meet.google.com/manual' }), 422, 'sessao_nao_editavel');
    sim.concluirSalaMeet(s, 'pronto'); expect(sessoes()[0].meet).toMatchObject({ estado: 'pronto', salaId: expect.stringMatching(/^spaces\//), url: expect.stringMatching(/^https:\/\/meet.google.com\//) });
    sim.concluirSalaMeet(s, 'falhou'); expect(sessoes()[0].meet).toEqual({ estado: 'falhou', salaId: null, url: null });
    expect(chamar('PATCH', `/sessoes/${s}`, { meetUrl: 'https://meet.google.com/manual' }).corpo).toMatchObject({ sessao: { meet: { estado: 'pronto', url: 'https://meet.google.com/manual' } } });
  });
  it('gravacao so coletiva realizada; leitura deriva aguardando/pendente, manual e automatica', () => {
    const s = id(sessao());
    erro(chamar('POST', `/sessoes/${s}/gravacao`, { url: 'https://drive.google.com/a' }), 422, 'gravacao_nao_permitida');
    sim.marcarRealizada(s); expect(sessoes()[0].gravacao).toMatchObject({ estado: 'aguardando' });
    sim.avancarRelogio(3 * 86400000); expect(sessoes()[0].gravacao).toMatchObject({ estado: 'pendente' });
    expect(chamar('POST', `/sessoes/${s}/gravacao`, { url: 'https://drive.google.com/a' }).corpo).toMatchObject({ gravacao: { estado: 'manual' } });
    sim.ligarGravacaoAutomatica(s, 'https://drive.google.com/b'); expect(sessoes()[0].gravacao).toMatchObject({ estado: 'pronta' });
  });
  it('mover aluno cancela reservas futuras sem remover horarios', () => {
    const s = String(lista(registro(horarios().corpo).data)[0].id); sim.comoAluno(alunos[0]); reservar(s);
    sim.moverAlunoParaOutraTribo(alunos[0]); expect(sessoes()[0]).toMatchObject({ tipo: 'disponivel', alunoId: null });
  });
  it('listarSessoes filtra de/ate/status/tipo e ordena inicio crescente', () => {
    const segunda = id(sessao({ inicio: '2026-11-14T15:00:00Z' })); sim.marcarRealizada(segunda);
    sessao();
    expect(sessoes().map((s) => s.id)).toEqual([expect.any(String), segunda]);
    expect(sessoes('?de=2026-11-13T00:00:00Z&ate=2026-11-15T00:00:00Z&status=realizada&tipo=oficina').map((s) => s.id)).toEqual([segunda]);
  });
});

describe('limites e isolamento do simulador', () => {
  it('invocar gera chaves distintas mesmo na decima chamada e respeita idempotencyKey explicita', async () => {
    const body = { metodo: 'POST', caminho: '/uploads', corpo: { nome: 'a.pdf', mime: 'application/pdf', bytes: 1 } };
    for (let i = 0; i < 12; i++) await sim.invocar('flix-mentoria-proxy', { body });
    expect(new Set(sim.pedidos.map((p) => p.chaveIdempotencia)).size).toBe(12);
    const explicito = { ...body, idempotencyKey: 'chave-explicita-000001' };
    expect(await sim.invocar('flix-mentoria-proxy', { body: explicito })).toEqual(await sim.invocar('flix-mentoria-proxy', { body: explicito }));
  });
  it('relogio injetado e avancado, requestId repassado e resposta nao vaza estado mutavel', () => {
    sim = criarSimuladorFlix({ agora: () => new Date('2026-11-12T10:00:00Z') });
    const r = sim.responder({ metodo: 'POST', caminho: '/uploads', corpo: { nome: 'a.pdf', mime: 'application/pdf', bytes: 1 }, chaveIdempotencia: 'chave-de-upload-001', requestId: 'correlacao' });
    expect(r).toMatchObject({ requestId: 'correlacao', corpo: { expiraEm: '2026-11-12T12:00:00.000Z' } });
    const me = registro(chamar('GET', '/me').corpo); registro(me.mentor).nome = 'Alterado fora';
    expect(registro(chamar('GET', '/me').corpo).mentor).not.toMatchObject({ nome: 'Alterado fora' });
  });
  it('idempotencia expira depois de 24h e repetir exclusao com mesma chave retorna resposta original', () => {
    const livre = String(lista(registro(horarios().corpo).data)[0].id);
    const caminho = `/sessoes/${livre}`;
    const primeira = chamar('DELETE', caminho, undefined, 'chave-exclusao-0001');
    expect(chamar('DELETE', caminho, undefined, 'chave-exclusao-0001')).toEqual(primeira);
    sim.avancarRelogio(24 * 3600000);
    erro(chamar('DELETE', caminho, undefined, 'chave-exclusao-0001'), 404, 'nao_encontrado');
  });
  it('reserva e cancelamento no limite exato de 2h sao aceitos; outro aluno nao cancela', () => {
    const livre = String(lista(registro(horarios('2026-11-11T17:00:00Z', '2026-11-11T18:00:00Z').corpo).data)[0].id);
    sim.comoAluno(alunos[0]); expect(reservar(livre).status).toBe(200);
    sim.comoAluno(alunos[1]); erro(chamar('DELETE', `/sessoes/${livre}/reserva`), 404, 'nao_encontrado');
    sim.comoAluno(alunos[0]); expect(chamar('DELETE', `/sessoes/${livre}/reserva`).status).toBe(204);
  });
  it('horarios adjacentes nao conflitam, cancelada nao bloqueia e outro mentor e independente', () => {
    const s = id(sessao());
    expect(sessao({ inicio: '2026-11-12T16:00:00Z' }).status).toBe(201);
    chamar('POST', `/sessoes/${s}/cancelar`, {});
    expect(sessao().status).toBe(201);
    sim.comoMentor(sim.semente.outroMentorId);
    expect(chamar('POST', `/tribos/${sim.semente.triboDeOutroMentorId}/sessoes`, { tipo: 'oficina', inicio: '2026-11-12T15:00:00Z', tema: 'Independente' }).status).toBe(201);
  });
  it('individual realizada nao admite gravacao e segue fora do acervo', () => {
    const s = id(sessao({ tipo: 'individual', alunoId: alunos[0] })); sim.marcarRealizada(s);
    erro(chamar('POST', `/sessoes/${s}/gravacao`, { url: 'https://drive.google.com/a' }), 422, 'gravacao_nao_permitida');
    expect(sessoes()[0].gravacao).toMatchObject({ estado: 'nao_se_aplica' });
  });
  it('editar coletiva verifica sobreposicao sem mutacao nem aviso em falha', () => {
    sessao(); const s = id(sessao({ inicio: '2026-11-13T15:00:00Z' }));
    erro(chamar('PATCH', `/sessoes/${s}`, { inicio: '2026-11-12T15:30:00Z' }), 409, 'conflito_horario');
    expect(sessoes()[1].inicio).toBe('2026-11-13T15:00:00.000Z');
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/publicacoes`).corpo).data)).toEqual([]);
  });
  it('publicar rascunho com anexo envelhecido da 422 sem alterar rascunho', () => {
    const arquivoId = registro(chamar('POST', '/uploads', { nome: 'a.pdf', mime: 'application/pdf', bytes: 1 }).corpo).arquivoId;
    const p = registro(registro(publicar({ status: 'rascunho', anexoId: arquivoId }).corpo).publicacao);
    sim.avancarRelogio(49 * 3600000);
    erro(chamar('PATCH', `/publicacoes/${p.id}`, { status: 'publicada' }), 422, 'anexo_expirado');
    expect(lista(registro(chamar('GET', `/tribos/${tribo}/publicacoes?status=rascunho`).corpo).data)).toHaveLength(1);
  });
});
