#!/bin/bash

# --- CONFIGURAÇÃO OBRIGATÓRIA ---
# Coloque o ID do seu projeto (ex: obhkc... ou o que apareceu no seu deploy)
PROJECT_REF="gvqvrmkizemwsasmupmo" 

# Coloque a chave service_role (começa com eyJhbGc...)
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2cXZybWtpemVtd3Nhc211cG1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NTU5OSwiZXhwIjoyMDY5NTUxNTk5fQ.-ARFL-wKUtOO712C2mmFLMakWh7Hgt0g_T-ZfjShuxk"

# Monta a URL automaticamente
FUNCTION_URL="https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/old-user-creation"

# --- USUÁRIO 1 ---
echo "Processando Usuário 1..."
curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "nome": "Thomas Pécora Macarenco",
    "email": "8161772@souclaretiano.edu.br",
    "id_ies": "6029b69d-a2ef-4de5-b907-91f88122bb4e",
    "semestre": 9
  }'

echo -e "\n\n-----------------------------------"

# --- USUÁRIO 2 ---
echo "Processando Usuário 2..."
curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{
    "nome": "Ana Beatriz Donadi",
    "email": "8168028@souclaretiano.edu.br",
    "id_ies": "6029b69d-a2ef-4de5-b907-91f88122bb4e",
    "semestre": 9
  }'

echo -e "\n\nConcluído! COPIE AS SENHAS ACIMA."