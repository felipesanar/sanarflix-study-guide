import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import type { FiltrosRecorteEngajamento } from '@/features/gestor/api/engajamento';
import type { NoQuestoes, QuestoesEngajamento } from '@/features/gestor/api/types-engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import { AlunosDoNoDialog } from './AlunosDoNoDialog';
import { BlocoEngajamento, type ConsultaDoBloco } from './BlocoEngajamento';

export interface GavetaTaxonomiaProps {
  dados: QuestoesEngajamento | undefined;
  consulta: ConsultaDoBloco;
  filtros: FiltrosRecorteEngajamento;
}

type Ciclo = 'clinico' | 'basico';

/** Um nó da árvore já normalizado: o ciclo, o nível (1–3) e se é folha (tema ou assunto). */
interface Linha extends NoQuestoes {
  ciclo: Ciclo;
  nivel: 1 | 2 | 3;
  filhos: Linha[];
  folha: boolean;
}

const COLUNAS = 'minmax(0, 1fr) 96px 72px 88px';
const LARGURA_MINIMA = 520;

/** Achata a árvore da §8.5 em `Linha`s: clínico (grande área › especialidade › tema) e básico (disciplina › assunto). */
function montarLinhas(dados: QuestoesEngajamento): { clinico: Linha[]; basico: Linha[] } {
  const { clinico, basico } = dados.arvore;
  return {
    clinico: clinico.grandesAreas.map((g) => ({
      ...g,
      ciclo: 'clinico' as const,
      nivel: 1 as const,
      folha: false,
      filhos: g.especialidades.map((e) => ({
        ...e,
        ciclo: 'clinico' as const,
        nivel: 2 as const,
        folha: false,
        filhos: e.temas.map((t) => ({ ...t, ciclo: 'clinico' as const, nivel: 3 as const, folha: true, filhos: [] })),
      })),
    })),
    basico: basico.disciplinas.map((d) => ({
      ...d,
      ciclo: 'basico' as const,
      nivel: 1 as const,
      folha: false,
      filhos: d.assuntos.map((a) => ({ ...a, ciclo: 'basico' as const, nivel: 2 as const, folha: true, filhos: [] })),
    })),
  };
}

/** Abertura inicial (§12.3): a 1ª grande área e, nela, a 1ª especialidade; sem clínico, a 1ª disciplina. */
function abertosIniciais(linhas: { clinico: Linha[]; basico: Linha[] }): Set<string> {
  const ids = new Set<string>();
  const [primeira] = linhas.clinico;
  if (primeira) {
    ids.add(primeira.id);
    if (primeira.filhos[0]) ids.add(primeira.filhos[0].id);
  } else if (linhas.basico[0]) {
    ids.add(linhas.basico[0].id);
  }
  return ids;
}

const TEXTO_MARCA = 'text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]';

function Acerto({ valor }: { valor: number | null }) {
  const critico = nivelDesempenho(valor) === 'critico';
  return (
    <span style={{ color: critico ? 'var(--gp-danger-on)' : undefined }}>{valor === null ? TRACO : formatPct(valor)}</span>
  );
}

const ESTILO_CELULA_NUM: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

/**
 * "Por taxonomia" (spec §8.5, §12.3): árvore expansível das questões. Clínico:
 * grande área › especialidade › tema. Básico: disciplina › assunto. Cada questão é
 * contada uma vez, na classificação principal, então cada nível soma o total. Clicar
 * numa linha abre o nível abaixo; clicar num tema ou assunto abre o pop-up de alunos.
 */
