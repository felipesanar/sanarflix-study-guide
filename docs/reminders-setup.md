# Configuração do Sistema de Lembretes

## Visão Geral

O sistema de lembretes permite que os alunos recebam notificações por email sobre suas matérias agendadas no calendário de estudos.

## Componentes Implementados

### 1. Banco de Dados
- **Tabela `study_reminders`**: Armazena configurações de lembretes por usuário
  - `user_id`: ID do usuário
  - `enabled`: Se os lembretes estão ativos
  - `reminder_time`: Horário de envio (padrão: 08:00)
  - `days_before`: Dias de antecedência (padrão: 0 = dia atual)
  - `notify_email`: Ativar notificações por email
  - `notify_push`: Ativar notificações push (futura implementação)

### 2. Edge Functions

#### `send-study-reminder`
- **Função**: Envia email de lembrete para um usuário específico
- **Trigger**: Chamada manual ou via `check-and-send-reminders`
- **Autenticação**: Não requerida (pública)
- **Parâmetros**:
  ```json
  {
    "userEmail": "usuario@email.com",
    "userName": "Nome do Usuário",
    "subjects": [
      {
        "name": "Nome da Matéria",
        "day": "Segunda",
        "week": "Semana 1"
      }
    ]
  }
  ```

#### `check-and-send-reminders`
- **Função**: Verifica e envia lembretes para todos os usuários elegíveis
- **Trigger**: Cron job diário (recomendado: 08:00 AM)
- **Autenticação**: Não requerida (pública)
- **Fluxo**:
  1. Busca usuários com lembretes ativos
  2. Verifica matérias agendadas para hoje
  3. Envia email via `send-study-reminder`
  4. Registra logs de sucesso/erro

### 3. Interface do Usuário

#### `ReminderSettings` Component
Localizado em: `src/components/ReminderSettings.tsx`

Permite ao usuário:
- Ativar/desativar lembretes
- Configurar horário de envio
- Escolher tipo de notificação (email/push)
- Testar envio de lembrete

Integrado na página **Dashboard** (`src/pages/Dashboard.tsx`)

## Configuração do Cron Job

### Pré-requisitos
1. Acesse o painel do Supabase: https://supabase.com/dashboard/project/gvqvrmkizemwsasmupmo
2. Vá para **SQL Editor**
3. Habilite as extensões necessárias (se ainda não habilitadas):

```sql
-- Habilitar pg_cron para jobs agendados
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Habilitar pg_net para chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### Criar o Cron Job

Execute o seguinte SQL no **SQL Editor**:

```sql
-- Agendar verificação de lembretes todos os dias às 08:00 (horário UTC)
-- Ajuste o horário conforme necessário para seu timezone
SELECT cron.schedule(
  'check-study-reminders-daily',
  '0 8 * * *', -- Cron expression: às 08:00 AM todos os dias
  $$
  SELECT
    net.http_post(
      url := 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/check-and-send-reminders',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2cXZybWtpemVtd3Nhc211cG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzU1OTksImV4cCI6MjA2OTU1MTU5OX0.8viZ7xflE9Yb4vrKzaaKuMsQFLhr_NgyhrJtnDIFCOU"}'::jsonb,
      body := json_build_object('time', now())::jsonb
    ) AS request_id;
  $$
);
```

### Verificar Cron Jobs Ativos

```sql
-- Listar todos os cron jobs
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### Remover/Atualizar Cron Job

```sql
-- Remover o cron job
SELECT cron.unschedule('check-study-reminders-daily');

-- Depois de remover, você pode criar novamente com novos parâmetros
```

## Expressões Cron Comuns

- `0 8 * * *` - Todos os dias às 08:00 AM
- `0 9 * * 1-5` - Segunda a Sexta às 09:00 AM
- `0 20 * * *` - Todos os dias às 20:00 (8 PM)
- `0 */4 * * *` - A cada 4 horas
- `*/30 * * * *` - A cada 30 minutos

**Nota**: O horário é em UTC. Para horário de Brasília (UTC-3), subtraia 3 horas.
Exemplo: Para executar às 08:00 BRT, use `0 11 * * *` (11:00 UTC)

## Configuração do Resend (Email)

O sistema já está configurado para usar o Resend. Certifique-se de:

1. **Validar o domínio** em: https://resend.com/domains
2. **Verificar a chave da API** `RESEND_API_KEY` está configurada nos secrets do Supabase

## Testando o Sistema

### 1. Teste Manual de Envio de Email

Execute no console do navegador (quando logado):

```javascript
const { data, error } = await supabase.functions.invoke('send-study-reminder', {
  body: {
    userEmail: 'seu-email@example.com',
    userName: 'Seu Nome',
    subjects: [
      { name: 'Anatomia', day: 'Segunda', week: 'Semana 1' },
      { name: 'Fisiologia', day: 'Segunda', week: 'Semana 1' }
    ]
  }
});

console.log(data, error);
```

### 2. Teste do Cron Job

```sql
-- Executar manualmente a função de verificação
SELECT
  net.http_post(
    url := 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/check-and-send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := json_build_object('time', now())::jsonb
  );
```

### 3. Usando o Botão "Enviar Teste"

Na interface do Dashboard:
1. Vá para a seção "Configurações de Lembretes"
2. Clique em "Enviar Teste"
3. Verifique seu email

## Monitoramento

### Ver Logs das Edge Functions

1. Acesse: https://supabase.com/dashboard/project/gvqvrmkizemwsasmupmo/functions/check-and-send-reminders/logs
2. Verifique erros e sucessos de envio

### Ver Logs do Cron

```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'check-study-reminders-daily'
ORDER BY start_time DESC 
LIMIT 20;
```

## Troubleshooting

### Emails não estão sendo enviados

1. **Verificar configurações de lembrete do usuário**:
```sql
SELECT * FROM study_reminders WHERE user_id = 'user-uuid';
```

2. **Verificar arranjos do calendário**:
```sql
SELECT * FROM calendar_arrangements WHERE user_id = 'user-uuid';
```

3. **Verificar logs da edge function**:
   - Acessar painel do Supabase > Functions > Logs

### Cron Job não está executando

1. Verificar se o cron job está ativo:
```sql
SELECT * FROM cron.job WHERE jobname = 'check-study-reminders-daily';
```

2. Verificar últimas execuções:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname = 'check-study-reminders-daily'
ORDER BY start_time DESC;
```

## Próximas Funcionalidades

- [ ] Notificações Push Web
- [ ] Lembretes personalizados por matéria
- [ ] Resumo semanal por email
- [ ] Integração com Google Calendar
- [ ] Estatísticas de engajamento com lembretes
