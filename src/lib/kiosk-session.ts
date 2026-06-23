// Client-safe re-exports for the kiosk session.
// All actual session state lives in an httpOnly cookie set by server functions.
// This file only re-exports the DTO type used by client components.
export type KioskUser = {
  id: string;
  name: string;
  access_level: string;
  role: string;
  workshop_id: string;
  email: string | null;
  phone: string | null;
  status: string | null;
};
// ── MECHANICS ──────────────────────────────────────────────

export type MechanicDTO = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export const listMechanics = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireSessionUser();
  const { data, error } = await supabaseAdmin
    .from("mechanics")
    .select("id, name, is_active, sort_order")
    .eq("workshop_id", user.workshop_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Failed to load mechanics");
  return (data ?? []) as MechanicDTO[];
});

export const createMechanic = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { data: existing } = await supabaseAdmin
      .from("mechanics")
      .select("sort_order")
      .eq("workshop_id", user.workshop_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (existing?.sort_order ?? 0) + 1;
    const { data: row, error } = await supabaseAdmin
      .from("mechanics")
      .insert({
        workshop_id: user.workshop_id,
        name: data.name,
        sort_order: nextOrder,
      })
      .select("id, name, is_active, sort_order")
      .single();
    if (error || !row) throw new Error("Failed to create mechanic");
    return row as MechanicDTO;
  });

export const updateMechanic = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.is_active !== undefined) updates.is_active = data.is_active;
    const { error } = await supabaseAdmin
      .from("mechanics")
      .update(updates)
      .eq("id", data.id)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error("Failed to update mechanic");
    return { ok: true as const };
  });

export const deleteMechanic = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("mechanics")
      .delete()
      .eq("id", data.id)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error("Failed to delete mechanic");
    return { ok: true as const };
  });
