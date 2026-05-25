import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentKioskUser,
  getJobDetail,
  updateJobStatus,
  markNotificationSent,
  type JobDetailDTO,
  type PriorVisitDTO,
} from "@/lib/kiosk.functions";
import { setJobDraft } from "@/lib/job-draft";

export const Route = createFileRoute("/jobs/$jobId")({
  head: () => ({ meta: [{ title: "Job Detail — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    return { kioskUser: user };
  },
  component: JobDetailPage,
});

type StatusKey = "pending" | "in_progress" | "repair_completed" | "closed";

const STATUS_OPTIONS: {
  key: StatusKey;
  label: string;
  desc: string;
  dot: string;
}[] = [
  { key: "pending", label: "⏳ Pending", desc: "Waiting to start work", dot: "bg-amber-400" },
  { key: "in_progress", label: "🔧 In Progress", desc: "Currently being worked on", dot: "bg-sky-400" },
  { key: "repair_completed", label: "✅ Repair Completed", desc: "Work done, awaiting customer pickup", dot: "bg-green-500" },
  { key: "closed", label: "🔒 Closed", desc: "Vehicle picked up by customer", dot: "bg-muted-foreground" },
];

function statusLabel(s: string) {
  if (s === "in_progress") return "In Progress";
  if (s === "repair_completed") return "Repair Completed";
  if (s === "closed") return "Closed";
  return "Pending";
}
function statusPillClasses(s: string) {
  if (s === "in_progress") return "bg-sky-400/15 text-sky-300";
  if (s === "repair_completed") return "bg-green-500/15 text-green-400";
  if (s === "closed") return "bg-muted text-muted-foreground";
  return "bg-amber-500/15 text-amber-400";
}
function formatINR(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function formatDate(iso: string | null) {
  if (!iso) return "Not specified";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not specified";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function buildPickupMessage(j: JobDetailDTO) {
  const name = j.customer?.name ?? "Customer";
  const make = j.vehicle?.make ?? "";
  const model = j.vehicle?.model ?? "";
  const total = Math.round(j.total_amount).toLocaleString("en-IN");
  const maps = j.workshop.maps_link || "https://maps.google.com";
  const ws = j.workshop.name || "My Workshop";
  return `Hi ${name}, great news! Your ${make} ${model} is ready for pickup! Total amount due: Rs.${total}. Find us: ${maps}. We are open Mon-Sat 9am-7pm. See you soon! — ${ws}`;
}
function buildDropoffMessage(j: JobDetailDTO) {
  const name = j.customer?.name ?? "Customer";
  const make = j.vehicle?.make ?? "";
  const model = j.vehicle?.model ?? "";
  const ws = j.workshop.name || "My Workshop";
  const phone = j.workshop.phone ?? "";
  const maps = j.workshop.maps_link || "https://maps.google.com";
  return `Hi ${name}, your ${make} ${model} has been dropped off at ${ws}. Questions? Call ${phone}. Find us: ${maps}. We are open Mon-Sat 9am-7pm. — ${ws}`;
}
function openWhatsApp(phone: string | undefined, msg: string) {
  if (!phone) return;
  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const fetchJob = useServerFn(getJobDetail);
  const setStatus = useServerFn(updateJobStatus);
  const markNotif = useServerFn(markNotificationSent);

  const [job, setJob] = useState<JobDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusSheet, setStatusSheet] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const load = async () => {
    try {
      const res = await fetchJob({ data: { jobId } });
      setJob(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [jobId]);

  const applyStatus = async (next: StatusKey) => {
    if (!job) return;
    try {
      await setStatus({ data: { jobId: job.id, status: next } });
      const updated = { ...job, status: next } as JobDetailDTO;
      if (next === "repair_completed") updated.repair_completed_at = new Date().toISOString();
      if (next === "closed") updated.picked_up_at = new Date().toISOString();
      setJob(updated);
      setStatusSheet(false);

      if (next === "repair_completed") {
        openWhatsApp(updated.customer?.phone, buildPickupMessage(updated));
      }
      if (next === "closed") {
        toast.success(`Job #${updated.job_number} Closed ✓`);
        navigate({ to: "/jobs/active" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const handleStatusPick = (k: StatusKey) => {
    if (k === "closed") {
      setConfirmClose(true);
      return;
    }
    applyStatus(k);
  };

  const sendDropoff = async () => {
    if (!job) return;
    openWhatsApp(job.customer?.phone, buildDropoffMessage(job));
    try {
      await markNotif({ data: { jobId: job.id, kind: "dropoff" } });
      setJob({ ...job, dropoff_notification_sent: true });
    } catch {}
  };
  const sendCompleted = async () => {
    if (!job) return;
    openWhatsApp(job.customer?.phone, buildPickupMessage(job));
    try {
      await markNotif({ data: { jobId: job.id, kind: "completed" } });
      setJob({ ...job, completed_notification_sent: true });
    } catch {}
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }
  if (!job) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Job not found</p>
      </main>
    );
  }

  const showClose = job.status === "repair_completed";
  const bothNotifSent =
    job.dropoff_notification_sent &&
    (job.status === "repair_completed" || job.status === "closed"
      ? job.completed_notification_sent
      : true);
  const showDropoffBtn = !job.dropoff_notification_sent;
  const showCompletedBtn = job.status === "repair_completed" && !job.completed_notification_sent;

  return (
    <main className="min-h-screen w-full bg-background flex flex-col pb-44">
      <header className="relative w-full px-5 pt-6 pb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/jobs/active" })}
          className="w-10 h-10 -ml-2 flex items-center justify-center text-foreground"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-mono text-sky-400 font-bold text-lg">#{job.job_number}</h1>
        <button
          type="button"
          onClick={() => setStatusSheet(true)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-semibold",
            statusPillClasses(job.status),
          ].join(" ")}
        >
          {statusLabel(job.status)}
        </button>
      </header>

      <div className="px-5 space-y-6">
        <Section title="Customer">
          <p className="font-body font-bold text-base text-white">{job.customer?.name ?? "—"}</p>
          {job.customer?.phone && (
            <a
              href={`tel:${job.customer.phone}`}
              className="block text-muted-foreground text-sm mt-0.5"
            >
              {job.customer.phone}
            </a>
          )}
          {job.customer?.address && (
            <p className="text-muted-foreground text-sm mt-0.5">{job.customer.address}</p>
          )}
        </Section>

        <Section title="Vehicle">
          <p className="font-body font-bold text-base text-white">
            {[job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "—"}
          </p>
          <p className="text-muted-foreground text-sm mt-0.5">
            {[job.vehicle?.year, job.vehicle?.colour].filter(Boolean).join(" · ") || "—"}
          </p>
          {job.vehicle?.licence_plate && (
            <p className="font-mono text-sky-400 mt-1">{job.vehicle.licence_plate}</p>
          )}
          {job.mileage_at_dropoff != null && (
            <p className="text-muted-foreground text-sm mt-1">
              {job.mileage_at_dropoff.toLocaleString("en-IN")} km at drop-off
            </p>
          )}
        </Section>

        <Section title="Complaint">
          <p className="text-[15px] text-white whitespace-pre-wrap">
            {job.customer_complaint ?? "—"}
          </p>

          {job.prior_visits.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-muted-foreground text-[11px] uppercase tracking-widest">
                  Previous Visits
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <ul className="space-y-2">
                {job.prior_visits.map((v) => (
                  <PriorCard key={v.id} visit={v} />
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Timeline">
          <TimelineRow icon="📥" label="Dropped off" value={formatDateTime(job.dropped_off_at)} />
          <TimelineRow icon="🔧" label="Repair completed" value={formatDateTime(job.repair_completed_at)} />
          <TimelineRow icon="📤" label="Picked up" value={formatDateTime(job.picked_up_at)} />
          <TimelineRow icon="📅" label="Pickup requested" value={formatDate(job.pickup_requested_date)} />
        </Section>

        <Section title="Financials">
          <div className="space-y-2">
            {(job.package || job.custom_package_amount != null) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-white">{job.package?.name ?? "Custom Package"}</span>
                <span className="text-white font-bold">
                  {formatINR(job.package?.price ?? job.custom_package_amount ?? 0)}
                </span>
              </div>
            )}
            {job.parts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-white truncate pr-2">{p.part_name}</span>
                <span className="text-muted-foreground text-xs mr-2 shrink-0">
                  {p.quantity} {p.unit}
                </span>
                <span className="text-white font-bold shrink-0">{formatINR(p.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="font-display text-lg tracking-wide text-white">TOTAL</span>
            <span className="font-display text-2xl text-primary">{formatINR(job.total_amount)}</span>
          </div>
        </Section>

        <Section title="Notifications">
          {showDropoffBtn && (
            <button
              type="button"
              onClick={sendDropoff}
              className="w-full h-12 rounded-lg border-2 border-amber-400 text-amber-400 font-semibold text-sm active:scale-[0.98] transition mb-2"
            >
              📱 Send Drop-off Notification
            </button>
          )}
          {showCompletedBtn && (
            <button
              type="button"
              onClick={sendCompleted}
              className="w-full h-12 rounded-lg border-2 border-green-500 text-green-400 font-semibold text-sm active:scale-[0.98] transition"
            >
              📱 Send Ready for Pickup
            </button>
          )}
          {!showDropoffBtn && !showCompletedBtn && bothNotifSent && (
            <p className="text-green-400/80 text-sm text-center">✓ All notifications sent</p>
          )}
        </Section>
      </div>

      {/* Bottom fixed actions */}
      <div className="fixed inset-x-0 bottom-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t border-border space-y-2">
        <button
          type="button"
          onClick={() => {
            if (!job.customer || !job.vehicle) {
              toast.error("Cannot edit: job missing customer or vehicle");
              return;
            }
            setJobDraft({
              phone: job.customer.phone,
              customer: {
                id: job.customer.id,
                name: job.customer.name,
                phone: job.customer.phone,
                address: job.customer.address,
              },
              address: job.customer.address,
              vehicle: {
                id: job.vehicle.id,
                make: job.vehicle.make,
                model: job.vehicle.model,
                year: job.vehicle.year,
                licence_plate: job.vehicle.licence_plate,
                type: job.vehicle.type,
                colour: job.vehicle.colour,
                last_mileage: null,
              },
              editJobId: job.id,
              initialComplaint: job.customer_complaint ?? "",
              initialPickupDate: job.pickup_requested_date,
              initialMileage: job.mileage_at_dropoff,
            });
            navigate({ to: "/jobs/new/vehicle" });
          }}
          className="w-full h-12 rounded-lg border-2 border-primary text-primary font-semibold text-sm active:scale-[0.98] transition"
        >
          Edit Job Card
        </button>
        {showClose && (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="w-full h-12 rounded-lg bg-primary text-white font-semibold text-sm active:scale-[0.98] transition"
          >
            Close Job
          </button>
        )}
      </div>

      {statusSheet && (
        <StatusSheet
          current={job.status as StatusKey}
          onClose={() => setStatusSheet(false)}
          onPick={handleStatusPick}
        />
      )}

      {confirmClose && (
        <ConfirmCloseDialog
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            applyStatus("closed");
          }}
        />
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-l-2 border-primary pl-3">
      <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TimelineRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-white">
        <span className="mr-2" aria-hidden>{icon}</span>
        {label}
      </span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function PriorCard({ visit }: { visit: PriorVisitDTO }) {
  const [open, setOpen] = useState(false);
  const d = visit.dropped_off_at ? new Date(visit.dropped_off_at) : null;
  const date = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const mileage = visit.mileage_at_dropoff != null
    ? `${visit.mileage_at_dropoff.toLocaleString("en-IN")} km`
    : "—";
  const firstLine = (visit.customer_complaint ?? "").split("\n")[0] || "—";
  return (
    <li className="rounded-lg bg-card border-l-[3px] border-l-primary p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0 flex items-center gap-3 text-sm">
          <span className="text-white shrink-0">{date}</span>
          <span className="text-muted-foreground shrink-0">{mileage}</span>
          <span className="text-muted-foreground truncate">{firstLine}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <p className="mt-2 text-sm text-white whitespace-pre-wrap">
          {visit.customer_complaint ?? "No complaint recorded."}
        </p>
      )}
    </li>
  );
}

function StatusSheet({
  current,
  onClose,
  onPick,
}: {
  current: StatusKey;
  onClose: () => void;
  onPick: (k: StatusKey) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full bg-card rounded-t-2xl p-5 pb-[max(env(safe-area-inset-bottom),1rem)] border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
        <h3 className="text-white font-display text-xl tracking-wide mb-3">Change Status</h3>
        <ul className="space-y-2">
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.key === current;
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  onClick={() => onPick(opt.key)}
                  className="w-full flex items-center gap-3 rounded-lg p-3 bg-background border border-border text-left active:scale-[0.99] transition"
                >
                  <span className={["w-2.5 h-2.5 rounded-full shrink-0", opt.dot].join(" ")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{opt.label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{opt.desc}</p>
                  </div>
                  {active && <Check className="w-5 h-5 text-primary shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ConfirmCloseDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-sm bg-card rounded-xl p-5 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-display text-xl tracking-wide">Confirm vehicle pickup</h3>
        <p className="text-muted-foreground text-sm mt-2">
          Has the customer collected their vehicle?
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-lg border border-border text-white text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-semibold"
          >
            Yes, Close Job
          </button>
        </div>
      </div>
    </div>
  );
}
