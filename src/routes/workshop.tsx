import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Copy, Trash2, Pencil, Plus, ArrowUp, ArrowDown, Lock, Check } from "lucide-react";
import {
  getCurrentKioskUser,
  updateMyAccount,
  getWorkshopProfile,
  updateWorkshopProfile,
  updateNotificationSettings,
  updateAutoArchive,
  listTeam,
  deleteTeamMember,
  listServicePackages,
  createServicePackage,
  updateServicePackage,
  deleteServicePackage,
  reorderServicePackage,
  listParts,
  createPart,
  updatePart,
  deletePart,
  searchClosedJobs,
  exportAllJobs,
  type WorkshopProfileDTO,
  type TeamMemberDTO,
  type ServicePackageDTO,
  type PartDTO,
  type ClosedJobDTO,
} from "@/lib/kiosk.functions";

const WORKSHOP_ID = "a1b2c3d4-0000-0000-0000-000000000001";

export const Route = createFileRoute("/workshop")({
  head: () => ({ meta: [{ title: "Workshop — MotorON.ai" }] }),
  beforeLoad: async () => {
    const user = await getCurrentKioskUser();
    if (!user) throw redirect({ to: "/" });
    if (user.access_level !== "full-admin") throw redirect({ to: "/home" });
    return { kioskUser: user };
  },
  component: WorkshopAdmin,
});

type SectionKey =
  | "account"
  | "profile"
  | "notifications"
  | "team"
  | "mechanics"
  | "packages"
  | "parts"
  | "data"
  | "soon";

function WorkshopAdmin() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<SectionKey | null>("account");

  const toggle = (k: SectionKey) => setOpen((p) => (p === k ? null : k));

  return (
    <main className="min-h-screen w-full bg-background pb-24">
      <header className="relative w-full px-5 pt-6 pb-4 flex items-center justify-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-foreground hover:text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-display text-[28px] tracking-wide text-foreground">Workshop</h1>
      </header>

      <div className="px-4 space-y-3">
        <Section title="My Account" k="account" open={open} onToggle={toggle}>
          <AccountSection />
        </Section>
        <Section title="Workshop Profile" k="profile" open={open} onToggle={toggle}>
          <ProfileSection />
        </Section>
        <Section title="Notifications & Alerts" k="notifications" open={open} onToggle={toggle}>
          <NotificationsSection />
        </Section>
        <Section title="Team & Ownership" k="team" open={open} onToggle={toggle}>
          <TeamSection />
        </Section>
        <Section title="Service Packages" k="packages" open={open} onToggle={toggle}>
          <PackagesSection />
        </Section>
        <Section title="Parts Library" k="parts" open={open} onToggle={toggle}>
          <PartsSection />
        </Section>
        <Section title="Data & Records" k="data" open={open} onToggle={toggle}>
          <DataSection />
        </Section>
        <Section title="Coming Soon" k="soon" open={open} onToggle={toggle}>
          <ComingSoonSection />
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  k,
  open,
  onToggle,
  children,
}: {
  title: string;
  k: SectionKey;
  open: SectionKey | null;
  onToggle: (k: SectionKey) => void;
  children: React.ReactNode;
}) {
  const isOpen = open === k;
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(k)}
        className="w-full flex items-center gap-3 p-4 text-left border-l-4 border-l-primary"
      >
        <span className="flex-1 font-body font-bold text-[15px] text-foreground">{title}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

// ---------- helpers ----------

const inputCls =
  "w-full h-11 px-3 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary";
const textareaCls =
  "w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-y";
const labelCls = "block text-muted-foreground text-[11px] uppercase tracking-widest mb-1.5";
const btnPrimary =
  "w-full h-12 rounded-lg bg-primary text-white font-display text-[18px] tracking-wide active:scale-[0.98] transition disabled:opacity-60";
const btnOutline =
  "w-full h-12 rounded-lg border-2 border-primary text-primary font-body font-bold active:scale-[0.98] transition disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// ---------- Section 1: Account ----------
