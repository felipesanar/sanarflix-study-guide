import { useId, useMemo, useRef, useState, type RefObject } from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import type { AlunoFlix } from '@/features/mentor/api/fonte';
import type { TagMural } from '@/features/mentor/api/types';
import type { GrupoAlerta } from './alertasMural';
import { ACCEPT_ANEXO, erroDoArquivo } from './anexoMural';
import { GrupoRadio } from './GrupoRadio';
import { rotuloAlunos, TAGS_MURAL, TEXTOS_MURAL } from './rotulosMural';
import type { ComposerMural as Composer } from './useComposerMural';
import type { CampoMural } from './validacaoMural';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const MAX_SUGESTOES = 6;

export type RefsCampos = Partial<Record<CampoMural, RefObject<HTMLElement>>>;

export interface ComposerMuralProps {
  composer: Composer;
  alunos: AlunoFlix[] | undefined;
  /** Grupos "Adicionar por alerta" já convertidos para alunoId da fonte. */
  grupos: (GrupoAlerta & { alunoIds: string[] })[];
  totalTurma: number | null;
  refs: RefsCampos;
  onCancelarEdicao: () => void;
}

/** Bloco "Nova publicação" do Mural B2C (captura b2c/11, 11b, 12, 13). */
export function ComposerMural({ composer: c, alunos, grupos, totalTurma, refs, onCancelarEdicao }: ComposerMuralProps) {
  const id = useId();
  const ids = {
    tag: `${id}-tag`, para: `${id}-para`, titulo: `${id}-titulo`, mensagem: `${id}-mensagem`, selecao: `${id}-selecao`,
    linkPainel: `${id}-link`, linkUrl: `${id}-link-url`, linkTitulo: `${id}-link-titulo`, anexo: `${id}-anexo`, geral: `${id}-geral`,
  };
  const erro = (campo: CampoMural) => (c.erros[campo] ? `${ids[campo as keyof typeof ids] ?? campo}-erro` : undefined);
  const { form } = c;
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState('');
  const editandoPublicada = c.edicao?.status === 'publicada';
  const ocupado = c.enviando !== null;

  const sugestoes = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return [];
    const ja = new Set(form.selecao.filter((s) => s.tipo === 'aluno').flatMap((s) => s.alunoIds));
    return (alunos ?? []).filter((a) => !ja.has(a.alunoId) && normalizar(a.nome).includes(q)).slice(0, MAX_SUGESTOES);
  }, [busca, alunos, form.selecao]);

  function escolherArquivo(lista: FileList | null) {
    const f = lista?.[0];
    if (arquivoRef.current) arquivoRef.current.value = '';
    if (!f) return;
    const e = erroDoArquivo(f);
    if (e) {
      c.setErros((x) => ({ ...x, anexo: e }));
      return;
    }
    c.alterar({ anexo: { tipo: 'novo', arquivo: f, nome: f.name } });
  }

  const rotuloN = c.rotuloN;
  return (
    <section className="mural-bloco mural-composer" aria-labelledby={`${id}-h`}>
      <div className="mural-composer-topo">
        <h2 id={`${id}-h`} className="mural-h2">Nova publicação</h2>
        {c.edicao && (
          <span className="mural-editando">
            {c.edicao.status === 'rascunho' ? 'Rascunho' : 'Editando publicação'}
            <button type="button" className="mural-link-acao" onClick={onCancelarEdicao}>
              {c.edicao.status === 'rascunho' ? 'Nova publicação' : 'Cancelar edição'}
            </button>
          </span>
        )}
      </div>

      <div className="mural-campo">
        <span id={ids.tag} className="mural-rotulo">Tag</span>
        <GrupoRadio<TagMural>
          rotuloId={ids.tag}
          valor={form.tag}
          opcoes={TAGS_MURAL.map((t) => ({ valor: t.tag, rotulo: t.rotulo }))}
          onChange={(tag) => c.alterar({ tag })}
          className="mural-chips"
          classeOpcao="mural-chip-tag"
          renderOpcao={(o) => o.rotulo}
        />
      </div>

      <div className="mural-campo">
        <span id={ids.para} className="mural-rotulo">Para quem</span>
        <GrupoRadio<'turma' | 'selecionados'>
          rotuloId={ids.para}
          valor={form.para}
          opcoes={[{ valor: 'turma', rotulo: 'Toda a turma' }, { valor: 'selecionados', rotulo: 'Selecionados' }]}
          onChange={c.definirPara}
          className="mural-para"
          classeOpcao="mural-para-opcao"
          renderOpcao={(o, marcado) => (
            <>
              <span className="mural-radio" data-marcado={marcado || undefined} aria-hidden="true" />
              <span className="mural-para-rotulo">{o.rotulo}</span>
              <span className="mural-para-sub">
                {o.valor === 'turma' ? (totalTurma == null ? '' : rotuloAlunos(totalTurma)) : 'aba Pra você'}
              </span>
            </>
          )}
        />

        {form.para === 'selecionados' && (
          <>
            {grupos.length > 0 && (
              <div className="mural-atalhos" role="group" aria-label="Adicionar por alerta">
                <span className="mural-atalhos-rotulo" aria-hidden="true">Adicionar por alerta:</span>
                {grupos.map((g) => {
                  const chave = `g:${g.chave}`;
                  const ja = form.selecao.some((s) => s.chave === chave);
                  const rotulo = `${g.rotulo} · ${g.alunoIds.length}`;
                  return (
                    <button
                      key={g.chave}
                      type="button"
                      className="mural-atalho"
                      aria-pressed={ja}
                      onClick={() => !ja && c.adicionar({ chave, rotulo: g.rotulo, alunoIds: g.alunoIds, tipo: 'grupo' })}
                    >
                      {rotulo}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mural-busca-aluno">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Adicionar aluno pelo nome"
                aria-label="Buscar aluno pelo nome"
                className="mural-input mural-input-sm"
                disabled={!alunos}
              />
              {sugestoes.length > 0 && (
                <ul className="mural-sugestoes" aria-label="Alunos encontrados">
                  {sugestoes.map((a) => (
                    <li key={a.alunoId}>
                      <button
                        type="button"
                        className="mural-atalho"
                        onClick={() => {
                          c.adicionar({ chave: `a:${a.alunoId}`, rotulo: a.nome, alunoIds: [a.alunoId], tipo: 'aluno' });
                          setBusca('');
                        }}
                      >
                        <Icon name="add" size={13} />
                        {a.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              ref={refs.selecao as RefObject<HTMLDivElement>}
              tabIndex={-1}
              id={ids.selecao}
              className="mural-selecao"
              data-erro={c.erros.selecao ? true : undefined}
              aria-label="Alunos selecionados"
              aria-describedby={erro('selecao')}
              role="group"
            >
              {form.selecao.map((s) => {
                const rotulo = s.tipo === 'grupo' ? `${s.rotulo} · ${s.alunoIds.length}` : s.rotulo;
                return (
                  <span key={s.chave} className="mural-chip-selecao">
                    {rotulo}
                    <button type="button" aria-label={`Remover ${rotulo}`} onClick={() => c.remover(s.chave)}>
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                );
              })}
              {form.selecao.length === 0 && <span className="mural-selecao-vazia">{TEXTOS_MURAL.nenhumSelecionado}</span>}
            </div>
            {c.erros.selecao && <span id={erro('selecao')} className="mural-erro">{c.erros.selecao}</span>}
          </>
        )}
      </div>

      <div className="mural-campo">
        <label htmlFor={ids.titulo} className="mural-rotulo">Título</label>
        <input
          ref={refs.titulo as RefObject<HTMLInputElement>}
          id={ids.titulo}
          value={form.titulo}
          onChange={(e) => c.alterar({ titulo: e.target.value })}
          placeholder={TEXTOS_MURAL.placeholderTitulo}
          maxLength={120}
          aria-invalid={!!c.erros.titulo}
          aria-describedby={erro('titulo')}
          className="mural-input"
        />
        {c.erros.titulo && <span id={erro('titulo')} className="mural-erro">{c.erros.titulo}</span>}
      </div>

      <div className="mural-campo">
        <label htmlFor={ids.mensagem} className="mural-rotulo">Mensagem</label>
        <textarea
          ref={refs.mensagem as RefObject<HTMLTextAreaElement>}
          id={ids.mensagem}
          value={form.mensagem}
          onChange={(e) => c.alterar({ mensagem: e.target.value })}
          rows={4}
          placeholder={TEXTOS_MURAL.placeholderMensagem}
          aria-invalid={!!c.erros.mensagem}
          aria-describedby={erro('mensagem')}
          className="mural-input mural-textarea"
        />
        {c.erros.mensagem && <span id={erro('mensagem')} className="mural-erro">{c.erros.mensagem}</span>}
      </div>

      {form.linkAberto && (
        <div id={ids.linkPainel} className="mural-link-painel">
          <div className="mural-campo mural-campo-sm">
            <label htmlFor={ids.linkUrl} className="mural-rotulo-sm">Link</label>
            <input
              ref={refs.linkUrl as RefObject<HTMLInputElement>}
              id={ids.linkUrl}
              type="url"
              inputMode="url"
              value={form.linkUrl}
              onChange={(e) => c.alterar({ linkUrl: e.target.value })}
              placeholder="https://"
              aria-invalid={!!c.erros.linkUrl}
              aria-describedby={erro('linkUrl')}
              className="mural-input mural-input-sm"
            />
            {c.erros.linkUrl && <span id={erro('linkUrl')} className="mural-erro">{c.erros.linkUrl}</span>}
          </div>
          <div className="mural-campo mural-campo-sm">
            <label htmlFor={ids.linkTitulo} className="mural-rotulo-sm">Título do link (obrigatório)</label>
            <input
              ref={refs.linkTitulo as RefObject<HTMLInputElement>}
              id={ids.linkTitulo}
              value={form.linkTitulo}
              onChange={(e) => c.alterar({ linkTitulo: e.target.value })}
              placeholder={TEXTOS_MURAL.placeholderLinkTitulo}
              aria-invalid={!!c.erros.linkTitulo}
              aria-describedby={erro('linkTitulo')}
              className="mural-input mural-input-sm"
            />
          </div>
          {c.erros.linkTitulo && <span id={erro('linkTitulo')} className="mural-erro mural-link-erro">{c.erros.linkTitulo}</span>}
        </div>
      )}

      {form.anexo && (
        <span className="mural-anexo">
          <Icon name="attach_file" size={14} />
          <span className="mural-anexo-nome">{form.anexo.nome}</span>
          <button type="button" aria-label={`Remover anexo ${form.anexo.nome}`} onClick={() => c.alterar({ anexo: null })}>
            <Icon name="close" size={12} />
          </button>
        </span>
      )}
      {c.erros.anexo && <span id={erro('anexo')} className="mural-erro">{c.erros.anexo}</span>}

      <div className="mural-acoes">
        <button
          type="button"
          className="mural-icone-btn"
          aria-label="Inserir link"
          aria-expanded={form.linkAberto}
          aria-controls={form.linkAberto ? ids.linkPainel : undefined}
          data-ativo={form.linkAberto || undefined}
          onClick={() => c.alterar({ linkAberto: !form.linkAberto })}
        >
          <Icon name="open_in_new" size={16} />
        </button>
        <button
          ref={refs.anexo as RefObject<HTMLButtonElement>}
          type="button"
          className="mural-icone-btn"
          aria-label="Anexar arquivo"
          aria-describedby={erro('anexo')}
          onClick={() => arquivoRef.current?.click()}
        >
          <Icon name="attach_file" size={16} />
        </button>
        <input
          ref={arquivoRef}
          id={ids.anexo}
          type="file"
          accept={ACCEPT_ANEXO}
          className="mural-arquivo"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="mural-arquivo"
          onChange={(e) => escolherArquivo(e.target.files)}
        />
        <label className="mural-registrar" title={editandoPublicada ? 'A intervenção desta publicação já foi registrada quando ela foi publicada.' : undefined}>
          <input
            type="checkbox"
            checked={form.registrar}
            disabled={editandoPublicada}
            onChange={(e) => c.alterar({ registrar: e.target.checked })}
          />
          Registrar como intervenção (Mensagem · {rotuloN ?? 'turma'})
        </label>
        <button
          type="button"
          className="mural-btn mural-btn-sec"
          onClick={() => void c.salvarRascunho()}
          disabled={ocupado || editandoPublicada}
          aria-busy={c.enviando === 'rascunho' || undefined}
        >
          {c.enviando === 'rascunho' ? 'Salvando…' : 'Salvar rascunho'}
        </button>
        <button
          type="button"
          className="mural-btn mural-btn-pri"
          onClick={() => void c.publicar()}
          disabled={ocupado}
          aria-busy={c.enviando === 'publicar' || undefined}
          aria-describedby={c.erroGeral ? ids.geral : undefined}
        >
          {c.enviando === 'publicar' ? 'Publicando…' : rotuloN ? `Publicar para ${rotuloN}` : 'Publicar'}
        </button>
      </div>
      {c.erroGeral && <p id={ids.geral} role="alert" className="mural-erro mural-erro-geral">{c.erroGeral}</p>}
    </section>
  );
}
