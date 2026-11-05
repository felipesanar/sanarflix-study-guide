/**
 * Estado e ações do composer do Mural: preencher, validar, publicar (composta), salvar rascunho,
 * editar uma publicação e aplicar o deep link. Dados só pelos hooks de `api/queries.ts`.
 */
import { useCallback, useRef, useState } from 'react';
import type { AlunoFlix, NovaPublicacao } from '@/features/mentor/api/fonte';
import type { Publicacao } from '@/features/mentor/api/types';
import { useEditarPublicacao, usePublicar } from '@/features/mentor/api/queries';
import { campoDoErro, mensagemErro, tratamentoErro } from '@/features/mentor/api/erros';
import { useEnviarAnexo } from './anexoMural';
import type { DeepLinkMural } from './deepLinkMural';
import { rotuloAlunos, TEXTOS_MURAL } from './rotulosMural';
import {
  alunosSelecionados, destinoDaPublicacao, formVazio, linkDaPublicacao, ORDEM_CAMPOS, validarPublicacao,
  type CampoMural, type ErrosMural, type FormMural, type ItemSelecao,
} from './validacaoMural';

/** Campo do formulário que recebe o erro de validação da fonte (`ErroFonte.field`). */
const CAMPO_DA_FONTE: Record<string, CampoMural> = {
  titulo: 'titulo', mensagem: 'mensagem', url: 'linkUrl', link: 'linkUrl', link_url: 'linkUrl', linkUrl: 'linkUrl',
  link_titulo: 'linkTitulo', linkTitulo: 'linkTitulo', destinatarios: 'selecao', alunoIds: 'selecao', anexo: 'anexo',
};

export interface EdicaoMural {
  id: string;
  status: Publicacao['status'];
  titulo: string;
}

export interface OpcoesComposer {
  alunos: AlunoFlix[] | undefined;
  /** Tamanho da turma (lista de alunos; cadastro da tribo enquanto ela carrega). `null` = desconhecido. */
  totalTurma: number | null;
  avisar: (texto: string) => void;
  /** Foco no primeiro campo com erro (a tela conhece os elementos). */
  focarCampo?: (campo: CampoMural) => void;
}