function AccountSection() {
  const { kioskUser: user } = Route.useRouteContext();
  const save = useServerFn(updateMyAccount);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (newPin || confirmPin || curPin) {
      if (!/^\d{4}$/.test(newPin) || !/^\d{4}$/.test(confirmPin) || !/^\d{4}$/.test(curPin)) {
        toast.error("PINs must be 4 digits");
        return;
      }
      if (newPin !== confirmPin) {
        toast.error("New PIN and confirm don't match");
        return;
      }
    }
    setBusy(true);
    try {
      await save({
        data: {
          name,
          email,
          phone,
          currentPin: curPin || undefined,
          newPin: newPin || undefined,
        },
      });
      setCurPin("");
      setNewPin("");
      setConfirmPin("");
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Display name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <input type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <div>
        <label className={labelCls}>Change PIN</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            className={inputCls}
            placeholder="Current"
            inputMode="numeric"
            maxLength={4}
            value={curPin}
            onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className={inputCls}
            placeholder="New"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className={inputCls}
            placeholder="Confirm"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>
      <button className={btnPrimary} disabled={busy} onClick={onSave}>
        {busy ? "Saving…" : "Save Account"}
      </button>
    </div>
  );
}

// ---------- Section 2: Profile ----------
const DAYS: { k: string; label: string }[] = [
  { k: "mon", label: "Mon" },
  { k: "tue", label: "Tue" },
  { k: "wed", label: "Wed" },
  { k: "thu", label: "Thu" },
  { k: "fri", label: "Fri" },
  { k: "sat", label: "Sat" },
  { k: "sun", label: "Sun" },
];

