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
export const listKioskUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("workshop_id", WORKSHOP_ID)
    .eq("status", "active")
    .order("name", { ascending: true });
  if (error) {
    console.error("[listKioskUsers]", error.message);
    throw new Error("Service temporarily unavailable");
  }
  return (data ?? []) as { id: string; name: string }[];
});

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
export const getCurrentKioskUser = createServerFn({ method: "GET" }).handler(async (): Promise<KioskUserDTO | null> => {
  return await readSessionUser();
});

// --- Public: clear session ---
export const logoutKiosk = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<SessionData>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

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
      .select("id, customer_id, make, model, year, licence_plate, type, colour, last_mileage")
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

// --- Protected: list prior job_cards for a customer (and optionally vehicle) ---
const priorVisitsSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
});

export type PriorVisitDTO = {
  id: string;
  job_number: string;
  dropped_off_at: string | null;
  mileage_at_dropoff: number | null;
  customer_complaint: string | null;
};

export const listPriorVisits = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => priorVisitsSchema.parse(input))
  .handler(async ({ data }): Promise<PriorVisitDTO[]> => {
    const user = await requireSessionUser();
    let q = supabaseAdmin
      .from("job_cards")
      .select("id, job_number, dropped_off_at, mileage_at_dropoff, customer_complaint")
      .eq("workshop_id", user.workshop_id)
      .eq("customer_id", data.customerId)
      .order("dropped_off_at", { ascending: false })
      .limit(20);
    if (data.vehicleId) q = q.eq("vehicle_id", data.vehicleId);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[listPriorVisits]", error.message);
      throw new Error("Failed to load prior visits");
    }
    return (rows ?? []) as PriorVisitDTO[];
  });

// --- Protected: create the full job card (customer + vehicle + job_card) ---
const createJobSchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
  existingCustomerId: z.string().uuid().nullable(),
  newCustomerName: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  existingVehicleId: z.string().uuid().nullable(),
  vehicleForm: z.object({
    type: z.string().min(1).max(40),
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    year: z.number().int().min(1900).max(2100).nullable(),
    colour: z.string().trim().max(40).nullable(),
    licence_plate: z.string().trim().min(1).max(20),
    current_mileage: z.number().int().min(0).max(10_000_000),
  }),
  complaint: z.string().trim().min(1).max(2000),
  pickupRequestedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  packageId: z.string().uuid().nullable().optional(),
  customPackageAmount: z.number().nullable().optional(),
  parts: z
    .array(
      z.object({
        partName: z.string(),
        quantity: z.number(),
        unit: z.enum(["pcs", "litre", "ml", "set", "pair", "metre"]),
        unitPrice: z.number(),
        lineTotal: z.number(),
      }),
    )
    .optional()
    .default([]),
});

export type CreateJobResult = {
  jobId: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
};

