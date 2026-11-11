import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { engajamento } from '@/features/mentor/lib/regrasMentor';
import { ComposerMural } from '@/features/mentor/components/mural-v2/ComposerMural';
import { useComposerMural } from '@/features/mentor/components/mural-v2/useComposerMural';
import { alunosSelecionados, destinoDaPublicacao, formVazio, validarPublicacao } from '@/features/mentor/components/mural-v2/validacaoMural';
import { gruposDeAlerta } from '@/features/mentor/components/mural-v2/alertasMural';
import { AGORA, MODULOS, preparar, PUBLICACAO } from './apoio';

const { publicar } = vi.hoisted(() => ({ publicar: vi.fn() }));
vi.mock('@/features/mentor/api/queries', () => ({
  usePublicar: () => ({ mutateAsync: publicar }),
  useEditarPublicacao: () => ({ mutateAsync: vi.fn() }),
}));

describe('destinatarios e grupos', () => {
  // FALTA: etapa de revisao nomeada dos destinatarios antes de chamar a fonte
  it.fails('[M3] publicar para um grupo abre revisao com total e nomes antes do envio', async () => {
    const a = preparar(); const alunos = (await a.fonte.alunos(a.triboId)).slice(0, 2);
    publicar.mockResolvedValue({ id: 'publicacao', titulo: 'Revisao' });
    function Compositor() {
      const composer = useComposerMural({ alunos, totalTurma: alunos.length, avisar: vi.fn() });
      return createElement(ComposerMural, { composer, alunos, grupos: [{ chave: 'sumiram', rotulo: 'Sumiram', emails: alunos.map((aluno) => aluno.email), alunoIds: alunos.map((aluno) => aluno.alunoId) }], totalTurma: alunos.length, refs: {}, onCancelarEdicao: vi.fn() });
    }
    render(createElement(Compositor));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Revisao' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Vamos estudar' } });
    fireEvent.click(screen.getByRole('radio', { name: /Selecionados/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sumiram.*2/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Publicar para 2 alunos' })); });
    expect(publicar).not.toHaveBeenCalled();
    const revisao = screen.getByRole('dialog');
    expect(revisao).toHaveTextContent('2 alunos');
    for (const aluno of alunos) expect(within(revisao).getByText(aluno.nome)).toBeVisible();
  });
  // FALTA: modulo destinatarios com limite explicito de 500
  it.fails('[M13] aceita 500 destinatarios, recusa 501 e lista vazia', async () => {
    const { validarDestinatarios, LIMITE_DESTINATARIOS } = await import(MODULOS.destinatarios);
    expect(LIMITE_DESTINATARIOS).toBe(500);
    expect(validarDestinatarios(Array.from({ length: 500 }, (_, i) => String(i)))).toEqual({ ok: true });
    expect(validarDestinatarios(Array.from({ length: 501 }, (_, i) => String(i)))).toEqual({ ok: false, motivo: 'limite' });
    expect(validarDestinatarios([])).toEqual({ ok: false, motivo: 'vazio' });
  });
  it('[M3] total da selecao nao duplica aluno e conserva cada identificador para revisao', () => {
    const selecao = [{ chave: 'sumiu', rotulo: 'Sumiu', tipo: 'grupo' as const, alunoIds: ['ana', 'bia'] }, { chave: 'ana', rotulo: 'Ana', tipo: 'aluno' as const, alunoIds: ['ana'] }];
    expect(alunosSelecionados(selecao)).toEqual(['ana', 'bia']);
    expect(destinoDaPublicacao({ para: 'selecionados', selecao })).toEqual({ tipo: 'alunos', alunoIds: ['ana', 'bia'] });
  });
  // FALTA: modulo unico separa semDado de sumiu e usa atividade de estudo
  it.fails('[M6] aluno sem data fica em semDado, quinze dias sem estudo fica em sumiu', async () => {
    const { calcularGrupos } = await import(MODULOS.grupos);
    const alunos = [
      { alunoId: 'sem-data', ultimaAtividadeEm: null },
      { alunoId: 'quinze-dias', ultimaAtividadeEm: '2026-10-27T15:00:00Z' },
      { alunoId: 'ativo', ultimaAtividadeEm: '2026-11-11T14:00:00Z' },
    ];
    const grupos = calcularGrupos(alunos, undefined, { agora: AGORA });
    expect(grupos.semDado).toEqual(['sem-data']);
    expect(grupos.sumiu).toEqual(['quinze-dias']);
  });
  // HOJE (a corrigir na fase 7): ausencia de data ainda e classificada como sumido.
  it('[M6] documenta engajamento null como sumido hoje', () => {
    expect(engajamento(null)).toBe('sumido');
  });
  // FALTA: gruposStatus identifica o ultimo simulado aberto para a tribo
  it.fails('[M8] nao fez simulado considera somente o ultimo aberto para a tribo', async () => {
    const { calcularGrupos } = await import(MODULOS.grupos);
    const alunos = [{ alunoId: 'ana', ultimaAtividadeEm: AGORA.toISOString() }];
    const desempenho = { simulados: [{ id: 'aberto', ordem: 1, abertoParaTribo: true }, { id: 'fechado', ordem: 2, abertoParaTribo: false }], alunos: [{ alunoId: 'ana', resultados: [{ simuladoId: 'aberto', acertoPct: 70 }] }] };
    expect(calcularGrupos(alunos, desempenho, { agora: AGORA }).naoFezSimulado).toEqual([]);
    expect(calcularGrupos(alunos, { ...desempenho, alunos: [] }, { agora: AGORA }).naoFezSimulado).toEqual(['ana']);
  });
  // FALTA: grupos vazios sao removidos em vez de expostos para estado desabilitado
  it.fails('[M16] grupo vazio permanece disponivel para rotulo e estado desabilitado', () => {
    expect(gruposDeAlerta([], undefined)).toContainEqual({ chave: 'sumiram', rotulo: 'Sumiram', emails: [] });
  });
  // FALTA: modulo gruposStatus verifica atualizacao acima de 36 horas
  it.fails('[M17] dados de 37 horas ou sem data indisponibilizam grupos; 36 horas ainda vale', async () => {
    const { gruposDisponiveis } = await import(MODULOS.grupos);
    expect(gruposDisponiveis(new Date(AGORA.getTime() - 37 * 3600000).toISOString(), AGORA)).toBe(false);
    expect(gruposDisponiveis(null, AGORA)).toBe(false);
    expect(gruposDisponiveis(new Date(AGORA.getTime() - 36 * 3600000).toISOString(), AGORA)).toBe(true);
  });
  it('[M17] selecao manual valida sem depender dos dados de desempenho', () => {
    expect(validarPublicacao({ ...formVazio(), titulo: 'Ola', mensagem: 'Vamos estudar', para: 'selecionados', selecao: [{ chave: 'ana', rotulo: 'Ana', tipo: 'aluno', alunoIds: ['ana'] }] }, { exigirDestinatarios: true })).toEqual({});
  });
});

