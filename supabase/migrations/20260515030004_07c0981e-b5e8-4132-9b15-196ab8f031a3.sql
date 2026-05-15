
DROP POLICY IF EXISTS "view_customers" ON public.customers;
CREATE POLICY "kiosk_public_read_customers"
ON public.customers
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "view_vehicles" ON public.vehicles;
CREATE POLICY "kiosk_public_read_vehicles"
ON public.vehicles
FOR SELECT
TO anon, authenticated
USING (true);
