import type { NoQuestoes, QuestoesAlunosEngajamento, QuestoesEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_gestor_engajamento_questoes` (spec §8.5) e da
 * `get_gestor_engajamento_questoes_alunos` (§8.6). Só as chaves que as RPCs
 * emitem. Os totais da §4.5 (PARACATU) são os do topo; a árvore, os meses e os
 * semestres foram completados para FECHAR entre si (V11, V12): cada nível soma
 * o nível acima e tudo soma `kpis.questoes`. `alunos` não soma, de propósito.
 */

const no = (id: string, nome: string, questoes: number, alunos: number, acertoPct: number | null): NoQuestoes => ({
  id,
  nome,
  questoes,
  alunos,
  acertoPct,
});

export function questoesParacatu(): QuestoesEngajamento {
  return {
    kpis: { questoes: 145873, acertoPct: 66.4, alunos: 296, porAluno: 493 },
    meses: [
      { mes: '2026-05', parcial: false, questoes: 21000, acertoPct: 65.2 },
      { mes: '2026-06', parcial: false, questoes: 24000, acertoPct: 66.0 },
      { mes: '2026-07', parcial: false, questoes: 22000, acertoPct: 66.8 },
      { mes: '2026-08', parcial: false, questoes: 31000, acertoPct: 67.1 },
      { mes: '2026-09', parcial: false, questoes: 28000, acertoPct: 66.5 },
      { mes: '2026-10', parcial: true, questoes: 19873, acertoPct: 65.9 },
    ],
    semestres: [3000, 9000, 6000, 10000, 8000, 12000, 13000, 30000, 6000, 20000, 9000, 19873].map((questoes, i) => ({
      semestre: i + 1,
      questoes,
      acertoPct: i === 8 ? null : 60 + i,
    })),
    arvore: {
      clinico: {
        questoes: 100000,
        acertoPct: 66.0,
        grandesAreas: [
          {
            ...no('ga-cm', 'Clínica Médica', 60000, 250, 67.0),
            especialidades: [
              {
                ...no('esp-card', 'Cardiologia', 35000, 200, 68.0),
                temas: [no('tema-arr', 'Arritmias', 20000, 180, 70.0), no('tema-ic', 'Insuficiência cardíaca', 15000, 150, 65.5)],
              },
              {
                ...no('esp-pneumo', 'Pneumologia', 25000, 190, 45.0),
                temas: [no('tema-asma', 'Asma', 25000, 190, 45.0)],
              },
            ],
          },
          {
            ...no('ga-ped', 'Pediatria', 40000, 220, 64.0),
            especialidades: [
              {
                ...no('esp-neo', 'Neonatologia', 40000, 220, 64.0),
                temas: [no('tema-ict', 'Icterícia', 24000, 210, 66.0), no('tema-sepse', 'Sepse neonatal', 16000, 150, 60.0)],
              },
            ],
          },
        ],
      },
      basico: {
        questoes: 45873,
        acertoPct: 67.8,
        disciplinas: [
          {
            ...no('disc-fisio', 'Fisiologia', 30000, 200, 69.0),
            assuntos: [no('ass-cardio', 'Fisiologia cardiovascular', 18000, 180, 70.0), no('ass-renal', 'Fisiologia renal', 12000, 120, 67.0)],
          },
          {
            ...no('disc-anat', 'Anatomia', 15873, 90, 64.0),
            assuntos: [no('ass-cabeca', 'Cabeça e pescoço', 15873, 90, 64.0)],
          },
        ],
      },
      total: { questoes: 145873, alunos: 296, acertoPct: 66.4 },
    },
  };
}

/** Pop-up do tema "Arritmias" (clínico). */
export function questoesAlunosTema(): QuestoesAlunosEngajamento {
  return {
    no: { id: 'tema-arr', nome: 'Arritmias', ciclo: 'clinico', caminho: ['Clínica Médica', 'Cardiologia'] },
    resumo: { alunos: 180, questoes: 20000, acertoPct: 70.0 },
    alunos: [
      { id: 'a1', nome: 'Ana Clara Ribeiro', semestre: 12, questoes: 320, acertoPct: 78.0, ultimaAtividade: '2026-10-22' },
      { id: 'a2', nome: 'Bruno Alves', semestre: 10, questoes: 210, acertoPct: 41.0, ultimaAtividade: '2026-09-30' },
    ],
  };
}

/** Pop-up do assunto "Fisiologia cardiovascular" (básico). */
export function questoesAlunosAssunto(): QuestoesAlunosEngajamento {
  return {
    no: { id: 'ass-cardio', nome: 'Fisiologia cardiovascular', ciclo: 'basico', caminho: ['Ciclo básico', 'Fisiologia'] },
    resumo: { alunos: 8, questoes: 600, acertoPct: 70.0 },
    alunos: [{ id: 'a3', nome: 'Camila Souza', semestre: 3, questoes: 150, acertoPct: 72.0, ultimaAtividade: '2026-10-10' }],
  };
}
