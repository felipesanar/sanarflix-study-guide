-- Enable Row Level Security on questions_enamed_complement table
ALTER TABLE public.questions_enamed_complement ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read questions complement data
CREATE POLICY "Authenticated users can read questions complement" 
ON public.questions_enamed_complement 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Only allow service_role to modify questions complement data
CREATE POLICY "Only service role can modify questions complement" 
ON public.questions_enamed_complement 
FOR ALL 
USING (auth.role() = 'service_role');