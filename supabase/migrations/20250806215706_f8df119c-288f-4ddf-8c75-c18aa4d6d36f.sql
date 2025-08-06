-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  email TEXT NOT NULL,
  id_ies UUID NOT NULL REFERENCES public.ies(id),
  semestre INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create secure function to get user's IES ID
CREATE OR REPLACE FUNCTION public.get_current_user_ies_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id_ies FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create secure function to get user's semester
CREATE OR REPLACE FUNCTION public.get_current_user_semester()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT semestre FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Create secure function to get user's faculty name
CREATE OR REPLACE FUNCTION public.get_current_user_faculty()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT i.nome 
  FROM public.profiles p
  JOIN public.ies i ON p.id_ies = i.id
  WHERE p.user_id = auth.uid();
$$;

-- Update conteudos policies to use secure function
DROP POLICY IF EXISTS "Usuários podem ver os conteúdos da sua IES" ON public.conteudos;
CREATE POLICY "Users can view content from their institution" 
ON public.conteudos 
FOR SELECT 
USING (id_ies = get_current_user_ies_id());

-- Add missing policies for conteudos
CREATE POLICY "Admins can insert content" 
ON public.conteudos 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can update content" 
ON public.conteudos 
FOR UPDATE 
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can delete content" 
ON public.conteudos 
FOR DELETE 
USING (auth.role() = 'service_role'::text);

-- Enable RLS on ies table and add policies
ALTER TABLE public.ies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all institutions" 
ON public.ies 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can modify institutions" 
ON public.ies 
FOR ALL 
USING (auth.role() = 'service_role'::text);

-- Remove the old insecure users table and users_public view
DROP TABLE IF EXISTS public.users CASCADE;
DROP VIEW IF EXISTS public.users_public CASCADE;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, id_ies, semestre, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email,
    (NEW.raw_user_meta_data ->> 'id_ies')::UUID,
    (NEW.raw_user_meta_data ->> 'semestre')::INTEGER,
    NEW.raw_user_meta_data ->> 'cpf'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();