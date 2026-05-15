import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { clearKioskUser, getKioskUser, type KioskUser } from "@/lib/kiosk-session";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Home — MotorON.ai" }] }),
  component: HomePage,
});

function greetingFor(date: Date, name: string) {
  const h = date.getHours();
  const period = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${period}, ${name}`;
}

function HomePage() {
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

  const firstName = user.name.split(" ")[0] ?? user.name;
  const isAdmin = user.access_level === "full-admin";

  const logout = () => {
    clearKioskUser();
    navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen w-full flex flex-col bg-background">
      {/* Header */}
      <header className="w-full px-5 pt-6 pb-2 flex items-center justify-between">
        <Logo className="text-3xl" />
        <span className="text-muted-foreground text-sm font-medium truncate max-w-[40%] text-right">
          {user.name}
        </span>
      </header>

      {/* Greeting */}
      <p className="px-5 mt-2 text-muted-foreground text-[18px] font-body">
        {greetingFor(new Date(), firstName)}
      </p>

      {/* Buttons */}
      <section className="flex-1 flex flex-col justify-center gap-4 px-6">
        <HomeButton
          variant="primary"
          icon="➕"
          label="New Job"
          subtitle="Create a new job card"
          onClick={() => navigate({ to: "/jobs/new" })}
        />
        <HomeButton
          variant="outline"
          icon="🔧"
          label="Active Jobs"
          subtitle="View all ongoing jobs"
          onClick={() => navigate({ to: "/jobs/active" })}
        />
        {isAdmin && (
          <HomeButton
            variant="outline"
            icon="⚙️"
            label="Workshop"
            subtitle="Settings & admin"
            onClick={() => navigate({ to: "/workshop" })}
          />
        )}
      </section>

      {/* Logout */}
      <footer className="w-full pb-8 pt-4 flex justify-center">
        <button
          type="button"
          onClick={logout}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
        >
          Log out
        </button>
      </footer>
    </main>
  );
}

function HomeButton({
  variant,
  icon,
  label,
  subtitle,
  onClick,
}: {
  variant: "primary" | "outline";
  icon: string;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full min-h-[88px] rounded-[14px] px-5 py-4 flex items-center gap-4 text-left",
        "transition-transform duration-100 ease-out active:scale-[0.97]",
        isPrimary
          ? "bg-primary"
          : "bg-card border-2 border-primary",
      ].join(" ")}
    >
      <span className="text-4xl leading-none shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-[24px] leading-tight text-white tracking-wide">
          {label}
        </span>
        <span
          className={[
            "block font-body text-[13px] mt-0.5",
            isPrimary ? "text-[#1a1208]" : "text-muted-foreground",
          ].join(" ")}
        >
          {subtitle}
        </span>
      </span>
    </button>
  );
}
