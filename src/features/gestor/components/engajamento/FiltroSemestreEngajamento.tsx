import * as React from 'react';
import { rotuloOpcaoSemestre } from '@/features/gestor/lib/engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { SelectFiltroGestor } from '@/features/gestor/components/SelectFiltroGestor';

const SEMESTRES = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Filtro "Semestre do aluno" (spec §12.1): "Todos (1º ao 12º)" e uma opção por
 * semestre com o ciclo ("8º semestre · clínico").
 *
 * Lê e grava a mesma chave `eng_sem` que o Comparativo entre semestres (regra 2
 * da §9.6). Aluno e semestre são exclusivos (regra 1): com um aluno filtrado o
 * select mostra "Todos" — o semestre não é o recorte — e continua habilitado;
 * escolher um semestre troca o filtro (o hook apaga o aluno).
 */
export function FiltroSemestreEngajamento({
  filtros,
  semestresDisponiveis,
}: {
  filtros: Pick<FiltrosEngajamento, 'semestre' | 'alunoId' | 'setSemestre'>;
  /** Semestres com alunos na IES. `undefined` = ainda carregando: só "Todos". */
  semestresDisponiveis?: number[];
}) {
  const lista = new Set(semestresDisponiveis ?? []);
  // O semestre do link continua na lista mesmo sem alunos, para não sumir do gatilho.
  if (filtros.semestre !== null) lista.add(filtros.semestre);
  const semestres = SEMESTRES.filter((n) => lista.has(n));
  const valor = filtros.alunoId !== null || filtros.semestre === null ? 'todos' : String(filtros.semestre);

  return (
    <SelectFiltroGestor
      ariaLabel="Semestre do aluno"
      prefixo="Semestre"
      valor={valor}
      onChange={(v) => filtros.setSemestre(v === 'todos' ? null : Number(v))}
      opcoes={[
        { valor: 'todos', rotulo: 'Todos (1º ao 12º)' },
        ...semestres.map((n) => ({ valor: String(n), rotulo: rotuloOpcaoSemestre(n) })),
      ]}
    />
  );
}
