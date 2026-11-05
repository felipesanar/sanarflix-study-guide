import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { ROTULO_TAG_MURAL, TEXTOS_MURAL } from './rotulosMural';
import type { FormMural } from './validacaoMural';

/**
 * "Como o aluno vê" (prévia ao vivo). É um dos 4 lugares com identidade da tribo (docs/05 D6):
 * ícone da tribo no cabeçalho do mural do aluno.
 */
export function PreviaAluno({ form, triboNome, mentorNome, iconeUrl }: {
  form: FormMural;
  triboNome: string;
  mentorNome: string;
  iconeUrl: string | null;
}) {
  const selecionados = form.para === 'selecionados';
  const linkTitulo = form.linkUrl.trim() || form.linkTitulo.trim() ? form.linkTitulo.trim() : '';
  return (
    <aside className="mural-previa" aria-labelledby="mural-previa-h">
      <span id="mural-previa-h" className="mural-rotulo">Como o aluno vê</span>
      <div className="mural-bloco mural-previa-cartao" data-testid="previa-aluno">
        <div className="mural-previa-cabecalho">
          {iconeUrl && <img src={iconeUrl} alt="" className="mural-previa-icone" />}
          <span>Mural da Tribo {triboNome}</span>
        </div>
        <div className="mural-previa-abas" aria-hidden="true">
          <span data-ativa={!selecionados || undefined}>Coletivo</span>
          {selecionados && <span data-ativa>Pra você</span>}
        </div>
        <p className="sr-only">Aba {selecionados ? 'Pra você' : 'Coletivo'}</p>
        <article className="mural-previa-post">
          <div className="mural-previa-meta">
            <Tag variant="contador" className="mural-previa-tag">{ROTULO_TAG_MURAL[form.tag]}</Tag>
            <span>agora</span>
          </div>
          <strong className="mural-previa-titulo">{form.titulo.trim() || TEXTOS_MURAL.previaTitulo}</strong>
          <span className="mural-previa-msg">{form.mensagem.trim() || TEXTOS_MURAL.previaMensagem}</span>
          {linkTitulo && (
            <span className="mural-previa-link"><Icon name="open_in_new" size={13} />{linkTitulo}</span>
          )}
          {form.anexo && (
            <span className="mural-previa-anexo"><Icon name="attach_file" size={13} />{form.anexo.nome}</span>
          )}
          <span className="mural-previa-assinatura">{mentorNome} · Tribo {triboNome}</span>
        </article>
      </div>
    </aside>
  );
}