export const createJobCard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createJobSchema.parse(input))
  .handler(async ({ data }): Promise<CreateJobResult> => {
    const user = await requireSessionUser();
    const workshopId = user.workshop_id;

    // 1. Resolve / insert customer
    let customerId = data.existingCustomerId;
    let customerName = data.newCustomerName ?? "";
    if (!customerId) {
      if (!data.newCustomerName) throw new Error("Customer name is required");
      const { data: inserted, error } = await supabaseAdmin
        .from("customers")
        .insert({
          name: data.newCustomerName,
          phone: data.phone,
          address: data.address ?? null,
          workshop_id: workshopId,
        })
        .select("id, name")
        .single();
      if (error || !inserted) {
        console.error("[createJobCard:customer]", error?.message);
        throw new Error("Failed to create customer");
      }
      customerId = inserted.id;
      customerName = inserted.name;
    } else {
      const { data: c, error } = await supabaseAdmin
        .from("customers")
        .select("id, name")
        .eq("id", customerId)
        .eq("workshop_id", workshopId)
        .maybeSingle();
      if (error || !c) throw new Error("Customer not found");
      customerName = c.name;
      // Update address if provided and different
      if (data.address !== undefined) {
        await supabaseAdmin
          .from("customers")
          .update({ address: data.address ?? null })
          .eq("id", customerId)
          .eq("workshop_id", workshopId);
      }
    }

    // 2. Resolve / insert vehicle
    let vehicleId = data.existingVehicleId;
    const vf = data.vehicleForm;
    if (!vehicleId) {
      const { data: insertedV, error } = await supabaseAdmin
        .from("vehicles")
        .insert({
          customer_id: customerId,
          workshop_id: workshopId,
          type: vf.type.toLowerCase(),
          make: vf.make,
          model: vf.model,
          year: vf.year,
          colour: vf.colour,
          licence_plate: vf.licence_plate.toUpperCase(),
          last_mileage: vf.current_mileage,
        })
        .select("id")
        .single();
      if (error || !insertedV) {
        console.error("[createJobCard:vehicle]", error?.message);
        throw new Error("Failed to create vehicle");
      }
      vehicleId = insertedV.id;
    } else {
      await supabaseAdmin
        .from("vehicles")
        .update({ last_mileage: vf.current_mileage })
        .eq("id", vehicleId)
        .eq("workshop_id", workshopId);
    }

    // 3. Generate next job number
    const { data: lastJob, error: lastErr } = await supabaseAdmin
      .from("job_cards")
      .select("job_number")
      .eq("workshop_id", workshopId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (lastErr) {
      console.error("[createJobCard:jobNumber]", lastErr.message);
      throw new Error("Failed to generate job number");
    }
    let maxNum = 0;
    for (const r of lastJob ?? []) {
      const m = /^JC-(\d+)$/.exec(r.job_number ?? "");
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const jobNumber = `JC-${String(maxNum + 1).padStart(4, "0")}`;

    // 4. Insert job card
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("job_cards")
      .insert({
        job_number: jobNumber,
        workshop_id: workshopId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        created_by: user.id,
        mileage_at_dropoff: vf.current_mileage,
        customer_complaint: data.complaint,
        pickup_requested_date: data.pickupRequestedDate ?? null,
        status: "pending",
        package_id: data.packageId ?? null,
        custom_package_amount: data.customPackageAmount ?? null,
      })
      .select("id, job_number")
      .single();
    if (jobErr || !job) {
      console.error("[createJobCard:job]", jobErr?.message);
      throw new Error("Failed to create job card");
    }

    // 5. Insert parts if any
    if (data.parts && data.parts.length > 0) {
      const partsToInsert = data.parts.map((p) => ({
        job_card_id: job.id,
        part_name: p.partName,
        quantity: p.quantity,
        unit: p.unit,
        unit_price: p.unitPrice,
        line_total: p.lineTotal ?? Number((p.quantity * p.unitPrice).toFixed(2)),
      }));
      const { error: partsErr } = await supabaseAdmin.from("job_card_parts").insert(partsToInsert);
      if (partsErr) {
        console.error("[createJobCard:parts]", partsErr.message);
        // Non-fatal — job is created, parts failed
      }
    }

    return {
      jobId: job.id,
      jobNumber: job.job_number,
      customerId: customerId!,
      customerName,
      customerPhone: data.phone,
      vehicleId: vehicleId!,
      vehicleMake: vf.make,
      vehicleModel: vf.model,
    };
  });

// --- Protected: list active job cards for the workshop ---
export type ActiveJobDTO = {
  id: string;
  job_number: string;
  status: string;
  dropped_off_at: string | null;
  customer_name: string;
  vehicle_make: string;
  vehicle_model: string;
  total_amount: number;
};

export const listActiveJobs = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ jobs: ActiveJobDTO[]; threshold: number }> => {
    const user = await requireSessionUser();
    const workshopId = user.workshop_id;

    const { data: jobs, error } = await supabaseAdmin
      .from("job_cards")
      .select("id, job_number, status, dropped_off_at, customer_id, vehicle_id, package_id, custom_package_amount")
      .eq("workshop_id", workshopId)
      .in("status", ["pending", "in_progress", "repair_completed"])
      .order("dropped_off_at", { ascending: true });
    if (error) {
      console.error("[listActiveJobs]", error.message);
      throw new Error("Failed to load jobs");
    }

    const rows = jobs ?? [];
    const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
    const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))] as string[];
    const packageIds = [...new Set(rows.map((r) => r.package_id).filter(Boolean))] as string[];
    const jobIds = rows.map((r) => r.id);

    const [customersRes, vehiclesRes, packagesRes, partsRes, workshopRes] = await Promise.all([
      customerIds.length
        ? supabaseAdmin.from("customers").select("id, name").in("id", customerIds)
        : Promise.resolve({ data: [], error: null } as const),
      vehicleIds.length
        ? supabaseAdmin.from("vehicles").select("id, make, model").in("id", vehicleIds)
        : Promise.resolve({ data: [], error: null } as const),
      packageIds.length
        ? supabaseAdmin.from("service_packages").select("id, price").in("id", packageIds)
        : Promise.resolve({ data: [], error: null } as const),
      jobIds.length
        ? supabaseAdmin
            .from("job_card_parts")
            .select("job_card_id, line_total, unit_price, quantity")
            .in("job_card_id", jobIds)
        : Promise.resolve({ data: [], error: null } as const),
      supabaseAdmin.from("workshops").select("job_duration_threshold").eq("id", workshopId).maybeSingle(),
    ]);

    const customers = new Map((customersRes.data ?? []).map((c: any) => [c.id, c.name as string]));
    const vehicles = new Map(
      (vehiclesRes.data ?? []).map((v: any) => [v.id, { make: v.make as string, model: v.model as string }]),
    );
    const packages = new Map((packagesRes.data ?? []).map((p: any) => [p.id, Number(p.price) || 0]));
    const partsByJob = new Map<string, number>();
    for (const p of (partsRes.data ?? []) as any[]) {
      const lt = Number(p.line_total ?? Number(p.unit_price) * Number(p.quantity)) || 0;
      partsByJob.set(p.job_card_id, (partsByJob.get(p.job_card_id) ?? 0) + lt);
    }

    const out: ActiveJobDTO[] = rows.map((r) => {
      const pkgAmt = r.package_id ? (packages.get(r.package_id) ?? 0) : Number(r.custom_package_amount) || 0;
      const partsAmt = partsByJob.get(r.id) ?? 0;
      const v = r.vehicle_id ? vehicles.get(r.vehicle_id) : undefined;
      return {
        id: r.id,
        job_number: r.job_number,
        status: r.status ?? "pending",
        dropped_off_at: r.dropped_off_at,
        customer_name: (r.customer_id && customers.get(r.customer_id)) || "—",
        vehicle_make: v?.make ?? "",
        vehicle_model: v?.model ?? "",
        total_amount: pkgAmt + partsAmt,
      };
    });

    return {
      jobs: out,
      threshold: Number(workshopRes.data?.job_duration_threshold ?? 3),
    };
  },
);

