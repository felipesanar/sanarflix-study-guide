import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import type { FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { ChaveConteudo, ConteudosEngajamento, TipoConteudoBanco } from '@/features/gestor/api/types-engajamento';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { AlunosDoConteudoDialog } from './AlunosDoConteudoDialog';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';

export interface GavetaConteudosProps {
  dados: ConteudosEngajamento | undefined;
  consulta: ConsultaDoBloco;
  filtros: FiltrosRecorteEngajamento;
}

/** Um nó da árvore: especialidade (1), módulo (2) ou conteúdo (3, folha). */
interface Linha {
  /** Chave única do nó: o conteúdo pode aparecer em mais de um módulo. */
  chave: string;
  nome: string;
  nivel: 1 | 2 | 3;
  consumos: number;
  alunos: number;
  filhos: Linha[];
  tipo?: TipoConteudoBanco;
  conteudo?: ChaveConteudo;
}

const COLUNAS = 'minmax(0, 1fr) 96px 72px 120px';
const LARGURA_MINIMA = 560;
const ROTULO_TIPO: Record<TipoConteudoBanco, string> = { video: 'Vídeo', document: 'Documento' };

function montarLinhas(dados: ConteudosEngajamento): Linha[] {
  return dados.arvore.map((e) => ({
    chave: `e:${e.especialidade}`,
    nome: e.especialidade,
    nivel: 1 as const,
    consumos: e.consumos,
    alunos: e.alunos,
    filhos: e.modulos.map((m) => ({
      chave: `m:${e.especialidade}|${m.modulo}`,
      nome: m.modulo,
      nivel: 2 as const,
      consumos: m.consumos,
      alunos: m.alunos,
      filhos: m.conteudos.map((c) => ({
        chave: `c:${e.especialidade}|${m.modulo}|${c.id}`,
        nome: c.nome,
        nivel: 3 as const,
        consumos: c.consumos,
        alunos: c.alunos,
        filhos: [],
        tipo: c.tipo,
        conteudo: { content_id: c.id, especialidade: e.especialidade, modulo: m.modulo },
      })),
    })),
  }));
}

/** Abertura inicial (§12.4): a 1ª especialidade e o seu 1º módulo. */
function abertosIniciais(linhas: Linha[]): Set<string> {
  const ids = new Set<string>();
  const [primeira] = linhas;
  if (primeira) {
    ids.add(primeira.chave);
    if (primeira.filhos[0]) ids.add(primeira.filhos[0].chave);
  }
  return ids;
}

/** "Participação no nível" (§4.6): consumos do nó ÷ consumos do nó pai (no 1º nível, ÷ total), inteiro. */
export function participacao(consumos: number, base: number): string {
  return base > 0 ? `${Math.round((100 * consumos) / base)}%` : '—';
}

const ESTILO_NUM: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

/**
 * "Por especialidade" (spec §8.7, §12.4): especialidade › módulo › conteúdo, com
 * consumos, alunos e a participação de cada nó no nível acima. Clicar numa linha abre
 * o nível de baixo; clicar num conteúdo abre o pop-up dos alunos que o consumiram.
 * "Materiais gerais" fica sempre por último (a RPC já entrega nessa ordem).
 */
export function GavetaConteudos({ dados, consulta, filtros }: GavetaConteudosProps) {
  const linhas = React.useMemo(() => (dados ? montarLinhas(dados) : []), [dados]);
  const [aberto, setAberto] = React.useState<Set<string> | null>(null);
  const [conteudoAberto, setConteudoAberto] = React.useState<ChaveConteudo | null>(null);

  const abertos = aberto ?? abertosIniciais(linhas);
  const totalConsumos = dados?.kpis.consumos ?? 0;

  const alternar = (chave: string) => {
    const proximo = new Set(abertos);
    if (proximo.has(chave)) proximo.delete(chave);
    else proximo.add(chave);
    setAberto(proximo);
  };

  const renderLinha = (l: Linha, baseDoNivel: number): React.ReactNode => {
    const expandido = abertos.has(l.chave);
    const folha = l.nivel === 3;
    const recuo = 12 + (l.nivel - 1) * 22;

    return (
      <React.Fragment key={l.chave}>
        <div
          role="row"
          aria-level={l.nivel}
          aria-expanded={folha ? undefined : expandido}
          data-testid={`conteudo-${l.chave}`}
          className="grid items-center"
          style={{ gridTemplateColumns: COLUNAS, borderBottom: '1px solid var(--gp-border-subtle)', minHeight: 40 }}
        >
          <div role="gridcell" style={{ paddingLeft: recuo, paddingRight: 8 }}>
            {folha && l.conteudo ? (
              <span className="inline-flex items-center" style={{ gap: 8 }}>
                <span
                  role="img"
                  aria-label={ROTULO_TIPO[l.tipo ?? 'video']}
                  style={{ display: 'inline-flex', color: 'var(--gp-text-3)' }}
                >
                  <Icon name={l.tipo === 'document' ? 'documents' : 'play_circle'} size={16} />
                </span>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Ver alunos que consumiram ${l.nome}`}
                  onClick={() => setConteudoAberto(l.conteudo ?? null)}
                  className="text-left"
                  style={{ color: 'var(--gp-text-1)' }}
                >
                  {l.nome}
                </button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`${expandido ? 'Recolher' : 'Abrir'} ${l.nome}`}
                onClick={() => alternar(l.chave)}
                className="inline-flex items-center text-left"
                style={{ gap: 8, color: 'var(--gp-text-1)', fontWeight: l.nivel === 1 ? 'var(--gp-font-weight-medio)' : undefined }}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--gp-text-3)' }}>
                  <Icon name={expandido ? 'expand_more' : 'chevron_right'} size={16} />
                </span>
                {l.nome}
              </button>
            )}
          </div>
          <div role="gridcell" style={ESTILO_NUM}>
            {formatNumero(l.consumos)}
          </div>
          <div role="gridcell" style={ESTILO_NUM}>
            {formatNumero(l.alunos)}
          </div>
          <div role="gridcell" style={{ ...ESTILO_NUM, paddingRight: 8 }}>
            {participacao(l.consumos, baseDoNivel)}
          </div>
        </div>
        {expandido ? l.filhos.map((f) => renderLinha(f, l.consumos)) : null}
      </React.Fragment>
    );
  };

  return (
    <BlocoEngajamento
      titulo="Por especialidade"
      descricao="Especialidade › módulo › conteúdo · clique numa linha para abrir o nível abaixo · clique num conteúdo para ver quais alunos o consumiram"
      acao={
        <Button type="button" variant="outline" size="sm" onClick={() => setAberto(new Set())}>
          Recolher tudo
        </Button>
      }
      consulta={consulta}
      vazio={Boolean(dados) && totalConsumos === 0}
      mensagemVazio="Nenhum conteúdo consumido neste recorte."
      alturaSkeleton={360}
      bloco="gaveta-conteudos"
    >
      {dados ? (
        <div className="overflow-x-auto">
          <div
            role="treegrid"
            aria-label="Conteúdos consumidos por especialidade, módulo e conteúdo"
            style={{ minWidth: LARGURA_MINIMA, fontSize: 'var(--gp-font-size-body)', color: 'var(--gp-text-1)' }}
          >
            <div role="row" className="grid" style={{ gridTemplateColumns: COLUNAS }}>
              {['Especialidade / módulo / conteúdo', 'Consumos', 'Alunos', 'Participação no nível'].map((c, i) => (
                <div
                  key={c}
                  role="columnheader"
                  style={{
                    padding: '8px 12px',
                    textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 'var(--gp-font-size-label)',
                    fontWeight: 'var(--gp-font-weight-medio)',
                    color: 'var(--gp-text-3)',
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
            {linhas.map((l) => renderLinha(l, totalConsumos))}
          </div>
        </div>
      ) : null}

      {conteudoAberto ? <AlunosDoConteudoDialog conteudo={conteudoAberto} filtros={filtros} onFechar={() => setConteudoAberto(null)} /> : null}
    </BlocoEngajamento>
  );
}
