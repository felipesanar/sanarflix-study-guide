/**
 * Fixture da Task 61 (§7.7 da spec — segurança e LGPD).
 *
 * Um aluno com nome, id e proficiência DISTINTOS o bastante para não colidir
 * por acaso com qualquer outro texto/número que a tela já desenha (KPIs,
 * períodos, ids curtos tipo 'a1' usados em outras fixtures). Se qualquer um
 * destes três valores aparecer em `localStorage`, `sessionStorage` ou na URL
 * durante os testes de `seguranca-lgpd.test.tsx`, é porque o código
 * efetivamente escreveu o dado do aluno lá — não coincidência com outro dado
 * de tela.
 *
 * `ALUNO_ID` é um UUID de verdade (formato de produção — `alunos.id uuid`),
 * ao contrário dos ids curtos ('a1', 'a2') usados em `TabelaAlunos.test.tsx`,
 * porque um dos testes desta suíte precisa distinguir "UUID opaco" de
 * "e-mail/CPF/matrícula" — a régua do §7.7 é sobre a FORMA do identificador.
 */
import type { AlunoSimuladoEntry, LinhaAluno } from '@/features/gestor/api/types';

export const ALUNO_ID = '3fa02c9e-6b1b-4c1e-9f6d-8a1b2c3d4e5f';
export const ALUNO_NOME = 'Beatriz Wanderley Casagrande';
export const ALUNO_PROFICIENCIA = 73;

/** Linha da tabela de alunos (`get_gestor_alunos`) — 3 simulados, alinhado com `colunasSimulados` derivado de `visaoGeralFake.evolucao` (s1/s2/s3). */
export const linhaAlunoFake: LinhaAluno = {
  id: ALUNO_ID,
  nome: ALUNO_NOME,
  semestre: 11,
  grupo: 'consistentemente_proficiente',
  proficiencias: [
    { simuladoId: 's1', valor: ALUNO_PROFICIENCIA },
    { simuladoId: 's2', valor: 68 },
    { simuladoId: 's3', valor: 70 },
  ],
  tendencia: 'subindo',
};

/** Detalhe por simulado (`get_gestor_aluno`) — o que o `DrawerAluno` mostra ao abrir. */
export const alunoDrawerFake: AlunoSimuladoEntry[] = [
  {
    id: ALUNO_ID,
    nome: ALUNO_NOME,
    semestre: 11,
    participou: true,
    acertos: 44,
    proficiencia: ALUNO_PROFICIENCIA,
    situacao: 'proficiente',
    posicao: { lugar: 5, total: 118, percentil: 96 },
    acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 40, critica: true }],
    variacao: 2,
    simuladoId: 's1',
    simuladoNome: 'Simulado 1',
    simuladoData: '2026-03-10T12:00:00Z',
  },
];
