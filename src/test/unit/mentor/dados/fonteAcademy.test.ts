/**
 * fonteAcademy: cada RPC → tipo de domínio, com payloads no formato exato das migrations
 * (20261104120000_mentor_portal_v2.sql, 20261104130000_mentor_b2c_v2.sql e anteriores).
 */
import { describe, expect, it, vi } from 'vitest';
import { ErroFonte } from '@/features/mentor/api/fonte';
import {
  criarDadosAcademy,
  criarFonteAcademy,
  erroDoPostgres,
  eventoParaSql,
  mapearIntervencao,
  type ChamadorRpc,
} from '@/features/mentor/api/fonteAcademy';
import type { Publicacao, Sessao } from '@/features/mentor/api/types';

const MENTOR_ID = '11111111-1111-1111-1111-111111111111';

const CONTEXTO_B2C = {
  mentor: {
    user_id: MENTOR_ID, nome: 'Thiago Taniguchi', email: 'thiago@sanar.com', tipo: 'b2c', turma_nome: 'Carcará',
    ies_id: null, ies_nome: null, ativo: true, portal_mentor: true, modalidade: 'b2c', tribo_slug: 'carcara',
  },
  alunos_ativos: 87,
};
const CONTEXTO_B2B = {
  mentor: {
    user_id: MENTOR_ID, nome: 'Beatriz Câmara', email: 'bia@sanar.com', tipo: 'b2b', turma_nome: 'UniAtenas Paracatu',
    ies_id: 'ies-1', ies_nome: 'UniAtenas', ativo: true, portal_mentor: false, modalidade: 'b2b', tribo_slug: 'uniatenas-paracatu',
  },
  alunos_ativos: 186,
};

const LINHA_TURMA = {
  email: 'beatriz.sampaio@exemplo.com', nome: 'Beatriz Sampaio', telefone: '71996412280', semestre: '9',
  acesso_ate: '2026-12-31', b2b: false, academy_user_id: 'u-1', sanarflix_user_id: null,
  ultima_atividade: '2026-11-03T12:00:00+00:00', dias_sem_atividade: 1, segmento: 'ativo',
  meta: { especialidade: 'Dermatologia', instituicao: 'USP-SP', cortePct: 84 },
  conteudos_7d: { videos: null, documentos: null, total: null },
  conteudos_30d: { videos: null, documentos: null, total: null },
  tem_dado_consumo: false,
  questoes_7d: { respondidas: 10, acertos: 7, erros: 3, pct_acerto: 70.0 },
  questoes_30d: { respondidas: 40, acertos: 0, erros: 40, pct_acerto: 0 },
  tem_dado_questoes: true,
};

/** rpc falso: devolve o payload por nome de função e registra as chamadas. */
function rpcFalso(respostas: Record<string, unknown | ((args: Record<string, unknown> | undefined) => unknown)>) {
  const chamadas: { fn: string; args?: Record<string, unknown> }[] = [];
  const rpc: ChamadorRpc = async (fn, args) => {
    chamadas.push({ fn, args });
    if (!(fn in respostas)) throw new Error(`rpc inesperada: ${fn}`);
    const r = respostas[fn];
    return typeof r === 'function' ? (r as (a?: Record<string, unknown>) => unknown)(args) : r;
  };
  return { rpc, chamadas };
}

const semCadastro = async () => null;

describe('fonteAcademy · me ← get_mentor_contexto', () => {
  it('B2C: portalMentor, tribo com slug, modalidade e identidade da tribo pelo tema', async () => {
    const { rpc } = rpcFalso({ get_mentor_contexto: CONTEXTO_B2C });
    const lerCadastro = vi.fn(async () => ({ link_agendamento: 'https://calendar.app.google/abc', foto_url: 'https://cdn/x.png' }));
    const me = await criarFonteAcademy({ rpc, lerCadastro }).me();
    expect(me.portalMentor).toBe(true);
    expect(me.mentor).toEqual({ id: MENTOR_ID, nome: 'Thiago Taniguchi', fotoUrl: 'https://cdn/x.png', agendaUrl: 'https://calendar.app.google/abc', modalidade: 'b2c', bio: null, mote: null, googleEmail: null, ativo: true });
    expect(me.tribos).toHaveLength(1);
    expect(me.tribos[0]).toMatchObject({ id: MENTOR_ID, nome: 'Carcará', slug: 'carcara', modalidade: 'b2c', papel: 'titular', lema: 'Nota 90+', totalAlunos: 87, mentoriaAtiva: false });
    expect(me.tribos[0].cores).toEqual({ sig: '#D9771F', shadow: '#3A1405', glow: '#FFB547' });
    // Fallback só porque o contexto não traz link_agendamento.
    expect(lerCadastro).toHaveBeenCalledWith(MENTOR_ID);
  });

  it('usa link_agendamento do contexto quando a RPC passar a devolvê-lo (sem ler o cadastro)', async () => {
    const ctx = { ...CONTEXTO_B2C, mentor: { ...CONTEXTO_B2C.mentor, link_agendamento: 'https://a.b/c', foto_url: null } };
    const lerCadastro = vi.fn(semCadastro);
    const me = await criarFonteAcademy({ rpc: rpcFalso({ get_mentor_contexto: ctx }).rpc, lerCadastro }).me();
    expect(me.mentor.agendaUrl).toBe('https://a.b/c');
    expect(me.mentor.fotoUrl).toBeNull();
    expect(lerCadastro).not.toHaveBeenCalled();
  });

  it('B2B: sem identidade de tribo, com IES; toggle desligado', async () => {
    const me = await criarFonteAcademy({ rpc: rpcFalso({ get_mentor_contexto: CONTEXTO_B2B }).rpc, lerCadastro: semCadastro }).me();
    expect(me.portalMentor).toBe(false);
    expect(me.mentor.modalidade).toBe('b2b');
    expect(me.mentor.agendaUrl).toBeNull();
    expect(me.tribos[0]).toMatchObject({ slug: 'uniatenas-paracatu', iesId: 'ies-1', iesNome: 'UniAtenas', lema: null, cores: null });
  });

  it('mentor null (cadastro incompleto) vira ErroFonte mentor_sem_cadastro', async () => {
    const f = criarFonteAcademy({ rpc: rpcFalso({ get_mentor_contexto: { mentor: null, alunos_ativos: 0 } }).rpc, lerCadastro: semCadastro });
    await expect(f.me()).rejects.toMatchObject({ code: 'mentor_sem_cadastro' });
  });
});

