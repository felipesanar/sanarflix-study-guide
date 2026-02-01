
# Exibir Nome do Usuario na Aba de Liberacoes

## Problema Identificado

A aba de Liberacoes no portal de admin mostra "Nome nao disponivel" porque a tabela `users` possui politicas de RLS (Row Level Security) que restringem o acesso apenas ao proprio usuario:

```sql
-- Politica atual: SELECT
-- Condicao: auth.uid() = id
-- Resultado: Admin so ve seu proprio nome
```

O admin consegue ver os emails porque a query esta retornando resultados, mas os nomes ficam vazios devido ao RLS.

## Solucao

Adicionar uma politica RLS que permite usuarios com role `admin` visualizarem todos os registros da tabela `users`.

## Implementacao

### Migracao SQL

```sql
-- Adicionar politica para admins verem todos os usuarios
CREATE POLICY "Admins podem ver todos os usuarios"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'admin')
);
```

**Nota**: Como ja existe uma politica de SELECT (`Usuario pode ver seus dados`), precisamos:
1. Remover a politica existente
2. Criar uma nova politica que combine as duas condicoes (usuario ve seus dados OU admin ve todos)

### Migracao Completa

```sql
-- Remover politica de SELECT existente
DROP POLICY IF EXISTS "Usuário pode ver seus dados" ON public.users;

-- Criar nova politica que permite:
-- 1. Usuario ver seus proprios dados
-- 2. Admin ver todos os usuarios
CREATE POLICY "Usuarios podem ver seus dados e admins podem ver todos"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'admin')
);
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Nome nao disponivel | Gabriela Souza Modesto |
| Nome nao disponivel | Amanda |
| Nome nao disponivel | Maria Das Gracas Furlan |

## Impacto

- **LiberacoesTab.tsx**: Nenhuma alteracao necessaria no codigo - ja busca o nome corretamente
- **Outros componentes admin**: Tambem se beneficiarao (UsersTab, LiberarSimuladoModal, etc.)
- **Usuarios normais**: Continuam vendo apenas seus proprios dados

## Seguranca

- A funcao `has_role` ja usa `SECURITY DEFINER`, evitando recursao de RLS
- Apenas usuarios autenticados com role `admin` poderao ver todos os registros
- Usuarios comuns continuam limitados ao proprio perfil

## Arquivos Afetados

Nenhum arquivo de codigo precisa ser alterado - apenas a politica RLS do banco de dados.

