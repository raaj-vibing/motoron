import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getJobDraft, type JobDraft } from "@/lib/job-draft";

export const Route = createFileRoute("/jobs/new/vehicle")({
  head: () => ({ meta: [{ title: "Vehicle Details — MotorON.ai" }] }),
  component: VehicleStepPlaceholder,
});

function VehicleStepPlaceholder() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<JobDraft | null>(null);

  useEffect(() => {
    const d = getJobDraft();
    if (!d) {
      navigate({ to: "/jobs/new" });
      return;
    }
    setDraft(d);
  }, [navigate]);

  if (!draft) return null;

  return (
    <main className="min-h-screen w-full bg-background flex flex-col">
      <header className="relative w-full px-5 pt-6 pb-3 flex items-center justify-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/jobs/new" })}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-foreground hover:text-primary transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-display text-[24px] tracking-wide text-foreground">
          Vehicle Details
        </h1>
      </header>

      <section className="px-6 mt-4 flex-1">
        <p className="text-muted-foreground text-sm">
          Step 2 placeholder — vehicle form will live here.
        </p>

        <pre className="mt-6 p-4 rounded-lg bg-card border border-border text-xs text-foreground overflow-auto">
{JSON.stringify(draft, null, 2)}
        </pre>
      </section>
    </main>
  );
}