function ProfileSection() {
  const fetch = useServerFn(getWorkshopProfile);
  const save = useServerFn(updateWorkshopProfile);
  const [p, setP] = useState<WorkshopProfileDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch()
      .then(setP)
      .catch(() => toast.error("Failed to load profile"));
  }, [fetch]);

  if (!p) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const setField = <K extends keyof WorkshopProfileDTO>(k: K, v: WorkshopProfileDTO[K]) =>
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      toast.error("Logo must be under 1.5 MB");
      return;
    }
    const r = new FileReader();
    r.onload = () => setField("logo", String(r.result));
    r.readAsDataURL(file);
  };

  const setDay = (k: string, patch: Partial<{ open: string; close: string; closed: boolean }>) => {
    setP((prev) => (prev ? { ...prev, hours: { ...prev.hours, [k]: { ...prev.hours?.[k], ...patch } } } : prev));
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          name: p.name,
          phone: p.phone ?? "",
          address: p.address ?? "",
          maps_link: p.maps_link ?? "",
          logo: p.logo ?? "",
          hours: p.hours ?? {},
          gst_number: p.gst_number ?? "",
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Workshop name">
        <input className={inputCls} value={p.name} onChange={(e) => setField("name", e.target.value)} />
      </Field>
      <Field label="Workshop phone">
        <input
          type="tel"
          className={inputCls}
          value={p.phone ?? ""}
          onChange={(e) => setField("phone", e.target.value)}
        />
      </Field>
      <Field label="Address">
        <textarea
          rows={3}
          className={textareaCls}
          value={p.address ?? ""}
          onChange={(e) => setField("address", e.target.value)}
        />
      </Field>
      <Field label="Google Maps link">
        <input
          className={inputCls}
          placeholder="Paste your Google Maps share link"
          value={p.maps_link ?? ""}
          onChange={(e) => setField("maps_link", e.target.value)}
        />
      </Field>
      <Field label="Logo">
        <div className="flex items-center gap-3">
          {p.logo && <img src={p.logo} alt="Logo" className="w-14 h-14 rounded-lg object-cover bg-background" />}
          <label className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border-2 border-primary text-primary cursor-pointer">
            <Plus className="w-4 h-4" /> Upload Logo
            <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          </label>
          {p.logo && (
            <button type="button" onClick={() => setField("logo", null)} className="text-destructive text-sm">
              Remove
            </button>
          )}
        </div>
      </Field>

      <Field label="Hours of operation">
        <div className="space-y-2">
          {DAYS.map((d) => {
            const h = p.hours?.[d.k] ?? { open: "09:00", close: "19:00", closed: false };
            return (
              <div
                key={d.k}
                className={`flex items-center gap-3 rounded-lg bg-background px-3 py-2 ${h.closed ? "opacity-50" : ""}`}
              >
                <span className="w-10 text-sm font-medium text-foreground">{d.label}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) => setDay(d.k, { closed: !e.target.checked })}
                  />
                  Open
                </label>
                {!h.closed && (
                  <div className="flex-1 flex items-center gap-2 justify-end">
                    <input
                      type="time"
                      value={h.open}
                      onChange={(e) => setDay(d.k, { open: e.target.value })}
                      className="h-9 px-2 rounded bg-card border border-border text-foreground text-sm"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                      type="time"
                      value={h.close}
                      onChange={(e) => setDay(d.k, { close: e.target.value })}
                      className="h-9 px-2 rounded bg-card border border-border text-foreground text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>

      <Field label="GST number (optional)">
        <input
          className={inputCls}
          placeholder="GST Number (optional)"
          value={p.gst_number ?? ""}
          onChange={(e) => setField("gst_number", e.target.value)}
        />
      </Field>

      <button className={btnPrimary} disabled={busy} onClick={onSave}>
        {busy ? "Saving…" : "Save Profile"}
      </button>
    </div>
  );
}

// ---------- Section 3: Notifications ----------
function NotificationsSection() {
  const fetch = useServerFn(getWorkshopProfile);
  const save = useServerFn(updateNotificationSettings);
  const [p, setP] = useState<WorkshopProfileDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch()
      .then(setP)
      .catch(() => toast.error("Failed to load"));
  }, [fetch]);

  if (!p) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const setF = <K extends keyof WorkshopProfileDTO>(k: K, v: WorkshopProfileDTO[K]) =>
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  const onSave = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          job_duration_threshold: p.job_duration_threshold || 3,
          notify_dropoff: p.notify_dropoff,
          notify_completed: p.notify_completed,
          dropoff_template: p.dropoff_template ?? "",
          completed_template: p.completed_template ?? "",
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Job duration threshold">
        <input
          type="number"
          min={1}
          className={inputCls}
          value={p.job_duration_threshold}
          onChange={(e) => setF("job_duration_threshold", Number(e.target.value) || 0)}
        />
        <p className="text-muted-foreground text-xs mt-1">
          Flag jobs overdue after X days. Jobs older than this show a red counter on Active Jobs screen.
        </p>
      </Field>

      <Toggle
        label="Send drop-off WhatsApp notification"
        value={p.notify_dropoff}
        onChange={(v) => setF("notify_dropoff", v)}
      />
      <Toggle
        label="Send repair-completed WhatsApp notification"
        value={p.notify_completed}
        onChange={(v) => setF("notify_completed", v)}
      />

      <Field label="Drop-off message template">
        <textarea
          rows={5}
          className={textareaCls}
          value={p.dropoff_template ?? ""}
          onChange={(e) => setF("dropoff_template", e.target.value)}
        />
        <p className="text-muted-foreground text-[11px] mt-1 font-mono">
          [CustomerName] [VehicleMake] [VehicleModel] [WorkshopName] [WorkshopPhone] [MapsLink] [WorkshopHours]
        </p>
      </Field>

      <Field label="Ready for pickup message template">
        <textarea
          rows={5}
          className={textareaCls}
          value={p.completed_template ?? ""}
          onChange={(e) => setF("completed_template", e.target.value)}
        />
        <p className="text-muted-foreground text-[11px] mt-1 font-mono">
          [CustomerName] [VehicleMake] [VehicleModel] [WorkshopName] [WorkshopPhone] [MapsLink] [WorkshopHours]
          [TotalAmount]
        </p>
      </Field>

      <button className={btnPrimary} disabled={busy} onClick={onSave}>
        {busy ? "Saving…" : "Save Notifications"}
      </button>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between p-3 rounded-lg bg-background border border-border"
    >
      <span className="text-sm text-foreground text-left">{label}</span>
      <span className={`relative w-11 h-6 rounded-full transition ${value ? "bg-primary" : "bg-muted-foreground/30"}`}>
        <span
          className={`absolute top-0.5 ${value ? "right-0.5" : "left-0.5"} w-5 h-5 rounded-full bg-white transition-all`}
        />
      </span>
    </button>
  );
}

