import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

// --- DADOS DO SEU USUÁRIO DE TESTE (Altere aqui) ---
const TEST_USER_EMAIL = "aluno.teste@email.com";
const TEST_USER_PASSWORD = "senha-forte-e-segura";
const TEST_USER_NAME = "Aluno Teste Script";
// ----------------------------------------------------

console.log("🚀 Tentando criar um usuário de teste com metadados...");

// Carrega as variáveis de ambiente (URL e Service Key)
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.");
  Deno.exit(1);
}

// Inicializa o cliente com a chave de serviço para ter privilégios de admin
const supabase = createClient(supabaseUrl, serviceKey);

try {
  // Usa a função de admin para criar o usuário, passando os metadados
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true, // Já cria o usuário como confirmado
    user_metadata: {
      full_name: TEST_USER_NAME // <-- ESTA É A PARTE IMPORTANTE!
    }
  });

  if (error) {
    // Se der erro, joga para o bloco catch
    throw error;
  }

  console.log("✅ Usuário de teste criado com sucesso!");
  console.log("Email:", data.user.email);
  console.log("ID:", data.user.id);
  console.log("Verifique o painel do Supabase em Authentication e na sua tabela 'users'.");

} catch (error) {
  console.error("❌ Falha ao criar o usuário de teste:", error.message);
}