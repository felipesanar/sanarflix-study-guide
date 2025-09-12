-- Add Row Level Security policies to users_basic table
-- This table contains sensitive user information and needs protection

-- Policy to allow users to view only their own basic data
CREATE POLICY "Users can view their own basic data" 
ON public.users_basic 
FOR SELECT 
USING (auth.uid() = id);

-- Policy to allow service role (admin) to view all basic user data
CREATE POLICY "Service role can view all basic user data" 
ON public.users_basic 
FOR SELECT 
USING (auth.role() = 'service_role');

-- Since this appears to be a read-only view/table for basic user info,
-- we'll only add SELECT policies. If INSERT/UPDATE/DELETE are needed later,
-- they should be added with proper validation.