// --- Protected: full job detail ---
const jobIdSchema = z.object({ jobId: z.string().uuid() });

export type JobDetailPart = {
  id: string;
  part_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

export type JobDetailDTO = {
  id: string;
  job_number: string;
  status: string;
  payment_status: string | null;
  customer_complaint: string | null;
  mileage_at_dropoff: number | null;
  dropped_off_at: string | null;
  repair_completed_at: string | null;
  picked_up_at: string | null;
  pickup_requested_date: string | null;
  dropoff_notification_sent: boolean;
  completed_notification_sent: boolean;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
  } | null;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number | null;
    colour: string | null;
    licence_plate: string | null;
    type: string;
  } | null;
  package: { id: string; name: string; price: number } | null;
  custom_package_amount: number | null;
  parts: JobDetailPart[];
  total_amount: number;
  prior_visits: PriorVisitDTO[];
  assigned_mechanic: { id: string; name: string } | null;
  workshop: {
    id: string;
    name: string;
    phone: string | null;
    maps_link: string | null;
    hours: any;
  };
};

export const getJobDetail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => jobIdSchema.parse(input))
  .handler(async ({ data }): Promise<JobDetailDTO> => {
    const user = await requireSessionUser();
    const workshopId = user.workshop_id;

    const { data: job, error } = await supabaseAdmin
      .from("job_cards")
      .select(
        "id, job_number, status, payment_status, customer_complaint, mileage_at_dropoff, dropped_off_at, repair_completed_at, picked_up_at, pickup_requested_date, dropoff_notification_sent, completed_notification_sent, customer_id, vehicle_id, package_id, custom_package_amount",
      )
      .eq("id", data.jobId)
      .eq("workshop_id", workshopId)
      .maybeSingle();
    if (error || !job) throw new Error("Job not found");

    const [custRes, vehRes, pkgRes, partsRes, priorRes, wsRes] = await Promise.all([
      job.customer_id
        ? supabaseAdmin.from("customers").select("id, name, phone, address").eq("id", job.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      job.vehicle_id
        ? supabaseAdmin
            .from("vehicles")
            .select("id, make, model, year, colour, licence_plate, type")
            .eq("id", job.vehicle_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      job.package_id
        ? supabaseAdmin.from("service_packages").select("id, name, price").eq("id", job.package_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      supabaseAdmin
        .from("job_card_parts")
        .select("id, part_name, quantity, unit, unit_price, line_total")
        .eq("job_card_id", job.id),
      job.customer_id
        ? supabaseAdmin
            .from("job_cards")
            .select("id, job_number, dropped_off_at, mileage_at_dropoff, customer_complaint")
            .eq("workshop_id", workshopId)
            .eq("customer_id", job.customer_id)
            .eq("status", "closed")
            .neq("id", job.id)
            .order("dropped_off_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null } as const),
      supabaseAdmin.from("workshops").select("id, name, phone, maps_link, hours").eq("id", workshopId).maybeSingle(),
    ]);

    const parts: JobDetailPart[] = ((partsRes.data ?? []) as any[]).map((p) => ({
      id: p.id,
      part_name: p.part_name,
      quantity: Number(p.quantity) || 0,
      unit: p.unit ?? "pcs",
      unit_price: Number(p.unit_price) || 0,
      line_total: Number(p.line_total ?? Number(p.unit_price) * Number(p.quantity)) || 0,
    }));

    const pkgAmt = pkgRes.data ? Number((pkgRes.data as any).price) || 0 : Number(job.custom_package_amount) || 0;
    const partsAmt = parts.reduce((s, p) => s + p.line_total, 0);

    return {
      id: job.id,
      job_number: job.job_number,
      status: job.status ?? "pending",
      payment_status: job.payment_status ?? null,
      customer_complaint: job.customer_complaint,
      mileage_at_dropoff: job.mileage_at_dropoff,
      dropped_off_at: job.dropped_off_at,
      repair_completed_at: job.repair_completed_at,
      picked_up_at: job.picked_up_at,
      pickup_requested_date: job.pickup_requested_date,
      dropoff_notification_sent: !!job.dropoff_notification_sent,
      completed_notification_sent: !!job.completed_notification_sent,
      customer: (custRes.data as any) ?? null,
      vehicle: (vehRes.data as any) ?? null,
      package: pkgRes.data
        ? {
            id: (pkgRes.data as any).id,
            name: (pkgRes.data as any).name,
            price: Number((pkgRes.data as any).price) || 0,
          }
        : null,
      custom_package_amount: job.custom_package_amount != null ? Number(job.custom_package_amount) : null,
      parts,
      total_amount: pkgAmt + partsAmt,
      prior_visits: (priorRes.data ?? []) as PriorVisitDTO[],
      workshop: (wsRes.data as any) ?? { id: workshopId, name: "Workshop", phone: null, maps_link: null, hours: null },
    };
  });

// --- Protected: update job status ---
const updateStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "repair_completed", "closed"]),
});