describe('fonteAcademy · alunos ← mentor_turma', () => {
  it('alunoId = e-mail; whatsapp = telefone; semestre só no B2B; meta e última atividade', async () => {
    const { rpc } = rpcFalso({ get_mentor_contexto: CONTEXTO_B2C, mentor_turma: [LINHA_TURMA] });
    const [a] = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).alunos(MENTOR_ID);
    expect(a).toMatchObject({
      alunoId: 'beatriz.sampaio@exemplo.com', email: 'beatriz.sampaio@exemplo.com', nome: 'Beatriz Sampaio',
      whatsapp: '71996412280', semestre: null, acessoAte: '2026-12-31', triboId: MENTOR_ID,
      ultimaAtividadeEm: '2026-11-03T12:00:00+00:00', meta: { especialidade: 'Dermatologia', instituicao: 'USP-SP', cortePct: 84 },
    });
  });

  it('B2B devolve o semestre numérico', async () => {
    const { rpc } = rpcFalso({ get_mentor_contexto: CONTEXTO_B2B, mentor_turma: [{ ...LINHA_TURMA, semestre: '12º', meta: null }] });
    const [a] = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).alunos(MENTOR_ID);
    expect(a.semestre).toBe(12);
    expect(a.meta).toBeNull();
  });

  it('busca por nome sem acento e aluno() fora da turma vira aluno_fora_da_tribo', async () => {
    const outro = { ...LINHA_TURMA, email: 'joao@x.com', nome: 'João Siqueira' };
    const { rpc } = rpcFalso({ get_mentor_contexto: CONTEXTO_B2C, mentor_turma: [LINHA_TURMA, outro] });
    const f = criarFonteAcademy({ rpc, lerCadastro: semCadastro });
    expect((await f.alunos(MENTOR_ID, 'joao')).map((x) => x.email)).toEqual(['joao@x.com']);
    await expect(f.aluno(MENTOR_ID, 'ninguem@x.com')).rejects.toMatchObject({ code: 'aluno_fora_da_tribo' });
  });

  it('turma (DAG): null continua null; contagens zero do servidor continuam zero', async () => {
    const { rpc } = rpcFalso({ mentor_turma: [LINHA_TURMA] });
    const { data, meta } = await criarDadosAcademy(rpc, async () => 'b2c').turma();
    expect(meta).toBeNull();
    expect(data[0].conteudos30d).toEqual({ videos: null, documentos: null, total: null });
    expect(data[0].questoes30d).toEqual({ respondidas: 40, acertos: 0, erros: 40, pctAcerto: 0 });
    expect(data[0].segmento).toBe('ativo');
  });
});

const POST = {
  id: 'p1', tag: 'Fique por dentro', titulo: 'Imunização', mensagem: 'O calendário que mais cai',
  link_titulo: 'Material', link_url: 'https://sanar.com/x', anexo_nome: 'ficha.pdf', anexo_path: `${MENTOR_ID}/1-ficha.pdf`,
  publico: 'selecionados', status: 'publicado', publicado_em: '2026-09-22T12:00:00Z', origem: 'mentor',
  editada_em: '2026-09-23T10:00:00Z', fixada: false, destinatarios: ['a@x.com', 'b@x.com'],
};

