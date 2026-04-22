

# Criar IES "FAI"

Não existe nenhuma IES cadastrada com o nome "FAI". Vou inserir um novo registro na tabela `ies`.

## Alteração
- **Tabela:** `public.ies`
- **Operação:** `INSERT` (dados, não schema) — usando a ferramenta de inserção do Supabase.
- **Registro:** `{ nome: 'FAI' }` (o `id` é gerado automaticamente via `gen_random_uuid()`).

## SQL a executar
```sql
INSERT INTO public.ies (nome) VALUES ('FAI');
```

## Observações
- Nenhum efeito colateral: a tabela `ies` não tem FKs e é lida publicamente (RLS permite `SELECT` a todos).
- Após inserir, a nova IES aparecerá automaticamente nos dropdowns de admin (cadastro de usuários, simulados, conteúdos, avisos, etc.).
- Nenhuma feature será habilitada por padrão em `ies_features` — se quiser liberar módulos específicos (home, simulados, sanarclass etc.) para FAI, me avise em seguida.

## Critério de aceite
- [ ] `SELECT id, nome FROM ies WHERE nome = 'FAI'` retorna 1 linha.

