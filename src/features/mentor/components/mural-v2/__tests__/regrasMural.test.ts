import { describe, expect, it } from 'vitest';
import type { AlunoTurmaAcademy, DesempenhoAlunoB2c, DesempenhoTurmaB2c, Publicacao } from '@/features/mentor/api/types';
import { formVazio, validarPublicacao, linkDaPublicacao, normalizarGrupoWhatsapp, alunosSelecionados, destinoDaPublicacao } from '../validacaoMural';
import { lerDeepLinkMural, urlMuralComposer } from '../deepLinkMural';
import { gruposDeAlerta } from '../alertasMural';
import { rotuloAlunos, rotuloDestinatario, dataCurta } from '../rotulosMural';

describe('validarPublicacao (textos literais do protótipo)', () => {
  const ok = { ...formVazio(), titulo: 'Oi', mensagem: 'Texto' };

  it('título e mensagem obrigatórios', () => {
    expect(validarPublicacao(formVazio(), { exigirDestinatarios: true })).toEqual({
      titulo: 'Informe o título.',
      mensagem: 'Escreva a mensagem.',
    });
    expect(validarPublicacao({ ...ok, titulo: '   ' }, { exigirDestinatarios: true })).toEqual({ titulo: 'Informe o título.' });
  });

  it('Selecionados sem aluno exige destinatário só quando pedido (publicar, não rascunho)', () => {
    const sel = { ...ok, para: 'selecionados' as const };
    expect(validarPublicacao(sel, { exigirDestinatarios: true })).toEqual({ selecao: 'Selecione pelo menos um aluno.' });
    expect(validarPublicacao(sel, { exigirDestinatarios: false })).toEqual({});
  });

  it('link com URL exige título; URL precisa ser https', () => {
    expect(validarPublicacao({ ...ok, linkUrl: 'https://exemplo.com/a' }, { exigirDestinatarios: true })).toEqual({
      linkTitulo: 'Link inserido precisa de título.',
    });
    for (const url of ['http://exemplo.com', 'https://', 'https://exemplo.com/a b', 'javascript:alert(1)']) {
      expect(validarPublicacao({ ...ok, linkUrl: url, linkTitulo: 'x' }, { exigirDestinatarios: true })).toEqual({
        linkUrl: 'Use um link https://.',
      });
    }
    expect(validarPublicacao({ ...ok, linkUrl: 'https://exemplo.com/a', linkTitulo: 'Aula' }, { exigirDestinatarios: true })).toEqual({});
  });

  it('linkDaPublicacao: null sem URL; aparado com URL', () => {
    expect(linkDaPublicacao({ ...ok, linkTitulo: 'só título' })).toBeNull();
    expect(linkDaPublicacao({ ...ok, linkUrl: ' https://a.com ', linkTitulo: ' Aula ' })).toEqual({ url: 'https://a.com', titulo: 'Aula' });
  });

  it('alunos selecionados sem repetição (um aluno pode estar em mais de um alerta)', () => {
    const selecao = [
      { chave: 'g:sumiram', rotulo: 'Sumiram', alunoIds: ['a', 'b'], tipo: 'grupo' as const },
      { chave: 'a:b', rotulo: 'B', alunoIds: ['b'], tipo: 'aluno' as const },
      { chave: 'g:regrediram', rotulo: 'Regrediram', alunoIds: ['c', 'a'], tipo: 'grupo' as const },
    ];
    expect(alunosSelecionados(selecao)).toEqual(['a', 'b', 'c']);
    expect(destinoDaPublicacao({ ...ok, para: 'selecionados', selecao })).toEqual({ tipo: 'alunos', alunoIds: ['a', 'b', 'c'] });
    expect(destinoDaPublicacao({ ...ok, selecao })).toEqual({ tipo: 'tribo' });
  });
});

describe('normalizarGrupoWhatsapp', () => {
  it('aceita só convite https://chat.whatsapp.com/…', () => {
    expect(normalizarGrupoWhatsapp('https://chat.whatsapp.com/Kc8tRbQ2xLm')).toBe('https://chat.whatsapp.com/Kc8tRbQ2xLm');
    expect(normalizarGrupoWhatsapp('  chat.whatsapp.com/Kc8tRbQ2xLm ')).toBe('https://chat.whatsapp.com/Kc8tRbQ2xLm');
    expect(normalizarGrupoWhatsapp('http://chat.whatsapp.com/abc')).toBeNull();
    expect(normalizarGrupoWhatsapp('https://chat.whatsapp.com/')).toBeNull();
    expect(normalizarGrupoWhatsapp('https://wa.me/5571999')).toBeNull();
    expect(normalizarGrupoWhatsapp('https://chat.whatsapp.com.evil.io/abc')).toBeNull();
    expect(normalizarGrupoWhatsapp('https://chat.whatsapp.com/a b')).toBeNull();
    expect(normalizarGrupoWhatsapp('')).toBeNull();
  });
});