export const updateJobStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateStatusSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    const patch: {
      status: "pending" | "in_progress" | "repair_completed" | "closed";
      repair_completed_at?: string;
      picked_up_at?: string;
    } = { status: data.status };
    if (data.status === "repair_completed") patch.repair_completed_at = new Date().toISOString();
    if (data.status === "closed") patch.picked_up_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("job_cards")
      .update(patch)
      .eq("id", data.jobId)
      .eq("workshop_id", user.workshop_id);
    if (error) {
      console.error("[updateJobStatus]", error.message);
      throw new Error("Failed to update status");
    }
    return { ok: true as const };
  });

// --- Protected: mark notification sent ---
const markNotifSchema = z.object({
  jobId: z.string().uuid(),
  kind: z.enum(["dropoff", "completed"]),
});

export const markNotificationSent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => markNotifSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    const patch = data.kind === "dropoff" ? { dropoff_notification_sent: true } : { completed_notification_sent: true };
    const { error } = await supabaseAdmin
      .from("job_cards")
      .update(patch)
      .eq("id", data.jobId)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Protected: update an existing job card (edit flow) ---
const updateJobSchema = z.object({
  jobId: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).nullable().optional(),
  vehicleId: z.string().uuid().nullable(),
  vehicleForm: z.object({
    type: z.string().min(1).max(40),
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    year: z.number().int().min(1900).max(2100).nullable(),
    colour: z.string().trim().max(40).nullable(),
    licence_plate: z.string().trim().min(1).max(20),
    current_mileage: z.number().int().min(0).max(10_000_000),
  }),
  complaint: z.string().trim().min(1).max(2000),
  pickupRequestedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  packageId: z.string().uuid().nullable().optional(),
  customPackageAmount: z.number().min(0).max(10_000_000).nullable().optional(),
  parts: z
    .array(
      z.object({
        partName: z.string().trim().min(1).max(120),
        quantity: z.number().min(0).max(100_000),
        unit: z.string().trim().min(1).max(20),
        unitPrice: z.number().min(0).max(10_000_000),
      }),
    )
    .max(50)
    .optional(),
});

