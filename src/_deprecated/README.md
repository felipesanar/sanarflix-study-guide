# Arquivos Descontinuados

Esta pasta contém código que foi **descontinuado** e removido do fluxo ativo da aplicação, mas mantido para referência histórica e potencial reutilização futura.

## Data da Descontinuação
2026-02-01

## Motivo
Reestruturação do sistema de acesso e permissões, com foco em:
1. Simplificação do modelo de usuários (Admin, Professor, Aluno B2B)
2. Remoção de funcionalidades B2C do fluxo atual
3. Descontinuação de páginas ENAMED e Intensivos

## Arquivos Arquivados

### Páginas (`pages/`)
- **IntensivaoEnamed.tsx** - Cronograma intensivo do ENAMED com calendário e progresso
- **IntensivoEnamedUSCS.tsx** - Versão exclusiva USCS do intensivo ENAMED
- **CronogramaEnamed.tsx** - Cronograma de estudos ENAMED para usuários B2C

### Serviços (`services/`)
- **enamedApi.ts** - API client para conteúdo ENAMED
- **cronogramaEnamedApi.ts** - API client para cronograma ENAMED
- **intensivoUSCSApi.ts** - API client para conteúdo do intensivo USCS

### Componentes (`components/`)
- **CalendarView.tsx** - Componente de visualização de calendário usado nas páginas descontinuadas

## Edge Functions Relacionadas (mantidas no Supabase)
- `supabase/functions/enamed-proxy/` - Proxy para API ENAMED
- `supabase/functions/cronograma-enamed-proxy/` - Proxy para cronograma ENAMED

## Notas
- O código pode conter imports que não funcionarão mais após a descontinuação
- Para reativar qualquer funcionalidade, será necessário revisar dependências e rotas
- Configurações de banco de dados relacionadas (ies_features) também foram removidas
