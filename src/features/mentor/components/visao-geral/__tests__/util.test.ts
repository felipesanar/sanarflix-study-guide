import { describe, expect, it } from 'vitest';
import type { AlunoB2b, QuestaoResumoMentor, Sessao, TemaTurmaMentor } from '@/features/mentor/api/types';
import {
  alunoNoGrupo, alunoNoPerfil, colunasProficiencia, ddmm, evolucaoTema, hojeSp, impactoTema, lerGrupo, lerPerfil,
  lerPeriodo, ordenarTemasB2b, proximaOficina, questoesDoTema, regua3, temaNaPauta, temasCriticosB2b, textoQuestoesDoTema,
} from '../util';

const tema = (p: Partial<TemaTurmaMentor>): TemaTurmaMentor => ({
  id: 't', tema: 'Tema', especialidade: null, grandeArea: 'Preventiva', prevalencia: 'alta', peso: 3, respostas: 40,
  acertoPct: 40, alunosAbaixo50: [], critico: true, serie: [], ...p,
});
const sessao = (p: Partial<Sessao>): Sessao => ({
  id: 's', tipo: 'oficina', data: '2026-11-19', hora: '20:00', tema: null, alunoId: null, link: null,
  status: 'agendada', gravacaoUrl: null, pauta: [], ...p,
});
const aluno = (p: Partial<AlunoB2b>): AlunoB2b => ({
  email: 'a@x.com', nome: 'A', semestre: 12, telefone: null, proficiencias: [], acertoUltimoPct: null,
  ultimaAtividade: null, diasSemAtividade: 0, perfil: null, grupo: null, sinalizadoEm: null, ...p,
});

describe('parâmetros de URL', () => {
  it('período inválido ou ausente cai no padrão de 6 meses', () => {
    expect(lerPeriodo(null)).toBe('6m');
    expect(lerPeriodo('xyz')).toBe('6m');
    expect(lerPeriodo('30d')).toBe('30d');
    expect(lerPeriodo('ciclo')).toBe('ciclo');
  });
  it('perfil e grupo só aceitam valores conhecidos', () => {
    expect(lerPerfil('virada')).toBe('virada');
    expect(lerPerfil('sem_acesso')).toBe('sem_acesso');
    expect(lerPerfil('<script>')).toBeNull();
    expect(lerGrupo(null)).toBe('todos');
    expect(lerGrupo('em_variacao')).toBe('em_variacao');
    expect(lerGrupo('sem_resultado')).toBe('sem_resultado');
    expect(lerGrupo('outro')).toBe('todos');
  });
});

describe('régua 1º · anterior · atual', () => {
  it('só aparece com 2 pontos válidos e ignora nulos', () => {
    expect(regua3([{ rotulo: '1º', valor: 54 }])).toEqual([]);
    expect(regua3([{ rotulo: '1º', valor: null }, { rotulo: '2º', valor: 55 }])).toEqual([]);
    expect(regua3([{ rotulo: '3º', valor: 57.2 }, { rotulo: '4º', valor: 58.4 }])).toEqual([
      { rotulo: 'Anterior', valor: 57.2 }, { rotulo: 'Atual', valor: 58.4 },
    ]);
  });
  it('com 3+ pontos corta para o primeiro, o anterior e o atual', () => {
    const serie = [54.1, 55.8, null, 57.2, 58.4].map((valor, i) => ({ rotulo: `${i + 1}º`, valor }));
    expect(regua3(serie)).toEqual([
      { rotulo: '1º', valor: 54.1 }, { rotulo: 'Anterior', valor: 57.2 }, { rotulo: 'Atual', valor: 58.4 },
    ]);
  });
});

describe('datas', () => {
  it('hoje no fuso de São Paulo e dd/mm', () => {
    expect(hojeSp(new Date('2026-11-05T02:30:00Z'))).toBe('2026-11-04');
    expect(ddmm('2026-11-19')).toBe('19/11');
    expect(ddmm('2026-10-31T23:00:00-03:00')).toBe('31/10');
    expect(ddmm(null)).toBe('—');
  });
});

describe('oficina', () => {
  it('próxima oficina é a primeira agendada a partir de hoje, em ordem cronológica', () => {
    const lista = [
      sessao({ id: 'passada', data: '2026-10-22' }),
      sessao({ id: 'depois', data: '2026-12-03' }),
      sessao({ id: 'pos', tipo: 'pos_simulado', data: '2026-11-05' }),
      sessao({ id: 'feita', data: '2026-11-10', status: 'realizada' }),
      sessao({ id: 'proxima', data: '2026-11-19' }),
    ];
    expect(proximaOficina(lista, '2026-11-04')?.id).toBe('proxima');
    expect(proximaOficina([], '2026-11-04')).toBeNull();
  });
  it('tema na pauta de qualquer oficina futura', () => {
    const lista = [sessao({ pauta: [{ id: 'p', origem: 'tema_critico', referenciaId: 't1', texto: 'x' }] })];
    expect(temaNaPauta(lista, 't1', '2026-11-04')).toBe(true);
    expect(temaNaPauta(lista, 't2', '2026-11-04')).toBe(false);
    expect(temaNaPauta(lista, 't1', '2026-12-01')).toBe(false);
  });
});