describe('fonteAcademy · mural', () => {
  it('mentor_mural_listar → Publicacao (tag do contrato, destino, editadaEm)', async () => {
    const agenda = { ...POST, id: 'p2', tag: 'Agenda', publico: 'turma', destinatarios: [], status: 'rascunho', publicado_em: null, editada_em: null, link_url: null };
    const { rpc } = rpcFalso({ mentor_mural_listar: [POST, agenda] });
    const { data, nextCursor } = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).publicacoes(MENTOR_ID);
    expect(nextCursor).toBeNull();
    expect(data[0]).toMatchObject({
      id: 'p1', tag: 'fique_por_dentro', titulo: 'Imunização', link: { url: 'https://sanar.com/x', titulo: 'Material' },
      anexoUrl: `${MENTOR_ID}/1-ficha.pdf`, anexoNome: 'ficha.pdf', destino: { tipo: 'selecionados', alunoIds: ['a@x.com', 'b@x.com'] },
      status: 'publicada', publicadaEm: '2026-09-22T12:00:00Z', editadaEm: '2026-09-23T10:00:00Z', tagOriginal: null,
    });
    expect(data[1]).toMatchObject({ tag: 'aviso', tagOriginal: 'Agenda', destino: { tipo: 'turma' }, status: 'rascunho', link: null, editadaEm: null });
  });

  it('filtro de tag envia o texto do Academy; filtro de status é aplicado na lista', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_mural_listar: [POST] });
    const r = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).publicacoes(MENTOR_ID, { tag: 'fique_por_dentro', status: 'rascunho' });
    expect(chamadas[0].args).toEqual({ p_aluno_email: null, p_tag: 'Fique por dentro' });
    expect(r.data).toEqual([]);
  });

  it('criarPublicacao → mentor_mural_salvar com destino alunos → selecionados e relê o post', async () => {
    const { rpc, chamadas } = rpcFalso({
      mentor_mural_salvar: { post_id: 'p1', publicado: true, intervencao_id: 'i1' },
      mentor_mural_listar: [POST],
    });
    const p = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).criarPublicacao(MENTOR_ID, {
      tag: 'desempenho', titulo: 'Sua nota caiu', mensagem: 'Vamos entender', link: null, status: 'publicada',
      destino: { tipo: 'alunos', alunoIds: ['a@x.com'] }, registrarIntervencao: true,
    });
    expect(chamadas[0]).toEqual({ fn: 'mentor_mural_salvar', args: {
      p_id: null, p_tag: 'Desempenho', p_titulo: 'Sua nota caiu', p_mensagem: 'Vamos entender', p_link_titulo: null, p_link_url: null,
      p_anexo_path: null, p_anexo_nome: null, p_publico: 'selecionados', p_destinatarios: ['a@x.com'], p_publicar: true, p_registrar_intervencao: true,
    } });
    expect(p.id).toBe('p1');
  });

  it('editarPublicacao preserva o que não mudou (destino e anexo) e excluir chama mentor_mural_excluir', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_mural_listar: [POST], mentor_mural_salvar: { post_id: 'p1' }, mentor_mural_excluir: { id: 'p1' } });
    const f = criarFonteAcademy({ rpc, lerCadastro: semCadastro });
    await f.editarPublicacao('p1', { titulo: 'Novo título' });
    const salvar = chamadas.find((c) => c.fn === 'mentor_mural_salvar')!.args!;
    expect(salvar).toMatchObject({ p_id: 'p1', p_titulo: 'Novo título', p_tag: 'Fique por dentro', p_publico: 'selecionados', p_destinatarios: ['a@x.com', 'b@x.com'], p_anexo_path: `${MENTOR_ID}/1-ficha.pdf`, p_publicar: true });
    await f.excluirPublicacao('p1');
    expect(chamadas.at(-1)).toEqual({ fn: 'mentor_mural_excluir', args: { p_id: 'p1' } });
  });
});

const SESSAO = {
  id: 's1', tipo: 'oficina', titulo: 'Oficina', tema: 'Vigilância em saúde', inicio: '2026-10-22T23:00:00+00:00',
  duracao_min: 60, meet_link: null, gravacao_url: null, aluno_email: null, status: 'agendada', realizada_em: null,
  origem: 'academy', descricao: null,
  pauta: [
    { texto: 'Hepatites virais · 42% de acerto', origem: 'tema_critico', referenciaId: 't2', ordem: 1 },
    { texto: 'Vigilância em saúde · 38% de acerto', origem: 'tema_critico', referenciaId: 't1', ordem: 0 },
  ],
};

describe('fonteAcademy · sessões', () => {
  it('mentor_sessoes_listar → Sessao (data/hora em São Paulo, pauta ordenada, coletiva legada vira encontro_tribo)', async () => {
    const legado = { ...SESSAO, id: 's2', tipo: 'coletiva', pauta: [], status: 'realizada', gravacao_url: 'https://drive/x' };
    const { rpc, chamadas } = rpcFalso({ mentor_sessoes_listar: [SESSAO, legado] });
    const { data } = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).sessoes(MENTOR_ID);
    expect(chamadas[0].args).toEqual({ p_quando: 'todas' });
    expect(data[0]).toMatchObject({
      id: 's1', tipo: 'oficina', data: '2026-10-22', hora: '20:00', tema: 'Vigilância em saúde', link: null, status: 'agendada',
      gravacaoUrl: null, inicio: '2026-10-22T23:00:00+00:00', duracaoMin: 60,
    });
    expect(data[0].pauta.map((p) => p.referenciaId)).toEqual(['t1', 't2']);
    expect(data[1]).toMatchObject({ tipo: 'encontro_tribo', status: 'realizada', gravacaoUrl: 'https://drive/x' });
  });

  it('criarSessao exige título no Academy: usa o tema ou o rótulo do tipo; individual leva o e-mail', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_sessao_salvar: { sessao_id: 's1' }, mentor_sessoes_listar: [SESSAO] });
    const s = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).criarSessao(MENTOR_ID, {
      tipo: 'individual', inicio: '2026-10-20T22:00:00Z', alunoId: 'bruno@x.com',
    });
    expect(chamadas[0].args).toMatchObject({ p_id: null, p_tipo: 'individual', p_titulo: 'Reunião individual', p_aluno_email: 'bruno@x.com', p_pauta: null });
    expect(s.warnings).toEqual([]);
  });

  it('editarSessao com status realizada chama mentor_sessao_marcar_feita; vincularGravacao manda a URL', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_sessoes_listar: [SESSAO], mentor_sessao_marcar_feita: { sessao_id: 's1' }, mentor_sessao_excluir: { id: 's1' } });
    const f = criarFonteAcademy({ rpc, lerCadastro: semCadastro });
    await f.editarSessao('s1', { status: 'realizada' });
    expect(chamadas.find((c) => c.fn === 'mentor_sessao_marcar_feita')!.args).toEqual({ p_id: 's1', p_gravacao_url: null });
    expect(chamadas.some((c) => c.fn === 'mentor_sessao_salvar')).toBe(false);
    await f.vincularGravacao('s1', { url: 'https://drive/g' });
    expect(chamadas.filter((c) => c.fn === 'mentor_sessao_marcar_feita').at(-1)!.args).toEqual({ p_id: 's1', p_gravacao_url: 'https://drive/g' });
    await f.excluirSessao('s1');
    expect(chamadas.at(-1)).toEqual({ fn: 'mentor_sessao_excluir', args: { p_id: 's1' } });
  });

  it('editarSessao com link preserva o resto (pauta null = manter)', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_sessoes_listar: [SESSAO], mentor_sessao_salvar: { sessao_id: 's1' } });
    await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).editarSessao('s1', { meetUrl: 'https://meet.google.com/x' });
    expect(chamadas.find((c) => c.fn === 'mentor_sessao_salvar')!.args).toMatchObject({
      p_id: 's1', p_tipo: 'oficina', p_titulo: 'Oficina', p_tema: 'Vigilância em saúde', p_meet_link: 'https://meet.google.com/x', p_pauta: null, p_descricao: null,
    });
  });
});