export const updateJobCard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateJobSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    const workshopId = user.workshop_id;

    const { data: job, error: jErr } = await supabaseAdmin
      .from("job_cards")
      .select("id, customer_id, vehicle_id")
      .eq("id", data.jobId)
      .eq("workshop_id", workshopId)
      .maybeSingle();
    if (jErr || !job) throw new Error("Job not found");

    {
      const { error } = await supabaseAdmin
        .from("customers")
        .update({
          name: data.customerName,
          address: data.address ?? null,
        })
        .eq("id", data.customerId)
        .eq("workshop_id", workshopId);
      if (error) {
        console.error("[updateJobCard:customer]", error.message);
        throw new Error("Failed to update customer");
      }
    }

    let vehicleId = data.vehicleId;
    const vf = data.vehicleForm;
    if (vehicleId) {
      const { error } = await supabaseAdmin
        .from("vehicles")
        .update({
          type: vf.type.toLowerCase(),
          make: vf.make,
          model: vf.model,
          year: vf.year,
          colour: vf.colour,
          licence_plate: vf.licence_plate.toUpperCase(),
          last_mileage: vf.current_mileage,
        })
        .eq("id", vehicleId)
        .eq("workshop_id", workshopId);
      if (error) {
        console.error("[updateJobCard:vehicle]", error.message);
        throw new Error("Failed to update vehicle");
      }
    } else {
      const { data: insertedV, error } = await supabaseAdmin
        .from("vehicles")
        .insert({
          customer_id: data.customerId,
          workshop_id: workshopId,
          type: vf.type.toLowerCase(),
          make: vf.make,
          model: vf.model,
          year: vf.year,
          colour: vf.colour,
          licence_plate: vf.licence_plate.toUpperCase(),
          last_mileage: vf.current_mileage,
        })
        .select("id")
        .single();
      if (error || !insertedV) {
        console.error("[updateJobCard:vehicle-insert]", error?.message);
        throw new Error("Failed to create vehicle");
      }
      vehicleId = insertedV.id;
    }

    {
      const { error } = await supabaseAdmin
        .from("job_cards")
        .update({
          vehicle_id: vehicleId,
          mileage_at_dropoff: vf.current_mileage,
          customer_complaint: data.complaint,
          pickup_requested_date: data.pickupRequestedDate ?? null,
          package_id: data.packageId ?? null,
          custom_package_amount: data.customPackageAmount ?? null,
        })
        .eq("id", data.jobId)
        .eq("workshop_id", workshopId);
      if (error) {
        console.error("[updateJobCard:job]", error.message);
        throw new Error("Failed to update job");
      }
    }

    // Replace parts: delete existing then insert new
    {
      const { error: delErr } = await supabaseAdmin.from("job_card_parts").delete().eq("job_card_id", data.jobId);
      if (delErr) {
        console.error("[updateJobCard:parts-delete]", delErr.message);
        throw new Error("Failed to update parts");
      }
      if (data.parts && data.parts.length > 0) {
        const rows = data.parts.map((p) => ({
          job_card_id: data.jobId,
          part_name: p.partName,
          quantity: p.quantity,
          unit: p.unit,
          unit_price: p.unitPrice,
          line_total: Number((p.quantity * p.unitPrice).toFixed(2)),
        }));
        const { error: insErr } = await supabaseAdmin.from("job_card_parts").insert(rows);
        if (insErr) {
          console.error("[updateJobCard:parts-insert]", insErr.message);
          throw new Error("Failed to save parts");
        }
      }
    }

    return { ok: true as const, jobId: data.jobId };
  });

// ============================================================
// WORKSHOP ADMIN — server functions
// ============================================================

function requireAdmin(user: KioskUserDbRow) {
  if (user.access_level !== "full-admin") {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}

// --- My Account ---
const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).nullable().or(z.literal("")),
  phone: z.string().trim().max(20).nullable().or(z.literal("")),
  currentPin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  newPin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export const updateMyAccount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => updateAccountSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    const patch: { name: string; email: string | null; phone: string | null; pin?: string } = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
    };
    if (data.newPin) {
      if (!data.currentPin) throw new Error("Current PIN required");
      const { data: row } = await supabaseAdmin.from("users").select("pin").eq("id", user.id).maybeSingle();
      if (!row || row.pin !== data.currentPin) throw new Error("Current PIN is incorrect");
      patch.pin = data.newPin;
    }
    const { error } = await supabaseAdmin.from("users").update(patch).eq("id", user.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Workshop Profile ---
export type WorkshopProfileDTO = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  maps_link: string | null;
  logo: string | null;
  hours: any;
  gst_number: string | null;
  job_duration_threshold: number;
  notify_dropoff: boolean;
  notify_completed: boolean;
  dropoff_template: string | null;
  completed_template: string | null;
  auto_archive_months: number;
};

