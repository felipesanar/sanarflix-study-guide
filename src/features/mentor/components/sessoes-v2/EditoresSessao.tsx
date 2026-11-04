import { useEffect, useId, useRef, useState } from 'react';
import { mensagemErro } from '../../api/erros';
import { useEditarSessao, useVincularGravacao } from '../../api/queries';
import type { Sessao } from '../../api/types';
import { normalizarLink } from './util';

export const ERRO_LINK_MEET = 'Use um link https do Meet.';
export const ERRO_LINK_GRAVACAO = 'Use um link https da gravação.';

/** Abre/fecha um editor inline levando o foco ao campo e, ao fechar, de volta ao gatilho. */
function useEditorInline(inicialAberto: boolean) {
  const [aberto, setAberto] = useState(inicialAberto);
  const input = useRef<HTMLInputElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const foco = useRef<'input' | 'gatilho' | null>(null);
  useEffect(() => {
    if (foco.current === 'input') input.current?.focus();
    if (foco.current === 'gatilho') gatilho.current?.focus();
    foco.current = null;
  }, [aberto]);
  return {
    aberto, input, gatilho,
    abrir: () => { foco.current = 'input'; setAberto(true); },
    fechar: () => { foco.current = 'gatilho'; setAberto(false); },
  };
}

interface Props {
  sessao: Sessao;
  onToast: (msg: string) => void;
  /**
   * `compacto` (tabela B2C): botão "Adicionar link" que abre o campo.
   * `aberto` (linha expandida B2B): campo "Colar link do Meet" sempre visível, como no protótipo.
   */
  modo: 'compacto' | 'aberto';
}

/** Link do Meet de uma coletiva sem link: grava pela fonte (PATCH /sessoes/{id}) e o status deixa de ser "Falta link". */
export function CampoLinkMeet({ sessao, onToast, modo }: Props) {
  const editar = useEditarSessao();
  const { aberto, abrir, fechar: fecharEditor, input, gatilho } = useEditorInline(modo === 'aberto');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const erroId = useId();
  const fechar = () => { setErro(null); setValor(''); fecharEditor(); };

  async function salvar() {
    const url = normalizarLink(valor);
    if (!url) { setErro(ERRO_LINK_MEET); input.current?.focus(); return; }
    try {
      await editar.mutateAsync({ id: sessao.id, mudancas: { meetUrl: url } });
      onToast('Link do Meet salvo · a turma vê no mural');
      setValor('');
      setErro(null);
      if (modo === 'compacto') fecharEditor();
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  if (!aberto) {
    return (
      <button ref={gatilho} type="button" className="ms-btn-linha" style={{ height: 28 }} onClick={abrir}>
        Adicionar link
      </button>
    );
  }
  return (
    <span className="ms-inline">
      <input
        ref={input}
        className="ms-input"
        value={valor}
        onChange={(e) => { setValor(e.target.value); setErro(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void salvar(); }
          if (e.key === 'Escape' && modo === 'compacto') fechar();
        }}
        placeholder="Colar link do Meet"
        aria-label="Link do Meet"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? erroId : undefined}
        disabled={editar.isPending}
      />
      {(modo === 'compacto' || valor.trim()) && (
        <button type="button" className="ms-btn-salvar" onClick={() => void salvar()} disabled={editar.isPending} aria-busy={editar.isPending || undefined}>
          Salvar link
        </button>
      )}
      {modo === 'compacto' && (
        <button type="button" className="ms-btn-texto" onClick={fechar}>Cancelar</button>
      )}
      {erro && <span id={erroId} className="ms-erro" role="alert">{erro}</span>}
    </span>
  );
}

/** Fallback manual da gravação (docs/07: `POST /sessoes/{id}/gravacao { origem: 'manual' }`). */
export function GravacaoManual({ sessao, onToast }: Omit<Props, 'modo'>) {
  const vincular = useVincularGravacao();
  const { aberto, abrir, fechar: fecharEditor, input, gatilho } = useEditorInline(false);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const erroId = useId();

  async function salvar() {
    const url = normalizarLink(valor);
    if (!url) { setErro(ERRO_LINK_GRAVACAO); input.current?.focus(); return; }
    try {
      await vincular.mutateAsync({ id: sessao.id, url });
      onToast('Gravação vinculada · no acervo de mentorias');
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }
  function fechar() { setErro(null); setValor(''); fecharEditor(); }

  if (!aberto) {
    return (
      <button ref={gatilho} type="button" className="ms-btn-linha" style={{ height: 28 }} onClick={abrir}>
        Adicionar gravação
      </button>
    );
  }
  return (
    <span className="ms-inline">
      <input
        ref={input}
        className="ms-input"
        value={valor}
        onChange={(e) => { setValor(e.target.value); setErro(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void salvar(); }
          if (e.key === 'Escape') fechar();
        }}
        placeholder="Colar link da gravação"
        aria-label="Link da gravação"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? erroId : undefined}
        disabled={vincular.isPending}
      />
      <button type="button" className="ms-btn-salvar" onClick={() => void salvar()} disabled={vincular.isPending} aria-busy={vincular.isPending || undefined}>
        Salvar
      </button>
      <button type="button" className="ms-btn-texto" onClick={fechar}>Cancelar</button>
      {erro && <span id={erroId} className="ms-erro" role="alert">{erro}</span>}
    </span>
  );
}
