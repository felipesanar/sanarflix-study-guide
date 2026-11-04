import type { ConteudoAlunosEngajamento, ConteudosEngajamento } from '@/features/gestor/api/types-engajamento';

/**
 * Fixture da `get_gestor_engajamento_conteudos` (spec §8.7) e da
 * `get_gestor_engajamento_conteudo_alunos` (§8.8). Só as chaves que as RPCs emitem.
 * Os totais da §4.6 (PARACATU) são os do topo; árvore, meses e semestres FECHAM
 * entre si (V14): especialidades somam `kpis.consumos`, módulos somam a
 * especialidade, conteúdos somam o módulo. "Materiais gerais" vem por último.
 */

export function conteudosParacatu(): ConteudosEngajamento {
  return {
    kpis: { consumos: 13837, videos: 8810, documentos: 5027, alunos: 300, porAluno: 46 },
    meses: [2200, 2400, 2000, 3000, 2600, 1637].map((consumos, i) => ({
      mes: `2026-${String(i + 5).padStart(2, '0')}`,
      parcial: i === 5,
      consumos,
    })),
    semestres: [500, 1200, 900, 1300, 1100, 1500, 1600, 3000, 700, 1000, 500, 537].map((consumos, i) => ({ semestre: i + 1, consumos })),
    arvore: [
      {
        especialidade: 'Cardiologia',
        consumos: 7000,
        alunos: 210,
        modulos: [
          {
            modulo: 'Arritmias',
            consumos: 4000,
            alunos: 150,
            conteudos: [
              { id: 'c-ecg', nome: 'Aula de ECG', tipo: 'video', consumos: 2400, alunos: 120 },
              { id: 'c-fa', nome: 'Resumo de fibrilação atrial', tipo: 'document', consumos: 1600, alunos: 90 },
            ],
          },
          {
            modulo: 'Materiais gerais',
            consumos: 3000,
            alunos: 100,
            conteudos: [{ id: 'c-mapa', nome: 'Mapa mental de cardiologia', tipo: 'document', consumos: 3000, alunos: 100 }],
          },
        ],
      },
      {
        especialidade: 'Farmacologia',
        consumos: 6837,
        alunos: 180,
        modulos: [
          {
            modulo: 'Módulo básico',
            consumos: 6837,
            alunos: 180,
            conteudos: [{ id: 'c-beta', nome: 'Betabloqueadores', tipo: 'video', consumos: 6837, alunos: 180 }],
          },
        ],
      },
    ],
  };
}

export function conteudoAlunos(): ConteudoAlunosEngajamento {
  return {
    conteudo: { id: 'c-ecg', nome: 'Aula de ECG', tipo: 'video', especialidade: 'Cardiologia', modulo: 'Arritmias' },
    resumo: { alunos: 120, consumos: 2400, aberturas: 5100 },
    alunos: [
      // 02h30Z de 23/10 = 23h30 de 22/10 em São Paulo
      { id: 'a1', nome: 'Ana Clara Ribeiro', semestre: 8, aberturas: 40, consumos: 12, ultimaAbertura: '2026-10-23T02:30:00Z' },
      { id: 'a2', nome: 'Bruno Alves', semestre: 7, aberturas: 31, consumos: 9, ultimaAbertura: '2026-10-19T15:00:00Z' },
    ],
  };
}