export function useComposerMural({ alunos, totalTurma, avisar, focarCampo }: OpcoesComposer) {
  const [form, setForm] = useState<FormMural>(formVazio);
  const [erros, setErros] = useState<ErrosMural>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<EdicaoMural | null>(null);
  const [enviando, setEnviando] = useState<'publicar' | 'rascunho' | null>(null);
  const publicar = usePublicar();
  const editar = useEditarPublicacao();
  const enviarAnexo = useEnviarAnexo();
  const ocupado = useRef(false);

  const nAlunos = form.para === 'turma' ? totalTurma : alunosSelecionados(form.selecao).length;
  const rotuloN = nAlunos == null ? null : rotuloAlunos(nAlunos);

  /** Atualiza campos; o erro do campo editado some (comportamento do protótipo). */
  const alterar = useCallback((mudancas: Partial<FormMural>) => {
    setForm((f) => ({ ...f, ...mudancas }));
    setErroGeral(null);
    setErros((e) => {
      const prox = { ...e };
      for (const k of Object.keys(mudancas) as (keyof FormMural)[]) {
        if (k === 'selecao') delete prox.selecao;
        if (k === 'titulo' || k === 'mensagem' || k === 'linkUrl' || k === 'linkTitulo' || k === 'anexo') delete prox[k];
        if (k === 'linkUrl') delete prox.linkTitulo;
      }
      return prox;
    });
  }, []);

  /** Trocar "Para quem" limpa os erros (protótipo: `mErr:{}`). */
  const definirPara = useCallback((para: FormMural['para']) => {
    setForm((f) => ({ ...f, para }));
    setErros({});
    setErroGeral(null);
  }, []);

  const adicionar = useCallback((item: ItemSelecao) => {
    setForm((f) => (f.selecao.some((s) => s.chave === item.chave) ? f : { ...f, selecao: [...f.selecao, item] }));
    setErros(({ selecao: _s, ...resto }) => resto);
  }, []);
  const remover = useCallback((chave: string) => {
    setForm((f) => ({ ...f, selecao: f.selecao.filter((s) => s.chave !== chave) }));
  }, []);

  const limpar = useCallback(() => {
    setForm(formVazio());
    setErros({});
    setErroGeral(null);
    setEdicao(null);
  }, []);

  const nomeDe = useCallback((id: string) => alunos?.find((a) => a.alunoId === id)?.nome ?? null, [alunos]);

  /** "Editar" em Publicadas: carrega no composer. */
  const carregar = useCallback((pub: Publicacao) => {
    setForm({
      tag: pub.tag,
      para: pub.destino.tipo === 'turma' ? 'turma' : 'selecionados',
      selecao: pub.destino.tipo === 'turma' ? [] : pub.destino.alunoIds.map((id) => ({ chave: `a:${id}`, rotulo: nomeDe(id) ?? id, alunoIds: [id], tipo: 'aluno' as const })),
      titulo: pub.titulo,
      mensagem: pub.mensagem,
      linkAberto: !!pub.link,
      linkUrl: pub.link?.url ?? '',
      linkTitulo: pub.link?.titulo ?? '',
      anexo: pub.anexoUrl ? { tipo: 'existente', url: pub.anexoUrl, nome: pub.anexoNome ?? 'anexo' } : null,
      registrar: pub.status !== 'publicada',
    });
    setErros({});
    setErroGeral(null);
    setEdicao({ id: pub.id, status: pub.status, titulo: pub.titulo });
    avisar(`Editando: ${pub.titulo}`);
  }, [avisar, nomeDe]);

  /** Deep link (questão/diagnóstico/drawer): preenche destinatários e texto. E-mail fora da turma é ignorado. */
  const aplicarDeepLink = useCallback((dl: DeepLinkMural) => {
    const porEmail = new Map((alunos ?? []).map((a) => [a.email.trim().toLowerCase(), a]));
    const achados = dl.emails.map((e) => porEmail.get(e)).filter((a): a is AlunoFlix => !!a);
    const selecao: ItemSelecao[] = dl.grupo && achados.length
      ? [{ chave: `g:link:${dl.grupo}`, rotulo: dl.grupo, alunoIds: achados.map((a) => a.alunoId), tipo: 'grupo' }]
      : achados.map((a) => ({ chave: `a:${a.alunoId}`, rotulo: a.nome, alunoIds: [a.alunoId], tipo: 'aluno' }));
    setForm((f) => ({
      ...f,
      ...(dl.emails.length ? { para: 'selecionados' as const, selecao } : {}),
      ...(dl.titulo ? { titulo: dl.titulo } : {}),
      ...(dl.mensagem ? { mensagem: dl.mensagem } : {}),
      ...(dl.tag ? { tag: dl.tag } : {}),
    }));
    setErros({});
  }, [alunos]);

  const tratarErro = useCallback((e: unknown) => {
    const campo = campoDoErro(e);
    const msg = mensagemErro(e);
    if (campo && CAMPO_DA_FONTE[campo]) {
      setErros((x) => ({ ...x, [CAMPO_DA_FONTE[campo]]: msg }));
      focarCampo?.(CAMPO_DA_FONTE[campo]);
    } else if (tratamentoErro(e) === 'toast') {
      avisar(msg);
    } else {
      setErroGeral(msg);
    }
  }, [avisar, focarCampo]);

  const validar = useCallback((exigirDestinatarios: boolean) => {
    const e = validarPublicacao(form, { exigirDestinatarios });
    setErros(e);
    setErroGeral(null);
    const primeiro = ORDEM_CAMPOS.find((c) => e[c]);
    if (primeiro) {
      if ((primeiro === 'linkUrl' || primeiro === 'linkTitulo') && !form.linkAberto) setForm((f) => ({ ...f, linkAberto: true }));
      focarCampo?.(primeiro);
      return false;
    }
    return true;
  }, [form, focarCampo]);

  async function montar(status: Publicacao['status']): Promise<NovaPublicacao> {
    return {
      tag: form.tag,
      titulo: form.titulo.trim(),
      mensagem: form.mensagem.trim(),
      link: linkDaPublicacao(form),
      status,
      destino: destinoDaPublicacao(form),
      anexo: await enviarAnexo(form.anexo),
    };
  }

  const descricaoDestino = () => (form.para === 'turma' ? 'Toda a turma' : form.selecao.map((s) => (s.tipo === 'grupo' ? `${s.rotulo} · ${s.alunoIds.length}` : s.rotulo)).join(', '));

  const enviarPublicacao = useCallback(async () => {
    if (ocupado.current || !validar(true)) return;
    ocupado.current = true;
    setEnviando('publicar');
    const registrar = form.registrar && edicao?.status !== 'publicada';
    const n = nAlunos;
    try {
      const pub = await montar('publicada');
      if (edicao) await editar.mutateAsync({ id: edicao.id, mudancas: { ...pub, registrarIntervencao: registrar } });
      else await publicar.mutateAsync({ pub, registrarIntervencao: registrar, descricaoDestino: descricaoDestino() });
      limpar();
      avisar(`Publicado para ${n == null ? 'a turma' : rotuloAlunos(n)}${registrar ? ' · registrado em Intervenções' : ''}`);
    } catch (e) {
      tratarErro(e);
    } finally {
      ocupado.current = false;
      setEnviando(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, edicao, nAlunos, validar, limpar, avisar, tratarErro]);

  const salvarRascunho = useCallback(async () => {
    if (ocupado.current || edicao?.status === 'publicada' || !validar(false)) return;
    ocupado.current = true;
    setEnviando('rascunho');
    try {
      const pub = await montar('rascunho');
      if (edicao) {
        await editar.mutateAsync({ id: edicao.id, mudancas: pub });
        setEdicao({ ...edicao, titulo: pub.titulo });
      } else {
        const criada = await publicar.mutateAsync({ pub, registrarIntervencao: false });
        setEdicao({ id: criada.id, status: 'rascunho', titulo: criada.titulo });
      }
      if (form.anexo?.tipo === 'novo') {
        // Já enviado: a próxima gravação reaproveita o arquivo.
        const enviado = pub.anexo;
        if (enviado) setForm((f) => ({ ...f, anexo: { tipo: 'existente', url: enviado.url, nome: enviado.nome } }));
      }
      avisar(TEXTOS_MURAL.toastRascunho);
    } catch (e) {
      tratarErro(e);
    } finally {
      ocupado.current = false;
      setEnviando(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, edicao, validar, avisar, tratarErro]);

  return {
    form, erros, erroGeral, edicao, enviando, nAlunos, rotuloN,
    alterar, definirPara, adicionar, remover, limpar, carregar, aplicarDeepLink,
    publicar: enviarPublicacao, salvarRascunho, setErros,
  };
}

export type ComposerMural = ReturnType<typeof useComposerMural>;