export const getWorkshopProfile = createServerFn({ method: "GET" }).handler(async (): Promise<WorkshopProfileDTO> => {
  const user = await requireSessionUser();
  requireAdmin(user);
  const { data, error } = await supabaseAdmin
    .from("workshops")
    .select(
      "id, name, phone, address, maps_link, logo, hours, gst_number, job_duration_threshold, notify_dropoff, notify_completed, dropoff_template, completed_template, auto_archive_months",
    )
    .eq("id", user.workshop_id)
    .maybeSingle();
  if (error || !data) throw new Error("Workshop not found");
  return {
    ...data,
    job_duration_threshold: Number(data.job_duration_threshold ?? 3),
    auto_archive_months: Number((data as any).auto_archive_months ?? 6),
    notify_dropoff: !!data.notify_dropoff,
    notify_completed: !!data.notify_completed,
  } as WorkshopProfileDTO;
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).nullable().or(z.literal("")),
  address: z.string().trim().max(1000).nullable().or(z.literal("")),
  maps_link: z.string().trim().max(500).nullable().or(z.literal("")),
  logo: z.string().max(2_000_000).nullable().or(z.literal("")),
  hours: z.record(
    z.string(),
    z.object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
      closed: z.boolean(),
    }),
  ),
  gst_number: z.string().trim().max(30).nullable().or(z.literal("")),
});

export const updateWorkshopProfile = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => updateProfileSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("workshops")
      .update({
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        maps_link: data.maps_link || null,
        logo: data.logo || null,
        hours: data.hours,
        gst_number: data.gst_number || null,
      })
      .eq("id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Notifications ---
const updateNotifSchema = z.object({
  job_duration_threshold: z.number().int().min(1).max(365),
  notify_dropoff: z.boolean(),
  notify_completed: z.boolean(),
  dropoff_template: z.string().max(2000),
  completed_template: z.string().max(2000),
});

export const updateNotificationSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => updateNotifSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin.from("workshops").update(data).eq("id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Auto Archive ---
export const updateAutoArchive = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ months: z.number().int().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("workshops")
      .update({ auto_archive_months: data.months })
      .eq("id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Team ---
export type TeamMemberDTO = {
  id: string;
  name: string;
  role: string;
  access_level: string;
  status: string;
  phone: string | null;
  email: string | null;
};

export const listTeam = createServerFn({ method: "GET" }).handler(async (): Promise<TeamMemberDTO[]> => {
  const user = await requireSessionUser();
  requireAdmin(user);
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, role, access_level, status, phone, email")
    .eq("workshop_id", user.workshop_id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMemberDTO[];
});

export const deleteTeamMember = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { data: target } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", data.userId)
      .eq("workshop_id", user.workshop_id)
      .maybeSingle();
    if (!target) throw new Error("User not found");
    if (target.role === "owner") throw new Error("Cannot remove the owner");
    const { error } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", data.userId)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Service Packages ---
export type ServicePackageDTO = {
  id: string;
  name: string;
  price: number;
  subtitle: string | null;
  sort_order: number;
  is_custom: boolean;
};

export const listServicePackages = createServerFn({ method: "GET" }).handler(async (): Promise<ServicePackageDTO[]> => {
  const user = await requireSessionUser();
  requireAdmin(user);
  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .select("id, name, price, subtitle, sort_order, is_custom")
    .eq("workshop_id", user.workshop_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price) || 0,
    subtitle: p.subtitle,
    sort_order: Number(p.sort_order) || 0,
    is_custom: !!p.is_custom,
  }));
});

const pkgInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.number().min(0).max(10_000_000),
  subtitle: z.string().trim().max(300).nullable().or(z.literal("")),
});

