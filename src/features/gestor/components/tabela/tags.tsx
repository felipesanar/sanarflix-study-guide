import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { ROTULO_TENDENCIA, rotuloGrupo, rotuloSituacao } from '@/features/gestor/lib/rotulos';
import type { AlunoNoSimulado, GrupoEvolucao, Tendencia } from '@/features/gestor/api/types';

/**
 * As três pílulas que aparecem DENTRO das tabelas de aluno e no drawer:
 * situação, grupo de evolução e tendência. Moram juntas para que a mesma
 * situação nunca apareça com dois desenhos diferentes na tabela e no drawer —
 * que era o estado anterior (`Badge variant="secondary"` nos dois lugares,
 * derivando de `participou` em vez de `situacao`).
 *
 * Todas reusam `Tag` (as anatomias fechadas do handoff §5): nenhuma inventa
 * geometria nova. O que varia entre elas é só o PAR semântico on/surface —
 * exatamente o que `TagNivel` já faz dentro do próprio `Tag.tsx`. A cor é
 * sempre reforço: o rótulo textual vai junto, sem exceção.
 */

const PAR_SUCESSO: React.CSSProperties = {
  color: 'var(--gp-success-on)',
  background: 'var(--gp-success-surface)',
};
const PAR_ALERTA: React.CSSProperties = {
  color: 'var(--gp-warning-on)',
  background: 'var(--gp-warning-surface)',
};
const PAR_PERIGO: React.CSSProperties = {
  color: 'var(--gp-danger-on)',
  background: 'var(--gp-danger-surface)',
};

/**
 * Situação do aluno num simulado.
 *
 * `aguardando_resultado` cai no neutro contornado, junto de
 * `abaixo_do_limiar`, e não no tracejado de ausência: o aluno PARTICIPOU (a
 * nota é que ainda não subiu pelo pipeline). O tracejado da referência
 * significa "não participou" — usá-lo aqui afirmaria uma ausência que não
 * existe. Quem separa os dois é o rótulo, que é o canal primário.
 */
export function TagSituacao({ situacao }: { situacao: AlunoNoSimulado['situacao'] }) {
  const variante =
    situacao === 'proficiente' ? 'positivo' : situacao === 'nao_participou' ? 'ausencia' : 'neutro';
  return <Tag variant={variante}>{rotuloSituacao(situacao)}</Tag>;
}

/**
 * Exportado: `FiltroGrupoAlunos` (`TabelaAlunos.tsx`) usa o MESMO par por
 * grupo na bolinha do chip de filtro — um chip verde para o mesmo grupo que
 * a tag da linha pinta verde, nunca uma segunda paleta inventada ao lado.
 */
export const PAR_GRUPO: Record<GrupoEvolucao, React.CSSProperties> = {
  consistentemente_proficiente: PAR_SUCESSO,
  em_variacao: PAR_ALERTA,
  consistentemente_nao_proficiente: PAR_PERIGO,
};

/**
 * Grupo de evolução, na segunda linha da célula do nome. A cor por grupo é o
 * motivo de a tag existir: sem ela a coluna inteira sai igual e a varredura
 * visual (que é como a coordenadora lê 25 linhas) não acontece.
 *
 * `grupo: null` (aluno sem nenhum resultado de TRI ainda) NÃO tem tag — quem
 * decide isso é o chamador, com o TRAÇO. Aqui só entra grupo conhecido.
 */
export function TagGrupo({ grupo }: { grupo: GrupoEvolucao }) {
  return (
    <Tag variant="positivo" style={PAR_GRUPO[grupo]}>
      {rotuloGrupo(grupo)}
    </Tag>
  );
}

/**
 * Tendência entre simulados.
 *
 * Só "Subindo" e "Descendo" levam glifo (`arrow_upward`/`arrow_downward`
 * filled, 10px) — a referência desenha "Alternando" e "Estável" sem ícone
 * nenhum. A versão anterior inventava dois glifos (`Repeat` e `ArrowRight` do
 * Lucide) para os dois casos que a referência deixa mudos, e usava setas
 * diagonais onde a referência usa verticais.
 */
export function TagTendencia({ tendencia }: { tendencia: Tendencia }) {
  if (tendencia === 'estavel') return <Tag variant="neutro">{ROTULO_TENDENCIA.estavel}</Tag>;
  if (tendencia === 'alternando') {
    return (
      <Tag variant="positivo" style={PAR_ALERTA}>
        {ROTULO_TENDENCIA.alternando}
      </Tag>
    );
  }

  const subindo = tendencia === 'subindo';
  return (
    <Tag variant="positivo" style={subindo ? PAR_SUCESSO : PAR_PERIGO}>
      <Icon name={subindo ? 'arrow_upward' : 'arrow_downward'} variant="filled" size={10} />
      {ROTULO_TENDENCIA[tendencia]}
    </Tag>
  );
}
