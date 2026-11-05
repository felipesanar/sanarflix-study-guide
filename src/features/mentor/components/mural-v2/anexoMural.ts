/**
 * Anexo do Mural. `queries.ts` não tem hook de upload: este é o hook local fino sobre
 * `FonteMentoria.pedirUpload` (Academy: URL assinada do bucket `mural-anexos`; Flix: `/uploads`;
 * mock: sem envio). O arquivo só sobe quando o mentor publica ou salva o rascunho.
 * TODO(dados): mover para `api/queries.ts` como `usePedirUpload()`.
 */
import { useCallback } from 'react';
import { fonteAtiva } from '@/features/mentor/api/ativa';
import type { NovaPublicacao } from '@/features/mentor/api/fonte';
import { ErroFonte } from '@/features/mentor/api/fonte';
import type { AnexoForm } from './validacaoMural';
import { TEXTOS_MURAL } from './rotulosMural';

export const TIPOS_ANEXO = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
export const ACCEPT_ANEXO = TIPOS_ANEXO.join(',');
export const LIMITE_ANEXO_BYTES = 10 * 1024 * 1024;
const POR_EXTENSAO: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };

/** Alguns sistemas entregam `type` vazio: vale a extensão. `null` = tipo recusado. */
export function tipoDoAnexo(f: Pick<File, 'type' | 'name'>): string | null {
  const t = f.type?.toLowerCase();
  if (t) return (TIPOS_ANEXO as readonly string[]).includes(t) ? t : null;
  return POR_EXTENSAO[f.name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}

/** Mensagem de erro do arquivo escolhido; `null` = aceito. */
export function erroDoArquivo(f: File): string | null {
  if (!tipoDoAnexo(f)) return TEXTOS_MURAL.erroAnexoTipo;
  if (f.size > LIMITE_ANEXO_BYTES) return TEXTOS_MURAL.erroAnexoTamanho;
  return null;
}

export function useEnviarAnexo() {
  return useCallback(async (anexo: AnexoForm | null): Promise<NovaPublicacao['anexo']> => {
    if (!anexo) return null;
    if (anexo.tipo === 'existente') return { url: anexo.url, nome: anexo.nome, mime: '', bytes: 0 };
    const mime = tipoDoAnexo(anexo.arquivo) ?? 'application/octet-stream';
    const { uploadUrl, fileUrl } = await fonteAtiva().pedirUpload({ nome: anexo.nome, mime, bytes: anexo.arquivo.size });
    if (/^https:\/\//i.test(uploadUrl)) {
      const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': mime }, body: anexo.arquivo });
      if (!r?.ok) throw new ErroFonte(r?.status || 503, 'rede', 'Falha ao enviar o anexo.');
    }
    return { url: fileUrl, nome: anexo.nome, mime, bytes: anexo.arquivo.size };
  }, []);
}
