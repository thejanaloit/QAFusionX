"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { SampleShell } from "@/components/sample-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RELATIONSHIP_UI } from "@/lib/sample-store";

const STEPS = ["basic", "contact", "emergency", "documents", "review"] as const;
type Step = (typeof STEPS)[number];

function WizardInner() {
  const params = useSearchParams();
  const router = useRouter();
  const step = (params.get("step") as Step) || "basic";
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    channel: "Broker",
    licence: "",
    email: "",
    mobile: "",
    businessAddress: "",
    emergencyName: "",
    relationshipType: "Parent",
    emergencyContact: "",
    emergencyAddress: "",
    documentName: "",
  });

  const idx = STEPS.indexOf(step);
  const next = STEPS[idx + 1];
  const prev = STEPS[idx - 1];

  function go(nextStep: Step) {
    router.push(`/sample/intermediaries/new?step=${nextStep}`);
  }

  function continueStep() {
    setError("");
    if (step === "basic" && !form.displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (step === "contact" && !form.email.trim()) {
      setError("Work email is required.");
      return;
    }
    if (step === "emergency") {
      if (!form.emergencyName.trim() || !form.emergencyContact.trim()) {
        setError("Emergency Name and Emergency Contact Detail are required.");
        return;
      }
    }
    if (next) go(next);
  }

  const summary = useMemo(
    () => [
      ["Display name", form.displayName || "—"],
      ["Channel", form.channel],
      ["Emergency Name", form.emergencyName || "—"],
      ["Relationship Type", form.relationshipType],
      ["Emergency Contact Detail", form.emergencyContact || "—"],
      ["Emergency Address", form.emergencyAddress || "(blank)"],
    ],
    [form],
  );

  return (
    <SampleShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Add new intermediary</h2>
          <p className="text-sm text-white/60">Step {idx + 1} of {STEPS.length}: {step}</p>
        </div>
        <Button variant="outline" className="border-white/20 bg-transparent text-white" onClick={() => setLeaveOpen(true)}>
          Leave wizard
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className={`rounded-full px-3 py-1 text-xs capitalize ${s === step ? "bg-teal-400 text-black" : "bg-white/10 text-white/70"}`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      ) : null}

      {step === "basic" ? (
        <section className="grid max-w-xl gap-4">
          <Field label="Code" id="code" value="IM-NEW" readOnly />
          <Field label="Display name" id="display-name" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
          <div className="space-y-2">
            <Label className="text-white/80" htmlFor="channel">Channel</Label>
            <select
              id="channel"
              className="h-8 w-full rounded-lg border border-white/15 bg-[#141b2d] px-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option>Broker</option>
              <option>Bancassurance</option>
              <option>Agency</option>
            </select>
          </div>
          <Field label="Licence number" id="licence" value={form.licence} onChange={(v) => setForm({ ...form, licence: v })} />
        </section>
      ) : null}

      {step === "contact" ? (
        <section className="grid max-w-xl gap-4">
          <Field label="Work email" id="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Mobile" id="mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
          <Field label="Business address" id="business-address" value={form.businessAddress} onChange={(v) => setForm({ ...form, businessAddress: v })} />
        </section>
      ) : null}

      {step === "emergency" ? (
        <section className="grid max-w-xl gap-4">
          <h3 className="text-lg font-medium">Preferences / Emergency Details</h3>
          <Field label="Emergency Name" id="emergency-name" value={form.emergencyName} onChange={(v) => setForm({ ...form, emergencyName: v })} />
          <div className="space-y-2">
            <Label className="text-white/80" htmlFor="relationship-type">Relationship Type</Label>
            <select
              id="relationship-type"
              className="h-8 w-full rounded-lg border border-white/15 bg-[#141b2d] px-2 text-sm"
              value={form.relationshipType}
              onChange={(e) => setForm({ ...form, relationshipType: e.target.value })}
            >
              {RELATIONSHIP_UI.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <Field
            label="Emergency Contact Detail"
            id="emergency-contact"
            value={form.emergencyContact}
            onChange={(v) => setForm({ ...form, emergencyContact: v })}
          />
          <div className="space-y-2">
            <Label className="text-white/80" htmlFor="emergency-address">
              Emergency Address <span className="text-red-400">*</span>
            </Label>
            <Input
              id="emergency-address"
              value={form.emergencyAddress}
              onChange={(e) => setForm({ ...form, emergencyAddress: e.target.value })}
              className="border-white/15 bg-[#141b2d] text-white"
            />
            <p className="text-xs text-white/40">UI marks this required; the specification says optional.</p>
          </div>
        </section>
      ) : null}

      {step === "documents" ? (
        <section className="grid max-w-xl gap-4">
          <Field label="Document name (optional)" id="document-name" value={form.documentName} onChange={(v) => setForm({ ...form, documentName: v })} />
        </section>
      ) : null}

      {step === "review" ? (
        <section className="max-w-xl space-y-2 rounded-lg border border-white/10 bg-[#141b2d] p-4 text-sm">
          {summary.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <span className="text-white/50">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mt-8 flex gap-2">
        {prev ? (
          <Button variant="outline" className="border-white/20 bg-transparent text-white" onClick={() => go(prev)}>
            Back
          </Button>
        ) : null}
        {next ? (
          <Button onClick={continueStep}>Continue</Button>
        ) : (
          <Button
            onClick={async () => {
              await fetch("/api/sample/intermediaries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  displayName: form.displayName,
                  channel: form.channel,
                  licence: form.licence,
                  email: form.email,
                  mobile: form.mobile,
                  businessAddress: form.businessAddress,
                  status: "Active",
                  emergency: {
                    name: form.emergencyName,
                    relationshipType: form.relationshipType,
                    contact: form.emergencyContact,
                    address: form.emergencyAddress,
                  },
                }),
              });
              router.push("/sample/intermediaries");
            }}
          >
            Save intermediary
          </Button>
        )}
      </div>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="bg-[#141b2d] text-white">
          <DialogHeader>
            <DialogTitle>Leave wizard?</DialogTitle>
            <DialogDescription className="text-white/60">
              Unsaved intermediary details will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="border-white/20 bg-transparent text-white" onClick={() => setLeaveOpen(false)}>
              Stay
            </Button>
            <Button onClick={() => router.push("/sample/intermediaries")}>Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SampleShell>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  id: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white/80">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className="border-white/15 bg-[#141b2d] text-white"
      />
    </div>
  );
}

export default function NewIntermediaryPage() {
  return (
    <Suspense>
      <WizardInner />
    </Suspense>
  );
}
