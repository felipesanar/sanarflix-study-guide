/**
 * Detecção de item de navegação ativo por prefixo de rota.
 *
 * Um item é considerado ativo quando a rota atual é a sua URL ou um descendente
 * dela (ex.: `/simulados` fica ativo em `/simulados/123/prova`; `/admin/usuarios`
 * em `/admin/usuarios/42`). A raiz (`/`) é tratada como caso especial e só fica
 * ativa em correspondência exata — caso contrário ativaria em qualquer rota.
 */
export const isRouteActive = (currentPath: string, url: string): boolean => {
  if (url === '/') return currentPath === '/';
  return currentPath === url || currentPath.startsWith(`${url}/`);
};
