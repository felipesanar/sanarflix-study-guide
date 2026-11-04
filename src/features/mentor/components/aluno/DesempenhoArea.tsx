/**
 * Desempenho por área (B2C): árvore Grande área → Especialidade → Tema, barra de 110px e %.
 * Cor da barra pela régua B2C 78/66 (`tomCelula`, TODO(P3)); a cor reforça o número, nunca o substitui.
 */
import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { formatPct, TRACO } from '@/features/gestor/lib/formatters';
import type { AcertoArea } from '../../api/types';
import { tomCelula } from '../../lib/regrasMentor';

interface No { chave: string; nome: string; acertoPct: number | null; nivel: 0 | 1 | 2; filhos: No[] }

const COR_TOM = { bom: 'var(--gp-success)', medio: 'var(--gp-warning)', ruim: 'var(--gp-danger)' } as const;

function arvore(areas: AcertoArea[]): No[] {
  return areas.map((a, i) => ({
    chave: `a${i}`, nome: a.grandeArea, acertoPct: a.acertoPct, nivel: 0,
    filhos: a.especialidades.map((e, j) => ({
      chave: `a${i}e${j}`, nome: e.especialidade ?? TRACO, acertoPct: e.acertoPct, nivel: 1,
      filhos: e.temas.map((t, k) => ({ chave: `a${i}e${j}t${k}`, nome: t.tema, acertoPct: t.acertoPct, nivel: 2, filhos: [] })),
    })),
  }));
}

function Barra({ valor }: { valor: number | null }) {
  const tom = tomCelula(valor, 'b2c');
  return (
    <>
      <span aria-hidden="true" className="h-1.5 shrink-0 overflow-hidden rounded-full" style={{ width: 110, background: 'var(--gp-border-subtle)' }}>
        {valor !== null && tom && <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, valor))}%`, background: COR_TOM[tom] }} />}
      </span>
      <span className="w-[38px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums">{valor === null ? TRACO : formatPct(Math.round(valor))}</span>
    </>
  );
}

export function DesempenhoArea({ areas }: { areas: AcertoArea[] }) {
  const id = React.useId();
  const raiz = React.useMemo(() => arvore(areas), [areas]);
  const [abertos, setAbertos] = React.useState<Set<string>>(() => new Set(raiz[0] ? [raiz[0].chave] : []));
  const alternar = (chave: string) => setAbertos((s) => { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });

  const linhas: React.ReactNode[] = [];
  const visitar = (nos: No[]) => nos.forEach((no) => {
    const temFilhos = no.filhos.length > 0;
    const aberto = abertos.has(no.chave);
    const estilo = { paddingLeft: no.nivel * 18, fontSize: no.nivel === 2 ? 12.5 : 13.5, fontWeight: no.nivel === 0 ? 600 : 500 };
    const conteudo = (
      <>
        <span aria-hidden="true" className="flex w-[14px] shrink-0 justify-center" style={{ color: 'var(--gp-text-3)' }}>
          {temFilhos && <Icon name={aberto ? 'expand_more' : 'chevron_right'} size={14} />}
        </span>
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{no.nome}</span>
        <Barra valor={no.acertoPct} />
      </>
    );
    linhas.push(temFilhos ? (
      <button
        key={no.chave}
        type="button"
        aria-expanded={aberto}
        onClick={() => alternar(no.chave)}
        className="flex w-full items-center gap-2 border-0 bg-transparent py-[7px] pr-0 text-left tabular-nums max-[640px]:min-h-[44px]"
        style={estilo}
      >
        {conteudo}
      </button>
    ) : (
      <div key={no.chave} className="flex w-full items-center gap-2 py-[7px] tabular-nums" style={estilo}>{conteudo}</div>
    ));
    if (temFilhos && aberto) visitar(no.filhos);
  });
  visitar(raiz);

  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h3 id={id} className="m-0 text-[14px] font-[650]">Desempenho por área</h3>
      {linhas.length === 0 ? <span className="text-[13px]" style={{ color: 'var(--gp-text-3)' }}>Sem dado por área neste aluno.</span> : linhas}
    </section>
  );
}
