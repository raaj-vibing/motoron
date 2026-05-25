// Thin server-function wrappers. Helpers + supabaseAdmin live in kiosk.server.ts
// to keep this module client-import safe (per tanstack-supabase-import-graph).
import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  WORKSHOP_ID,
  readSessionUser,
  requireSessionUser,
  sessionConfig,
  type KioskUserDbRow,
  type SessionData,
} from "./kiosk.server";

export type KioskUserDTO = Omit<KioskUserDbRow, never>;

// --- Public: list users for the login picker (no PIN exposed) ---
export const listKioskUsers = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .eq("workshop_id", WORKSHOP_ID)
      .eq("status", "active")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string }[];
  },
);

// --- Public: verify PIN, set sealed httpOnly session cookie ---
const verifyPinSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
});

export const verifyPin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifyPinSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("users")
      .select("id, name, access_level, role, workshop_id, email, phone, status, pin")
      .eq("id", data.userId)
      .eq("workshop_id", WORKSHOP_ID)
      .eq("status", "active")
      .maybeSingle();

    if (error || !row || row.pin !== data.pin) {
      // Constant-ish delay to slow brute force on a 4-digit space.
      await new Promise((r) => setTimeout(r, 250));
      return { ok: false as const };
    }

    const session = await useSession<SessionData>(sessionConfig());
    await session.update({ userId: row.id });

    const { pin: _pin, ...safe } = row;
    return { ok: true as const, user: safe as KioskUserDTO };
  });

// --- Public: who am I? Returns null when no/expired cookie ---
export const getCurrentKioskUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<KioskUserDTO | null> => {
    return await readSessionUser();
  },
);

// --- Public: clear session ---
export const logoutKiosk = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await useSession<SessionData>(sessionConfig());
    await session.clear();
    return { ok: true as const };
  },
);

// --- Protected: phone lookup for new-job flow ---
const lookupSchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
});

export type CustomerDTO = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  workshop_id: string;
};

export type VehicleDTO = {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  year: number | null;
  licence_plate: string | null;
  type: string;
  colour: string | null;
  last_mileage: number | null;
};

export const lookupCustomerByPhone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => lookupSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();

    const { data: customers, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, address, workshop_id")
      .eq("workshop_id", user.workshop_id)
      .eq("phone", data.phone)
      .limit(1);
    if (cErr) throw new Error(cErr.message);

    const customer = (customers?.[0] as CustomerDTO | undefined) ?? null;
    if (!customer) return { customer: null, vehicles: [] as VehicleDTO[] };

    const { data: vehicles, error: vErr } = await supabaseAdmin
      .from("vehicles")
      .select(
        "id, customer_id, make, model, year, licence_plate, type, colour, last_mileage",
      )
      .eq("customer_id", customer.id)
      .eq("workshop_id", user.workshop_id)
      .order("created_at", { ascending: false });
    if (vErr) throw new Error(vErr.message);

    return { customer, vehicles: (vehicles ?? []) as VehicleDTO[] };
  });

// --- Protected: update last_mileage for an existing vehicle ---
const updateMileageSchema = z.object({
  vehicleId: z.string().uuid(),
  mileage: z.number().int().min(0).max(10_000_000),
});

export const updateVehicleMileage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateMileageSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();

    const { error } = await supabaseAdmin
      .from("vehicles")
      .update({ last_mileage: data.mileage })
      .eq("id", data.vehicleId)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
