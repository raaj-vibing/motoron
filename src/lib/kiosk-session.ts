// Simple localStorage-backed kiosk session. No Supabase Auth, no JWTs.
export const WORKSHOP_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const KEY = "motoron_kiosk_user";

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

export function getKioskUser(): KioskUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as KioskUser) : null;
  } catch {
    return null;
  }
}

export function setKioskUser(user: KioskUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearKioskUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