describe('fonteAcademy · convites, canais e perfil', () => {
  const CONVITE = { id: 'l1', alunoEmail: 'dp@x.com', alunoNome: 'Diego Pacheco', mensagem: 'Liberei minha agenda', desde: '2026-09-18T12:00:00Z' };

  it('mentor_convites_listar → ConviteFlix', async () => {
    const { rpc } = rpcFalso({ mentor_convites_listar: [CONVITE] });
    expect(await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).convites(MENTOR_ID)).toEqual([{
      id: 'l1', alunoId: 'dp@x.com', alunoNome: 'Diego Pacheco', publicacaoId: null, mensagem: 'Liberei minha agenda', ativo: true, liberadoEm: '2026-09-18T12:00:00Z',
    }]);
  });

  it('liberarAgenda → mentor_agenda_liberar(e-mail); desligarAgenda resolve o e-mail pelo convite', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_agenda_liberar: { liberados: 1 }, mentor_convites_listar: [CONVITE], mentor_agenda_desligar: { desligados: 1 } });
    const f = criarFonteAcademy({ rpc, lerCadastro: semCadastro });
    const c = await f.liberarAgenda(MENTOR_ID, 'dp@x.com', { titulo: 'Agenda', mensagem: 'Liberei minha agenda' });
    expect(chamadas[0].args).toEqual({ p_emails: ['dp@x.com'], p_mensagem: 'Liberei minha agenda' });
    expect(c.id).toBe('l1');
    await f.desligarAgenda('l1');
    expect(chamadas.at(-1)).toEqual({ fn: 'mentor_agenda_desligar', args: { p_emails: ['dp@x.com'] } });
  });

  it('mentor_canais_listar → CanalTurma (grupo_tribo → grupo_turma; URL ausente fica "" com configurado=false)', async () => {
    const { rpc } = rpcFalso({
      mentor_canais_listar: [
        { tipo: 'avisos', nome: 'Grupo de avisos', url: null, editavel: false },
        { tipo: 'plantao', nome: 'Plantao de duvidas', url: 'https://chat.whatsapp.com/p', editavel: false },
        { tipo: 'grupo_tribo', nome: 'Grupo da tribo', url: null, editavel: true },
      ],
      mentor_canal_grupo_salvar: { tipo: 'grupo_tribo', nome: 'Grupo da tribo', url: 'https://chat.whatsapp.com/K', editavel: true },
    });
    const f = criarFonteAcademy({ rpc, lerCadastro: semCadastro });
    const canais = await f.canais(MENTOR_ID);
    expect(canais.map((c) => [c.tipo, c.url, c.configurado, c.editavel])).toEqual([
      ['avisos', '', false, false], ['plantao', 'https://chat.whatsapp.com/p', true, false], ['grupo_turma', '', false, true],
    ]);
    expect(await f.salvarGrupoTribo(MENTOR_ID, 'https://chat.whatsapp.com/K')).toMatchObject({ tipo: 'grupo_turma', url: 'https://chat.whatsapp.com/K', configurado: true });
  });

  it('atualizarPerfil(agendaUrl) → mentor_definir_link_agendamento', async () => {
    const { rpc, chamadas } = rpcFalso({ get_mentor_contexto: CONTEXTO_B2C, mentor_definir_link_agendamento: { link_agendamento: 'https://cal/x' } });
    const m = await criarFonteAcademy({ rpc, lerCadastro: semCadastro }).atualizarPerfil({ agendaUrl: 'https://cal/x' });
    expect(chamadas[0]).toEqual({ fn: 'mentor_definir_link_agendamento', args: { p_url: 'https://cal/x' } });
    expect(m.agendaUrl).toBe('https://cal/x');
  });

  it('declara eventosNoServidor = true', () => {
    expect(criarFonteAcademy({ rpc: rpcFalso({}).rpc }).eventosNoServidor).toBe(true);
  });
});

describe('fonteAcademy · erros do Postgres', () => {
  it('RAISE (P0001) → validacao com o texto do RAISE, sem prefixo técnico', () => {
    const e = erroDoPostgres({ code: 'P0001', message: 'validacao: somente sessao futura e agendada pode ser excluida' });
    expect(e).toBeInstanceOf(ErroFonte);
    expect(e).toMatchObject({ code: 'validacao', status: 400, message: 'Somente sessao futura e agendada pode ser excluida' });
  });

  it('falha de rede / sem código → rede', () => {
    expect(erroDoPostgres({ message: 'TypeError: Failed to fetch', code: '' })).toMatchObject({ code: 'rede', status: 503 });
  });

  it('o erro da RPC chega à tela como ErroFonte', async () => {
    const rpc: ChamadorRpc = async () => { throw erroDoPostgres({ code: 'P0001', message: 'título obrigatório' }); };
    await expect(criarFonteAcademy({ rpc }).excluirSessao('x')).rejects.toMatchObject({ code: 'validacao', message: 'Título obrigatório' });
  });
});

