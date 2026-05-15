
-- Allow public (anon) read access to users table for kiosk PIN login.
-- The kiosk uses direct table queries with the publishable key, no Supabase Auth.
CREATE POLICY "kiosk_public_read_users"
ON public.users
FOR SELECT
TO anon, authenticated
USING (true);
