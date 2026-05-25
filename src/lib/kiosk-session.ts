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
