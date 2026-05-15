
DROP POLICY IF EXISTS "update_vehicles" ON public.vehicles;
CREATE POLICY "kiosk_public_update_vehicles"
ON public.vehicles
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
