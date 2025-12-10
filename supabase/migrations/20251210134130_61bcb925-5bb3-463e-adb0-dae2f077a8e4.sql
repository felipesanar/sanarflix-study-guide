-- Fix overly permissive RLS policy on ies_branding table
-- The current policy allows ANY authenticated user to edit branding
-- It should only allow admins

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Admins podem editar branding" ON ies_branding;

-- Create proper admin-only policy using has_role() function
CREATE POLICY "Admins podem editar branding" ON ies_branding
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));