export const createServicePackage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => pkgInputSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { data: maxRow } = await supabaseAdmin
      .from("service_packages")
      .select("sort_order")
      .eq("workshop_id", user.workshop_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (Number(maxRow?.sort_order) || 0) + 1;
    const { error } = await supabaseAdmin.from("service_packages").insert({
      name: data.name,
      price: data.price,
      subtitle: data.subtitle || null,
      sort_order: nextOrder,
      workshop_id: user.workshop_id,
      is_custom: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateServicePackage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => pkgInputSchema.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("service_packages")
      .update({
        name: data.name,
        price: data.price,
        subtitle: data.subtitle || null,
      })
      .eq("id", data.id)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteServicePackage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("service_packages")
      .delete()
      .eq("id", data.id)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reorderServicePackage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        direction: z.enum(["up", "down"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { data: rows, error } = await supabaseAdmin
      .from("service_packages")
      .select("id, sort_order")
      .eq("workshop_id", user.workshop_id)
      .order("sort_order", { ascending: true });
    if (error || !rows) throw new Error(error?.message ?? "Failed");
    const idx = rows.findIndex((r: any) => r.id === data.id);
    if (idx < 0) throw new Error("Not found");
    const swapIdx = data.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) return { ok: true as const };
    const a = rows[idx] as any,
      b = rows[swapIdx] as any;
    await supabaseAdmin.from("service_packages").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabaseAdmin.from("service_packages").update({ sort_order: a.sort_order }).eq("id", b.id);
    return { ok: true as const };
  });

// --- Parts Library ---
export type PartDTO = {
  id: string;
  name: string;
  default_unit: string;
  sort_order: number;
};

export const listParts = createServerFn({ method: "GET" }).handler(async (): Promise<PartDTO[]> => {
  const user = await requireSessionUser();
  requireAdmin(user);
  const { data, error } = await supabaseAdmin
    .from("parts_library")
    .select("id, name, default_unit, sort_order")
    .eq("workshop_id", user.workshop_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PartDTO[];
});

const partInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  default_unit: z.enum(["pcs", "litre", "ml", "set", "pair", "metre"]),
});

export const createPart = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => partInputSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { data: maxRow } = await supabaseAdmin
      .from("parts_library")
      .select("sort_order")
      .eq("workshop_id", user.workshop_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (Number(maxRow?.sort_order) || 0) + 1;
    const { error } = await supabaseAdmin.from("parts_library").insert({
      name: data.name,
      default_unit: data.default_unit,
      sort_order: nextOrder,
      workshop_id: user.workshop_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updatePart = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("parts_library")
      .update({ name: data.name })
      .eq("id", data.id)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deletePart = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const { error } = await supabaseAdmin
      .from("parts_library")
      .delete()
      .eq("id", data.id)
      .eq("workshop_id", user.workshop_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// --- Closed Jobs / Search ---
export type ClosedJobDTO = ActiveJobDTO;

export const searchClosedJobs = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ q: z.string().trim().max(120) }).parse(i))
  .handler(async ({ data }): Promise<ClosedJobDTO[]> => {
    const user = await requireSessionUser();
    requireAdmin(user);
    const workshopId = user.workshop_id;
    const { data: jobs, error } = await supabaseAdmin
      .from("job_cards")
      .select("id, job_number, status, dropped_off_at, customer_id, vehicle_id, package_id, custom_package_amount")
      .eq("workshop_id", workshopId)
      .eq("status", "closed")
      .order("picked_up_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = jobs ?? [];
    if (rows.length === 0) return [];

    const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
    const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))] as string[];
    const packageIds = [...new Set(rows.map((r) => r.package_id).filter(Boolean))] as string[];
    const jobIds = rows.map((r) => r.id);

    const [cRes, vRes, pRes, prRes] = await Promise.all([
      customerIds.length
        ? supabaseAdmin.from("customers").select("id, name, phone").in("id", customerIds)
        : Promise.resolve({ data: [] } as const),
      vehicleIds.length
        ? supabaseAdmin.from("vehicles").select("id, make, model, licence_plate").in("id", vehicleIds)
        : Promise.resolve({ data: [] } as const),
      packageIds.length
        ? supabaseAdmin.from("service_packages").select("id, price").in("id", packageIds)
        : Promise.resolve({ data: [] } as const),
      jobIds.length
        ? supabaseAdmin
            .from("job_card_parts")
            .select("job_card_id, line_total, unit_price, quantity")
            .in("job_card_id", jobIds)
        : Promise.resolve({ data: [] } as const),
    ]);
    const cust = new Map((cRes.data ?? []).map((c: any) => [c.id, c]));
    const veh = new Map((vRes.data ?? []).map((v: any) => [v.id, v]));
    const pkg = new Map((pRes.data ?? []).map((p: any) => [p.id, Number(p.price) || 0]));
    const partsByJob = new Map<string, number>();
    for (const p of (prRes.data ?? []) as any[]) {
      const lt = Number(p.line_total ?? Number(p.unit_price) * Number(p.quantity)) || 0;
      partsByJob.set(p.job_card_id, (partsByJob.get(p.job_card_id) ?? 0) + lt);
    }
    const q = data.q.toLowerCase();
    const out: ClosedJobDTO[] = [];
    for (const r of rows) {
      const c = (r.customer_id && cust.get(r.customer_id)) as any;
      const v = (r.vehicle_id && veh.get(r.vehicle_id)) as any;
      const haystack = [r.job_number, c?.name, c?.phone, v?.make, v?.model, v?.licence_plate]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (q && !haystack.includes(q)) continue;
      const pkgAmt = r.package_id ? (pkg.get(r.package_id) ?? 0) : Number(r.custom_package_amount) || 0;
      out.push({
        id: r.id,
        job_number: r.job_number,
        status: r.status ?? "closed",
        dropped_off_at: r.dropped_off_at,
        customer_name: c?.name ?? "—",
        vehicle_make: v?.make ?? "",
        vehicle_model: v?.model ?? "",
        total_amount: pkgAmt + (partsByJob.get(r.id) ?? 0),
      });
    }
    return out;
  });

