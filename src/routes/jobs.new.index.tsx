import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  getCurrentKioskUser,
  lookupCustomerByPhone,
  type CustomerDTO,
  type VehicleDTO,
} from "@/lib/kiosk.functions";
import {
  setJobDraft,
  type DraftCustomer,
  type DraftVehicle,
} from "@/lib/job-draft";

export const Route = createFileRoute("/jobs/new/")({
  head: () => ({ meta: [{ title: "New Job — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    return { kioskUser: user };
  },
  component: NewJobPhoneEntry,
});

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "new" }
  | { kind: "existing-single"; customer: CustomerDTO; vehicle: VehicleDTO }
  | { kind: "existing-multi"; customer: CustomerDTO; vehicles: VehicleDTO[] }
  | { kind: "existing-none"; customer: CustomerDTO };

function NewJobPhoneEntry() {
  const navigate = useNavigate();
  const doLookup = useServerFn(lookupCustomerByPhone);

  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [newName, setNewName] = useState("");
  const [address, setAddress] = useState("");

  const phoneValid = phone.length === 10;

  const handlePhoneChange = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
    if (lookup.kind !== "idle" && lookup.kind !== "loading") {
      setLookup({ kind: "idle" });
      setNewName("");
      setAddress("");
    }
  };

  const startLookup = async () => {
    if (!phoneValid) return;
    setLookup({ kind: "loading" });
    try {
      const { customer, vehicles } = await doLookup({ data: { phone } });
      if (!customer) {
        setLookup({ kind: "new" });
        return;
      }
      setAddress(customer.address ?? "");
      if (vehicles.length === 0) {
        setLookup({ kind: "existing-none", customer });
      } else if (vehicles.length === 1) {
        setLookup({ kind: "existing-single", customer, vehicle: vehicles[0] });
      } else {
        setLookup({ kind: "existing-multi", customer, vehicles });
      }
    } catch (e) {
      setLookup({
        kind: "error",
        message: e instanceof Error ? e.message : "Lookup failed",
      });
    }
  };

  const goToVehicleStep = (
    customer: CustomerDTO | null,
    vehicle: VehicleDTO | null,
    overrideName?: string,
    overrideAddress?: string | null,
  ) => {
    const draftCustomer: DraftCustomer | null = customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: overrideAddress ?? customer.address ?? null,
        }
      : null;

    const draftVehicle: DraftVehicle | null = vehicle
      ? {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          licence_plate: vehicle.licence_plate,
          type: vehicle.type,
          colour: vehicle.colour,
          last_mileage: vehicle.last_mileage,
        }
      : null;

    setJobDraft({
      phone,
      customer: draftCustomer,
      newCustomerName: overrideName?.trim() || undefined,
      address: (overrideAddress ?? null) || null,
      vehicle: draftVehicle,
    });
    navigate({ to: "/jobs/new/vehicle" });
  };

  return (
    <main className="min-h-screen w-full bg-background flex flex-col">
      <header className="relative w-full px-5 pt-6 pb-3 flex items-center justify-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-foreground hover:text-primary transition"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-display text-[24px] tracking-wide text-foreground">
          New Job
        </h1>
      </header>

      <div className="flex-1 px-6 pb-10">
        <p className="font-display text-[28px] leading-tight text-foreground mt-4">
          Enter Customer Mobile Number
        </p>

        <input
          inputMode="tel"
          autoComplete="off"
          maxLength={10}
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="10-digit mobile number"
          className="mt-6 w-full h-14 px-4 rounded-lg bg-card border-2 border-border text-foreground text-lg tracking-wider placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />

        <button
          type="button"
          disabled={!phoneValid || lookup.kind === "loading"}
          onClick={startLookup}
          className={[
            "mt-4 w-full h-14 rounded-lg font-display text-[20px] tracking-wide transition",
            phoneValid
              ? "bg-primary text-white shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)] active:scale-[0.98]"
              : "bg-card text-muted-foreground/60 cursor-not-allowed",
          ].join(" ")}
        >
          {lookup.kind === "loading" ? "Looking up…" : "Start New Job"}
        </button>

        {lookup.kind === "error" && (
          <p className="mt-4 text-destructive text-sm">{lookup.message}</p>
        )}

        {lookup.kind === "existing-single" && (
          <ExistingCustomerCard customer={lookup.customer} className="mt-6">
            <AddressField value={address} onChange={setAddress} />
            <NextButton
              onClick={() =>
                goToVehicleStep(lookup.customer, lookup.vehicle, undefined, address)
              }
            />
          </ExistingCustomerCard>
        )}

        {lookup.kind === "existing-multi" && (
          <>
            <ExistingCustomerCard customer={lookup.customer} className="mt-6">
              <AddressField value={address} onChange={setAddress} />
            </ExistingCustomerCard>

            <p className="mt-6 text-muted-foreground text-xs uppercase tracking-widest mb-3">
              Select Vehicle
            </p>
            <ul className="space-y-3">
              {lookup.vehicles.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() =>
                      goToVehicleStep(lookup.customer, v, undefined, address)
                    }
                    className="w-full text-left rounded-xl bg-card border border-border px-4 py-4 active:scale-[0.99] transition"
                  >
                    <p className="text-foreground font-medium">
                      {v.make} {v.model}
                      {v.year ? ` · ${v.year}` : ""}
                    </p>
                    {v.licence_plate && (
                      <p className="text-muted-foreground text-sm mt-0.5 tracking-wider">
                        {v.licence_plate}
                      </p>
                    )}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() =>
                    goToVehicleStep(lookup.customer, null, undefined, address)
                  }
                  className="w-full text-left rounded-xl bg-transparent border-2 border-dashed border-primary/70 px-4 py-4 text-primary font-medium active:scale-[0.99] transition"
                >
                  + Add New Vehicle
                </button>
              </li>
            </ul>
          </>
        )}

        {lookup.kind === "existing-none" && (
          <ExistingCustomerCard customer={lookup.customer} className="mt-6">
            <AddressField value={address} onChange={setAddress} />
            <NextButton
              onClick={() =>
                goToVehicleStep(lookup.customer, null, undefined, address)
              }
            />
          </ExistingCustomerCard>
        )}

        {lookup.kind === "new" && (
          <NewCustomerForm
            name={newName}
            address={address}
            onNameChange={setNewName}
            onAddressChange={setAddress}
            onNext={() =>
              goToVehicleStep(null, null, newName, address || null)
            }
          />
        )}
      </div>
    </main>
  );
}

