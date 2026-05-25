// Server-only kiosk session config + DB helpers.
// Anything in this file uses the service role and MUST NOT be imported from client code.
// The *.server.ts suffix triggers the bundler's client-import block.
import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const WORKSHOP_ID = "a1b2c3d4-0000-0000-0000-000000000001";

export type SessionData = { userId: string };

export type KioskUserDbRow = {
  id: string;
  name: string;
  access_level: string;
  role: string;
  workshop_id: string;
  email: string | null;
  phone: string | null;
  status: string | null;
};

export function sessionConfig() {
  // Reuse SUPABASE_SERVICE_ROLE_KEY as the cookie-encryption secret.
  // It is provisioned at deploy time, server-only, and long enough for sealed-session.
  const password = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to seal the kiosk session cookie.",
    );
  }
  return {
    password,
    name: "motoron_kiosk",
    maxAge: 60 * 60 * 12, // 12 hours
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

export async function readSessionUser(): Promise<KioskUserDbRow | null> {
  const session = await useSession<SessionData>(sessionConfig());
  const userId = session.data?.userId;
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, access_level, role, workshop_id, email, phone, status")
    .eq("id", userId)
    .eq("workshop_id", WORKSHOP_ID)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  return data as KioskUserDbRow;
}

export async function requireSessionUser(): Promise<KioskUserDbRow> {
  const user = await readSessionUser();
  if (!user) {
    // 401 status so beforeLoad can react if it ever calls directly.
    const err = new Error("Unauthenticated");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return user;
}
