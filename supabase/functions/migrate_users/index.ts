import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

// Função para gerar uma senha temporária (sem alterações aqui)
const generateHumanReadablePassword = (length = 8)=>{
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for(let i = 0; i < length; i++){
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// --- Configuração do cliente Supabase --- (sem alterações aqui)
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceKey) {
  console.error("Erro: As variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.");
  Deno.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

 

try {
  // 1. Buscar todos os usuários da sua tabela PÚBLICA original
  const { data: publicUsers, error: fetchError } = await supabase
    .from('users')
    .select('email, nome'); // Adicione outros campos se precisar deles no user_metadata

  if (fetchError) {
    throw new Error(`Erro ao buscar usuários de public.users: ${fetchError.message}`);
  }

  if (!publicUsers || publicUsers.length === 0) {
    Deno.exit(0);
  }

  const passwordsForAdmins = [];
  let successCount = 0;
  let skippedCount = 0;
  const errorDetails = [];

  // ######### INÍCIO DA MODIFICAÇÃO PRINCIPAL #########
  for (const user of publicUsers){

    try {
      // ETAPA 1: CRIAR O USUÁRIO NO SISTEMA DE AUTENTICAÇÃO
      const temporaryPassword = generateHumanReadablePassword();
      const { data: { user: newAuthUser }, error: createError } = await supabase.auth.admin.createUser({
        email: user.email.toLowerCase(),
        password: temporaryPassword,
        email_confirm: true, // Já marca o email como confirmado
        user_metadata: {
          must_change_password: true,
          full_name: user.nome,
        }
      });

      // Se o erro for "User already registered", pulamos a criação e o vínculo.
      if (createError) {
        if (createError.message.includes("User already registered")) {
          skippedCount++;
          continue; // Pula para o próximo usuário do loop
        }
        // Se for outro erro de criação, lança para o catch principal
        throw createError;
      }

      if (!newAuthUser) {
        throw new Error('Failed to create user in auth');
      }
      
      

      // ETAPA 2: VINCULAR O PERFIL EXISTENTE NA TABELA 'public.users'
      // Esta é a etapa crucial que resolve o problema do trigger.
      const { error: updateError } = await supabase
        .from('users') // Tabela de perfis
        .update({ id: newAuthUser.id }) // Define a coluna 'id' para ser igual ao id do auth.user
        .eq('email', user.email.toLowerCase()); // Encontra o perfil correto pelo email

      if (updateError) {
        // Se a atualização falhar, é um erro grave e precisamos saber.
        throw new Error(`Falha ao VINCULAR o perfil para ${user.email}: ${updateError.message}`);
      }

      

      // Adiciona a senha à lista para o arquivo CSV
      passwordsForAdmins.push({
        email: user.email,
        temporary_password: temporaryPassword
      });
      successCount++;

    } catch (e) {
      // O catch agora pega erros tanto da criação quanto do vínculo.
      const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido';
      console.error(`❌ Erro inesperado ao processar ${user.email}: ${errorMessage}`);
      errorDetails.push({
        email: user.email,
        error: errorMessage
      });
    }
  }
  // ######### FIM DA MODIFICAÇÃO PRINCIPAL #########


  // O resto do arquivo continua igual para gerar o CSV e reportar os resultados
  if (passwordsForAdmins.length > 0) {
    const csvHeader = "email,temporary_password\n";
    const csvBody = passwordsForAdmins.map((p)=>`${p.email},${p.temporary_password}`).join("\n");
    await Deno.writeTextFile("./senhas_temporarias.csv", csvHeader + csvBody);
    
  }

  
  if (errorDetails.length > 0) {
    
  }

} catch (e) {
  console.error("Um erro fatal ocorreu durante a migração:", e);
  Deno.exit(1);
}