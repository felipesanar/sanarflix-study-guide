import * as React from 'react';
import { ESTILO_CONTROLE } from './FiltroPeriodo';

export interface OpcaoMetrica<T extends string> {
  valor: T;
  rotulo: string;
}

export interface SeletorMetricaProps<T extends string> {
  /** Nome acessível: "Métrica da evolução", "Métrica por semestre". */
  rotulo: string;
  valor: T;
  opcoes: ReadonlyArray<OpcaoMetrica<T>>;
  onChange: (valor: T) => void;
}

/** Seletor "Quantidade | % de acerto" dos gráficos da aba Questões (`<select>` nativo, só tokens do tema). */
export function SeletorMetrica<T extends string>({ rotulo, valor, opcoes, onChange }: SeletorMetricaProps<T>) {
  return (
    <select aria-label={rotulo} value={valor} onChange={(e) => onChange(e.target.value as T)} style={{ ...ESTILO_CONTROLE, height: 30 }}>
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
