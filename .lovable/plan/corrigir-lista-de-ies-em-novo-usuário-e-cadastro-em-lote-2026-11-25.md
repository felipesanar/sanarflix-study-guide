# Corrigir lista de IES em "Novo usuário" e "Cadastro em lote"

## Causa
Na mudança anterior (indicadores do topo acompanhando os filtros), foi removida sem querer a linha que carregava a lista de IES ao abrir a página de Usuários. A lista fica vazia, então os dois dropdowns abrem sem opções. O filtro de IES da tabela também depende dessa lista.

## Correção
- Em `src/experiences/admin/pages/UsuariosPage.tsx`, restaurar o carregamento ao montar a página: `useEffect(() => { iesService.list().then(setIesList); }, [])`.
- Nada muda no banco nem nos diálogos.

## Verificação
- Conferir build e abrir os dois diálogos para ver as IES listadas.
