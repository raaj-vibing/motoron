// Lightweight session-scoped store for the New Job wizard.
// Survives navigation between wizard steps without persisting long-term.

const KEY = "motoron_job_draft";

export type DraftCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
};

export type DraftVehicle = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  licence_plate: string | null;
  type: string;
  colour: string | null;
  last_mileage: number | null;
};

export type VehicleFormData = {
  type: string; // "Bike" | "Car" | "Auto" | "Other"
  make: string;
  model: string;
  year: number | null;
  colour: string | null;
  licence_plate: string;
  current_mileage: number;
};

export type DraftPart = {
  partName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type JobDraft = {
  phone: string;
  customer: DraftCustomer | null; // null = new customer
  newCustomerName?: string;
  address?: string | null;
  vehicle: DraftVehicle | null; // null = new vehicle (existing match if not null)
  vehicleForm?: VehicleFormData; // populated after Step 2
  editJobId?: string; // when set, wizard is editing an existing job card
  initialComplaint?: string;
  initialPickupDate?: string | null;
  initialMileage?: number | null;
  initialPackageId?: string | null;
  initialCustomPackageAmount?: number | null;
  initialParts?: DraftPart[];
};

export function getJobDraft(): JobDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JobDraft) : null;
  } catch {
    return null;
  }
}

export function setJobDraft(draft: JobDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearJobDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
