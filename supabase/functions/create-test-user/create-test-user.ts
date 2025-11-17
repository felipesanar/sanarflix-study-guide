import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { parse } from "https://deno.land/std@0.208.0/csv/parse.ts";

// Configurações do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.");
  Deno.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

async function criarUsuariosDoCSV() {
  try {
    // NOVO: Array para guardar as senhas dos usuários criados com sucesso.
    const senhasGeradas = [];

    // Lê o arquivo CSV
    const csvData = await Deno.readTextFile('./professores_barao.csv');
    // Faz o parse do CSV (assumindo que a primeira linha é o cabeçalho)
    const usuarios = await parse(csvData, {
      skipFirstRow: true, // Ignora o cabeçalho
      columns: ["nome", "email", "id_ies", "semestre"], // Mapeia as colunas
    });

    

    for (const usuario of usuarios) {
      try {
        

        // Senha padrão (pode ser personalizada)
        const senhaPadrao = "SenhaSegura@" + Math.random().toString(36).slice(2, 6);

        const { data, error } = await supabase.auth.admin.createUser({
          email: usuario.email,
          password: senhaPadrao, // Senha aleatória (ou poderia usar um campo do CSV)
          email_confirm: true, // Confirma o e-mail automaticamente
          user_metadata: {
            full_name: usuario.nome,
            id_ies: usuario.id_ies,
            semestre: usuario.semestre
          }
        });

        if (error) throw error;

        // NOVO: Salva a credencial na lista se o usuário foi criado com sucesso.
        senhasGeradas.push({ email: data.user.email, senha: senhaPadrao });

        
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`❌ Falha ao criar ${usuario.email}:`, errorMessage);
        continue; // Continua mesmo se um usuário falhar
      }
    }

    // NOVO: Bloco para gerar o CSV com as senhas
    if (senhasGeradas.length > 0) {
      
      const csvHeader = "email,senha\n";
      const csvBody = senhasGeradas.map(cred => `${cred.email},${cred.senha}`).join("\n");
      await Deno.writeTextFile('./senhas_geradas.csv', csvHeader + csvBody);
      
      console.warn("🔒 ATENÇÃO: Trate este arquivo com o máximo de segurança e apague-o após o uso.");
    } else {
        
    }
    
    

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ Erro ao processar o CSV:", errorMessage);
    Deno.exit(1);
  }
}

// Executa a função principal
await criarUsuariosDoCSV();