/** Só aceita http(s): impede `javascript:` e afins num href vindo do banco. */
export function ehLinkHttp(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}