export type ExportRowDTO = {
  job_number: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  vehicle: string;
  complaint: string;
  dropped_off_at: string | null;
  repair_completed_at: string | null;
  picked_up_at: string | null;
  total_amount: number;
};

export const exportAllJobs = createServerFn({ method: "GET" }).handler(async (): Promise<ExportRowDTO[]> => {
  const user = await requireSessionUser();
  requireAdmin(user);
  const workshopId = user.workshop_id;
  const { data: jobs, error } = await supabaseAdmin
    .from("job_cards")
    .select(
      "id, job_number, status, customer_complaint, dropped_off_at, repair_completed_at, picked_up_at, customer_id, vehicle_id, package_id, custom_package_amount",
    )
    .eq("workshop_id", workshopId)
    .order("dropped_off_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  const rows = jobs ?? [];
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))] as string[];
  const packageIds = [...new Set(rows.map((r) => r.package_id).filter(Boolean))] as string[];
  const jobIds = rows.map((r) => r.id);
  const [cRes, vRes, pRes, prRes] = await Promise.all([
    customerIds.length
      ? supabaseAdmin.from("customers").select("id, name, phone").in("id", customerIds)
      : Promise.resolve({ data: [] } as const),
    vehicleIds.length
      ? supabaseAdmin.from("vehicles").select("id, make, model, licence_plate").in("id", vehicleIds)
      : Promise.resolve({ data: [] } as const),
    packageIds.length
      ? supabaseAdmin.from("service_packages").select("id, price").in("id", packageIds)
      : Promise.resolve({ data: [] } as const),
    jobIds.length
      ? supabaseAdmin
          .from("job_card_parts")
          .select("job_card_id, line_total, unit_price, quantity")
          .in("job_card_id", jobIds)
      : Promise.resolve({ data: [] } as const),
  ]);
  const cust = new Map((cRes.data ?? []).map((c: any) => [c.id, c]));
  const veh = new Map((vRes.data ?? []).map((v: any) => [v.id, v]));
  const pkg = new Map((pRes.data ?? []).map((p: any) => [p.id, Number(p.price) || 0]));
  const partsByJob = new Map<string, number>();
  for (const p of (prRes.data ?? []) as any[]) {
    const lt = Number(p.line_total ?? Number(p.unit_price) * Number(p.quantity)) || 0;
    partsByJob.set(p.job_card_id, (partsByJob.get(p.job_card_id) ?? 0) + lt);
  }
  return rows.map((r) => {
    const c = (r.customer_id && cust.get(r.customer_id)) as any;
    const v = (r.vehicle_id && veh.get(r.vehicle_id)) as any;
    const pkgAmt = r.package_id ? (pkg.get(r.package_id) ?? 0) : Number(r.custom_package_amount) || 0;
    return {
      job_number: r.job_number,
      status: r.status ?? "",
      customer_name: c?.name ?? "",
      customer_phone: c?.phone ?? "",
      vehicle: v ? `${v.make ?? ""} ${v.model ?? ""} ${v.licence_plate ?? ""}`.trim() : "",
      complaint: (r.customer_complaint ?? "").replace(/\s+/g, " "),
      dropped_off_at: r.dropped_off_at,
      repair_completed_at: r.repair_completed_at,
      picked_up_at: r.picked_up_at,
      total_amount: pkgAmt + (partsByJob.get(r.id) ?? 0),
    };
  });
});

// --- Public (any signed-in kiosk user): list packages for the New Job flow ---
export const listPackagesForJob = createServerFn({ method: "GET" }).handler(async (): Promise<ServicePackageDTO[]> => {
  const user = await requireSessionUser();
  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .select("id, name, price, subtitle, sort_order, is_custom")
    .eq("workshop_id", user.workshop_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Failed to load packages");
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price) || 0,
    subtitle: p.subtitle,
    sort_order: Number(p.sort_order) || 0,
    is_custom: !!p.is_custom,
  }));
});

export type PartsLibraryItem = {
  id: string;
  name: string;
  default_unit: string;
};

export const listPartsLibrary = createServerFn({ method: "GET" }).handler(async (): Promise<PartsLibraryItem[]> => {
  const user = await requireSessionUser();
  const { data, error } = await supabaseAdmin
    .from("parts_library")
    .select("id, name, default_unit, sort_order")
    .eq("workshop_id", user.workshop_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Failed to load parts");
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    default_unit: p.default_unit ?? "pcs",
  }));
});

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
    z.object({ name: z.string().trim().min(1).max(80) }).parse(input),
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
      .insert({ workshop_id: user.workshop_id, name: data.name, sort_order: nextOrder })
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
    const updates: { name?: string; is_active?: boolean } = {};
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
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
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
