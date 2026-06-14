import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Check,
  Plus,
  Trash2,
  Search,
} from "lucide-react";
import {
  getCurrentKioskUser,
  listPriorVisits,
  createJobCard,
  updateJobCard,
  listPackagesForJob,
  listPartsLibrary,
  type PriorVisitDTO,
  type CreateJobResult,
  type ServicePackageDTO,
  type PartsLibraryItem,
} from "@/lib/kiosk.functions";
import { getJobDraft, clearJobDraft, type JobDraft, type DraftPart } from "@/lib/job-draft";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

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

const UNITS = ["pcs", "litre", "ml", "set", "pair", "metre"] as const;

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

const formatRupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function ComplaintStep() {
  const navigate = useNavigate();
  const loadPrior = useServerFn(listPriorVisits);
  const loadPackages = useServerFn(listPackagesForJob);
  const loadParts = useServerFn(listPartsLibrary);
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

  // Packages
  const [packages, setPackages] = useState<ServicePackageDTO[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");

  // Parts
  const [parts, setParts] = useState<DraftPart[]>([]);
  const [partsLibrary, setPartsLibrary] = useState<PartsLibraryItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      if (d.initialPackageId) setSelectedPackageId(d.initialPackageId);
      if (d.initialCustomPackageAmount != null) {
        setCustomAmount(String(d.initialCustomPackageAmount));
      }
      if (d.initialParts) setParts(d.initialParts);
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
    loadPackages().then(setPackages).catch(() => setPackages([]));
    loadParts().then(setPartsLibrary).catch(() => setPartsLibrary([]));
  }, [navigate, loadPrior, loadPackages, loadParts]);

  const isEdit = !!draft?.editJobId;

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  const packageCharge = useMemo(() => {
    if (!selectedPackage) return 0;
    if (selectedPackage.is_custom) {
      const n = parseInt(customAmount, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return selectedPackage.price;
  }, [selectedPackage, customAmount]);

  const partsTotal = useMemo(
    () => parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0),
    [parts],
  );

  const totalEstimate = packageCharge + partsTotal;

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
      const isCustom = !!selectedPackage?.is_custom;
      const payloadPackageId = selectedPackage ? selectedPackage.id : null;
      const payloadCustomAmount = isCustom && packageCharge > 0 ? packageCharge : null;
      const payloadParts = parts.map((p) => ({
        partName: p.partName,
        quantity: p.quantity,
        unit: p.unit,
        unitPrice: p.unitPrice,
        lineTotal: p.lineTotal,
      }));

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
            packageId: payloadPackageId,
            customPackageAmount: payloadCustomAmount,
            parts: payloadParts,
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
          packageId: payloadPackageId,
          customPackageAmount: payloadCustomAmount,
          parts: payloadParts,
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
          {isEdit ? "Edit Complaint" : "Customer Complaint"}
        </h1>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
          {isEdit ? "Edit · 2 of 2" : "Step 3 of 3"}
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

        {/* SERVICE PACKAGE */}
        <div>
          <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
            Service Package
          </span>
          {packages.length === 0 ? (
            <p className="text-muted-foreground text-sm py-2">
              No packages configured yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {packages.map((p) => {
                const isSel = selectedPackageId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPackageId(isSel ? null : p.id)
                      }
                      className={[
                        "relative w-full text-left rounded-xl p-4 border-2 transition flex items-start justify-between gap-3",
                        isSel
                          ? "border-primary bg-primary/10"
                          : "bg-card border-[#2D4A66]",
                      ].join(" ")}
                    >
                      <div className="min-w-0 pr-6">
                        <div className="text-foreground font-semibold text-[15px]">
                          {p.name}
                        </div>
                        {p.subtitle && (
                          <div className="text-muted-foreground text-xs mt-0.5">
                            {p.subtitle}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-primary font-bold text-[15px]">
                        {p.is_custom ? "Custom" : formatRupees(p.price)}
                      </div>
                      {isSel && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedPackage?.is_custom && (
            <div className="mt-3">
              <label className="block text-muted-foreground text-xs mb-1.5">
                Enter amount (₹)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customAmount}
                onChange={(e) =>
                  setCustomAmount(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="0"
                className="w-full h-[48px] px-4 rounded-lg bg-card border-2 border-border text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* PARTS & MATERIALS */}
        <div>
          <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
            Parts & Materials
          </span>

          {parts.length > 0 && (
            <ul className="space-y-2 mb-3">
              {parts.map((p, idx) => (
                <li
                  key={idx}
                  className="rounded-lg bg-card border border-[#2D4A66] p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground text-sm font-medium truncate">
                      {p.partName}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {p.quantity} {p.unit} · {formatRupees(p.unitPrice)} each
                    </div>
                  </div>
                  <div className="text-foreground font-bold text-sm">
                    {formatRupees(p.quantity * p.unitPrice)}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setParts((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-2 text-muted-foreground hover:text-destructive transition"
                    aria-label="Remove part"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full h-12 rounded-lg border-2 border-dashed border-primary text-primary font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" /> Add Part
          </button>
        </div>

        {/* COST SUMMARY */}
        {(selectedPackage || parts.length > 0) && (
          <div className="rounded-xl bg-card border border-[#2D4A66] p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Package Charge</span>
              <span className="text-foreground">{formatRupees(packageCharge)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Parts & Materials</span>
              <span className="text-foreground">{formatRupees(partsTotal)}</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between items-center">
              <span className="text-foreground font-medium text-sm">
                Total Estimate
              </span>
              <span className="text-primary font-bold text-xl">
                {formatRupees(totalEstimate)}
              </span>
            </div>
          </div>
        )}

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
          onClick={handleSubmit}
          className="w-full h-14 rounded-lg bg-primary text-white font-display text-[22px] tracking-wide active:scale-[0.98] transition disabled:opacity-60"
        >
          {submitting
            ? isEdit ? "Updating…" : "Creating…"
            : isEdit ? "Update Job" : "Create Job"}
        </button>
      </div>

      <AddPartDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        library={partsLibrary}
        onAdd={(p) => {
          setParts((prev) => [...prev, p]);
          setDrawerOpen(false);
        }}
      />

      {success && (
        <SuccessOverlay result={success} onBackHome={handleBackToHome} />
      )}
    </main>
  );
}

function AddPartDrawer({
  open,
  onOpenChange,
  library,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  library: PartsLibraryItem[];
  onAdd: (p: DraftPart) => void;
}) {
  const [search, setSearch] = useState("");
  const [partName, setPartName] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>("pcs");
  const [unitPrice, setUnitPrice] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPartName("");
      setManualMode(false);
      setQuantity("");
      setUnit("pcs");
      setUnitPrice("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter((p) => p.name.toLowerCase().includes(q));
  }, [library, search]);

  const qtyNum = parseFloat(quantity) || 0;
  const priceNum = parseFloat(unitPrice) || 0;
  const lineTotal = qtyNum * priceNum;

  const canAdd = partName.trim().length > 0 && qtyNum > 0 && priceNum >= 0;

  const handleSelectLibrary = (p: PartsLibraryItem) => {
    setPartName(p.name);
    setUnit(p.default_unit || "pcs");
    setManualMode(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-foreground font-display text-[22px] tracking-wide text-left">
            Add Part
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 overflow-y-auto">
          {/* Part name */}
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
              Part Name
            </label>

            {!partName ? (
              <>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search parts…"
                    className="w-full h-11 pl-9 pr-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectLibrary(p)}
                        className="w-full px-3 py-2.5 text-left text-foreground text-sm hover:bg-background/50 transition flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {p.default_unit}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setManualMode(true);
                        setPartName(" ");
                      }}
                      className="w-full px-3 py-2.5 text-left text-primary text-sm hover:bg-background/50 transition"
                    >
                      Other — type manually
                    </button>
                  </li>
                </ul>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {manualMode ? (
                  <input
                    type="text"
                    autoFocus
                    value={partName.trim()}
                    onChange={(e) => setPartName(e.target.value)}
                    placeholder="Type part name"
                    className="flex-1 h-11 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                  />
                ) : (
                  <div className="flex-1 h-11 px-3 rounded-lg bg-background border border-border text-foreground flex items-center">
                    {partName}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPartName("");
                    setManualMode(false);
                  }}
                  className="text-muted-foreground text-xs px-2"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
              Quantity
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Unit segmented */}
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
              Unit
            </label>
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={[
                    "px-3 h-9 rounded-md text-xs font-medium transition",
                    unit === u
                      ? "bg-primary text-white"
                      : "bg-background border border-border text-muted-foreground",
                  ].join(" ")}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
              Unit Price (₹)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
              className="w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="text-primary font-bold text-sm">
            Total: {formatRupees(lineTotal)}
          </div>

          <button
            type="button"
            disabled={!canAdd}
            onClick={() =>
              onAdd({
                partName: partName.trim(),
                quantity: qtyNum,
                unit,
                unitPrice: priceNum,
              })
            }
            className="w-full h-12 rounded-lg bg-primary text-white font-semibold text-sm active:scale-[0.98] transition disabled:opacity-50"
          >
            Add Part
          </button>
        </div>
      </DrawerContent>
    </Drawer>
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
