import * as React from 'react';
import { rotuloOpcaoSemestre } from '@/features/gestor/lib/engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { ESTILO_CONTROLE, ESTILO_ROTULO_FILTRO } from '@/features/gestor/components/engajamento/FiltroPeriodo';

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
}: {
  filtros: Pick<FiltrosEngajamento, 'semestre' | 'alunoId' | 'setSemestre'>;
}) {
  const id = React.useId();
  const valor = filtros.alunoId !== null || filtros.semestre === null ? '' : String(filtros.semestre);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} style={ESTILO_ROTULO_FILTRO}>
        Semestre do aluno
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => filtros.setSemestre(e.target.value === '' ? null : Number(e.target.value))}
        style={ESTILO_CONTROLE}
      >
        <option value="">Todos (1º ao 12º)</option>
        {SEMESTRES.map((n) => (
          <option key={n} value={n}>
            {rotuloOpcaoSemestre(n)}
          </option>
        ))}
      </select>
    </div>
  );
}
