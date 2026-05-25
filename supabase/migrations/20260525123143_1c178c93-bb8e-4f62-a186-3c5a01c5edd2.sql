-- Drop any leftover permissive kiosk_public_* policies (no-op if already gone)
DROP POLICY IF EXISTS kiosk_public_read_users ON public.users;
DROP POLICY IF EXISTS kiosk_public_read_customers ON public.customers;
DROP POLICY IF EXISTS kiosk_public_read_vehicles ON public.vehicles;
DROP POLICY IF EXISTS kiosk_public_update_vehicles ON public.vehicles;
DROP POLICY IF EXISTS kiosk_public_insert_vehicles ON public.vehicles;
DROP POLICY IF EXISTS kiosk_public_read_workshops ON public.workshops;
DROP POLICY IF EXISTS kiosk_public_read_job_cards ON public.job_cards;
DROP POLICY IF EXISTS kiosk_public_insert_job_cards ON public.job_cards;
DROP POLICY IF EXISTS kiosk_public_update_job_cards ON public.job_cards;
DROP POLICY IF EXISTS kiosk_public_read_service_packages ON public.service_packages;
DROP POLICY IF EXISTS kiosk_public_read_parts_library ON public.parts_library;
DROP POLICY IF EXISTS kiosk_public_read_job_card_parts ON public.job_card_parts;

-- Belt-and-braces: revoke all table privileges from anon and authenticated.
-- Service role bypasses RLS and these grants entirely, so server functions keep working.
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.customers FROM anon, authenticated;
REVOKE ALL ON public.vehicles FROM anon, authenticated;
REVOKE ALL ON public.workshops FROM anon, authenticated;
REVOKE ALL ON public.job_cards FROM anon, authenticated;
REVOKE ALL ON public.service_packages FROM anon, authenticated;
REVOKE ALL ON public.parts_library FROM anon, authenticated;
REVOKE ALL ON public.job_card_parts FROM anon, authenticated;