export function GavetaTaxonomia({ dados, consulta, filtros }: GavetaTaxonomiaProps) {
  const linhas = React.useMemo(() => (dados ? montarLinhas(dados) : null), [dados]);
  // `null` = ainda não houve gesto do usuário: vale a abertura inicial da §12.3.
  const [aberto, setAberto] = React.useState<Set<string> | null>(null);
  const [folhaAberta, setFolhaAberta] = React.useState<string | null>(null);

  const abertos = aberto ?? (linhas ? abertosIniciais(linhas) : new Set<string>());
  const total = dados?.arvore.total;

  const alternar = (id: string) => {
    const proximo = new Set(abertos);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    setAberto(proximo);
  };

  const renderLinha = (l: Linha): React.ReactNode => {
    const expandido = abertos.has(l.id);
    const recuo = 12 + (l.nivel - 1) * 22;
    const rotuloFolha = `Ver alunos do ${l.ciclo === 'clinico' ? 'tema' : 'assunto'} ${l.nome}`;

    return (
      <React.Fragment key={l.id}>
        <div
          role="row"
          aria-level={l.nivel}
          aria-expanded={l.folha ? undefined : expandido}
          data-testid={`taxonomia-${l.id}`}
          className="grid items-center"
          style={{ gridTemplateColumns: COLUNAS, borderBottom: '1px solid var(--gp-border-subtle)', minHeight: 40 }}
        >
          <div role="gridcell" style={{ paddingLeft: recuo, paddingRight: 8 }}>
            {l.folha ? (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={rotuloFolha}
                onClick={() => setFolhaAberta(l.id)}
                className="inline-flex items-center text-left"
                style={{ gap: 8, color: 'var(--gp-text-1)' }}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--gp-text-3)' }}>
                  <Icon name="groups" size={16} />
                </span>
                {l.nome}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`${expandido ? 'Recolher' : 'Abrir'} ${l.nome}`}
                onClick={() => alternar(l.id)}
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
          <div role="gridcell" style={ESTILO_CELULA_NUM}>
            {formatNumero(l.questoes)}
          </div>
          <div role="gridcell" style={ESTILO_CELULA_NUM}>
            {formatNumero(l.alunos)}
          </div>
          <div role="gridcell" style={{ ...ESTILO_CELULA_NUM, paddingRight: 8 }}>
            <Acerto valor={l.acertoPct} />
          </div>
        </div>
        {expandido ? l.filhos.map(renderLinha) : null}
      </React.Fragment>
    );
  };

  const faixa = (titulo: string, legenda: string, questoes: number, acertoPct: number | null) => (
    <div
      role="row"
      key={titulo}
      data-testid="faixa-ciclo"
      className="grid items-center"
      style={{
        gridTemplateColumns: COLUNAS,
        background: 'var(--gp-brand-surface)',
        borderTop: '3px solid var(--gp-brand)',
        borderBottom: '1px solid var(--gp-brand-border)',
        minHeight: 40,
      }}
    >
      <div role="gridcell" style={{ padding: '6px 12px' }}>
        <span className={`uppercase ${TEXTO_MARCA}`} style={{ fontWeight: 'var(--gp-font-weight-forte)', fontSize: 'var(--gp-font-size-apoio)', letterSpacing: 'var(--gp-font-tracking-micro)' }}>
          {titulo}
        </span>{' '}
        <span style={{ fontSize: 'var(--gp-font-size-micro)', color: 'var(--gp-text-3)' }}>{legenda}</span>
      </div>
      <div role="gridcell" className={TEXTO_MARCA} style={{ ...ESTILO_CELULA_NUM, fontWeight: 'var(--gp-font-weight-medio)' }}>
        {formatNumero(questoes)}
      </div>
      <div role="gridcell" style={{ ...ESTILO_CELULA_NUM, color: 'var(--gp-text-3)' }}>
        {TRACO}
      </div>
      {/* Só o percentual: a coluna se chama "Acerto" e tem 88px; "61% de acerto" não cabia e vazava do bloco. */}
      <div
        role="gridcell"
        title={acertoPct === null ? undefined : `${formatPct(acertoPct)} de acerto no ciclo`}
        className={acertoPct === null ? undefined : TEXTO_MARCA}
        style={{ ...ESTILO_CELULA_NUM, paddingRight: 8, fontWeight: 'var(--gp-font-weight-medio)', color: acertoPct === null ? 'var(--gp-text-3)' : undefined }}
      >
        {acertoPct === null ? TRACO : formatPct(acertoPct)}
      </div>
    </div>
  );

  return (
    <BlocoEngajamento
      titulo="Por taxonomia"
      descricao="Ciclo clínico: grande área › especialidade › tema · Ciclo básico: disciplina › assunto · clique numa linha para abrir o nível abaixo · clique num tema ou assunto para ver os alunos que resolveram questões dele"
      acao={
        <Button type="button" variant="outline" size="sm" onClick={() => setAberto(new Set())}>
          Recolher tudo
        </Button>
      }
      consulta={consulta}
      vazio={Boolean(dados) && total?.questoes === 0}
      mensagemVazio="Nenhuma questão classificada neste recorte."
      alturaSkeleton={360}
      bloco="gaveta-taxonomia"
      rodape={
        total
          ? `Cada questão é contada uma única vez, na sua classificação principal; por isso cada nível soma exatamente o total (${formatNumero(total.questoes)}), igual aos indicadores do topo. A coluna Alunos não soma: o mesmo aluno resolve questões de vários temas.`
          : undefined
      }
    >
      {dados && linhas && total ? (
        <div className="overflow-x-auto">
          <div
            role="treegrid"
            aria-label="Questões por grande área, especialidade e tema"
            style={{ minWidth: LARGURA_MINIMA, fontSize: 'var(--gp-font-size-body)', color: 'var(--gp-text-1)' }}
          >
            <div role="row" className="grid" style={{ gridTemplateColumns: COLUNAS }}>
              {['Classificação', 'Questões', 'Alunos', 'Acerto'].map((c, i) => (
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

            {linhas.clinico.length > 0
              ? [faixa('Ciclo clínico e residência', 'Grande área › especialidade › tema', dados.arvore.clinico.questoes, dados.arvore.clinico.acertoPct), ...linhas.clinico.map(renderLinha)]
              : null}
            {linhas.basico.length > 0
              ? [faixa('Ciclo básico', 'Disciplina › assunto', dados.arvore.basico.questoes, dados.arvore.basico.acertoPct), ...linhas.basico.map(renderLinha)]
              : null}

            <div
              role="row"
              data-testid="taxonomia-total"
              className="grid items-center"
              style={{ gridTemplateColumns: COLUNAS, minHeight: 40, fontWeight: 'var(--gp-font-weight-forte)' }}
            >
              <div role="gridcell" style={{ padding: '6px 12px' }}>
                Total
              </div>
              <div role="gridcell" style={ESTILO_CELULA_NUM}>
                {formatNumero(total.questoes)}
              </div>
              <div role="gridcell" style={ESTILO_CELULA_NUM}>
                {formatNumero(total.alunos)}
              </div>
              <div role="gridcell" style={{ ...ESTILO_CELULA_NUM, paddingRight: 8 }}>
                <Acerto valor={total.acertoPct} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {folhaAberta ? <AlunosDoNoDialog folhaId={folhaAberta} filtros={filtros} onFechar={() => setFolhaAberta(null)} /> : null}
    </BlocoEngajamento>
  );
}
