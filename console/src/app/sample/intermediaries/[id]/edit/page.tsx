"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SampleShell } from "@/components/sample-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RELATIONSHIP_UI, type Intermediary } from "@/lib/sample-store";

export default function EditIntermediaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Intermediary | null>(null);

  useEffect(() => {
    fetch(`/api/sample/intermediaries/${id}`)
      .then((r) => r.json())
      .then(setItem);
  }, [id]);

  if (!item) {
    return (
      <SampleShell>
        <p>Loading…</p>
      </SampleShell>
    );
  }

  return (
    <SampleShell>
      <h2 className="mb-6 text-2xl font-semibold">Manage {item.displayName}</h2>
      <form
        className="grid max-w-xl gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await fetch(`/api/sample/intermediaries/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          });
          router.push(`/sample/intermediaries/${id}`);
        }}
      >
        <Field label="Display name" id="display-name" value={item.displayName} onChange={(v) => setItem({ ...item, displayName: v })} />
        <h3 className="text-lg font-medium">Preferences / Emergency Details</h3>
        <Field
          label="Emergency Name"
          id="emergency-name"
          value={item.emergency?.name ?? ""}
          onChange={(v) => setItem({ ...item, emergency: { ...(item.emergency ?? { relationshipType: "Parent", contact: "", address: "" }), name: v } })}
        />
        <div className="space-y-2">
          <Label htmlFor="relationship-type" className="text-white/80">Relationship Type</Label>
          <select
            id="relationship-type"
            className="h-8 w-full rounded-lg border border-white/15 bg-[#141b2d] px-2 text-sm"
            value={item.emergency?.relationshipType ?? "Parent"}
            onChange={(e) =>
              setItem({
                ...item,
                emergency: {
                  ...(item.emergency ?? { name: "", contact: "", address: "" }),
                  relationshipType: e.target.value as never,
                },
              })
            }
          >
            {RELATIONSHIP_UI.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <Field
          label="Emergency Contact Detail"
          id="emergency-contact"
          value={item.emergency?.contact ?? ""}
          onChange={(v) => setItem({ ...item, emergency: { ...(item.emergency ?? { name: "", relationshipType: "Parent", address: "" }), contact: v } })}
        />
        <Field
          label="Emergency Address"
          id="emergency-address"
          value={item.emergency?.address ?? ""}
          onChange={(v) => setItem({ ...item, emergency: { ...(item.emergency ?? { name: "", relationshipType: "Parent", contact: "" }), address: v } })}
        />
        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          <Button type="button" variant="outline" className="border-white/20 bg-transparent text-white" onClick={() => router.push(`/sample/intermediaries/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </SampleShell>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-white/80">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="border-white/15 bg-[#141b2d] text-white" />
    </div>
  );
}
