-- 1) Restrict access to sensitive columns on users table.
-- The view_users RLS policy allows any workshop member to read all users;
-- revoke column-level SELECT on pin/email/phone so they are not returned
-- via PostgREST/Supabase clients. Server code uses the service role and
-- is unaffected.
REVOKE SELECT (pin, email, phone) ON public.users FROM anon, authenticated;

-- 2) Harden manage_users UPDATE policy with a WITH CHECK clause so
-- admins cannot escalate another user's privileges or move a row to
-- another workshop on update.
DROP POLICY IF EXISTS manage_users ON public.users;
CREATE POLICY manage_users ON public.users
  FOR UPDATE
  USING (
    (workshop_id IN (
      SELECT users_1.workshop_id FROM public.users users_1
      WHERE users_1.id = auth.uid() AND users_1.access_level = 'full-admin'
    )) AND id <> auth.uid()
  )
  WITH CHECK (
    (workshop_id IN (
      SELECT users_1.workshop_id FROM public.users users_1
      WHERE users_1.id = auth.uid() AND users_1.access_level = 'full-admin'
    )) AND id <> auth.uid()
  );

-- 3) Revoke EXECUTE on SECURITY DEFINER helpers from public roles.
-- These are internal helpers and must not be callable by anon/authenticated
-- via PostgREST.
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;
