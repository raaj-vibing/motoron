ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS assigned_mechanic_id uuid REFERENCES public.mechanics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_cards_assigned_mechanic_id_idx
  ON public.job_cards(assigned_mechanic_id);