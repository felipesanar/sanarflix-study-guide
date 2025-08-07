import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

// Função para gerar uma senha temporária
const generateHumanReadablePassword = (length = 8) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// --- Configuração do cliente Supabase ---
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceKey) {
  console.error("Erro: As variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

console.log("🚀 Iniciando migração de usuários (versão corrigida)...");

try {
  // 1. Buscar todos os usuários da sua tabela pública original
  const { data: publicUsers, error: fetchError } = await supabase
    .from('users')
    .select('email, nome, cpf, id_ies, semestre'); // Adicione outros campos que queira manter

  if (fetchError) {
    throw new Error(`Erro ao buscar usuários de public.users: ${fetchError.message}`);
  }

  if (!publicUsers || publicUsers.length === 0) {
    console.log("Nenhum usuário encontrado em public.users para migrar.");
    Deno.exit(0);
  }

  console.log(`Encontrados ${publicUsers.length} usuários para processar.`);

  const passwordsForAdmins: { email: string; temporary_password: string }[] = [];
  let successCount = 0;
  let skippedCount = 0;
  const errorDetails = [];

  for (const user of publicUsers) {
    console.log(`---------------------------------`);
    console.log(`Processando: ${user.email}`);

    try {
      // Gera a senha temporária ANTES de tentar criar o usuário
      const temporaryPassword = generateHumanReadablePassword();

      // **A LÓGICA CORRIGIDA ESTÁ AQUI**
      // 2. Tenta criar o usuário diretamente no auth.users
      const { data: { user: newAuthUser }, error: createError } = await supabase.auth.admin.createUser({
        email: user.email.toLowerCase(),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { 
          must_change_password: true,
          full_name: user.nome 
        },
      });

      // Se a criação falhar, o erro será capturado pelo bloco catch abaixo
      if (createError) {
        throw createError;
      }
      
      console.log(`✅ Usuário criado no auth.users com ID: ${newAuthUser.id}`);
      
      // Adiciona a senha à lista para o arquivo CSV
      passwordsForAdmins.push({
        email: user.email,
        temporary_password: temporaryPassword,
      });

      // O trigger no banco de dados cuidará da criação/atualização do perfil em public.users
      
      successCount++;

    } catch (e) {
      // Se o erro for "User already registered", é o que esperamos! Apenas pulamos.
      if (e.message.includes("User already registered")) {
        console.log("Utilizador já existe no auth.users. Pulando.");
        skippedCount++;
      } else {
        // LOG MELHORADO: Imprime a mensagem E o objeto de erro completo.
        console.error(`❌ Erro inesperado ao processar ${user.email}: ${e.message}`);
        console.error("   Objeto de erro completo:", e); // Esta nova linha pode dar mais pistas.
        errorDetails.push({ email: user.email, error: e.message });
      }
    }
  }

  // 4. Salva o arquivo CSV com as senhas para a empresa
  if (passwordsForAdmins.length > 0) {
    const csvHeader = "email,temporary_password\n";
    const csvBody = passwordsForAdmins.map(p => `${p.email},${p.temporary_password}`).join("\n");
    await Deno.writeTextFile("./senhas_temporarias.csv", csvHeader + csvBody);
    console.log("\n✅ Arquivo 'senhas_temporarias.csv' gerado com sucesso!");
    console.log("🔒 ATENÇÃO: Trate este arquivo com o máximo de segurança e apague-o após a comunicação com os usuários.");
  }

  console.log(`\n🎉 Migração concluída!`);
  console.log(`- ${successCount} novos usuários migrados com sucesso.`);
  console.log(`- ${skippedCount} usuários já existiam e foram pulados.`);
  if (errorDetails.length > 0) {
    console.log(`- ${errorDetails.length} usuários falharam por outros motivos.`);
    console.log("Detalhes dos erros:", errorDetails);
  }

} catch (e) {
  console.error("Um erro fatal ocorreu durante a migração:", e);
  Deno.exit(1);
}