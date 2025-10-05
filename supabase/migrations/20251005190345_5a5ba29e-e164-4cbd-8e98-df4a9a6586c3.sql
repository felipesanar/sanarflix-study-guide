-- Drop the broken function that references non-existent column
DROP FUNCTION IF EXISTS public.get_conteudos_for_user(uuid, integer);

-- We don't need this function anymore since we're querying directly from the table
-- The direct query in the frontend is more efficient and flexible