import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MoreHorizontal, Printer } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "invoice-print-styles";
    style.innerHTML = `
      @media print {
        @page { margin: 0; size: auto; }
        body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
        .invoice-shell { padding: 0 !important; background: white !important; }
        .invoice-page {
          width: 210mm !important;
          max-width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          background: white !important;
          color: black !important;
        }
        .invoice-watermark { opacity: 0.06 !important; }
        .invoice-stamp { opacity: 1 !important; }
        .invoice-text-dark { color: black !important; }
        .invoice-text-muted { color: #374151 !important; }
        .invoice-border { border-color: #e5e7eb !important; }
        .invoice-primary { color: #d97706 !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById("invoice-print-styles");
      if (existing) document.head.removeChild(existing);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success("Link copied");
    });
    setMenuOpen(false);
  };

  const showPaidStamp =
    job.status === "closed" && job.payment_status === "paid";

  return (
    <main className="invoice-shell min-h-screen w-full bg-background flex flex-col items-center pb-28">
      {/* Header */}
      <header className="no-print relative w-full px-5 pt-6 pb-4 flex items-center">
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
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary text-white active:scale-[0.97] transition"
            aria-label="Print Invoice"
          >
            <Printer size={18} />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-card border border-border text-foreground active:scale-[0.97] transition"
              aria-label="More options"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-48 rounded-xl bg-card border border-border shadow-xl overflow-hidden">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-primary/10 transition"
                >
                  Copy Link
                </button>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!customerPhone) {
                      e.preventDefault();
                      toast.error("Customer phone not available");
                    }
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-foreground hover:bg-primary/10 transition"
                >
                  Share on WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Invoice A4 page */}
      <section className="invoice-page relative w-full max-w-[210mm] mx-4 md:mx-auto rounded-xl bg-white text-black p-8 md:p-10 overflow-hidden shadow-2xl">
        {/* Orange stripe */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-[#D97706]" />

        {/* Watermark */}
        <div className="invoice-watermark absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <span className="text-[80px] font-bold uppercase tracking-widest text-black rotate-[-30deg]">
            Customer Copy
          </span>
        </div>

        {/* Paid stamp */}
        {showPaidStamp && (
          <div className="invoice-stamp absolute top-10 right-10 w-28 h-28 rounded-full border-4 border-green-600 flex items-center justify-center rotate-[-12deg] opacity-80">
            <span className="text-green-600 font-bold text-lg uppercase tracking-widest">
              Paid
            </span>
          </div>
        )}

        {/* Header content */}
        <div className="text-center mt-4">
          <p
            className="text-3xl leading-none font-serif"
            style={{ fontFamily: "Georgia, serif" }}
          >
            <span className="invoice-text-dark">Motor</span>
            <span className="invoice-primary">ON</span>
            <span className="text-sky-600">.ai</span>
          </p>
          <p
            className="text-[28px] tracking-wide mt-3 font-serif"
            style={{ fontFamily: "Georgia, serif" }}
          >
            INVOICE
          </p>
          <p className="font-mono text-sky-600 text-sm mt-1">{invoiceNo}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {formatDate(new Date().toISOString())}
          </p>
        </div>

        <div className="my-5 h-px bg-gray-200 invoice-border" />

        {/* Bill To */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Bill To
          </p>
          <p
            className="font-bold text-black text-base"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {customerName}
          </p>
          {customerPhone && (
            <p className="text-gray-600 text-sm font-mono">{customerPhone}</p>
          )}
          <p className="text-gray-600 text-sm mt-1">
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
            <p className="font-mono text-sky-600 mt-1">
              {job.vehicle.licence_plate}
            </p>
          )}
          {job.mileage_at_dropoff != null && (
            <p className="text-gray-500 text-xs mt-1">
              Odometer at drop-off:{" "}
              {job.mileage_at_dropoff.toLocaleString("en-IN")} km
            </p>
          )}
        </div>

        <div className="my-5 h-px bg-gray-200 invoice-border" />

        {/* Line items */}
        <div>
          <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-widest text-gray-500 pb-2">
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
            <p className="text-gray-500 text-sm py-3 text-center">
              No line items
            </p>
          )}
        </div>

        <div className="my-5 h-px bg-gray-200 invoice-border" />

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-black font-mono">{formatINR(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span
              className="text-black text-lg tracking-wide font-serif"
              style={{ fontFamily: "Georgia, serif" }}
            >
              TOTAL
            </span>
            <span
              className="text-[#D97706] text-[28px] leading-none font-serif"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {formatINR(total)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-0.5">
          <p className="text-gray-500 text-xs">
            Thank you for visiting MotorON.ai
          </p>
          <p className="text-gray-500 text-xs">
            {workshopName}
            {job.workshop?.phone ? ` · ${job.workshop.phone}` : ""}
          </p>
        </div>
      </section>

      {/* Bottom action bar */}
      <div className="no-print fixed inset-x-0 bottom-0 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t border-border">
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
        alt ? "bg-gray-50" : "",
      ].join(" ")}
    >
      <div className="col-span-5 text-black truncate">{item}</div>
      <div className="col-span-2 text-right text-gray-500 text-xs self-center font-mono">
        {qty}
      </div>
      <div className="col-span-2 text-right text-gray-500 self-center font-mono">
        {rate}
      </div>
      <div className="col-span-3 text-right text-black font-bold self-center font-mono">
        {total}
      </div>
    </div>
  );
}
