import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import {
  getRequestHeader,
  setResponseHeaders,
} from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_WORKSHOP_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const SESSION_COOKIE = "motoron_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getWorkshopId(): string {
  return process.env.WORKSHOP_ID || DEFAULT_WORKSHOP_ID;
}

function getSessionSecret(): string {
  // Reuse server-only key as HMAC secret. Never reaches the client.
  const s = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing session signing secret");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("hex");
}

function buildSessionToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string | undefined): { userId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expStr, nonce, sig] = parts;
  const payload = `${userId}.${expStr}.${nonce}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  return { userId };
}

function readCookie(name: string): string | undefined {
  const header = getRequestHeader("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

function setSessionCookie(token: string | null) {
  const value =
    token === null
      ? `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
      : `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
  setResponseHeaders(new Headers({ "set-cookie": value }));
}

export const listKioskUsers = createServerFn({ method: "GET" }).handler(
  async () => {
    // Only return non-sensitive fields needed to render the kiosk picker.
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .eq("workshop_id", getWorkshopId())
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
      .eq("workshop_id", getWorkshopId())
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const };

    // Constant-time PIN comparison
    const a = Buffer.from(row.pin ?? "");
    const b = Buffer.from(data.pin);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) return { ok: false as const };

    setSessionCookie(buildSessionToken(row.id));
    return { ok: true as const };
  });

export const getKioskSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = verifySessionToken(readCookie(SESSION_COOKIE));
    if (!session) return { authenticated: false as const };

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .eq("id", session.userId)
      .eq("workshop_id", getWorkshopId())
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) return { authenticated: false as const };
    return { authenticated: true as const, user: data };
  },
);

export const signOutKiosk = createServerFn({ method: "POST" }).handler(
  async () => {
    setSessionCookie(null);
    return { ok: true as const };
  },
);
