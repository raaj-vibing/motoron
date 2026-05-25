import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import {
  getCurrentKioskUser,
  listPriorVisits,
  createJobCard,
  updateJobCard,
  type PriorVisitDTO,
  type CreateJobResult,
} from "@/lib/kiosk.functions";
import { getJobDraft, clearJobDraft, type JobDraft } from "@/lib/job-draft";

export const Route = createFileRoute("/jobs/new/complaint")({
  head: () => ({ meta: [{ title: "Complaint — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    return { kioskUser: user };
  },
  component: ComplaintStep,
});

const todayISO = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

function formatVisitDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ComplaintStep() {
  const navigate = useNavigate();
  const loadPrior = useServerFn(listPriorVisits);
  const submit = useServerFn(createJobCard);
  const submitUpdate = useServerFn(updateJobCard);

  const [draft, setDraft] = useState<JobDraft | null>(null);
  const [complaint, setComplaint] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<CreateJobResult | null>(null);

  const [priorVisits, setPriorVisits] = useState<PriorVisitDTO[]>([]);
  const [showAllVisits, setShowAllVisits] = useState(false);

  useEffect(() => {
    const d = getJobDraft();
    if (!d || !d.vehicleForm) {
      navigate({ to: "/jobs/new" });
      return;
    }
    setDraft(d);
    if (d.editJobId) {
      if (d.initialComplaint) setComplaint(d.initialComplaint);
      if (d.initialPickupDate) setPickupDate(d.initialPickupDate);
    }
    if (d.customer) {
      loadPrior({
        data: {
          customerId: d.customer.id,
          vehicleId: d.vehicle?.id,
        },
      })
        .then((rows) =>
          setPriorVisits(d.editJobId ? rows.filter((r) => r.id !== d.editJobId) : rows),
        )
        .catch(() => setPriorVisits([]));
    }
  }, [navigate, loadPrior]);

  const isEdit = !!draft?.editJobId;

  const handleSubmit = async () => {
    if (!draft || !draft.vehicleForm) return;
    const trimmed = complaint.trim();
    if (!trimmed) {
      setError("Please enter the customer complaint");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && draft.editJobId && draft.customer) {
        await submitUpdate({
          data: {
            jobId: draft.editJobId,
            customerId: draft.customer.id,
            customerName: draft.customer.name,
            address: draft.address ?? draft.customer.address ?? null,
            vehicleId: draft.vehicle?.id ?? null,
            vehicleForm: draft.vehicleForm,
            complaint: trimmed,
            pickupRequestedDate: pickupDate || null,
          },
        });
        const jobId = draft.editJobId;
        clearJobDraft();
        navigate({ to: "/jobs/$jobId", params: { jobId } });
        return;
      }

      const result = await submit({
        data: {
          phone: draft.phone,
          existingCustomerId: draft.customer?.id ?? null,
          newCustomerName: draft.customer ? undefined : draft.newCustomerName,
          address: draft.address ?? null,
          existingVehicleId: draft.vehicle?.id ?? null,
          vehicleForm: draft.vehicleForm,
          complaint: trimmed,
          pickupRequestedDate: pickupDate || null,
        },
      });

      const msg =
        `Hi ${result.customerName}, your ${result.vehicleMake} ${result.vehicleModel} ` +
        `has been dropped off at My Workshop. ` +
        `Questions? Call 9800000000. Find us: https://maps.google.com. ` +
        `We are open Mon-Sat 9am-7pm. — My Workshop`;
      const url = `https://wa.me/91${result.customerPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank", "noopener,noreferrer");

      setSuccess(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : isEdit ? "Failed to update job" : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToHome = () => {
    clearJobDraft();
    navigate({ to: "/home" });
  };

  if (!draft) return null;

  const visitsToShow = showAllVisits ? priorVisits : priorVisits.slice(0, 5);
  const hasMore = priorVisits.length > 5;

  return (
    <main className="min-h-screen w-full bg-background flex flex-col pb-28">
      <header className="relative w-full px-5 pt-6 pb-3 flex items-center justify-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/jobs/new/vehicle" })}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-foreground hover:text-primary transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-display text-[24px] tracking-wide text-foreground">
          Customer Complaint
        </h1>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
          Step 3 of 3
        </span>
      </header>

      <div className="px-6 mt-2 space-y-5">
        <div>
          <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
            What is the customer saying?
          </span>
          <textarea
            value={complaint}
            onChange={(e) => {
              setComplaint(e.target.value);
              if (e.target.value.trim()) setError(null);
            }}
            rows={5}
            placeholder="Describe the complaint in the customer's own words. No technical language needed."
            className={[
              "w-full px-4 py-3 rounded-lg bg-card border-2 text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors resize-y min-h-[140px]",
              error
                ? "border-destructive focus:border-destructive"
                : "border-border focus:border-primary",
            ].join(" ")}
          />
          {error && (
            <p className="mt-1.5 text-xs text-destructive">{error}</p>
          )}
        </div>

        <div>
          <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
            Pickup Requested Date
          </span>
          <input
            type="date"
            min={todayISO()}
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="w-full h-[52px] px-4 rounded-lg bg-card border-2 border-border text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {draft.customer && priorVisits.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-muted-foreground text-[11px] uppercase tracking-widest">
                Previous Visits
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <ul className="space-y-2">
              {visitsToShow.map((v) => (
                <PriorVisitCard key={v.id} visit={v} />
              ))}
            </ul>

            {hasMore && !showAllVisits && (
              <button
                type="button"
                onClick={() => setShowAllVisits(true)}
                className="mt-3 text-primary text-sm font-medium"
              >
                View all history →
              </button>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t border-border">
        <button
          type="button"
          disabled={submitting}
          onClick={handleCreate}
          className="w-full h-14 rounded-lg bg-primary text-white font-display text-[22px] tracking-wide active:scale-[0.98] transition disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create Job"}
        </button>
      </div>

      {success && (
        <SuccessOverlay result={success} onBackHome={handleBackToHome} />
      )}
    </main>
  );
}

function PriorVisitCard({ visit }: { visit: PriorVisitDTO }) {
  const [open, setOpen] = useState(false);
  const date = formatVisitDate(visit.dropped_off_at);
  const mileage =
    visit.mileage_at_dropoff != null
      ? `${visit.mileage_at_dropoff.toLocaleString("en-IN")} km`
      : "—";
  const firstLine = (visit.customer_complaint ?? "").split("\n")[0] || "—";

  return (
    <li className="rounded-lg bg-card border-l-[3px] border-l-primary p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0 flex items-center gap-3 text-sm">
          <span className="text-foreground font-medium shrink-0">{date}</span>
          <span className="text-muted-foreground shrink-0">{mileage}</span>
          <span className="text-muted-foreground truncate">{firstLine}</span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
          {visit.customer_complaint ?? "No complaint recorded."}
        </p>
      )}
    </li>
  );
}

function SuccessOverlay({
  result,
  onBackHome,
}: {
  result: CreateJobResult;
  onBackHome: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 animate-fade-in">
      <CheckCircle2 className="w-24 h-24 text-emerald-500 mb-6" strokeWidth={1.5} />
      <h2 className="font-display text-[36px] text-primary text-center leading-tight">
        Job #{result.jobNumber} Created!
      </h2>
      <p className="mt-3 text-muted-foreground text-sm text-center max-w-xs">
        Drop-off notification ready to send on WhatsApp
      </p>
      <div className="mt-10 w-full max-w-sm">
        <button
          type="button"
          onClick={onBackHome}
          className="w-full h-14 rounded-lg bg-primary text-white font-display text-[22px] tracking-wide active:scale-[0.98] transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
