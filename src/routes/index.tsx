import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Delete } from "lucide-react";
import { Logo } from "@/components/Logo";
import { listKioskUsers, verifyPin } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — MotorON.ai" },
      {
        name: "description",
        content: "Workshop kiosk login for MotorON.ai.",
      },
    ],
  }),
  component: LoginPage,
});

type KioskUser = {
  id: string;
  name: string;
};

const PIN_LENGTH = 4;

function LoginPage() {
  const navigate = useNavigate();
  const fetchUsers = useServerFn(listKioskUsers);
  const checkPin = useServerFn(verifyPin);

  const [users, setUsers] = useState<KioskUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KioskUser | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUsers()
      .then((rows) => {
        if (!cancelled) setUsers(rows as KioskUser[]);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e?.message ?? "Failed to load users");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchUsers]);

  const submit = async (full: string) => {
    if (!selected || checking) return;
    setChecking(true);
    try {
      const res = await checkPin({ data: { userId: selected.id, pin: full } });
      if (res.ok) {
        navigate({ to: "/home" });
      } else {
        triggerError();
      }
    } catch {
      triggerError();
    } finally {
      setChecking(false);
    }
  };

  const triggerError = () => {
    setError("Incorrect PIN. Try again.");
    setShake(true);
    setPin("");
    setTimeout(() => setShake(false), 450);
  };

  const press = (digit: string) => {
    if (checking) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + digit;
      if (next.length === PIN_LENGTH) {
        void submit(next);
      }
      return next;
    });
  };

  const back = () => {
    if (checking) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  };

  const reset = () => {
    setSelected(null);
    setPin("");
    setError(null);
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Logo className="text-5xl" />
        <p className="mt-3 text-xs uppercase tracking-[0.25em] text-muted-foreground text-center">
          Your Workshop · Always On
        </p>

        {!selected ? (
          <section className="w-full mt-10">
            <h1 className="text-muted-foreground text-xs uppercase tracking-widest mb-3">
              Select your profile
            </h1>

            {loadError && (
              <p className="text-destructive text-sm">{loadError}</p>
            )}

            {!users && !loadError && (
              <ul className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li
                    key={i}
                    className="h-16 rounded-xl bg-card animate-pulse"
                  />
                ))}
              </ul>
            )}

            {users && users.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No users found for this workshop.
              </p>
            )}

            {users && users.length > 0 && (
              <ul className="space-y-3">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(u)}
                      className="w-full min-h-16 px-4 py-3 rounded-xl bg-card border border-border flex items-center gap-4 text-left active:scale-[0.99] transition"
                    >
                      <span className="w-10 h-10 rounded-full bg-primary/15 text-primary font-display text-xl flex items-center justify-center">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1">
                        <span className="block text-foreground font-medium">
                          {u.name}
                        </span>
                        <span className="block text-xs text-muted-foreground capitalize">
                          {u.role}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="w-full mt-10 flex flex-col items-center">
            <button
              type="button"
              onClick={reset}
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              ← Switch user
            </button>

            <p className="mt-4 font-display text-3xl text-foreground">
              {selected.name}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Enter your PIN
            </p>

            <div
              className={`flex gap-4 mb-2 ${shake ? "animate-shake" : ""}`}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                const filled = i < pin.length;
                const errored = !!error;
                return (
                  <span
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition ${
                      errored
                        ? "border-destructive bg-destructive"
                        : filled
                          ? "border-primary bg-primary"
                          : "border-border bg-transparent"
                    }`}
                  />
                );
              })}
            </div>

            <p
              className={`h-5 text-sm mb-4 ${
                error ? "text-destructive" : "text-transparent"
              }`}
            >
              {error ?? "placeholder"}
            </p>

            <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <PinKey key={n} onClick={() => press(String(n))}>
                  {n}
                </PinKey>
              ))}
              <span />
              <PinKey onClick={() => press("0")}>0</PinKey>
              <PinKey onClick={back} aria-label="Backspace">
                <Delete className="w-6 h-6" />
              </PinKey>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PinKey({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aspect-square min-h-16 w-full rounded-full bg-card border border-border text-foreground font-display text-2xl flex items-center justify-center active:bg-primary/20 active:border-primary transition"
      {...rest}
    >
      {children}
    </button>
  );
}
