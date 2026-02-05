
# Plano: Correções no Cadastro B2B (Individual e em Lote)

## Resumo das Alterações

Este plano aborda duas correções principais no sistema de cadastro de usuários:

1. **Correção da lógica de admin role**: Documentar corretamente que o ID `9f21b138-0027-44c8-9660-dc6706d57bc0` corresponde à IES "B2B" (não "Sanar")
2. **Transformar cadastro em lote em maquinário de cadastro/update**: Com relatório detalhado de resultados

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/b2b-create-user/index.ts` | Melhorar lógica de update, tratamento de erros detalhado, remover geração de senha |
| `src/components/admin/UsersTab.tsx` | Atualizar UI do cadastro em lote com relatório detalhado |

---

## Mudança 1: Edge Function `b2b-create-user`

### 1.1 Corrigir comentário sobre IES B2B
```typescript
// Antes (linha 154)
if (id_ies === '9f21b138-0027-44c8-9660-dc6706d57bc0') {

// Depois - Corrigir documentação
// Auto-grant admin role for B2B internal users (IES "B2B")
const B2B_IES_ID = '9f21b138-0027-44c8-9660-dc6706d57bc0';
if (id_ies === B2B_IES_ID) {
```

### 1.2 Implementar lógica de Update inteligente

A função deve:
- **Se usuário NÃO existe**: Criar via `inviteUserByEmail` (envia email convite)
- **Se usuário JÁ existe**: Atualizar apenas campos permitidos (semestre) via upsert

### 1.3 Tratamento de Erros Detalhado

Criar enum de códigos de erro para respostas claras:

```typescript
type ErrorCode = 
  | 'VALIDATION_ERROR'      // Dados inválidos (nome, email, semestre fora do range)
  | 'IES_NOT_FOUND'         // IES não existe
  | 'AUTH_CREATE_FAILED'    // Falha ao criar no auth.users
  | 'PROFILE_SYNC_FAILED'   // Criou no auth mas falhou no public.users
  | 'UPDATE_FAILED'         // Falha ao atualizar usuário existente
  | 'RATE_LIMITED'          // Rate limit do Supabase
  | 'INTERNAL_ERROR';       // Erro inesperado
```

### 1.4 Response estruturada

```typescript
interface SuccessResponse {
  success: true;
  action: 'created' | 'updated';
  userId: string;
  email: string;
  message: string;
  details?: {
    emailSent: boolean;      // true se email convite foi enviado
    fieldsUpdated?: string[]; // ex: ['semestre'] para updates
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: string;
}
```

---

## Mudança 2: Frontend `UsersTab.tsx`

### 2.1 Interface de Resultados Melhorada

```typescript
interface BatchResult {
  email: string;
  nome: string;
  success: boolean;
  action?: 'created' | 'updated' | 'skipped';
  error?: {
    code: string;
    message: string;
  };
}

interface BatchReport {
  total: number;
  created: number;
  updated: number;
  errors: number;
  skipped: number;
  results: BatchResult[];
  startedAt: Date;
  finishedAt: Date;
  duration: string;
}
```

### 2.2 UI do Relatório Final

Ao terminar o processamento, exibir:

```text
╔══════════════════════════════════════════════════════╗
║           📊 RELATÓRIO DE PROCESSAMENTO              ║
╠══════════════════════════════════════════════════════╣
║  Total processados:  150                             ║
║  ✅ Criados:         120  (email convite enviado)    ║
║  🔄 Atualizados:      25  (semestre atualizado)      ║
║  ⚠️  Erros:            5                             ║
║  ⏭️  Ignorados:         0                             ║
║  ⏱️  Duração:         2m 34s                          ║
╚══════════════════════════════════════════════════════╝
```

### 2.3 Cards de Resumo com Cores

- **Verde**: Criados (novos usuários)
- **Azul**: Atualizados (semestre alterado)
- **Vermelho**: Erros (com lista clicável para ver detalhes)
- **Cinza**: Ignorados (linhas inválidas no CSV)

### 2.4 Lista de Erros Detalhada

Para cada erro, mostrar:
- Email do usuário
- Código do erro
- Mensagem descritiva
- Linha do CSV (para fácil localização)

### 2.5 Download do Relatório

Botão para baixar CSV com todas as informações:
```csv
email,nome,status,acao,erro_codigo,erro_mensagem,linha_csv
joao@test.com,João Silva,sucesso,created,,,2
maria@test.com,Maria Santos,sucesso,updated,,,3
pedro@test.com,Pedro Souza,erro,,VALIDATION_ERROR,Semestre inválido,4
```

### 2.6 Remover campos de senha

- Remover `generatePassword()` e `generatedPassword` state
- Remover UI de exibição de senha gerada
- Atualizar textos para indicar que "email convite será enviado"

---

## Fluxo Completo do Cadastro em Lote

```text
1. Admin faz upload do CSV
   ↓
2. Validação do formato do CSV
   ├─ Colunas obrigatórias: nome, email, id_ies, semestre
   └─ Se inválido → erro imediato
   ↓
3. Para cada linha:
   ├─ Validar dados (Zod)
   │   └─ Se inválido → adiciona ao relatório como erro
   ├─ Verificar se email já existe
   │   ├─ NÃO existe → inviteUserByEmail (cria + envia email)
   │   └─ JÁ existe → updateUserById + upsert (atualiza semestre)
   └─ Registrar resultado
   ↓
4. Exibir relatório completo
   ↓
5. Opção de baixar CSV com resultados
```

---

## Tratamento de Erros Específicos

| Cenário | Código | Mensagem | Ação |
|---------|--------|----------|------|
| Email inválido | `VALIDATION_ERROR` | "Email inválido: xxx" | Pular linha |
| Semestre < 1 ou > 12 | `VALIDATION_ERROR` | "Semestre deve ser entre 1 e 12" | Pular linha |
| Nome muito curto | `VALIDATION_ERROR` | "Nome deve ter pelo menos 2 caracteres" | Pular linha |
| IES não existe | `IES_NOT_FOUND` | "IES não encontrada: xxx" | Pular linha |
| Rate limit | `RATE_LIMITED` | "Limite de requisições excedido, aguarde" | Pausar e retry |
| Email duplicado no CSV | `SKIPPED` | "Email já processado neste lote" | Pular linha |

---

## Seção Técnica

### Edge Function - Estrutura Final

```typescript
// b2b-create-user/index.ts

const B2B_IES_ID = '9f21b138-0027-44c8-9660-dc6706d57bc0';

// 1. Validar IES existe
const { data: iesExists } = await supabaseAdmin
  .from('ies')
  .select('id')
  .eq('id', id_ies)
  .single();

if (!iesExists) {
  return errorResponse('IES_NOT_FOUND', `IES não encontrada: ${id_ies}`);
}

// 2. Verificar se usuário existe
const { data: existingUser } = await supabaseAdmin
  .from('users')
  .select('id, semestre')
  .eq('email', email.toLowerCase())
  .single();

if (existingUser) {
  // UPDATE flow
  const fieldsUpdated: string[] = [];
  
  if (existingUser.semestre !== semestre) {
    fieldsUpdated.push('semestre');
  }
  
  // Atualiza auth metadata
  await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
    user_metadata: { full_name: nome, id_ies, semestre }
  });
  
  // Atualiza public.users
  await supabaseAdmin.from('users').update({
    nome,
    id_ies,
    semestre
  }).eq('id', existingUser.id);
  
  return successResponse('updated', existingUser.id, email, fieldsUpdated);
} else {
  // CREATE flow - usa inviteUserByEmail
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: nome, id_ies, semestre, must_change_password: true },
    redirectTo: redirectUrl
  });
  
  if (error) {
    return errorResponse('AUTH_CREATE_FAILED', error.message);
  }
  
  // Upsert no public.users
  await supabaseAdmin.from('users').upsert({
    id: data.user.id,
    email,
    nome,
    id_ies,
    semestre
  });
  
  // Auto-grant admin para IES B2B
  if (id_ies === B2B_IES_ID) {
    await supabaseAdmin.from('user_roles').upsert({
      user_id: data.user.id,
      role: 'admin',
      granted_by: callerUserId
    });
  }
  
  return successResponse('created', data.user.id, email, undefined, true);
}
```

### Frontend - Componente de Relatório

```typescript
// Novo componente: BatchProcessingReport.tsx

interface BatchProcessingReportProps {
  report: BatchReport;
  onDownload: () => void;
  onClose: () => void;
}

// Exibe cards de resumo + tabela de detalhes + botão download
```

---

## Resultado Esperado

1. **Cadastro individual**: Funciona como antes, com mensagem clara "Email convite enviado"
2. **Cadastro em lote**:
   - Cria novos usuários (envia email convite)
   - Atualiza usuários existentes (semestre)
   - Relatório visual claro ao final
   - Download de CSV com todos os resultados
   - Tratamento de erros granular e informativo
3. **Admin role**: Automaticamente concedido para IES "B2B" (documentado corretamente)
