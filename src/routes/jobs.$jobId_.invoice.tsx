import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  getCurrentKioskUser,
  getJobDetail,
  type JobDetailDTO,
} from "@/lib/kiosk.functions";

export const Route = createFileRoute("/jobs/$jobId_/invoice")({
  head: () => ({ meta: [{ title: "Invoice — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    return { kioskUser: user };
  },
  component: InvoicePage,
});

function formatINR(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function formatDate(iso: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function InvoicePage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const fetchJob = useServerFn(getJobDetail);
  const [job, setJob] = useState<JobDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchJob({ data: { jobId } });
        setJob(res);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

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

  const packagePrice = job.package?.price ?? job.custom_package_amount ?? 0;
  const hasPackage = !!job.package || job.custom_package_amount != null;
  const partsTotal = job.parts.reduce((sum, p) => sum + p.line_total, 0);
  const subtotal = packagePrice + partsTotal;
  const total = job.total_amount || subtotal;

  const customerName = job.customer?.name ?? "Customer";
  const customerPhone = job.customer?.phone ?? "";
  const workshopName = job.workshop?.name ?? "MotorON.ai";
  const make = job.vehicle?.make ?? "";
  const model = job.vehicle?.model ?? "";
  const invoiceNo = `INV-${job.job_number}`;
  const totalStr = Math.round(total).toLocaleString("en-IN");

  const waMsg = `Hi ${customerName}, your invoice for ${make} ${model} service is ready. Invoice #${invoiceNo} | Total: ₹${totalStr}. Thank you for choosing ${workshopName}! — ${workshopName}`;
  const waUrl = customerPhone
    ? `https://wa.me/91${customerPhone}?text=${encodeURIComponent(waMsg)}`
    : "#";

  return (
    <main className="min-h-screen w-full bg-background flex flex-col pb-44">
      <header className="relative w-full px-5 pt-6 pb-4 flex items-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId } })}
          className="w-10 h-10 -ml-2 flex items-center justify-center text-foreground"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 font-display tracking-wide text-white text-[28px] leading-none">
          INVOICE
        </h1>
      </header>

      <section className="mx-4 rounded-xl bg-card p-4 border border-border">
        <div className="text-center">
          <p className="font-display text-2xl leading-none">
            <span className="text-white">Motor</span>
            <span className="text-primary">ON</span>
            <span className="text-sky-400">.ai</span>
          </p>
          <p className="font-display text-white text-[28px] tracking-wide mt-2">
            INVOICE
          </p>
          <p className="font-mono text-sky-400 text-sm mt-1">{invoiceNo}</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {formatDate(new Date().toISOString())}
          </p>
        </div>

        <div className="my-4 h-px bg-border" />

        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
            Bill To
          </p>
          <p className="font-bold text-white text-base">{customerName}</p>
          {customerPhone && (
            <p className="text-muted-foreground text-sm">{customerPhone}</p>
          )}
          <p className="text-muted-foreground text-sm mt-1">
            {[
              job.vehicle?.make,
              job.vehicle?.model,
              job.vehicle?.year,
              job.vehicle?.colour,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {job.vehicle?.licence_plate && (
            <p className="font-mono text-sky-400 mt-1">
              {job.vehicle.licence_plate}
            </p>
          )}
          {job.mileage_at_dropoff != null && (
            <p className="text-muted-foreground text-xs mt-1">
              Odometer at drop-off:{" "}
              {job.mileage_at_dropoff.toLocaleString("en-IN")} km
            </p>
          )}
        </div>

        <div className="my-4 h-px bg-border" />

        <div>
          <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
            <div className="col-span-5">Item</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Rate</div>
            <div className="col-span-3 text-right">Total</div>
          </div>

          {hasPackage && (
            <Row
              alt={false}
              item={job.package?.name ?? "Custom Package"}
              qty="1 service"
              rate={formatINR(packagePrice)}
              total={formatINR(packagePrice)}
            />
          )}
          {job.parts.map((p, idx) => (
            <Row
              key={p.id}
              alt={(idx + (hasPackage ? 1 : 0)) % 2 === 1}
              item={p.part_name}
              qty={`${p.quantity} ${p.unit}`}
              rate={formatINR(p.unit_price)}
              total={formatINR(p.line_total)}
            />
          ))}
          {!hasPackage && job.parts.length === 0 && (
            <p className="text-muted-foreground text-sm py-3 text-center">
              No line items
            </p>
          )}
        </div>

        <div className="my-4 h-px bg-border" />

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-white">{formatINR(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-display text-white text-lg tracking-wide">
              TOTAL
            </span>
            <span className="font-display text-primary text-[28px] leading-none">
              {formatINR(total)}
            </span>
          </div>
        </div>

        <div className="mt-6 text-center space-y-0.5">
          <p className="text-muted-foreground text-xs">
            Thank you for visiting MotorON.ai
          </p>
          <p className="text-muted-foreground text-xs">
            {workshopName}
            {job.workshop?.phone ? ` · ${job.workshop.phone}` : ""}
          </p>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t border-border space-y-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!customerPhone) {
              e.preventDefault();
              toast.error("Customer phone not available");
            }
          }}
          className="block w-full h-12 rounded-lg font-semibold text-sm active:scale-[0.98] transition flex items-center justify-center text-white"
          style={{ backgroundColor: "#25D366" }}
        >
          📱 Share via WhatsApp
        </a>
        <button
          type="button"
          onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId } })}
          className="w-full h-12 rounded-lg border-2 border-primary text-primary font-semibold text-sm active:scale-[0.98] transition"
        >
          Back to Job
        </button>
      </div>
    </main>
  );
}

function Row({
  alt,
  item,
  qty,
  rate,
  total,
}: {
  alt: boolean;
  item: string;
  qty: string;
  rate: string;
  total: string;
}) {
  return (
    <div
      className={[
        "grid grid-cols-12 gap-2 py-2 text-sm rounded",
        alt ? "bg-background/40" : "",
      ].join(" ")}
    >
      <div className="col-span-5 text-white truncate">{item}</div>
      <div className="col-span-2 text-right text-muted-foreground text-xs self-center">
        {qty}
      </div>
      <div className="col-span-2 text-right text-muted-foreground self-center">
        {rate}
      </div>
      <div className="col-span-3 text-right text-white font-bold self-center">
        {total}
      </div>
    </div>
  );
}
