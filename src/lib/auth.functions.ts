import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WORKSHOP_ID = "a1b2c3d4-0000-0000-0000-000000000001";

export const listKioskUsers = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, role, access_level, status")
      .eq("workshop_id", WORKSHOP_ID)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const verifyPin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      pin: z.string().min(4).max(8).regex(/^\d+$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("users")
      .select("id, pin, workshop_id")
      .eq("id", data.userId)
      .eq("workshop_id", WORKSHOP_ID)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const };
    return { ok: row.pin === data.pin };
  });