describe('deep link do Mural', () => {
  it('lê e-mails (normalizados, sem duplicados), grupo, título, mensagem e tag', () => {
    const sp = new URLSearchParams({
      para: 'Bia@a.com, caio@a.com,bia@a.com,,nao-e-email',
      grupo: 'Marcaram C na Q12',
      titulo: '<b>Vigilância</b>: o erro\u0000 que mais apareceu',
      mensagem: 'Linha 1\n<script>x</script>Linha 2',
      tag: 'desempenho',
    });
    expect(lerDeepLinkMural(sp)).toEqual({
      emails: ['bia@a.com', 'caio@a.com'],
      grupo: 'Marcaram C na Q12',
      titulo: 'Vigilância: o erro que mais apareceu',
      mensagem: 'Linha 1\nLinha 2',
      tag: 'desempenho',
    });
  });

  it('sem nenhum parâmetro conhecido devolve null; tag desconhecida vira null', () => {
    expect(lerDeepLinkMural(new URLSearchParams('x=1'))).toBeNull();
    expect(lerDeepLinkMural(new URLSearchParams('titulo=Oi&tag=novidade'))?.tag).toBeNull();
  });

  it('urlMuralComposer gera o link que lerDeepLinkMural entende', () => {
    const url = urlMuralComposer({ emails: ['a@x.com', 'b@x.com'], grupo: 'Marcaram C na Q12', titulo: 'T', mensagem: 'M', tag: 'aviso' });
    expect(url.startsWith('/mentor/mural?')).toBe(true);
    expect(lerDeepLinkMural(new URL(url, 'http://x').searchParams)).toEqual({
      emails: ['a@x.com', 'b@x.com'], grupo: 'Marcaram C na Q12', titulo: 'T', mensagem: 'M', tag: 'aviso',
    });
  });
});

function alunoTurma(email: string, segmento: AlunoTurmaAcademy['segmento']): AlunoTurmaAcademy {
  return { email, segmento } as AlunoTurmaAcademy;
}
function des(email: string, p: Partial<DesempenhoAlunoB2c>): DesempenhoAlunoB2c {
  return { email, regrediu: false, estagnado: false, fezUltimo: true, ...p } as DesempenhoAlunoB2c;
}

describe('gruposDeAlerta (Adicionar por alerta)', () => {
  const turma = [alunoTurma('a', 'sumido'), alunoTurma('b', 'esfriando'), alunoTurma('c', 'ativo'), alunoTurma('d', 'sem_dado')];

  it('com simulado: Sumiram, Regrediram, Estagnados e Não fizeram o {n}º simulado; grupo vazio some', () => {
    const desempenho = {
      alunos: [des('a', { fezUltimo: false }), des('b', { regrediu: true }), des('c', { regrediu: true, estagnado: false })],
      simulados: [{ id: 's5', ordem: 5, nome: '5º', data: null, status: 'realizado', participantes: null }],
      participacaoUltimo: { simuladoId: 's5', fizeram: 2, total: 3 },
    } as unknown as DesempenhoTurmaB2c;
    expect(gruposDeAlerta(turma, desempenho)).toEqual([
      { chave: 'sumiram', rotulo: 'Sumiram', emails: ['a'] },
      { chave: 'regrediram', rotulo: 'Regrediram', emails: ['b', 'c'] },
      { chave: 'nao_fizeram', rotulo: 'Não fizeram o 5º simulado', emails: ['a'] },
    ]);
  });

  it('sem simulado (V0): só Sumiram e Esfriando; sem_dado não vira sumido', () => {
    const desempenho = { alunos: [], simulados: [], participacaoUltimo: { simuladoId: null, fizeram: 0, total: 4 } } as unknown as DesempenhoTurmaB2c;
    expect(gruposDeAlerta(turma, desempenho)).toEqual([
      { chave: 'sumiram', rotulo: 'Sumiram', emails: ['a'] },
      { chave: 'esfriando', rotulo: 'Esfriando', emails: ['b'] },
    ]);
    expect(gruposDeAlerta(undefined, undefined)).toEqual([]);
  });
});

describe('rótulos', () => {
  it('plural de alunos', () => {
    expect(rotuloAlunos(1)).toBe('1 aluno');
    expect(rotuloAlunos(87)).toBe('87 alunos');
  });

  it('destinatário da linha de Publicadas', () => {
    const nome = (id: string) => (id === 'cm' ? 'Caio Menezes' : null);
    const pub = (destino: Publicacao['destino']) => ({ destino } as Publicacao);
    expect(rotuloDestinatario(pub({ tipo: 'turma' }), nome)).toBe('Toda a turma');
    expect(rotuloDestinatario(pub({ tipo: 'selecionados', alunoIds: ['cm'] }), nome)).toBe('Caio Menezes · individual');
    expect(rotuloDestinatario(pub({ tipo: 'selecionados', alunoIds: ['x'] }), nome)).toBe('1 aluno · individual');
    expect(rotuloDestinatario(pub({ tipo: 'selecionados', alunoIds: ['a', 'b', 'c', 'd', 'e', 'f'] }), nome)).toBe('6 alunos · individual');
  });

  it('data curta dd/mm em São Paulo; sem data = null', () => {
    expect(dataCurta('2026-09-29T02:00:00Z')).toBe('28/09');
    expect(dataCurta(null)).toBeNull();
    expect(dataCurta('lixo')).toBeNull();
  });
});