describe('dadosAcademy · DAG B2C', () => {
  it('mentor_desempenho_turma → DesempenhoTurmaB2c (fez_ultimo null preservado)', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_desempenho_turma: {
      alunos: [{ email: 'a@x.com', nome: 'A', notas: [{ simulado_id: 'sim5', sequence_number: 5, acerto_pct: 77.0, finalizada_em: '2026-09-21T15:00:00Z' }],
        ultimo_acerto: 77.0, corte_mais_dificil: 85, vs_corte_pp: -8.0, situacao: 'longe', regrediu: true, estagnado: false, fez_ultimo: null }],
      possivel_aprovacao_pct: null, acerto_medio_ultimo: 79.0,
      simulados: [{ id: 'sim5', sequence_number: 5, titulo: '5º Simulado PRO', janela_fim: '2026-09-21T23:59:00Z', encerrado: true },
                  { id: 'sim6', sequence_number: 6, titulo: '6º Simulado PRO', janela_fim: '2026-11-09T23:59:00Z', encerrado: false }],
      participacao_ultimo: { simulado_id: 'sim5', fizeram: 62, total: 87 },
    } });
    const { data } = await criarDadosAcademy(rpc).desempenhoTurma(['sim5']);
    expect(chamadas[0].args).toEqual({ p_simulados: ['sim5'] });
    expect(data.alunos[0]).toMatchObject({ email: 'a@x.com', ultimoAcerto: 77, vsCortePp: -8, situacao: 'longe', regrediu: true, fezUltimo: null });
    expect(data.alunos[0].notas[0]).toEqual({ simuladoId: 'sim5', ordem: 5, acertoPct: 77, finalizadaEm: '2026-09-21T15:00:00Z' });
    expect(data.possivelAprovacaoPct).toBeNull();
    expect(data.simulados.map((s) => [s.id, s.ordem, s.status, s.participantes])).toEqual([['sim5', 5, 'realizado', null], ['sim6', 6, 'agendado', null]]);
    expect(data.participacaoUltimo).toEqual({ simuladoId: 'sim5', fizeram: 62, total: 87 });
  });

  it('lista vazia de simulados vira p_simulados null (todos)', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_serie_turma: [{ simulado_id: 'sim1', sequence_number: 1, titulo: '1º', fechado: true, participantes: 80, acerto_medio: 72.0, acima_corte_pct: null }] });
    const { data } = await criarDadosAcademy(rpc).serieTurma([]);
    expect(chamadas[0].args).toEqual({ p_simulados: null });
    expect(data).toEqual([{ simuladoId: 'sim1', ordem: 1, titulo: '1º', fechado: true, participantes: 80, acertoMedio: 72, acimaCortePct: null }]);
  });

  it('mentor_engajamento_turma → semanas com null de fonte ausente', async () => {
    const { rpc } = rpcFalso({ mentor_engajamento_turma: [{ email: 'a@x.com', ultima_atividade: null, dias_sem_atividade: null, segmento: 'sem_dado', semanas: [] },
      { email: 'b@x.com', ultima_atividade: '2026-11-01T00:00:00Z', dias_sem_atividade: 3, segmento: 'ativo', semanas: [{ semana: '2026-10-26', questoes: 12, acertos: null, conteudos: null }] }] });
    const { data } = await criarDadosAcademy(rpc).engajamentoTurma(8);
    expect(data[0]).toEqual({ email: 'a@x.com', ultimaAtividade: null, diasSemAtividade: null, segmento: 'sem_dado', semanas: [] });
    expect(data[1].semanas[0]).toEqual({ semana: '2026-10-26', questoes: 12, acertos: null, conteudos: null });
  });

  it('mentor_temas_turma → TemaTurmaMentor (prevalência não cadastrada = null)', async () => {
    const { rpc } = rpcFalso({ mentor_temas_turma: [{
      grande_area: 'Preventiva', especialidade: 'Vigilância em Saúde', tema: 'Notificação compulsória', prevalencia: null, peso: null,
      respostas: 312, acerto_pct: 44.0, alunos_abaixo_50: ['a@x.com'], critico: true, serie: [{ simulado_id: 'sim4', acerto_pct: 41.0 }, { simulado_id: 'sim5', acerto_pct: 44.0 }],
    }, { grande_area: 'Pediatria', especialidade: null, tema: 'Imunização', prevalencia: 'Média', peso: 2, respostas: 10, acerto_pct: 60, alunos_abaixo_50: [], critico: false, serie: [] }] });
    const { data } = await criarDadosAcademy(rpc).temasTurma(null);
    expect(data[0]).toMatchObject({ tema: 'Notificação compulsória', grandeArea: 'Preventiva', prevalencia: null, peso: null, acertoPct: 44, alunosAbaixo50: ['a@x.com'], critico: true });
    expect(data[0].serie).toEqual([{ simuladoId: 'sim4', acertoPct: 41 }, { simuladoId: 'sim5', acertoPct: 44 }]);
    expect(data[1]).toMatchObject({ prevalencia: 'media', peso: 2, especialidade: null });
    expect(data[0].id).not.toBe(data[1].id);
  });

  it('mentor_detalhamento(p_simulados, p_emails) → DetalhamentoMentor', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_detalhamento: {
      areas: [{ grande_area: 'Preventiva', acerto_pct: 63.0, respostas: 900,
        especialidades: [{ especialidade: 'Vigilância em Saúde', acerto_pct: 42.0, respostas: 312, temas: [{ tema: 'Notificação compulsória', acerto_pct: 28.0, respostas: 96 }] }],
        temas: [{ tema: 'Vigilância em Saúde > Notificação compulsória', acerto_pct: 28.0, respostas: 96 }] }],
      questoes: [{ questao_id: 'q12', numero: 12, sequence_number: 5, grande_area: 'Preventiva', especialidade: 'Vigilância em Saúde', tema: 'Vigilância em Saúde > Notificação', tema_curto: 'Notificação',
        dificuldade: null, enunciado_inicio: 'Paciente com suspeita de sarampo', tem_imagem: false, correta_label: 'D', acerto_pct: 31.0, respostas: 87,
        distribuicao: { A: 8, B: 12, C: 40, D: 27 }, emails: { C: ['a@x.com'] } }],
      bloqueados: [{ simulado_id: 'sim6', sequence_number: 6, libera_em: '2026-11-10T03:00:00Z' }],
    } });
    const { data } = await criarDadosAcademy(rpc).detalhamento(['sim5'], ['a@x.com']);
    expect(chamadas[0].args).toEqual({ p_simulados: ['sim5'], p_emails: ['a@x.com'] });
    expect(data.areas[0].especialidades[0].temas[0]).toEqual({ tema: 'Notificação compulsória', acertoPct: 28, respostas: 96 });
    expect(data.questoes[0]).toMatchObject({ questaoId: 'q12', numero: 12, ordem: 5, corretaLabel: 'D', acertoPct: 31, distribuicao: { A: 8, B: 12, C: 40, D: 27 }, emailsPorAlternativa: { C: ['a@x.com'] } });
    expect(data.bloqueados).toEqual([{ simuladoId: 'sim6', ordem: 6, liberaEm: '2026-11-10T03:00:00Z' }]);
  });

  it('mentor_questao → QuestaoMentor (alternativa correta sem lista de e-mails)', async () => {
    const { rpc } = rpcFalso({ mentor_questao: {
      questao_id: 'q12', simulado_id: 'sim5', sequence_number: 5, numero: 12, grande_area: 'Preventiva', especialidade: 'Vigilância', tema: 'Vigilância > Notificação', tema_curto: 'Notificação',
      dificuldade: 'media', enunciado: 'Paciente…', imagens: [], explicacao: null, explicacao_imagem_url: null, respostas: 87, acerto_pct: 31.0,
      alternativas: [{ label: 'C', texto: 'Notificar após confirmação', correta: false, n: 40, pct: 46.0, emails: ['a@x.com'] }, { label: 'D', texto: 'Imediata', correta: true, n: 27, pct: 31.0, emails: null }],
      branco: { n: 0, emails: [] },
    } });
    const { data } = await criarDadosAcademy(rpc).questao('q12', ['sim5']);
    expect(data.alternativas[1]).toEqual({ label: 'D', texto: 'Imediata', correta: true, n: 27, pct: 31, emails: null });
    expect(data.branco).toEqual({ n: 0, emails: [] });
  });

  it('alunoDetalhe = mentor_aluno + notas + conteúdos + questões (série sem fonte fica null)', async () => {
    const { rpc, chamadas } = rpcFalso({
      mentor_aluno: { aluno: LINHA_TURMA, liberacao: { ligado: true, desde: '2026-09-26T12:00:00Z', mensagem: 'Liberei' },
        intervencoes: [{ id: 'i1', tipo: 'reuniao_individual', titulo: 'Entender por que sumiu', status: 'em_andamento', criado_em: '2026-09-26T12:00:00Z' }],
        log: [{ tipo: 'agenda_liberada', criado_em: '2026-09-26T12:00:00Z', payload: { liberacao_id: 'l1' } }], sinalizado_em: null },
      mentor_aluno_notas: { email: 'beatriz.sampaio@exemplo.com', notas: [{ simulado_id: 'sim5', sequence_number: 5, titulo: '5º', acerto_pct: 87.0, finalizada_em: null, acertos: 87, respondidas: 100, posicao: null, participantes: null, percentil: null, dentro_janela: true }], areas: [] },
      mentor_aluno_conteudos: { email: 'beatriz.sampaio@exemplo.com', tem_dado_consumo: false, por_semana: [{ semana: '2026-10-26', videos: 0, documentos: 0 }], recentes: [], top_cursos: [] },
      mentor_aluno_questoes: { email: 'beatriz.sampaio@exemplo.com', tem_dado_questoes: true, ultima_resposta: '2026-11-03T10:00:00Z', por_semana: [{ semana: '2026-10-26', respondidas: 0, acertos: 0, erros: 0 }], por_area: [] },
    });
    const { data } = await criarDadosAcademy(rpc, async () => 'b2c').alunoDetalhe('beatriz.sampaio@exemplo.com');
    expect(chamadas.map((c) => c.fn).sort()).toEqual(['mentor_aluno', 'mentor_aluno_conteudos', 'mentor_aluno_notas', 'mentor_aluno_questoes']);
    expect(data.aluno?.email).toBe('beatriz.sampaio@exemplo.com');
    expect(data.liberacao).toEqual({ ligado: true, desde: '2026-09-26T12:00:00Z', mensagem: 'Liberei' });
    expect(data.intervencoes[0]).toMatchObject({ tipo: 'individual', status: 'andamento' });
    expect(data.notas[0]).toMatchObject({ acertoPct: 87, posicao: null, dentroJanela: true });
    expect(data.conteudos.porSemana[0]).toEqual({ semana: '2026-10-26', videos: null, documentos: null });
    expect(data.questoes.porSemana[0]).toEqual({ semana: '2026-10-26', respondidas: 0, acertos: 0, erros: 0 });
  });
});

