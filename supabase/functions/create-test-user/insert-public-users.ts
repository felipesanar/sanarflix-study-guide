// Em: supabase/functions/create-test-user/insert-public-users.ts

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

async function inserirOuAtualizarPerfisDoCSV() {
  try {
    const csvData = await Deno.readTextFile('./public_users.csv');
    const perfis = await parse(csvData, {
      skipFirstRow: true,
      columns: ["id", "nome", "cpf", "email", "id_ies", "semestre"],
    });

    console.log(`🚀 Encontrados ${perfis.length} perfis no CSV. Inserindo ou atualizando em public.users...`);

    const perfisParaUpsert = perfis.map(p => ({
      ...p,
      semestre: p.semestre ? parseInt(p.semestre, 10) : null,
      cpf: p.cpf || null,
    }));

    // A MUDANÇA ESTÁ AQUI: usamos .upsert() em vez de .insert()
    const { data, error } = await supabase
      .from('users')
      .upsert(perfisParaUpsert) // Upsert irá inserir novas linhas ou atualizar as existentes
      .select();

    if (error) {
      console.error("❌ Erro detalhado ao fazer upsert:", error);
      throw error;
    }

    console.log(`✅ ${data?.length || 0} perfis inseridos ou atualizados com sucesso em public.users!`);
    console.log("\n🎉 Processo concluído!");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("❌ Erro fatal ao processar o CSV ou inserir dados:", errorMessage);
    Deno.exit(1);
  }
}

// Executa a função principal
await inserirOuAtualizarPerfisDoCSV();