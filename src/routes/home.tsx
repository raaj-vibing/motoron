import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [{ title: "Home — MotorON.ai" }],
  }),
  component: HomePlaceholder,
});

function HomePlaceholder() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <Logo className="text-5xl" />
      <p className="mt-6 text-foreground font-display text-2xl">
        Signed in
      </p>
      <p className="mt-2 text-muted-foreground text-sm max-w-xs">
        Home screen coming soon. The rest of the app will be built here.
      </p>
      <Link
        to="/"
        className="mt-8 text-xs uppercase tracking-widest text-accent"
      >
        ← Sign out
      </Link>
    </main>
  );
}