describe('dadosAcademy · kanban, rotina, pérolas', () => {
  const CARD = {
    id: 'i1', tipo: 'reuniao_coletiva', titulo: 'Sessão: Vigilância', nota: null, status: 'a_fazer', alvo: 'turma', origem: 'auto',
    origem_ref: { kind: 'sessao', id: 's1', post_id: 'p9' }, criado_em: '2026-09-30T12:00:00Z', alunos: ['a@x.com', 'b@x.com'],
    comentarios: [{ texto: 'Pedir tema', criado_em: '2026-10-01T12:00:00Z' }], peso: 1, perfil: null,
    historico: [
      { em: '2026-09-30T12:00:00Z', tipo: 'sessao_criada', payload: {}, texto: 'sessao_criada' },
      { em: '2026-09-30T12:00:00Z', tipo: 'sessao_criada', payload: {}, texto: 'sessao_criada' },
      { em: '2026-10-02T12:00:00Z', tipo: 'intervencao_status', payload: { de: 'a_fazer', para: 'em_andamento' }, texto: 'intervencao_status' },
    ],
  };

  it('mentor_intervencoes_listar → QuadroIntervencoes (status, origem, destino, histórico sem repetição por aluno)', async () => {
    const { rpc, chamadas } = rpcFalso({ mentor_intervencoes_listar: { cards: [CARD], planejadas: 5, realizadas: 2 } });
    const q = await criarDadosAcademy(rpc).intervencoes({ de: '2026-09-01', ate: null });
    expect(chamadas[0].args).toEqual({ p_de: '2026-09-01', p_ate: null });
    expect(q.planejadas).toBe(5);
    expect(q.realizadas).toBe(2);
    expect(q.cards[0]).toMatchObject({
      id: 'i1', tipo: 'coletiva', status: 'afazer', origem: 'sessao_criada', referenciaId: 's1',
      destino: { turmaToda: true, alunoIds: ['a@x.com', 'b@x.com'] }, perfil: null, criadaEm: '2026-09-30T12:00:00Z',
      comentarios: [{ em: '2026-10-01T12:00:00Z', texto: 'Pedir tema' }], peso: 1, tipoOriginal: 'reuniao_coletiva',
    });
    expect(q.cards[0].historico).toEqual([
      { em: '2026-09-30T12:00:00Z', texto: 'Sessão criada' },
      { em: '2026-10-02T12:00:00Z', texto: 'Status alterado para Em andamento' },
    ]);
  });

  it('perfil B2B do banco (baixo/bom) vira muito_baixo/muito_bom; card manual de aluno é individual', () => {
    const c = mapearIntervencao({ ...CARD, tipo: 'outro', alvo: 'aluno', origem: 'manual', origem_ref: null, perfil: 'baixo', status: 'feito' });
    expect(c).toMatchObject({ tipo: 'individual', origem: 'manual', perfil: 'muito_baixo', status: 'feito', referenciaId: null });
  });

  it('criar/atualizar/comentar intervenção mapeiam tipo, alvo e status para o SQL', async () => {
    const { rpc, chamadas } = rpcFalso({
      mentor_intervencao_criar: { intervencao_id: 'i9' },
      mentor_intervencao_atualizar: { intervencao_id: 'i9', status: 'em_andamento' },
      mentor_intervencao_comentar: { comentario_id: 'c1' },
    });
    const d = criarDadosAcademy(rpc);
    expect(await d.criarIntervencao({ tipo: 'individual', titulo: 'Conversa', destino: { alunoIds: ['a@x.com'] } })).toEqual({ id: 'i9' });
    expect(chamadas[0].args).toEqual({ p_tipo: 'reuniao_individual', p_titulo: 'Conversa', p_nota: null, p_alvo: 'aluno', p_alunos: ['a@x.com'] });
    await d.criarIntervencao({ tipo: 'mensagem', titulo: 'Avisar', destino: { turmaToda: true } });
    expect(chamadas[1].args).toMatchObject({ p_tipo: 'mensagem_mural', p_alvo: 'turma', p_alunos: [] });
    expect(await d.atualizarIntervencao('i9', { status: 'andamento' })).toEqual({ id: 'i9', status: 'andamento' });
    expect(chamadas[2].args).toEqual({ p_id: 'i9', p_titulo: null, p_nota: null, p_status: 'em_andamento' });
    await d.comentarIntervencao('i9', 'ok');
    expect(chamadas[3].args).toEqual({ p_id: 'i9', p_texto: 'ok' });
  });

  it('rotina, sinalização e pérolas', async () => {
    const { rpc, chamadas } = rpcFalso({
      mentor_rotina_listar: [{ id: 'r1', semana: '2026-10-12', dia: 'ter', tipo: 'enquete', conteudo: '', enviado_em: '2026-10-13T12:00:00Z' },
        { id: 'r2', semana: '2026-10-12', dia: 'qui', tipo: 'resposta', conteudo: '', enviado_em: null }],
      mentor_rotina_marcar_enviado: { id: 'r2', enviado_em: '2026-10-15T12:00:00Z' },
      mentor_sinalizar_ies: { id: 'sg1', sinalizado_em: '2026-10-02T12:00:00Z' },
      mentor_perolas_listar: [{ id: 'pe1', texto: 'ECG', tema: null, criado_em: '2026-10-01T00:00:00Z' }],
      mentor_perola_salvar: { id: 'pe2' },
    });
    const d = criarDadosAcademy(rpc);
    const r = await d.rotina('2026-10-12');
    expect(chamadas[0].args).toEqual({ p_semana: '2026-10-12' });
    expect(r[1]).toEqual({ id: 'r2', semana: '2026-10-12', dia: 'qui', tipo: 'resposta', conteudo: '', enviadoEm: null });
    expect(await d.marcarRotinaEnviada('r2')).toEqual({ id: 'r2', enviadoEm: '2026-10-15T12:00:00Z' });
    expect(await d.sinalizarIes('a@x.com', 'Proficiência < 45')).toEqual({ id: 'sg1', sinalizadoEm: '2026-10-02T12:00:00Z' });
    expect(await d.perolas()).toEqual([{ id: 'pe1', texto: 'ECG', tema: null, criadaEm: '2026-10-01T00:00:00Z' }]);
    await d.salvarPerola('Pérola', null);
    expect(chamadas.at(-1)).toEqual({ fn: 'mentor_perola_salvar', args: { p_texto: 'Pérola', p_tema: null } });
  });

  it('B2B: envelope paginado real e meta sao repassados', async () => {
    const meta = { periodo: '6m', fonte: 'DAG', atualizadoEm: '2026-11-04', criterio: 'x', partial: false, lowSample: false };
    const { rpc, chamadas } = rpcFalso({ mentor_alunos_b2b: { data: { data: [{ email: 'a@x.com', nome: 'A', semestre: 11, perfil: ['bom'], proficiencias: [{ simuladoId: 's4', valor: 66 }] }] }, meta } });
    const r = await criarDadosAcademy(rpc).alunosB2b('ciclo');
    expect(chamadas[0]).toEqual({ fn: 'mentor_alunos_b2b', args: { p_inicio: null, p_fim: null } });
    expect(r.meta).toEqual(meta);
    expect(r.data[0]).toMatchObject({ email: 'a@x.com', semestre: 11, perfil: 'muito_bom', proficiencias: [{ simuladoId: 's4', ordem: null, valor: 66 }], acertoUltimoPct: null });
  });
});

