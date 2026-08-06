export {
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  FONTE_MONO,
  LinhaTabela,
  LinhasSkeleton,
  RodapeTabela,
  TabelaGestor,
  type OrdemTabela,
} from './TabelaGestor';
export { Paginacao, paginasVisiveis } from './Paginacao';
export { TagGrupo, TagSituacao, TagTendencia } from './tags';
// `ROTULO_TENDENCIA` NÃO é reexportado daqui de propósito: o vocabulário pt-BR
// mora em `lib/rotulos.ts` e ter dois caminhos de import para a mesma constante
// é como as cópias divergentes começam. Quem precisa do rótulo importa de lá.
