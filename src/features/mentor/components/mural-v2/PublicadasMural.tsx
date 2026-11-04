import { useState } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import type { Publicacao, TagMural } from '@/features/mentor/api/types';
import { dataCurta, ROTULO_TAG_MURAL, rotuloDestinatario, TAGS_MURAL } from './rotulosMural';

type FiltroTag = 'todas' | TagMural;
const FILTROS: readonly { valor: FiltroTag; rotulo: string }[] = [{ valor: 'todas', rotulo: 'Todas' }, ...TAGS_MURAL.map((t) => ({ valor: t.tag, rotulo: t.rotulo }))];

export interface PublicadasMuralProps {
  itens: Publicacao[] | undefined;
  carregando: boolean;
  erro: boolean;
  tentandoNovamente?: boolean;
  onTentarNovamente: () => void;
  nomeDe: (alunoId: string) => string | null;
  onEditar: (p: Publicacao) => void;
  onExcluir: (p: Publicacao) => void;
  /** Publicação com exclusão em andamento (botão desabilitado). */
  excluindoId: string | null;
  editandoId: string | null;
}

/** "Publicadas": filtro por tag; linhas com título, tag, destinatário, data ("· editada") e Editar/Excluir. */
export function PublicadasMural({ itens, carregando, erro, tentandoNovamente, onTentarNovamente, nomeDe, onEditar, onExcluir, excluindoId, editandoId }: PublicadasMuralProps) {
  const [filtro, setFiltro] = useState<FiltroTag>('todas');
  const visiveis = (itens ?? []).filter((p) => filtro === 'todas' || p.tag === filtro);

  let corpo: React.ReactNode;
  if (carregando) corpo = <div className="mural-bloco-pad"><GestorSkeleton altura={176} rotulo="Carregando Publicadas" /></div>;
  else if (erro) corpo = <div className="mural-bloco-pad"><EstadoErro onRetry={onTentarNovamente} tentandoNovamente={tentandoNovamente} /></div>;
  else if (visiveis.length === 0) {
    corpo = (
      <div className="mural-bloco-pad">
        {filtro === 'todas' ? (
          <EstadoVazio titulo="Nenhuma publicação ainda." descricao="O que você publicar aparece aqui e na home dos alunos." glifo="campaign" />
        ) : (
          <EstadoVazio titulo="Nenhuma publicação com esta tag." glifo="campaign" acao={{ rotulo: 'Limpar filtro', onClick: () => setFiltro('todas') }} />
        )}
      </div>
    );
  } else {
    corpo = (
      <ul className="mural-lista" aria-label="Publicações">
        {visiveis.map((p) => {
          const data = p.status === 'rascunho' ? 'Rascunho' : dataCurta(p.publicadaEm) ?? '—';
          const editada = p.status === 'publicada' && p.editadaEm ? ' · editada' : '';
          return (
            <li key={p.id} className="mural-linha" data-editando={editandoId === p.id || undefined}>
              <span className="mural-linha-titulo" title={p.titulo}>{p.titulo}</span>
              <span className="mural-linha-meta">{p.tagOriginal ?? ROTULO_TAG_MURAL[p.tag]}</span>
              <span className="mural-linha-meta">{rotuloDestinatario(p, nomeDe)}</span>
              <span className="mural-linha-data">{data}{editada}</span>
              <span className="mural-linha-acoes">
                <button type="button" className="mural-btn-linha" onClick={() => onEditar(p)} aria-label={`Editar ${p.titulo}`}>Editar</button>
                <button
                  type="button"
                  className="mural-btn-linha mural-btn-perigo"
                  onClick={() => onExcluir(p)}
                  disabled={excluindoId === p.id}
                  aria-label={`Excluir ${p.titulo}`}
                >
                  Excluir
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="mural-bloco" aria-labelledby="mural-publicadas-h">
      <div className="mural-bloco-topo">
        <h2 id="mural-publicadas-h" className="mural-h2 mural-flex1">Publicadas</h2>
        <div className="mural-chips" role="group" aria-label="Filtrar por tag">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className="mural-chip-filtro"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>
      {corpo}
    </section>
  );
}
