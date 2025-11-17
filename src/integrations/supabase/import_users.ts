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

        

        // Note: users_public view was removed for security reasons
        // User data is now properly protected in the main users table with RLS policies

      } catch (err) {
        console.error(`❌ Erro inesperado com ${user.email}:`, err);
      }
    }

    
  });
