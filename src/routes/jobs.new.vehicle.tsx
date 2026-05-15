import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Search } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import {
  getJobDraft,
  setJobDraft,
  type JobDraft,
  type VehicleFormData,
} from "@/lib/job-draft";

export const Route = createFileRoute("/jobs/new/vehicle")({
  head: () => ({ meta: [{ title: "Vehicle Details — MotorON.ai" }] }),
  component: VehicleDetailsStep,
});

type VehicleType = "Bike" | "Car" | "Auto" | "Other";

const TYPES: { value: VehicleType; emoji: string; label: string }[] = [
  { value: "Bike", emoji: "🏍", label: "Bike" },
  { value: "Car", emoji: "🚗", label: "Car" },
  { value: "Auto", emoji: "🛺", label: "Auto" },
  { value: "Other", emoji: "🚐", label: "Other" },
];

const MAKES: Record<Exclude<VehicleType, "Other">, string[]> = {
  Bike: [
    "Royal Enfield", "Honda", "Bajaj", "TVS", "Hero", "Yamaha", "Suzuki",
    "KTM", "Kawasaki", "Harley-Davidson", "Triumph", "BMW Motorrad",
    "Ducati", "Jawa", "Yezdi", "Other",
  ],
  Car: [
    "Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Toyota", "Honda",
    "Kia", "MG", "Volkswagen", "Skoda", "Renault", "Nissan", "Jeep", "Other",
  ],
  Auto: ["Bajaj", "TVS", "Piaggio", "Mahindra", "Other"],
};

const YEARS: number[] = (() => {
  const arr: number[] = [];
  for (let y = 2025; y >= 2000; y--) arr.push(y);
  return arr;
})();

type Errors = Partial<Record<keyof VehicleFormData, string>>;

