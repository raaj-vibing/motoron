import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/jobs/active")({
  head: () => ({ meta: [{ title: "Active Jobs — MotorON.ai" }] }),
  component: ActiveJobsPlaceholder,
});

function ActiveJobsPlaceholder() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <Logo className="text-4xl" />
      <h1 className="font-display text-3xl text-foreground">Active Jobs</h1>
      <p className="text-muted-foreground text-sm">Coming soon.</p>
      <button
        type="button"
        onClick={() => navigate({ to: "/home" })}
        className="text-xs uppercase tracking-widest text-accent"
      >
        ← Back
      </button>
      <Link to="/home" className="sr-only">Home</Link>
    </main>
  );
}
