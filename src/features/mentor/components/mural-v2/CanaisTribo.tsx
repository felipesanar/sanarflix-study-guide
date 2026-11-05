import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '@/features/mentor/api/erros';
import type { CanalTurma } from '@/features/mentor/api/types';
import { ehLinkHttps } from '@/features/mentor/lib/linkSeguro';
import { TEXTOS_MURAL } from './rotulosMural';
import { normalizarGrupoWhatsapp } from './validacaoMural';

const ORDEM: CanalTurma['tipo'][] = ['avisos', 'plantao', 'grupo_turma'];
const SUB: Record<CanalTurma['tipo'], string> = {
  avisos: 'Comunicados gerais para todos os alunos',
  plantao: 'Atendido pela monitoria, não pelo mentor',
  grupo_turma: 'Único canal que você define',
};

const semProtocolo = (url: string) => url.replace(/^https?:\/\//i, '');

export interface CanaisTriboProps {
  canais: CanalTurma[] | undefined;
  carregando: boolean;
  erro: boolean;
  tentandoNovamente?: boolean;
  onTentarNovamente: () => void;
  triboNome: string;
  /** Grava o link (normalizado). Rejeita com o erro da fonte. */
  onSalvar: (url: string) => Promise<unknown>;
  avisar: (texto: string) => void;
}

/** "Canais da tribo" (docs/05 D4 revisto): Avisos e Plantão fixos; Grupo da tribo editável. */
export function CanaisTribo({ canais, carregando, erro, tentandoNovamente, onTentarNovamente, triboNome, onSalvar, avisar }: CanaisTriboProps) {
  const id = useId();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const nome = (c: CanalTurma) => (c.tipo === 'grupo_turma' ? `Grupo da Tribo ${triboNome}` : c.tipo === 'avisos' ? 'Grupo de avisos' : 'Plantão de dúvidas');
  const lista = ORDEM.map((t) => canais?.find((c) => c.tipo === t)).filter((c): c is CanalTurma => !!c);

  function abrir(c: CanalTurma) {
    setValor(c.url);
    setErroLink(null);
    setEditando(true);
    requestAnimationFrame(() => input.current?.focus());
  }
  function fechar() {
    setEditando(false);
    setErroLink(null);
    requestAnimationFrame(() => gatilho.current?.focus());
  }
  async function salvar() {
    const url = normalizarGrupoWhatsapp(valor);
    if (!url) {
      setErroLink(TEXTOS_MURAL.erroCanal);
      input.current?.focus();
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(url);
      fechar();
      avisar(TEXTOS_MURAL.toastCanal);
    } catch (e) {
      setErroLink(mensagemErro(e));
      input.current?.focus();
    } finally {
      setSalvando(false);
    }
  }
  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); void salvar(); }
    if (e.key === 'Escape') { e.preventDefault(); fechar(); }
  }

  let corpo: React.ReactNode;
  if (carregando) corpo = <div className="mural-bloco-pad"><GestorSkeleton altura={168} rotulo="Carregando Canais da tribo" /></div>;
  else if (erro) corpo = <div className="mural-bloco-pad"><EstadoErro onRetry={onTentarNovamente} tentandoNovamente={tentandoNovamente} /></div>;
  else if (lista.length === 0) corpo = <div className="mural-bloco-pad"><EstadoVazio titulo="Nenhum canal cadastrado para a tribo." glifo="whatsapp" /></div>;
  else {
    corpo = (
      <ul className="mural-lista" aria-label="Canais">
        {lista.map((c) => {
          const configurado = c.configurado !== false && !!c.url;
          return (
            <li key={c.tipo} className="mural-canal">
              <span className="mural-canal-icone" aria-hidden="true"><Icon name="whatsapp" size={16} /></span>
              <span className="mural-canal-texto">
                <span className="mural-canal-nome">{nome(c)}</span>
                <span className="mural-canal-sub">{SUB[c.tipo]}</span>
              </span>
              {!c.editavel ? (
                <span className="mural-canal-fixo"><Icon name="padlock" size={13} />{TEXTOS_MURAL.canalFixo}</span>
              ) : editando ? (
                <span className="mural-canal-edicao">
                  <input
                    ref={input}
                    value={valor}
                    onChange={(e) => { setValor(e.target.value); setErroLink(null); }}
                    onKeyDown={teclado}
                    aria-label="Link do grupo da tribo"
                    aria-invalid={!!erroLink}
                    aria-describedby={erroLink ? `${id}-erro` : undefined}
                    placeholder="https://chat.whatsapp.com/…"
                    inputMode="url"
                    className="mural-input mural-input-canal"
                    data-erro={erroLink ? true : undefined}
                  />
                  <button type="button" className="mural-btn mural-btn-pri mural-btn-sm" onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button type="button" className="mural-btn-linha" onClick={fechar} disabled={salvando}>Cancelar</button>
                </span>
              ) : (
                <span className="mural-canal-edicao">
                  {configurado ? (
                    ehLinkHttps(c.url) ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="mural-canal-link">
                        <Icon name="open_in_new" size={13} />{semProtocolo(c.url)}
                      </a>
                    ) : <span className="mural-canal-link">{semProtocolo(c.url)}</span>
                  ) : <span className="mural-canal-sub">Link ainda não definido</span>}
                  <button ref={gatilho} type="button" className="mural-btn-linha" onClick={() => abrir(c)}>
                    {configurado ? 'Editar link' : 'Adicionar link'}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="mural-bloco" aria-labelledby={`${id}-h`}>
      <div className="mural-bloco-topo mural-bloco-topo-canais">
        <h2 id={`${id}-h`} className="mural-h2 mural-flex1">Canais da tribo</h2>
        <span className="mural-canal-sub">aparecem na página de cada aluno</span>
      </div>
      {corpo}
      {erroLink && <p id={`${id}-erro`} className="mural-erro mural-canal-erro">{erroLink}</p>}
    </section>
  );
}
