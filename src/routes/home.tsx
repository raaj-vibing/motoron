import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { clearKioskUser, getKioskUser, type KioskUser } from "@/lib/kiosk-session";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Home — MotorON.ai" }] }),
  component: HomePlaceholder,
});

function HomePlaceholder() {
  const navigate = useNavigate();
  const [user, setUser] = useState<KioskUser | null>(null);

  useEffect(() => {
    const u = getKioskUser();
    if (!u) {
      navigate({ to: "/" });
      return;
    }
    setUser(u);
  }, [navigate]);

  if (!user) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Logo className="text-5xl" />
      <p className="mt-6 text-foreground font-display text-2xl">
        Signed in as {user.name}
      </p>
      <p className="mt-2 text-muted-foreground text-sm max-w-xs">
        Home screen coming soon. The rest of the app will be built here.
      </p>
      <button
        type="button"
        onClick={() => {
          clearKioskUser();
          navigate({ to: "/" });
        }}
        className="mt-8 text-xs uppercase tracking-widest text-accent"
      >
        ← Sign out
      </button>
      <Link to="/" className="sr-only">Home</Link>
    </main>
  );
}
