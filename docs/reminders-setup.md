# Configuração do Sistema de Lembretes

## Visão Geral

O sistema de lembretes permite que os alunos recebam notificações por email e push sobre suas matérias agendadas no calendário de estudos.

## Como Funciona

1. **Configuração pelo Usuário**: Na página de Dashboard, o usuário configura:
   - Horário desejado para receber lembretes (exemplo: 08:00)
   - Tipo de notificação: Email e/ou Push
   - Ativar/desativar lembretes

2. **Verificação Automática**: Um cron job executa a cada minuto a função `check-and-send-reminders` que:
   - Usa o **fuso horário de Brasília (America/Sao_Paulo)**
   - Busca usuários com lembretes configurados para o horário exato (hora:minuto)
   - Verifica se há matérias agendadas para o dia atual no calendário do usuário
   - Envia notificações (email e/ou push) apenas para usuários que têm matérias agendadas no dia

3. **Tipos de Notificação**:
   - **Email**: Enviado via Resend com lista de matérias do dia
   - **Push**: Notificação no navegador (quando habilitado pelo usuário)

4. **Fuso Horário**: Todas as verificações e envios seguem o horário de **Brasília (GMT-3)**

## Componentes Implementados

### 1. Banco de Dados
- **Tabela `study_reminders`**: Armazena configurações de lembretes por usuário
  - `user_id`: ID do usuário
  - `enabled`: Se os lembretes estão ativos
  - `reminder_time`: Horário de envio (padrão: 08:00)
  - `days_before`: Dias de antecedência (padrão: 0 = dia atual)
  - `notify_email`: Ativar notificações por email
  - `notify_push`: Ativar notificações push

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
- **Função**: Verifica e envia lembretes para usuários no horário exato configurado
- **Trigger**: Cron job a cada minuto
- **Autenticação**: Não requerida (pública)
- **Fuso Horário**: Brasília (America/Sao_Paulo)
- **Fluxo**:
  1. Obtém horário atual de Brasília (hora e minuto)
  2. Busca usuários com lembretes ativos configurados para o horário exato (hora:minuto:00)
  3. Verifica matérias agendadas para hoje no calendário de cada usuário
  4. Envia email (se `notify_email = true`)
  5. Envia push (se `notify_push = true`)
  6. Registra logs detalhados de execução

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

### ⚠️ AÇÃO MANUAL NECESSÁRIA ⚠️

Você precisa configurar o cron job no Supabase para executar **A CADA MINUTO** para garantir que os lembretes sejam enviados no horário exato configurado pelo usuário.

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

### Remover Cron Job Antigo (se existir)

Se você já tinha um cron job configurado para executar a cada hora, remova-o primeiro:

```sql
-- Remover o cron job antigo
SELECT cron.unschedule('check-study-reminders-hourly');
```

### Criar o Novo Cron Job (A CADA MINUTO)

Execute o seguinte SQL no **SQL Editor**:

```sql
-- Agendar verificação de lembretes A CADA MINUTO
-- O edge function envia notificações apenas para usuários cujo horário configurado 
-- corresponde EXATAMENTE ao minuto atual (hora:minuto)
SELECT cron.schedule(
  'check-study-reminders-minutely',
  '* * * * *', -- Executa a cada minuto
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

**Importante**: O edge function agora verifica o horário exato (hora:minuto) configurado pelo usuário no fuso de Brasília e envia notificações apenas quando há correspondência exata.

### Verificar Cron Jobs Ativos

```sql
-- Listar todos os cron jobs (anote o jobid)
SELECT jobid, schedule, command, nodename, nodeport, database, username, active 
FROM cron.job;

-- Ver histórico de execuções (substitua 1 pelo jobid correto)
SELECT * FROM cron.job_run_details 
WHERE jobid = 1
ORDER BY start_time DESC 
LIMIT 10;
```

### Remover/Atualizar Cron Job

```sql
-- Remover o cron job que executa a cada minuto
SELECT cron.unschedule('check-study-reminders-minutely');

-- Depois de remover, você pode criar novamente com novos parâmetros
```

## Expressões Cron Comuns

- `* * * * *` - A cada minuto ✅ **USADO ATUALMENTE**
- `*/5 * * * *` - A cada 5 minutos
- `*/30 * * * *` - A cada 30 minutos
- `0 * * * *` - A cada hora (minuto 0)
- `0 8 * * *` - Todos os dias às 08:00 AM
- `0 9 * * 1-5` - Segunda a Sexta às 09:00 AM
- `0 20 * * *` - Todos os dias às 20:00 (8 PM)

**Nota sobre Fuso Horário e Precisão**: 
- O cron job executa em **UTC** a cada minuto
- O edge function processa tudo em **horário de Brasília (GMT-3)**
- Usuário configura horário em Brasília com precisão de minuto (exemplo: 08:30 BRT)
- O sistema envia **EXATAMENTE** às 08:30 BRT, independente do horário UTC
- A verificação é feita comparando hora:minuto:00 configurado com hora:minuto:00 atual em Brasília

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
-- Primeiro encontre o jobid
SELECT jobid FROM cron.job LIMIT 1;

-- Depois use o jobid para ver os logs
SELECT * FROM cron.job_run_details 
WHERE jobid = 1  -- Substitua pelo jobid encontrado
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
SELECT * FROM cron.job;
```

2. Verificar últimas execuções (substitua 1 pelo jobid correto):
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = 1
ORDER BY start_time DESC;
```

## Próximas Funcionalidades

- [x] Notificações Push Web
- [ ] Lembretes personalizados por matéria
- [ ] Resumo semanal por email
- [ ] Integração com Google Calendar
- [ ] Estatísticas de engajamento com lembretes
