-- Criar tabela de usuários com senhas em hash
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  faculty TEXT NOT NULL,
  semester INTEGER NOT NULL,
  requires_password_change BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Política para permitir login (select sem autenticação via edge function)
CREATE POLICY "Allow login verification" 
ON public.users 
FOR SELECT 
USING (true);

-- Política para usuários autenticados atualizarem sua própria senha
CREATE POLICY "Users can update their own password" 
ON public.users 
FOR UPDATE 
USING (email = current_setting('request.jwt.claims', true)::json->>'email')
WITH CHECK (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_users()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_users();

-- Inserir usuários mockados (usando bcrypt hash para senha '123456')
INSERT INTO public.users (email, password_hash, name, faculty, semester, requires_password_change) VALUES
('estudante@medicina.com', '$2b$10$rN8QqJHKg.Zh8gMBJ8YhVuD1h3l6FZ8eJ6bQgV7XwZ4wYJZ4qC8WG', 'Ana Silva', 'Claretiano', 3, true),
('admin@medicina.com', '$2b$10$rN8QqJHKg.Zh8gMBJ8YhVuD1h3l6FZ8eJ6bQgV7XwZ4wYJZ4qC8WG', 'Dr. João Santos', 'FUNEPE', 12, false);