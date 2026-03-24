-- Create user_exams table for multi-exam tracking
CREATE TABLE public.user_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  materia TEXT NOT NULL,
  exam_name TEXT NOT NULL DEFAULT 'Prova',
  exam_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, materia, exam_date)
);

-- Enable RLS
ALTER TABLE public.user_exams ENABLE ROW LEVEL SECURITY;

-- Users can manage their own exams
CREATE POLICY "Users can view own exams"
  ON public.user_exams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exams"
  ON public.user_exams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exams"
  ON public.user_exams FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exams"
  ON public.user_exams FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_exams_updated_at
  BEFORE UPDATE ON public.user_exams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();