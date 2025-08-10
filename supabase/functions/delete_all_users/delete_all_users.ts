import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

// Inicialização do cliente Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.");
  Deno.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

async function deleteAllAuthUsers() {
  console.warn("⚠️ ATENÇÃO: Esta ação vai apagar TODOS os usuários do Supabase Auth.");
  console.warn("Isso é IRREVERSÍVEL.");
  
  // Passo de confirmação para evitar execução acidental
  const confirmation = prompt("Você tem ABSOLUTA CERTEZA que quer continuar? Digite 'apagar tudo' para confirmar:");
  
  if (confirmation !== 'apagar tudo') {
    console.log("❌ Operação cancelada pelo usuário.");
    return;
  }

  console.log("🚀 Iniciando exclusão de todos os usuários...");

  try {
    let page = 1;
    let usersOnPage;
    let totalDeletedCount = 0;

    // NOVO: Loop que lida com paginação
    do {
      // Busca uma página de usuários (até 1000 por vez)
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: 1000,
      });

      if (listError) {
        throw new Error(`Erro ao listar usuários na página ${page}: ${listError.message}`);
      }
      
      usersOnPage = users;

      if (usersOnPage && usersOnPage.length > 0) {
        console.log(`- Encontrados ${usersOnPage.length} usuários na página ${page}. Apagando...`);
        
        for (const user of usersOnPage) {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
          
          if (deleteError) {
            console.error(`  ❌ Falha ao apagar ${user.email}:`, deleteError.message);
          } else {
            totalDeletedCount++;
          }
        }
        page++; // Prepara para buscar a próxima página
      }

    } while (usersOnPage && usersOnPage.length > 0); // Continua enquanto houver usuários na página atual
    
    console.log(`\n🎉 Processo concluído! ${totalDeletedCount} usuários foram apagados.`);

  } catch (error) {
    console.error("Um erro fatal ocorreu durante a exclusão:", error);
    Deno.exit(1);
  }
}

await deleteAllAuthUsers();