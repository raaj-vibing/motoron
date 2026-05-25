import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getCurrentKioskUser, listActiveJobs, type ActiveJobDTO } from "@/lib/kiosk.functions";

export const Route = createFileRoute("/jobs/active")({
  head: () => ({ meta: [{ title: "Active Jobs — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    return { kioskUser: user };
  },
  component: ActiveJobsPage,
});

type FilterKey = "all" | "pending" | "in_progress" | "repair_completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "repair_completed", label: "Repair Completed" },
];

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const ms = Date.now() - then;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function statusLabel(s: string): string {
  if (s === "in_progress") return "In Progress";
  if (s === "repair_completed") return "Repair Completed";
  return "Pending";
}

function statusPillClasses(s: string): string {
  if (s === "in_progress") return "bg-sky-400/15 text-sky-300";
  if (s === "repair_completed") return "bg-green-500/15 text-green-400";
  return "bg-amber-500/15 text-amber-400";
}

function ActiveJobsPage() {
  const navigate = useNavigate();
  const fetchJobs = useServerFn(listActiveJobs);
  const [jobs, setJobs] = useState<ActiveJobDTO[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [pullOffset, setPullOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const res = await fetchJobs();
      setJobs(res.jobs);
      setThreshold(res.threshold);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollerRef.current?.scrollTop ?? 0) <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullOffset(Math.min(80, delta * 0.5));
  };
  const onTouchEnd = async () => {
    if (pullOffset > 50) {
      setRefreshing(true);
      setPullOffset(40);
      await load();
    }
    setPullOffset(0);
    touchStartY.current = null;
  };

  const filtered = jobs.filter((j) => (filter === "all" ? true : j.status === filter));

  return (
    <main className="min-h-screen w-full flex flex-col bg-background">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="w-10 h-10 -ml-2 flex items-center justify-center text-foreground"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-display text-[28px] text-white tracking-wide">Active Jobs</h1>
        <span className="min-w-[44px] h-7 px-3 rounded-full bg-primary text-white font-display text-base flex items-center justify-center">
          {jobs.length}
        </span>
      </header>

      <div className="overflow-x-auto no-scrollbar px-5 pb-3">
        <div className="flex gap-2 w-max">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={[
                  "h-9 rounded-full px-4 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-white font-bold"
                    : "bg-[#1B2E42] text-[#94A3B8]",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-1 overflow-y-auto px-5 pb-8"
      >
        {(pullOffset > 0 || refreshing) && (
          <div
            className="flex items-center justify-center text-xs text-muted-foreground transition-all"
            style={{ height: pullOffset || 40 }}
          >
            {refreshing ? "Refreshing…" : pullOffset > 50 ? "Release to refresh" : "Pull to refresh"}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[112px] rounded-[12px] bg-[#1B2E42] border border-[#2D4A66] animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-2 mt-24">
            <span className="text-4xl" aria-hidden>🔧</span>
            <p className="font-body text-base text-muted-foreground">
              No active jobs right now.
            </p>
            <p className="font-body text-[13px] text-[#94A3B8]">
              Tap New Job to get started
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((j) => {
              const days = daysSince(j.dropped_off_at);
              const overdue = days > threshold;
              return (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId: j.id } })}
                    className="w-full text-left rounded-[12px] p-4 bg-[#1B2E42] border border-[#2D4A66] active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sky-400 font-bold text-sm">
                        #{j.job_number}
                      </span>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          statusPillClasses(j.status),
                        ].join(" ")}
                      >
                        {statusLabel(j.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-body font-bold text-base text-white truncate pr-3">
                        {j.customer_name}
                      </span>
                      <span
                        className={[
                          "rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
                          overdue
                            ? "bg-red-500 text-white"
                            : "bg-[#2D4A66] text-muted-foreground",
                        ].join(" ")}
                      >
                        {overdue ? "⚠ " : ""}Day {days}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-body text-[13px] text-[#94A3B8] truncate pr-3">
                        {[j.vehicle_make, j.vehicle_model].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="font-body text-sm text-white font-bold">
                        {formatINR(j.total_amount)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