describe('eventoParaSql (contrato de registrar_evento_mentor)', () => {
  const pub: Publicacao = { id: 'p1', tag: 'aviso', titulo: 'Aviso', mensagem: 'm', link: null, anexoUrl: null, destino: { tipo: 'selecionados', alunoIds: ['u1'] }, status: 'publicada', publicadaEm: null };
  const sessao: Sessao = { id: 's1', tipo: 'individual', data: '2026-10-20', hora: '19:00', tema: 'Plano', alunoId: 'u1', link: null, status: 'agendada', gravacaoUrl: null, pauta: [] };
  const emailDe = (id: string) => `${id}@x.com`;

  it('mural_publicado com destinatários traduz alunoId → e-mail', () => {
    expect(eventoParaSql({ tipo: 'mural_publicado', publicacao: pub, registrarIntervencao: true, descricaoDestino: '1 aluno' }, { emailDe }))
      .toEqual({ tipo: 'mural_publicado', referencia_id: 'p1', titulo: 'Aviso', registrar_intervencao: true, alunos: ['u1@x.com'] });
  });

  it('agenda_liberada usa o id do convite como referência', () => {
    expect(eventoParaSql({ tipo: 'agenda_liberada', alunoId: 'u1', alunoNome: 'Bruno Teles' }, { referenciaId: 'conv-1', emailDe }))
      .toEqual({ tipo: 'agenda_liberada', referencia_id: 'conv-1', titulo: 'Reunião individual com Bruno', alunos: ['u1@x.com'] });
  });

  it('sessao_criada individual leva tipo_sessao e aluno; coletiva vai para a turma toda', () => {
    expect(eventoParaSql({ tipo: 'sessao_criada', sessao }, { emailDe })).toMatchObject({ tipo: 'sessao_criada', referencia_id: 's1', tipo_sessao: 'individual', alunos: ['u1@x.com'] });
    expect(eventoParaSql({ tipo: 'sessao_realizada', sessao: { ...sessao, tipo: 'oficina', alunoId: null } })).toMatchObject({ tipo: 'sessao_realizada', tipo_sessao: 'oficina', turma_toda: true });
  });

  it('whatsapp, status e intervenção de aluno usam id único por ocorrência; perfil vai no formato do banco', () => {
    const novoId = () => 'occ-1';
    expect(eventoParaSql({ tipo: 'whatsapp_aberto', alunoId: 'a@x.com' }, { novoId })).toEqual({ tipo: 'whatsapp', referencia_id: 'occ-1', alunos: ['a@x.com'] });
    expect(eventoParaSql({ tipo: 'status_alterado', intervencaoId: 'i1', status: 'andamento' }, { novoId })).toEqual({ tipo: 'status_alterado', referencia_id: 'occ-1', intervencao_id: 'i1', status: 'andamento' });
    expect(eventoParaSql({ tipo: 'intervencao_aluno', alunoId: 'a@x.com', alunoNome: 'Carla Menezes', perfil: 'muito_baixo' }, { novoId }))
      .toEqual({ tipo: 'intervencao_aluno', referencia_id: 'occ-1', alunos: ['a@x.com'], titulo: 'Acompanhar Carla', perfil: 'baixo' });
    expect(eventoParaSql({ tipo: 'intervencao_tema', temaId: 't1', tema: 'Imunização', acertoPct: null, origem: 'tema_critico' }))
      .toEqual({ tipo: 'intervencao_tema', referencia_id: 't1', origem: 'tema_critico', turma_toda: true, titulo: 'Imunização: — de acerto da turma' });
  });
});