function ExistingCustomerCard({
  customer,
  className,
  children,
}: {
  customer: CustomerDTO;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl bg-card border border-border p-4 animate-fade-in ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
        <span aria-hidden>✓</span> Existing Customer
      </span>
      <p className="mt-3 text-foreground font-semibold text-lg">
        {customer.name}
      </p>
      <p className="text-muted-foreground text-sm">{customer.phone}</p>
      {children && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}

function AddressField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
        Address (optional)
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Lane, area, city"
        className="w-full px-3 py-2 rounded-lg bg-background border-2 border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors resize-none"
      />
    </label>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-14 rounded-lg bg-primary text-white font-display text-[20px] tracking-wide active:scale-[0.98] transition"
    >
      Next →
    </button>
  );
}

function NewCustomerForm({
  name,
  address,
  onNameChange,
  onAddressChange,
  onNext,
}: {
  name: string;
  address: string;
  onNameChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onNext: () => void;
}) {
  const canContinue = useMemo(() => name.trim().length > 0, [name]);
  return (
    <section className="mt-6 rounded-xl bg-card border border-border p-4 animate-fade-in">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-400 text-xs font-medium">
        New Customer
      </span>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
            Customer Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={100}
            placeholder="Full name"
            className="w-full h-12 px-3 rounded-lg bg-background border-2 border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
          />
        </label>

        <AddressField value={address} onChange={onAddressChange} />

        <button
          type="button"
          disabled={!canContinue}
          onClick={onNext}
          className={[
            "w-full h-14 rounded-lg font-display text-[20px] tracking-wide transition",
            canContinue
              ? "bg-primary text-white active:scale-[0.98]"
              : "bg-background text-muted-foreground/60 border border-border cursor-not-allowed",
          ].join(" ")}
        >
          Next →
        </button>
      </div>
    </section>
  );
}
