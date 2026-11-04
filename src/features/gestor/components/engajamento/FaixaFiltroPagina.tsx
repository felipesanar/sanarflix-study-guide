import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';

export interface FaixaFiltroPaginaProps {
  /** Aluno filtrado (`recorte.aluno` da visão geral). */
  aluno: { nome: string; semestre: number } | null;
  /** Semestre filtrado (`eng_sem`). Aluno e semestre são exclusivos. */
  semestre: number | null;
  onLimpar: () => void;
}

/**
 * Faixa "Página filtrada por" (spec §12.2), só na Visão geral.
 *
 * Diz de que recorte são TODOS os blocos abaixo: um chip "Aluno: {nome} ({n}º
 * sem.)" ou "{n}º semestre", o "×" que limpa o filtro e a frase de escopo. Sem
 * aluno e sem semestre não há nada a dizer e a faixa não aparece.
 */
export function FaixaFiltroPagina({ aluno, semestre, onLimpar }: FaixaFiltroPaginaProps) {
  const chip = aluno ? `Aluno: ${aluno.nome} (${aluno.semestre}º sem.)` : semestre !== null ? `${semestre}º semestre` : null;
  if (chip === null) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--gp-radius-sm)',
        background: 'var(--gp-brand-surface)',
        border: '1px solid var(--gp-brand-border)',
        fontSize: 'var(--gp-font-size-apoio)',
        color: 'var(--gp-text-2)',
      }}
    >
      {/* Texto de marca: `--gp-brand-strong` no claro, `--gp-brand-on-dark` no escuro (regra do tema). */}
      <span className="text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]" style={{ fontWeight: 600 }}>
        Página filtrada por
      </span>
      <span
        className="inline-flex items-center gap-1.5 text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]"
        style={{
          padding: '3px 6px 3px 10px',
          borderRadius: 'var(--gp-radius-pill)',
          background: 'var(--gp-surface-1)',
          border: '1px solid var(--gp-brand-border)',
          fontWeight: 600,
        }}
      >
        {chip}
        <button
          type="button"
          aria-label="Remover filtro"
          onClick={onLimpar}
          className="inline-flex items-center justify-center text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]"
          style={{ width: 18, height: 18, borderRadius: 'var(--gp-radius-pill)' }}
        >
          <Icon name="close" size={14} />
        </button>
      </span>
      <span>Todos os componentes abaixo mostram só este recorte.</span>
    </div>
  );
}
