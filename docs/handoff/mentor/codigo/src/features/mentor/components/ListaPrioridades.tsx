/**
 * Lista de prioridades do Início — uma implementação para as duas modalidades.
 *
 * B2C: alertas ("Quem precisa de você") · B2B: perfis do planejamento
 * ("Prioridades de acompanhamento"). Referência: capturas/b2c/01-inicio.png,
 * capturas/b2b/01-inicio.png, capturas/b2c/25-mobile-390-inicio.png.
 *
 * Cada linha é um <button> inteiro que leva à lista filtrada (Turma B2C /
 * Visão Geral B2B) com o chip removível do grupo. Grupo vazio não aparece.
 */
import * as React from 'react';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { ItemPrioridade, Prioridade } from '../api/types';

const COR_PRIORIDADE: Record<Prioridade, { fundo: string; texto: string; rotulo: string }> = {
  alta: { fundo: 'var(--gp-danger-surface)', texto: 'var(--gp-danger-on)', rotulo: 'Alta' },
  media: { fundo: 'var(--gp-warning-surface)', texto: 'var(--gp-warning-on)', rotulo: 'Média' },
  baixa: { fundo: 'var(--gp-surface-3)', texto: 'var(--gp-text-2)', rotulo: 'Baixa' },
};

export interface ListaPrioridadesProps<K extends string> {
  titulo: string;
  /** "4 alertas · hoje, 14h" / "4 grupos". */
  resumo: string;
  itens: ItemPrioridade<K>[];
  /** Ícone e cor do ícone por chave. Nomes de ícone: conferir `icon-names.ts`. */
  icone: (chave: K) => { nome: DendeIconName; cor: string };
  /** Iniciais dos 3 primeiros alunos (só B2C; some abaixo de 600px). */
  iniciais?: (alunoIds: string[]) => string[];
  onSelecionar: (chave: K) => void;
  estado: 'ok' | 'loading' | 'error';
  onTentarNovamente?: () => void;
}

export function ListaPrioridades<K extends string>({
  titulo,
  resumo,
  itens,
  icone,
  iniciais,
  onSelecionar,
  estado,
  onTentarNovamente,
}: ListaPrioridadesProps<K>) {
  const visiveis = itens.filter((i) => i.alunoIds.length > 0);
  return (
    <BlocoGestor estado={estado} aoTentarNovamente={onTentarNovamente} alturaSkeleton={240} bloco="mentor-prioridades">
      <section
        aria-labelledby="prio-h"
        className="overflow-hidden"
        style={{ background: 'var(--gp-surface-1)', border: '1px solid var(--gp-border-strong)', borderRadius: 12 }}
      >
        <header className="flex items-baseline" style={{ gap: 10, padding: '14px 20px 10px' }}>
          <h2 id="prio-h" style={{ fontSize: 15, fontWeight: 650, margin: 0 }}>{titulo}</h2>
          <span style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>{resumo}</span>
        </header>
        <ul role="list" className="m-0 p-0">
          {visiveis.map((item) => {
            const ic = icone(item.chave);
            const p = COR_PRIORIDADE[item.prioridade];
            const avatares = iniciais?.(item.alunoIds) ?? [];
            return (
              <li key={item.chave} style={{ borderTop: '1px solid var(--gp-border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => onSelecionar(item.chave)}
                  className="grid w-full items-center text-left transition-colors hover:bg-[var(--gp-surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--gp-brand)]"
                  style={{
                    gap: 14,
                    padding: '11px 20px',
                    // 20 | texto | avatares | n | prioridade | chevron — avatares somem < sm
                    gridTemplateColumns: '20px minmax(0,1fr) auto 40px 64px 20px',
                  }}
                >
                  <span style={{ color: ic.cor, display: 'flex' }}><Icon name={ic.nome} size={17} /></span>
                  <span className="min-w-0">
                    <span className="block" style={{ fontSize: 14, fontWeight: 600 }}>{item.titulo}</span>
                    <span className="block" style={{ fontSize: 12.5, color: 'var(--gp-text-3)' }}>{item.criterio}</span>
                  </span>
                  <span className="hidden items-center sm:flex" aria-hidden="true">
                    {avatares.slice(0, 3).map((ini, i) => (
                      <span
                        key={ini + i}
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 24, height: 24, marginLeft: i ? -6 : 0, fontSize: 9.5, fontWeight: 700,
                          background: 'var(--gp-surface-3)', color: 'var(--gp-text-2)', border: '2px solid var(--gp-surface-1)',
                        }}
                      >
                        {ini}
                      </span>
                    ))}
                  </span>
                  <b className="text-right tabular-nums" style={{ fontSize: 17 }}>{item.alunoIds.length}</b>
                  <span
                    className="justify-self-end whitespace-nowrap"
                    style={{ fontSize: 11.5, fontWeight: 650, padding: '2px 8px', borderRadius: 5, background: p.fundo, color: p.texto }}
                  >
                    {p.rotulo}
                  </span>
                  <span style={{ color: 'var(--gp-text-3)', display: 'flex' }}><Icon name="chevron_right" size={16} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </BlocoGestor>
  );
}
