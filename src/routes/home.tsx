import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Logo } from "@/components/Logo";
import { getKioskSession, signOutKiosk } from "@/lib/auth.functions";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [{ title: "Home — MotorON.ai" }],
  }),
  beforeLoad: async () => {
    const session = await getKioskSession();
    if (!session.authenticated) {
      throw redirect({ to: "/" });
    }
    return { user: session.user };
  },
  loader: ({ context }) => ({ user: context.user }),
  component: HomePlaceholder,
});

function HomePlaceholder() {
  const { user } = Route.useLoaderData();
  const navigate = useNavigate();
  const signOut = useServerFn(signOutKiosk);

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
        onClick={async () => {
          await signOut();
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
