import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';

/**
 * Densidade das tabelas do Portal do Gestor (Onda 4 do roadmap de UI, item 6
 * do Top 10: "altura de linha compacta/confortável").
 *
 * Por que um store de módulo e não Context: as três tabelas do portal
 * (`TabelaAlunos`, `TabelaAlunosSimulado`, `TabelaQuestoes`) vivem em rotas
 * diferentes e, no Detalhamento, dentro de drawers montados fora da árvore da
 * rota. Um Provider teria de ser plugado no shell E em cada portal de drawer
 * para as três concordarem; um store de módulo com `useSyncExternalStore` dá a
 * mesma leitura em qualquer ponto da árvore, sem depender de onde o componente
 * foi montado.
 *
 * A escolha é do gestor e vale para a sessão inteira, então persiste em
 * `localStorage`. Nada aqui é dado de aluno — é preferência de exibição.
 */

export type Densidade = 'compacta' | 'confortavel';

const CHAVE = 'gestor:densidade-tabela';

/** Régua de padding por densidade. Fonte única: `TabelaGestor` só lê daqui. */
export const PADDING_DENSIDADE: Record<Densidade, { cabecalho: string; celula: string }> = {
  // Confortável = a régua original do handoff §6 (9px/11px verticais).
  confortavel: { cabecalho: '9px 12px', celula: '11px 12px' },
  // Compacta = mesmas colunas, ~28% menos altura de linha: cabe mais aluno na
  // tela sem mexer em fonte (reduzir texto para 11px quebraria a escala).
  compacta: { cabecalho: '6px 12px', celula: '6px 12px' },
};

export const ROTULO_DENSIDADE: Record<Densidade, string> = {
  confortavel: 'Confortável',
  compacta: 'Compacta',
};

function ehDensidade(valor: string | null): valor is Densidade {
  return valor === 'compacta' || valor === 'confortavel';
}

function lerInicial(): Densidade {
  if (typeof window === 'undefined') return 'confortavel';
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    return ehDensidade(salvo) ? salvo : 'confortavel';
  } catch {
    // `localStorage` pode lançar (modo restrito/quota). Preferência de
    // exibição nunca deve derrubar a tabela: cai no padrão.
    return 'confortavel';
  }
}

let atual: Densidade = lerInicial();
const inscritos = new Set<() => void>();

function inscrever(callback: () => void): () => void {
  inscritos.add(callback);
  return () => inscritos.delete(callback);
}

function ler(): Densidade {
  return atual;
}

export function definirDensidade(nova: Densidade): void {
  if (nova === atual) return;
  atual = nova;
  try {
    window.localStorage.setItem(CHAVE, nova);
  } catch {
    // Sem persistência: a sessão em memória continua valendo.
  }
  for (const callback of inscritos) callback();
}

export function useDensidadeTabela(): Densidade {
  // O terceiro argumento (`getServerSnapshot`) evita o erro de hidratação em
  // qualquer render fora do browser.
  return React.useSyncExternalStore(inscrever, ler, () => 'confortavel' as Densidade);
}

/**
 * Alternador de densidade: dois estados, sem menu. Um `radiogroup` porque é
 * escolha exclusiva entre opções visíveis — o mesmo padrão do `FiltroSemestre`,
 * para o portal não ter dois vocabulários de controle segmentado.
 */
export function AlternadorDensidade({ className }: { className?: string }) {
  const densidade = useDensidadeTabela();

  return (
    <div
      role="radiogroup"
      aria-label="Densidade da tabela"
      data-testid="alternador-densidade"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        background: 'var(--gp-surface-3)',
        border: '1px solid var(--gp-border-strong)',
        borderRadius: 'var(--gp-radius-sm)',
        flex: 'none',
      }}
    >
      {(['confortavel', 'compacta'] as const).map((opcao) => {
        const ativa = densidade === opcao;
        return (
          <button
            key={opcao}
            type="button"
            role="radio"
            aria-checked={ativa}
            aria-label={`Densidade ${ROTULO_DENSIDADE[opcao].toLowerCase()}`}
            title={`Densidade ${ROTULO_DENSIDADE[opcao].toLowerCase()}`}
            onClick={() => definirDensidade(opcao)}
            className="inline-flex items-center justify-center"
            style={{
              width: 28,
              height: 24,
              borderRadius: 6,
              background: ativa ? 'var(--gp-surface-1)' : 'transparent',
              border: ativa ? '1px solid var(--gp-border-strong)' : '1px solid transparent',
              color: ativa ? 'var(--gp-text-1)' : 'var(--gp-text-3)',
              transitionProperty: 'background-color, color, border-color',
              transitionDuration: 'var(--gp-motion-2)',
              transitionTimingFunction: 'var(--gp-ease)',
            }}
          >
            {/* `unfold_less`/`unfold_more` são os glifos do Dendê que dizem
                "juntar linhas"/"afastar linhas" — a fonte não tem família
                `density_*`, e inventar nome é erro de compilação (icon-names). */}
            <Icon name={opcao === 'compacta' ? 'unfold_less' : 'unfold_more'} size={16} />
          </button>
        );
      })}
    </div>
  );
}