function VehicleDetailsStep() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<JobDraft | null>(null);

  const [type, setType] = useState<VehicleType | "">("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [colour, setColour] = useState("");
  const [licencePlate, setLicencePlate] = useState("");
  const [mileage, setMileage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const [makeSheetOpen, setMakeSheetOpen] = useState(false);
  const [yearSheetOpen, setYearSheetOpen] = useState(false);
  const [makeSearch, setMakeSearch] = useState("");

  useEffect(() => {
    const d = getJobDraft();
    if (!d) {
      navigate({ to: "/jobs/new" });
      return;
    }
    setDraft(d);
    if (d.vehicle) {
      const t = (d.vehicle.type || "") as VehicleType;
      setType(TYPES.some((x) => x.value === t) ? t : "");
      setMake(d.vehicle.make ?? "");
      setModel(d.vehicle.model ?? "");
      setYear(d.vehicle.year ?? null);
      setColour(d.vehicle.colour ?? "");
      setLicencePlate((d.vehicle.licence_plate ?? "").toUpperCase());
      // Mileage intentionally left blank — must be re-entered for this visit.
    } else if (d.vehicleForm) {
      const f = d.vehicleForm;
      setType(f.type as VehicleType);
      setMake(f.make);
      setModel(f.model);
      setYear(f.year);
      setColour(f.colour ?? "");
      setLicencePlate(f.licence_plate);
      setMileage(String(f.current_mileage));
    }
  }, [navigate]);

  const isExisting = !!draft?.vehicle;
  const isOtherType = type === "Other";

  const filteredMakes = useMemo(() => {
    if (!type || isOtherType) return [];
    const list = MAKES[type as Exclude<VehicleType, "Other">];
    const q = makeSearch.trim().toLowerCase();
    return q ? list.filter((m) => m.toLowerCase().includes(q)) : list;
  }, [type, isOtherType, makeSearch]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!type) e.type = "Select vehicle type";
    if (!make.trim()) e.make = "Make is required";
    if (!model.trim()) e.model = "Model is required";
    if (!licencePlate.trim()) e.licence_plate = "Licence plate is required";
    const m = Number(mileage);
    if (!mileage.trim() || !Number.isFinite(m) || m < 0)
      e.current_mileage = "Mileage is required";
    return e;
  };

  const handleNext = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0 || !draft) return;

    const form: VehicleFormData = {
      type: type as VehicleType,
      make: make.trim(),
      model: model.trim(),
      year,
      colour: colour.trim() || null,
      licence_plate: licencePlate.trim().toUpperCase(),
      current_mileage: Number(mileage),
    };

    setSaving(true);
    try {
      if (draft.vehicle) {
        const { error } = await supabase
          .from("vehicles")
          .update({ last_mileage: form.current_mileage })
          .eq("id", draft.vehicle.id);
        if (error) {
          setErrors({ current_mileage: error.message });
          return;
        }
      }
      setJobDraft({ ...draft, vehicleForm: form });
      navigate({ to: "/jobs/new/complaint" });
    } finally {
      setSaving(false);
    }
  };

  if (!draft) return null;

  return (
    <main className="min-h-screen w-full bg-background flex flex-col pb-28">
      {/* Header */}
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
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
          Step 2 of 3
        </span>
      </header>

      <div className="px-6 mt-2 space-y-5">
        {/* Vehicle Type */}
        <div>
          <Label>Vehicle Type</Label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => {
              const selected = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setType(t.value);
                    setErrors((p) => ({ ...p, type: undefined }));
                    if (t.value === "Other") return;
                    // Reset make if switching type and it's not in the new list
                    const list = MAKES[t.value];
                    if (make && !list.includes(make)) setMake("");
                  }}
                  className={[
                    "h-12 rounded-full text-sm font-medium transition active:scale-[0.97]",
                    "flex items-center justify-center gap-1",
                    selected
                      ? "bg-primary text-white"
                      : "bg-card text-muted-foreground border border-border",
                  ].join(" ")}
                >
                  <span aria-hidden>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <FieldError msg={errors.type} />
        </div>

        {/* Make */}
        <div>
          <Label>Make / Brand</Label>
          {isOtherType ? (
            <TextField
              value={make}
              onChange={(v) => {
                setMake(v);
                if (v.trim()) setErrors((p) => ({ ...p, make: undefined }));
              }}
              placeholder="Enter make / brand"
              hasError={!!errors.make}
            />
          ) : (
            <button
              type="button"
              disabled={!type}
              onClick={() => {
                setMakeSearch("");
                setMakeSheetOpen(true);
              }}
              className={[
                "w-full h-[52px] px-4 rounded-lg text-left bg-card border-2 transition-colors",
                errors.make ? "border-destructive" : "border-border",
                !type ? "opacity-50" : "",
                make ? "text-foreground" : "text-muted-foreground/60",
              ].join(" ")}
            >
              {make || (type ? "Select make" : "Pick vehicle type first")}
            </button>
          )}
          <FieldError msg={errors.make} />
        </div>

        {/* Model */}
        <div>
          <Label>Model</Label>
          <TextField
            value={model}
            onChange={(v) => {
              setModel(v);
              if (v.trim()) setErrors((p) => ({ ...p, model: undefined }));
            }}
            placeholder="e.g. Classic 350"
            hasError={!!errors.model}
          />
          <FieldError msg={errors.model} />
        </div>

        {/* Year */}
        <div>
          <Label>Year</Label>
          <button
            type="button"
            onClick={() => setYearSheetOpen(true)}
            className={[
              "w-full h-[52px] px-4 rounded-lg text-left bg-card border-2 border-border transition-colors",
              year ? "text-foreground" : "text-muted-foreground/60",
            ].join(" ")}
          >
            {year ?? "Select year"}
          </button>
        </div>

        {/* Colour */}
        <div>
          <Label>Colour <span className="text-muted-foreground/70 normal-case">(optional)</span></Label>
          <TextField
            value={colour}
            onChange={setColour}
            placeholder="e.g. Black"
          />
        </div>

        {/* Licence Plate */}
        <div>
          <Label>Licence Plate</Label>
          <TextField
            value={licencePlate}
            onChange={(v) => {
              setLicencePlate(v.toUpperCase());
              if (v.trim()) setErrors((p) => ({ ...p, licence_plate: undefined }));
            }}
            placeholder="e.g. MH12AB1234"
            hasError={!!errors.licence_plate}
            className="tracking-wider"
          />
          <FieldError msg={errors.licence_plate} />
        </div>

        {/* Mileage */}
        <div>
          <Label>Current Mileage (km)</Label>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={mileage}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setMileage(v);
              if (v) setErrors((p) => ({ ...p, current_mileage: undefined }));
            }}
            placeholder="e.g. 57420"
            className={[
              "w-full h-[52px] px-4 rounded-lg bg-card border-2 text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors",
              "border-l-4 border-l-primary",
              errors.current_mileage
                ? "border-destructive focus:border-destructive"
                : "border-border focus:border-primary",
            ].join(" ")}
          />
          {errors.current_mileage ? (
            <FieldError msg={errors.current_mileage} />
          ) : (
            <p className="mt-1.5 text-xs text-primary">
              ⚑ Please update mileage for this visit
            </p>
          )}
        </div>
      </div>

      {/* Sticky Next button */}
      <div className="fixed inset-x-0 bottom-0 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t border-border">
        <button
          type="button"
          disabled={saving}
          onClick={handleNext}
          className="w-full h-14 rounded-lg bg-primary text-white font-display text-[20px] tracking-wide active:scale-[0.98] transition disabled:opacity-60"
        >
          {saving ? "Saving…" : "Next →"}
        </button>
      </div>

      {/* Make bottom sheet */}
      <Drawer open={makeSheetOpen} onOpenChange={setMakeSheetOpen}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-[22px] tracking-wide text-foreground">
              Select Make
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={makeSearch}
                onChange={(e) => setMakeSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-11 pl-9 pr-3 rounded-lg bg-card border-2 border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <ul className="px-2 pb-6 max-h-[55vh] overflow-y-auto">
            {filteredMakes.map((m) => {
              const selected = m === make;
              return (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => {
                      setMake(m);
                      setErrors((p) => ({ ...p, make: undefined }));
                      setMakeSheetOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-card text-left text-foreground"
                  >
                    <span>{m}</span>
                    {selected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                </li>
              );
            })}
            {filteredMakes.length === 0 && (
              <li className="px-4 py-6 text-center text-muted-foreground text-sm">
                No matches
              </li>
            )}
          </ul>
        </DrawerContent>
      </Drawer>

      {/* Year bottom sheet */}
      <Drawer open={yearSheetOpen} onOpenChange={setYearSheetOpen}>
        <DrawerContent className="bg-background border-border">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-[22px] tracking-wide text-foreground">
              Select Year
            </DrawerTitle>
          </DrawerHeader>
          <ul className="px-2 pb-6 max-h-[60vh] overflow-y-auto">
            {YEARS.map((y) => {
              const selected = y === year;
              return (
                <li key={y}>
                  <button
                    type="button"
                    onClick={() => {
                      setYear(y);
                      setYearSheetOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-card text-left text-foreground"
                  >
                    <span>{y}</span>
                    {selected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </DrawerContent>
      </Drawer>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-muted-foreground text-xs uppercase tracking-widest mb-2">
      {children}
    </span>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  hasError,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        "w-full h-[52px] px-4 rounded-lg bg-card border-2 text-foreground placeholder:text-muted-foreground/60 focus:outline-none transition-colors",
        hasError
          ? "border-destructive focus:border-destructive"
          : "border-border focus:border-primary",
        className ?? "",
      ].join(" ")}
    />
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-destructive">{msg}</p>;
}
