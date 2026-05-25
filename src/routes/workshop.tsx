import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { getCurrentKioskUser } from "@/lib/kiosk.functions";

export const Route = createFileRoute("/workshop")({
  head: () => ({ meta: [{ title: "Workshop — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    if (user.access_level !== "full-admin") {
      throw redirect({ to: "/home" });
    }
    return { kioskUser: user };
  },
  component: WorkshopPlaceholder,
});

function WorkshopPlaceholder() {
  const navigate = useNavigate();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <Logo className="text-4xl" />
      <h1 className="font-display text-3xl text-foreground">Workshop</h1>
      <p className="text-muted-foreground text-sm">Settings & admin coming soon.</p>
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