// ---------- Section 4: Team ----------
function TeamSection() {
  const fetch = useServerFn(listTeam);
  const del = useServerFn(deleteTeamMember);
  const [team, setTeam] = useState<TeamMemberDTO[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteLevel, setInviteLevel] = useState<"full-admin" | "view-only">("full-admin");
  const [inviteText, setInviteText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const reload = useCallback(
    () =>
      fetch()
        .then(setTeam)
        .catch(() => toast.error("Failed to load team")),
    [fetch],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const copyId = () => {
    navigator.clipboard.writeText(WORKSHOP_ID);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const generateInvite = () => {
    setInviteText(
      `Join my workshop on MotorON.ai. Workshop ID: ${WORKSHOP_ID}. Download the app and enter this ID when signing up.`,
    );
  };

  const copyInvite = () => {
    if (inviteText) {
      navigator.clipboard.writeText(inviteText);
      toast.success("Invite copied");
    }
  };

  const onRemove = async (id: string) => {
    try {
      await del({ data: { userId: id } });
      setConfirmId(null);
      await reload();
      toast.success("Removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const confirmMember = team.find((m) => m.id === confirmId);

  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>Workshop ID</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sky-400 font-mono text-xs break-all bg-background px-3 py-2 rounded-lg border border-border">
            {WORKSHOP_ID}
          </code>
          <button
            onClick={copyId}
            className="h-10 px-3 rounded-lg border border-border text-foreground flex items-center gap-1.5 text-xs"
          >
            {copiedId ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground text-sm truncate">{m.name}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                <Pill color={m.role === "owner" ? "orange" : "blue"}>{m.role}</Pill>
                <Pill color={m.access_level === "full-admin" ? "green" : "grey"}>{m.access_level}</Pill>
                <Pill color={m.status === "active" ? "green" : "amber"}>{m.status}</Pill>
              </div>
            </div>
            {m.role !== "owner" && (
              <button onClick={() => setConfirmId(m.id)} className="p-2 text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border space-y-3">
        <span className={labelCls}>Add co-owner</span>
        <input
          className={inputCls}
          placeholder="Phone number"
          type="tel"
          value={invitePhone}
          onChange={(e) => setInvitePhone(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          {(["full-admin", "view-only"] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setInviteLevel(lvl)}
              className={`h-11 rounded-lg border-2 text-sm font-medium transition ${
                inviteLevel === lvl
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {lvl === "full-admin" ? "Full Admin" : "View Only"}
            </button>
          ))}
        </div>
        <button onClick={generateInvite} className={btnPrimary}>
          Generate Invite
        </button>
        {inviteText && (
          <div className="rounded-lg bg-background border border-border p-3 space-y-2">
            <p className="text-sm text-foreground whitespace-pre-wrap">{inviteText}</p>
            <button onClick={copyInvite} className="text-primary text-xs font-bold flex items-center gap-1">
              <Copy className="w-3 h-3" /> Copy invite
            </button>
          </div>
        )}
      </div>

      {confirmMember && (
        <ConfirmModal
          title={`Remove ${confirmMember.name} from workshop?`}
          body="They will lose access immediately."
          confirmLabel="Remove"
          onCancel={() => setConfirmId(null)}
          onConfirm={() => onRemove(confirmMember.id)}
        />
      )}
    </div>
  );
}

function Pill({
  color,
  children,
}: {
  color: "orange" | "blue" | "green" | "grey" | "amber";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    orange: "bg-primary/20 text-primary",
    blue: "bg-sky-500/20 text-sky-400",
    green: "bg-emerald-500/20 text-emerald-400",
    grey: "bg-muted-foreground/20 text-muted-foreground",
    amber: "bg-amber-500/20 text-amber-400",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${map[color]}`}>{children}</span>;
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border p-5 space-y-3">
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button onClick={onCancel} className="h-11 rounded-lg border border-border text-foreground">
            Cancel
          </button>
          <button onClick={onConfirm} className="h-11 rounded-lg bg-destructive text-destructive-foreground font-bold">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Section 5: Service Packages ----------
function PackagesSection() {
  const fetch = useServerFn(listServicePackages);
  const create = useServerFn(createServicePackage);
  const upd = useServerFn(updateServicePackage);
  const del = useServerFn(deleteServicePackage);
  const reorder = useServerFn(reorderServicePackage);
  const [items, setItems] = useState<ServicePackageDTO[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", price: "", subtitle: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [newPkg, setNewPkg] = useState({ name: "", price: "", subtitle: "" });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetch()
        .then(setItems)
        .catch(() => toast.error("Failed to load")),
    [fetch],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const startEdit = (p: ServicePackageDTO) => {
    setEditingId(p.id);
    setDraft({ name: p.name, price: String(p.price), subtitle: p.subtitle ?? "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await upd({
        data: { id: editingId, name: draft.name, price: Number(draft.price) || 0, subtitle: draft.subtitle },
      });
      setEditingId(null);
      await reload();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const addNew = async () => {
    if (!newPkg.name) return;
    try {
      await create({ data: { name: newPkg.name, price: Number(newPkg.price) || 0, subtitle: newPkg.subtitle } });
      setNewPkg({ name: "", price: "", subtitle: "" });
      setShowAdd(false);
      await reload();
      toast.success("Added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      setConfirmId(null);
      await reload();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const move = async (id: string, dir: "up" | "down") => {
    try {
      await reorder({ data: { id, direction: dir } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const confirmPkg = items.find((p) => p.id === confirmId);

  return (
    <div className="space-y-3">
      {items.map((p, idx) => (
        <div key={p.id} className="rounded-lg bg-background border border-border">
          {editingId === p.id ? (
            <div className="p-3 space-y-2">
              <input
                className={inputCls}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Name"
              />
              <input
                className={inputCls}
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="Price"
              />
              <input
                className={inputCls}
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                placeholder="Subtitle"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  className="h-10 rounded-lg border border-border text-foreground text-sm"
                >
                  Cancel
                </button>
                <button onClick={saveEdit} className="h-10 rounded-lg bg-primary text-white font-bold text-sm">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(p.id, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground disabled:opacity-30"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => move(p.id, "down")}
                  disabled={idx === items.length - 1}
                  className="text-muted-foreground disabled:opacity-30"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-foreground text-sm truncate">{p.name}</span>
                  <span className="text-primary text-sm font-bold">₹{p.price.toLocaleString("en-IN")}</span>
                </div>
                {p.subtitle && <p className="text-muted-foreground text-xs truncate">{p.subtitle}</p>}
              </div>
              <button onClick={() => startEdit(p)} className="p-2 text-muted-foreground">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setConfirmId(p.id)} className="p-2 text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <div className="rounded-lg bg-background border border-dashed border-primary p-3 space-y-2">
          <input
            className={inputCls}
            placeholder="Name"
            value={newPkg.name}
            onChange={(e) => setNewPkg({ ...newPkg, name: e.target.value })}
          />
          <input
            className={inputCls}
            type="number"
            placeholder="Price"
            value={newPkg.price}
            onChange={(e) => setNewPkg({ ...newPkg, price: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Subtitle"
            value={newPkg.subtitle}
            onChange={(e) => setNewPkg({ ...newPkg, subtitle: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="h-10 rounded-lg border border-border text-foreground text-sm"
            >
              Cancel
            </button>
            <button onClick={addNew} className="h-10 rounded-lg bg-primary text-white font-bold text-sm">
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full h-12 rounded-lg border-2 border-dashed border-primary text-primary font-bold text-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Package
        </button>
      )}

      {confirmPkg && (
        <ConfirmModal
          title={`Delete ${confirmPkg.name}?`}
          body="This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmId(null)}
          onConfirm={() => onDelete(confirmPkg.id)}
        />
      )}
    </div>
  );
}

// ---------- Section 6: Parts ----------
const UNITS = ["pcs", "litre", "ml", "set", "pair", "metre"] as const;

function PartsSection() {
  const fetch = useServerFn(listParts);
  const create = useServerFn(createPart);
  const upd = useServerFn(updatePart);
  const del = useServerFn(deletePart);
  const [items, setItems] = useState<PartDTO[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<(typeof UNITS)[number]>("pcs");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      fetch()
        .then(setItems)
        .catch(() => toast.error("Failed to load")),
    [fetch],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await upd({ data: { id: editingId, name: editName } });
      setEditingId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const addNew = async () => {
    if (!newName.trim()) return;
    try {
      await create({ data: { name: newName, default_unit: newUnit } });
      setNewName("");
      setNewUnit("pcs");
      setShowAdd(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      setConfirmId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const confirmPart = items.find((p) => p.id === confirmId);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-[13px]">These parts appear in the dropdown when creating job cards.</p>

      {items.map((part) => (
        <div key={part.id} className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
          {editingId === part.id ? (
            <input
              autoFocus
              className={inputCls}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
            />
          ) : (
            <button
              onClick={() => {
                setEditingId(part.id);
                setEditName(part.name);
              }}
              className="flex-1 text-left text-foreground text-sm"
            >
              {part.name}
            </button>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] uppercase bg-muted-foreground/20 text-muted-foreground">
            {part.default_unit}
          </span>
          <button onClick={() => setConfirmId(part.id)} className="p-2 text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      {showAdd ? (
        <div className="rounded-lg bg-background border border-dashed border-primary p-3 space-y-2">
          <input
            className={inputCls}
            placeholder="Part name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select className={inputCls} value={newUnit} onChange={(e) => setNewUnit(e.target.value as any)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="h-10 rounded-lg border border-border text-foreground text-sm"
            >
              Cancel
            </button>
            <button onClick={addNew} className="h-10 rounded-lg bg-primary text-white font-bold text-sm">
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full h-12 rounded-lg border-2 border-dashed border-primary text-primary font-bold text-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Part
        </button>
      )}

      {confirmPart && (
        <ConfirmModal
          title={`Delete ${confirmPart.name}?`}
          body="This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmId(null)}
          onConfirm={() => onDelete(confirmPart.id)}
        />
      )}
    </div>
  );
}

// ---------- Section 7: Data ----------
function DataSection() {
  const navigate = useNavigate();
  const search = useServerFn(searchClosedJobs);
  const exportFn = useServerFn(exportAllJobs);
  const fetchProfile = useServerFn(getWorkshopProfile);
  const saveArchive = useServerFn(updateAutoArchive);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClosedJobDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState<number>(6);
  const [savingMonths, setSavingMonths] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => setMonths(p.auto_archive_months))
      .catch(() => {});
  }, [fetchProfile]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await search({ data: { q } }));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, search]);

  const doExport = async () => {
    try {
      const rows = await exportFn();
      const headers = [
        "job_number",
        "status",
        "customer_name",
        "customer_phone",
        "vehicle",
        "complaint",
        "dropped_off_at",
        "repair_completed_at",
        "picked_up_at",
        "total_amount",
      ];
      const escape = (s: any) => {
        const v = s == null ? "" : String(s);
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      };
      const csv = [headers.join(","), ...rows.map((r: any) => headers.map((h) => escape(r[h])).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `MotorON-export-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const saveMonths = async () => {
    setSavingMonths(true);
    try {
      await saveArchive({ data: { months: months || 1 } });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingMonths(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <span className={labelCls}>Closed jobs archive</span>
        <input
          className={inputCls}
          placeholder="Search by name, phone, vehicle or job number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-2 space-y-2">
          {loading && <p className="text-muted-foreground text-sm">Searching…</p>}
          {!loading && results && results.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">No closed jobs yet</p>
          )}
          {results?.map((j) => (
            <button
              key={j.id}
              onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId: j.id } })}
              className="w-full text-left p-3 rounded-lg bg-background border border-border opacity-80 hover:opacity-100 transition"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sky-400 text-xs">#{j.job_number}</span>
                <span className="text-foreground text-sm font-bold">₹{j.total_amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-1 text-sm text-foreground truncate">{j.customer_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {j.vehicle_make} {j.vehicle_model}
              </div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={doExport} className={btnOutline}>
        Export All Data
      </button>

      <div>
        <Field label="Auto-archive closed jobs">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 0)}
          />
          <p className="text-muted-foreground text-xs mt-1">
            Archive closed jobs after X months. Closed jobs older than this are hidden from active views.
          </p>
        </Field>
        <button onClick={saveMonths} disabled={savingMonths} className={`${btnPrimary} mt-3`}>
          {savingMonths ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ---------- Section 8: Coming Soon ----------
function ComingSoonSection() {
  const items = [
    "Add Another Workshop Location",
    "Automated WhatsApp API (Interakt / AiSensy)",
    "Multi-language Support (English / Marathi / Hindi)",
  ];
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <div key={t} className="relative rounded-lg p-4 border border-border" style={{ backgroundColor: "#162435" }}>
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-primary/20 text-primary">
            Coming Soon
          </span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span className="text-sm">{t}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