describe('mural no contrato v2.3, sem tela', () => {
  it('[M4] servidor conserva foto dos alunos, rotulo e total do grupo', () => {
    const a = preparar();
    const p = a.criarPublicacao({ ...PUBLICACAO, destino: { tipo: 'alunos', alunoIds: a.alunoIds.slice(0, 2) }, grupoRotulo: 'Sumiu', grupoTotal: 2 });
    expect(p.publicacao).toMatchObject({ grupoRotulo: 'Sumiu', grupoTotal: 2, destino: { tipo: 'alunos', alunoIds: a.alunoIds.slice(0, 2) } });
  });
  it('[M5] [M18] aluno movido depois de listar e descartado com aviso nomeado', async () => {
    const a = preparar(); const lista = await a.fonte.alunos(a.triboId);
    a.simulador.moverAlunoParaOutraTribo(lista[0].alunoId);
    const r = a.criarPublicacao({ ...PUBLICACAO, destino: { tipo: 'alunos', alunoIds: lista.slice(0, 2).map((aluno) => aluno.alunoId) } });
    expect(r).toMatchObject({ publicacao: { destinatarios: 1, destino: { alunoIds: [lista[1].alunoId] } }, warnings: [{ code: 'aluno_fora_da_tribo', alunoIds: [lista[0].alunoId], nomes: ['Ana Souza'] }] });
  });
  it('[M5] [M18] todos movidos gera sem_destinatarios sem publicar', async () => {
    const a = preparar(); a.simulador.moverAlunoParaOutraTribo(a.alunoIds[0]);
    await expect(a.fonte.criarPublicacao(a.triboId, { ...PUBLICACAO, destino: { tipo: 'alunos', alunoIds: [a.alunoIds[0]] } })).rejects.toMatchObject({ status: 422, code: 'sem_destinatarios' });
    expect((await a.fonte.publicacoes(a.triboId)).data).toEqual([]);
  });
  it('[M11] fixar segunda publicacao desafixa a primeira e informa seu id', async () => {
    const a = preparar(); const primeira = a.criarPublicacao({ ...PUBLICACAO, fixada: true });
    const segunda = a.criarPublicacao({ ...PUBLICACAO, titulo: 'Segunda', fixada: true });
    expect(segunda.desafixadaId).toBe(primeira.publicacao.id);
    const lista = (await a.fonte.publicacoes(a.triboId)).data;
    expect(lista.filter((p) => p.fixada).map((p) => p.id)).toEqual([segunda.publicacao.id]);
  });
  it('[M12] cartas individuais trazem contagem lidas e destinatarios', async () => {
    const a = preparar(); a.criarPublicacao({ ...PUBLICACAO, destino: { tipo: 'alunos', alunoIds: a.alunoIds.slice(0, 3) } });
    expect((await a.fonte.publicacoes(a.triboId)).data[0]).toMatchObject({ lidas: 0, destinatarios: 3 });
  });
});
