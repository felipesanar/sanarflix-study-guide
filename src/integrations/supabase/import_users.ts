import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type UsuarioCSV = {
  email: string;
  password: string;
  nome: string;
  id_ies: string;
  semestre: string;
};

const usuarios: UsuarioCSV[] = [];

fs.createReadStream('usuarios.csv')
  .pipe(csv())
  .on('data', (row) => {
    usuarios.push(row);
  })
  .on('end', async () => {
    console.log(`📥 ${usuarios.length} usuários lidos do CSV`);

    for (const user of usuarios) {
      try {
        // Cria o usuário no auth
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            nome: user.nome,
            id_ies: user.id_ies,
            semestre: user.semestre
          }
        });

        if (error || !data?.user) {
          console.error(`❌ Erro ao criar ${user.email}: ${error?.message}`);
          continue;
        }

        console.log(`✅ Usuário criado: ${user.email}`);

        // Insere os dados na tabela users_public
        const { error: insertError } = await supabase.from('users_public').insert({
          id: data.user.id,
          email: user.email,
          nome: user.nome,
          id_ies: user.id_ies,
          semestre: user.semestre
        });

        if (insertError) {
          console.error(`⚠️ Erro ao inserir em users_public: ${insertError.message}`);
        } else {
          console.log(`↳ Dados inseridos em users_public: ${user.email}`);
        }

      } catch (err) {
        console.error(`❌ Erro inesperado com ${user.email}:`, err);
      }
    }

    console.log('🏁 Importação finalizada.');
  });