describe('temas críticos B2B', () => {
  it('entram só temas com 30+ respostas e acerto < 50 (acerto nulo fica fora)', () => {
    const lista = [
      tema({ id: 'a', acertoPct: 49 }), tema({ id: 'b', acertoPct: 50 }), tema({ id: 'c', acertoPct: null }),
      tema({ id: 'd', acertoPct: 20, critico: false, respostas: 12 }),
    ];
    expect(temasCriticosB2b(lista).map((t) => t.id)).toEqual(['a']);
  });
  it('impacto = peso × (100 − acerto); sem prevalência não inventa peso', () => {
    expect(impactoTema(tema({ peso: 3, acertoPct: 33 }))).toBe(201);
    expect(impactoTema(tema({ peso: null, prevalencia: null }))).toBeNull();
  });
  it('ordena por impacto, menor acerto e mais alunos abaixo de 50%', () => {
    const lista = [
      tema({ id: 'vig', peso: 3, acertoPct: 38, alunosAbaixo50: ['1', '2'] }),
      tema({ id: 'not', peso: 3, acertoPct: 33, alunosAbaixo50: ['1'] }),
      tema({ id: 'trab', peso: 2, acertoPct: 36, alunosAbaixo50: ['1', '2', '3'] }),
    ];
    expect(ordenarTemasB2b(lista, 'impacto').map((t) => t.id)).toEqual(['not', 'vig', 'trab']);
    expect(ordenarTemasB2b(lista, 'acerto').map((t) => t.id)).toEqual(['not', 'trab', 'vig']);
    expect(ordenarTemasB2b(lista, 'alunos').map((t) => t.id)).toEqual(['trab', 'vig', 'not']);
  });
  it('sem prevalência cadastrada, "impacto" desempata pelo menor acerto', () => {
    const lista = [tema({ id: 'x', peso: null, prevalencia: null, acertoPct: 45 }), tema({ id: 'y', peso: null, prevalencia: null, acertoPct: 30 })];
    expect(ordenarTemasB2b(lista, 'impacto').map((t) => t.id)).toEqual(['y', 'x']);
  });
  it('evolução no tema usa a ordem do simulado e — para lacuna', () => {
    const t = tema({ serie: [{ simuladoId: 's2', acertoPct: 44 }, { simuladoId: 's3', acertoPct: null }, { simuladoId: 's4', acertoPct: 38 }] });
    const ordem = (id: string) => ({ s2: 2, s3: 3, s4: 4 } as Record<string, number>)[id] ?? null;
    expect(evolucaoTema(t, ordem)).toBe('2º: 44% → 3º: — → 4º: 38%');
    expect(evolucaoTema(tema({ serie: [] }), ordem)).toBe('—');
  });
  it('questões do tema casam por tema, tema curto ou "Especialidade > Tema"', () => {
    const q = (numero: number, t: string, curto: string | null = null) => ({ questaoId: `q${numero}`, numero, tema: t, temaCurto: curto } as QuestaoResumoMentor);
    const lista = [q(52, 'Vigilância em saúde'), q(13, 'Vigilância em Saúde > Vigilância em saúde'), q(7, 'Outro', 'vigilância em saúde'), q(1, 'Hepatites')];
    expect(questoesDoTema(lista, 'Vigilância em saúde').map((x) => x.numero)).toEqual([7, 13, 52]);
    expect(textoQuestoesDoTema([q(13, 'a'), q(33, 'a')])).toBe('Q13, Q33 · 2 questões no simulado');
    expect(textoQuestoesDoTema([q(52, 'a')])).toBe('Q52 · 1 questão no simulado');
    expect(textoQuestoesDoTema([])).toBe('Nenhuma questão do tema no simulado');
  });
});

describe('alunos', () => {
  it('perfil vem do servidor; "sem acesso" usa a régua de 15 dias (nunca acessou conta)', () => {
    expect(alunoNoPerfil(aluno({ perfil: 'virada' }), 'virada')).toBe(true);
    expect(alunoNoPerfil(aluno({ perfil: 'muito_bom' }), 'virada')).toBe(false);
    expect(alunoNoPerfil(aluno({ diasSemAtividade: 19 }), 'sem_acesso')).toBe(true);
    expect(alunoNoPerfil(aluno({ diasSemAtividade: null }), 'sem_acesso')).toBe(true);
    expect(alunoNoPerfil(aluno({ diasSemAtividade: 9 }), 'sem_acesso')).toBe(false);
    expect(alunoNoPerfil(aluno({}), null)).toBe(true);
  });
  it('grupo "sem resultado" = grupo nulo', () => {
    expect(alunoNoGrupo(aluno({ grupo: null }), 'sem_resultado')).toBe(true);
    expect(alunoNoGrupo(aluno({ grupo: 'em_variacao' }), 'em_variacao')).toBe(true);
    expect(alunoNoGrupo(aluno({ grupo: 'em_variacao' }), 'todos')).toBe(true);
    expect(alunoNoGrupo(aluno({ grupo: 'em_variacao' }), 'consistentemente_proficiente')).toBe(false);
  });
  it('colunas de proficiência = união das ordens, em ordem', () => {
    const lista = [
      aluno({ proficiencias: [{ simuladoId: 's3', ordem: 3, valor: 56 }, { simuladoId: 's4', ordem: 4, valor: 58 }] }),
      aluno({ proficiencias: [{ simuladoId: 's1', ordem: 1, valor: 61 }, { simuladoId: 's4', ordem: 4, valor: 66 }] }),
    ];
    expect(colunasProficiencia(lista)).toEqual([1, 3, 4]);
  });
});
