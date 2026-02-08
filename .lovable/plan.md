
# Plano: Lista de Usuarios com Edicao Inline

## Objetivo
Adicionar uma nova secao na aba "Usuarios" do painel de administracao que exibe todos os usuarios cadastrados em uma tabela, permitindo visualizar e editar seus dados diretamente na linha (inline editing).

## Funcionalidades

### 1. Listagem de Usuarios
- Tabela com todas as colunas: Nome, Email, IES, Semestre
- Busca/filtro por nome, email ou IES
- Paginacao para performance (ex: 25 usuarios por pagina)
- Indicador de loading durante carregamento
- Badge indicando role (Admin, Professor, Aluno)

### 2. Edicao Inline
- Clique duplo ou botao "Editar" transforma a linha em modo de edicao
- Campos editaveis: Nome, IES (dropdown), Semestre (input numerico)
- Email e aparece como read-only (nao editavel, pois e identificador unico)
- Botoes "Salvar" e "Cancelar" aparecem durante edicao
- Validacao em tempo real dos campos

### 3. Acoes Disponiveis
- Editar inline (nome, IES, semestre)
- Promover/remover role de admin
- Reenviar email de convite
- Sincronizar autenticacao (integra com funcao existente)

## Arquitetura Tecnica

### Novo Componente: `UsersListTable.tsx`
Componente dedicado para a listagem e edicao de usuarios:

```text
+------------------------------------------------------------------+
| [Buscar usuarios...]                    [Filtrar por IES: Todas] |
+------------------------------------------------------------------+
| Nome           | Email              | IES       | Sem | Acoes    |
+------------------------------------------------------------------+
| Joao Silva     | joao@ex.com        | USCS      | 5   | [Edit]   |
| Maria Santos   | maria@ex.com       | Claretiano| 7   | [Edit]   |
|                                                                  |
| [Em edicao - campos inline]                                      |
| [Input Nome]   | maria@ex.com       | [Select]  |[7] | [✓] [✕]  |
+------------------------------------------------------------------+
| Mostrando 1-25 de 150                       [<] [1] [2] [3] [>]  |
+------------------------------------------------------------------+
```

### Fluxo de Dados

1. **Buscar usuarios**: Query ao Supabase com JOIN na tabela `ies` para obter nome da IES
2. **Buscar roles**: Query separada na tabela `user_roles` para identificar admins
3. **Atualizar usuario**: Reutiliza a edge function `b2b-create-user` (ja suporta UPDATE)
4. **Gerenciar roles**: Query direta na `user_roles` (admin tem permissao via RLS)

### Estado do Componente

```typescript
interface UserRow {
  id: string;
  nome: string;
  email: string;
  id_ies: string | null;
  ies_nome: string | null;
  semestre: number | null;
  roles: string[];
}

interface EditingState {
  userId: string | null;
  nome: string;
  id_ies: string;
  semestre: string;
}
```

### Validacoes
- Nome: minimo 2 caracteres, apenas letras e espacos
- Semestre: numero de 1 a 12
- IES: deve existir na lista

## Arquivos a Criar/Modificar

### 1. Criar: `src/components/admin/UsersListTable.tsx`
Componente principal com:
- Fetch de usuarios com paginacao
- Busca e filtros
- Modo de edicao inline
- Acoes por usuario

### 2. Modificar: `src/components/admin/UsersTab.tsx`
- Adicionar estatisticas reais (total de usuarios, admins)
- Integrar o novo `UsersListTable` acima dos cards existentes
- Reorganizar layout para acomodar a nova secao

## Interface Visual

### Linha Normal
```text
| Nome Completo    | email@exemplo.com | IES Nome | 5  | [Editar] [⋮] |
```

### Linha em Edicao
```text
| [Input: Nome]    | email@exemplo.com | [Select] |[5] | [Salvar] [Cancelar] |
```

### Menu de Acoes (dropdown no botao ⋮)
- Reenviar convite (se nunca confirmou email)
- Sincronizar auth (chama funcao existente)
- Promover a admin / Remover admin

## Consideracoes de Segurança

1. Todas as atualizacoes passam pela edge function `b2b-create-user` que:
   - Verifica se o caller tem role 'admin' via RPC seguro
   - Valida todos os campos com Zod
   - Atualiza `auth.users` e `public.users` de forma atomica

2. Gerenciamento de roles usa RLS da tabela `user_roles`:
   - Apenas admins podem INSERT/UPDATE/DELETE

3. Listagem respeita politica RLS:
   - Admins podem ver todos os usuarios (`has_role(auth.uid(), 'admin')`)

## Beneficios
- Visao completa de todos os usuarios do sistema
- Edicao rapida sem precisar abrir formularios separados
- Busca e filtros para localizar usuarios rapidamente
- Gerenciamento de roles integrado
- Reutiliza infraestrutura existente (edge functions, RLS)
